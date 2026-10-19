import { lookup } from "dns/promises";
import http from "http";
import https from "https";

/**
 * Validates whether an IP address belongs to private, loopback, link-local,
 * carrier-grade NAT, documentation, multicast, or cloud metadata ranges.
 * Handles IPv4 (decimal, octal, hex, and single-integer), IPv6, and IPv4-mapped IPv6.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  let cleanIp = ip.toLowerCase().trim().replace(/^\[|\]$/g, "");

  // 1. Single integer IPv4 address (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(cleanIp)) {
    const num = Number(cleanIp);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      const a = (num >>> 24) & 255;
      const b = (num >>> 16) & 255;
      const c = (num >>> 8) & 255;
      const d = num & 255;
      return isPrivateOrReservedIp(`${a}.${b}.${c}.${d}`);
    }
    return true; // Invalid integer IP treated as unsafe
  }

  // 2. IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith("::ffff:") || cleanIp.startsWith("0:0:0:0:0:ffff:")) {
    const remainder = cleanIp.includes("ffff:") ? cleanIp.split("ffff:")[1] : cleanIp;
    if (remainder.includes(".")) {
      return isPrivateOrReservedIp(remainder);
    } else if (remainder.includes(":")) {
      const hexParts = remainder.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!isNaN(hi) && !isNaN(lo)) {
          const a = (hi >> 8) & 255;
          const b = hi & 255;
          const c = (lo >> 8) & 255;
          const d = lo & 255;
          return isPrivateOrReservedIp(`${a}.${b}.${c}.${d}`);
        }
      }
    }
    return true;
  }

  // 3. 6to4 addresses (2002::/16) embedding IPv4 in next 32 bits
  if (cleanIp.startsWith("2002:")) {
    const parts = cleanIp.split(":");
    if (parts.length >= 3) {
      const hi = parseInt(parts[1], 16);
      const lo = parseInt(parts[2], 16);
      if (!isNaN(hi) && !isNaN(lo)) {
        const a = (hi >> 8) & 255;
        const b = hi & 255;
        const c = (lo >> 8) & 255;
        const d = lo & 255;
        if (isPrivateOrReservedIp(`${a}.${b}.${c}.${d}`)) return true;
      }
    }
  }

  // 4. Standard IPv6 checks
  if (cleanIp.includes(":")) {
    if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true; // Loopback
    if (cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true; // Unspecified
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIp)) return true; // Link-local (fe80::/10)
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp)) return true; // Unique local (fc00::/7)
    if (cleanIp.startsWith("2001:db8:")) return true; // Documentation
    if (cleanIp.startsWith("ff")) return true; // Multicast
    if (cleanIp.startsWith("100::")) return true; // Discard prefix
    return false;
  }

  // 5. IPv4 checks (supporting decimal, hex 0x, and octal 0)
  const parts = cleanIp.split(".");
  if (parts.length !== 4) {
    return true; // Malformed address treated as unsafe
  }

  const parsedParts = parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      return parseInt(trimmed, 16);
    }
    if (trimmed.startsWith("0") && trimmed.length > 1 && !trimmed.includes("8") && !trimmed.includes("9")) {
      return parseInt(trimmed, 8);
    }
    return parseInt(trimmed, 10);
  });

  if (parsedParts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed / overflow
  }

  const [a, b, c] = parsedParts;

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
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1 Documentation)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 Relay Anycast)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;
  // 255.255.255.255 (Broadcast)
  if (cleanIp === "255.255.255.255") return true;

  return false;
}

/**
 * Validates destination host and resolves IP authoritatively.
 * Returns the pinned safe IP and IP family.
 */
async function resolveAndValidateHost(hostname: string): Promise<{ ip: string; family: number }> {
  const cleanHost = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");

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
    return {
      ip: cleanHost,
      family: cleanHost.includes(":") ? 6 : 4,
    };
  }

  try {
    const addresses = await lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Unable to resolve host: ${cleanHost}`);
    }

    // Verify EVERY resolved address against private/reserved ranges
    for (const record of addresses) {
      if (isPrivateOrReservedIp(record.address)) {
        throw new Error("Access to private IP addresses is blocked");
      }
    }

    return {
      ip: addresses[0].address,
      family: addresses[0].family,
    };
  } catch (err: any) {
    if (err.message?.includes("blocked")) throw err;
    throw new Error(`DNS resolution failed for ${cleanHost}: ${err.message}`);
  }
}

/**
 * Executes an HTTP or HTTPS request using a pinned IP address.
 * Bypasses OS DNS lookup on socket connect to prevent DNS-rebinding attacks (TOCTOU).
 * Enforces a strict response body byte limit (default 1MB) and timeout.
 */
function fetchWithPinnedIp(
  parsedUrl: URL,
  pinnedIp: string,
  pinnedFamily: number,
  timeoutMs: number = 6000,
  maxBytes: number = 1048576
): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHttps ? 443 : 80);

    const options: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port,
      path: (parsedUrl.pathname || "/") + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent": "DeepRootsBot/2.0 (+https://deeproots.app)",
        Accept: "text/html,application/xhtml+xml,text/plain",
        Host: parsedUrl.host,
      },
      // PINNED IP: never re-query DNS on connect, completely preventing DNS rebinding TOCTOU!
      lookup: (_hostname, _opts, callback) => {
        callback(null, pinnedIp, pinnedFamily);
      },
      servername: parsedUrl.hostname, // Preserves TLS SNI for certificate validation
      timeout: timeoutMs,
    };

    let settled = false;

    const req = transport.request(options, (res) => {
      const statusCode = res.statusCode || 500;
      let totalBytes = 0;
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          settled = true;
          req.destroy(new Error(`Response size exceeded maximum allowable limit of ${maxBytes} bytes`));
        } else {
          chunks.push(chunk);
        }
      });

      res.on("end", () => {
        if (settled) return;
        settled = true;
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode,
          headers: res.headers,
          body: bodyBuffer.toString("utf-8"),
        });
      });

      res.on("error", (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      });
    });

    req.on("timeout", () => {
      if (settled) return;
      settled = true;
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });

    req.end();
  });
}

/**
 * Hardened Safe URL Fetcher:
 * 1. Protocol restriction (HTTP/HTTPS only).
 * 2. DNS check on all resolved IPs against private/reserved ranges.
 * 3. DNS Rebinding Immunity: Pins resolved IP in connection socket.
 * 4. Manual redirect hops (max 3) with full validation at every hop.
 * 5. True streaming response cap (1MB max).
 * 6. Strict 6-second timeout.
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

    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      throw new Error("Connections are restricted to standard web ports (80, 443)");
    }

    // Verify destination IP safety and retrieve pinned IP before connecting
    const { ip: pinnedIp, family: pinnedFamily } = await resolveAndValidateHost(parsed.hostname);

    try {
      const response = await fetchWithPinnedIp(parsed, pinnedIp, pinnedFamily, 6000, 1048576);

      // Handle Redirects safely
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers["location"];
        if (!location) {
          throw new Error("Redirect response missing location header");
        }

        hopCount++;
        if (hopCount > maxHops) {
          throw new Error("Too many redirects (maximum 3 allowed)");
        }

        const locationStr = Array.isArray(location) ? location[0] : location;
        currentUrl = new URL(locationStr, parsed.toString()).toString();
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP Error ${response.statusCode} when accessing URL`);
      }

      const contentType = (response.headers["content-type"] as string) || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error("URL must point to a readable HTML or text document");
      }

      const html = response.body;

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
    } catch (err: any) {
      throw err;
    }
  }

  throw new Error("Failed to retrieve URL within redirect limits");
}
