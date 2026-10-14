import { lookup } from "dns/promises";

function isPrivateIp(ip: string): boolean {
  if (ip === "localhost" || ip === "::1") return true;

  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link local / AWS metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0
    if (parts[0] === 0) return true;
  }

  // IPv6 link local / private
  if (ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd00:")) {
    return true;
  }

  return false;
}

export async function safeFetchUrl(rawUrl: string): Promise<{
  title: string;
  extractedText: string;
  finalUrl: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost or private domain patterns immediately
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "169.254.169.254"
  ) {
    throw new Error("Access to local or private networks is blocked");
  }

  // Resolve DNS to verify IP address is not private (anti-SSRF)
  try {
    const address = await lookup(hostname);
    if (isPrivateIp(address.address)) {
      throw new Error("Access to private IP addresses is blocked");
    }
  } catch (err: any) {
    if (err.message?.includes("blocked")) throw err;
    throw new Error(`Unable to resolve host: ${hostname}`);
  }

  // Fetch with strict timeout and size cap
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "DeepRootsBot/1.0 (+https://deeproots.app)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status} when accessing URL`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("URL must point to a readable HTML or text document");
    }

    const html = await response.text();
    // Cap length to 100KB for text analysis
    const clipped = html.slice(0, 100000);

    // Extract title
    const titleMatch = clipped.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsed.hostname;

    // Strip scripts, styles, and tags for clean text content
    const cleanText = clipped
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return {
      title,
      extractedText: cleanText,
      finalUrl: response.url || rawUrl,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
