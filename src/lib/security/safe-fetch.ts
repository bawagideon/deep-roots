import { lookup } from "dns/promises";

/**
 * Validates whether an IP address belongs to private, loopback, link-local,
 * carrier-grade NAT, documentation, or cloud metadata ranges.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  const cleanIp = ip.toLowerCase().trim();

  // Normalize IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith("::ffff:")) {
    const v4Part = cleanIp.substring(7);
    if (v4Part.includes(".")) {
      return isPrivateOrReservedIp(v4Part);
    }
  }

  // IPv6 checks
  if (cleanIp.includes(":")) {
    if (cleanIp === "::1" || cleanIp === "::") return true;
    if (cleanIp.startsWith("fe80:")) return true; // Link-local
    if (cleanIp.startsWith("fc00:") || cleanIp.startsWith("fd00:")) return true; // Unique local
    if (cleanIp.startsWith("2001:db8:")) return true; // Documentation
    return false;
  }

  // IPv4 checks
  const parts = cleanIp.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed address treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1 Documentation)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;
  // 255.255.255.255 (Broadcast)
  if (cleanIp === "255.255.255.255") return true;

  return false;
}

/**
 * Validates a destination hostname via DNS. Checks ALL resolved IP addresses.
 */
async function validateDestinationHost(hostname: string): Promise<void> {
  const cleanHost = hostname.toLowerCase().trim();

  // Block localhost or common private suffixes immediately
  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal") ||
    cleanHost.endsWith(".lan") ||
    cleanHost === "169.254.169.254"
  ) {
    throw new Error("Access to private or internal network destinations is blocked");
  }

  // If host is already an IP, test directly
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanHost) || cleanHost.includes(":")) {
    if (isPrivateOrReservedIp(cleanHost)) {
      throw new Error("Access to private IP addresses is blocked");
    }
    return;
  }

  try {
    const addresses = await lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Unable to resolve host: ${cleanHost}`);
    }

    for (const record of addresses) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new Error("Access to private IP addresses is blocked");
      }
    }
  } catch (err: any) {
    if (err.message?.includes("blocked")) throw err;
    throw new Error(`DNS resolution failed for ${cleanHost}: ${err.message}`);
  }
}

/**
 * Streams response body with an enforced hard byte cap.
 * Never reads beyond maxBytes into server memory.
 */
async function readStreamWithByteLimit(
  response: Response,
  maxBytes: number = 1048576 // 1MB hard limit
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let totalBytes = 0;
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        reader.cancel("Payload exceeded allowable byte limit");
        throw new Error(`Response size exceeded maximum allowable limit of ${maxBytes} bytes`);
      }

      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode(); // Flush stream
  } finally {
    reader.releaseLock();
  }

  return result;
}

/**
 * Hardened Safe URL Fetcher:
 * 1. Protocol restriction (HTTP/HTTPS only).
 * 2. DNS check on all resolved IPs against private/reserved ranges.
 * 3. Manual redirect hops (max 3) with full validation at every hop.
 * 4. True streaming response cap (1MB max).
 * 5. Strict 6-second timeout.
 */
export async function safeFetchUrl(
  rawUrl: string,
  maxHops: number = 3
): Promise<{
  title: string;
  extractedText: string;
  finalUrl: string;
}> {
  let currentUrl = rawUrl;
  let hopCount = 0;

  while (hopCount <= maxHops) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error("Invalid URL format");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS URLs are allowed");
    }

    // Verify destination IP safety before opening connection
    await validateDestinationHost(parsed.hostname);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "DeepRootsBot/2.0 (+https://deeproots.app)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
        redirect: "manual", // Prevent automatic unvalidated redirects!
      });

      // Handle Redirects safely
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response missing location header");
        }

        hopCount++;
        if (hopCount > maxHops) {
          throw new Error("Too many redirects (maximum 3 allowed)");
        }

        // Resolve relative redirect locations
        currentUrl = new URL(location, parsed.toString()).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} when accessing URL`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error("URL must point to a readable HTML or text document");
      }

      // Stream body with strict 1MB byte cap
      const html = await readStreamWithByteLimit(response, 1048576);

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : parsed.hostname;

      // Clean HTML tags and scripts
      const cleanText = html
        .slice(0, 100000)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      return {
        title,
        extractedText: cleanText,
        finalUrl: parsed.toString(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Failed to retrieve URL within redirect limits");
}
