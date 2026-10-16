import { Claim, ClaimSource } from "@/types/roots";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface WikiSearchResult {
  title: string;
  pageid: number;
  snippet: string;
}

interface RetrievedCandidate {
  title: string;
  url: string;
  extract: string;
}

/**
 * Searches Wikipedia's public API to retrieve canonical reference articles and extracts.
 */
async function searchWikipediaForCandidate(claimText: string): Promise<RetrievedCandidate | null> {
  try {
    const terms = claimText
      .replace(/[^\w\s]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (terms.length === 0) return null;
    const query = terms.join(" ");

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*&utf8=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "DeepRoots/2.0 (https://deeproots.app; contact@deeproots.app)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const results: WikiSearchResult[] = data?.query?.search || [];

    if (results.length === 0) return null;

    // Fetch canonical extract for the top match
    const best = results[0];
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      best.title.replace(/\s+/g, "_")
    )}`;

    const sumRes = await fetch(summaryUrl, {
      headers: { "User-Agent": "DeepRoots/2.0 (https://deeproots.app)" },
    });

    if (!sumRes.ok) return null;
    const summary = await sumRes.json();

    if (summary.content_urls?.desktop?.page && summary.extract) {
      return {
        title: summary.title,
        url: summary.content_urls.desktop.page,
        extract: summary.extract,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * LLM-Powered Fact Verification:
 * Asks the language model to assess whether the reference passage factually supports,
 * contradicts, or lacks sufficient proof for the specific claim.
 */
async function verifyPassageWithAI(
  claimText: string,
  passage: string
): Promise<{
  status: "supported" | "contradicted" | "insufficient";
  excerpt: string;
} | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 250,
      },
    });

    const prompt = `You are a rigorous, objective academic fact checker.
Claim to evaluate: "${claimText}"
Reference passage: "${passage}"

Task: Does the reference passage factually substantiate the specific claim?
Output valid JSON only with keys "status" and "excerpt":
{
  "status": "supported" | "contradicted" | "insufficient",
  "excerpt": "the exact sentence from the reference passage that demonstrates this status"
}
Rules:
- "supported": The passage directly affirms the factual assertion of the claim.
- "contradicted": The passage directly conflicts with or disproves the claim.
- "insufficient": The passage is related or on-topic, but does not definitively prove the claim assertion.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await model.generateContent(prompt);
    clearTimeout(timeout);

    const text = res.response.text();
    const parsed = JSON.parse(text);

    if (["supported", "contradicted", "insufficient"].includes(parsed.status)) {
      return {
        status: parsed.status,
        excerpt: parsed.excerpt || passage.slice(0, 160),
      };
    }
  } catch (err) {
    // Model call timed out or failed; fallback safely
  }

  return null;
}

/**
 * Deterministic Filter & Fallback Evaluator:
 * NOTE: As per strict audit guidelines, a pure keyword match ALONE must NEVER earn "supported".
 * If AI evaluation is unavailable, keyword matches produce "insufficient" (evidence on-topic,
 * pending verification), contradiction triggers "contradicted", and no matches produce "unverified".
 */
function evaluatePassageSupportHeuristic(
  claimText: string,
  extract: string
): {
  status: "contradicted" | "insufficient" | "unverified";
  relevantExcerpt: string;
} {
  const normExtract = extract.toLowerCase();
  const normClaim = claimText.toLowerCase();

  const keywords = normClaim
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "were", "been", "have", "they"].includes(w));

  const sentences = extract.split(/(?<=[.?!])\s+/);
  let bestSentence = sentences[0] || extract;
  let maxSentenceMatches = 0;

  for (const sentence of sentences) {
    const sNorm = sentence.toLowerCase();
    const matches = keywords.filter((kw) => sNorm.includes(kw)).length;
    if (matches > maxSentenceMatches) {
      maxSentenceMatches = matches;
      bestSentence = sentence;
    }
  }

  // Check explicit contradiction cues
  const contradictionWords = ["disproven", "myth", "incorrectly", "contrary to", "falsely attributed", "no evidence that"];
  const hasContradiction = contradictionWords.some((w) => normExtract.includes(w) && keywords.some((kw) => normExtract.includes(kw)));

  if (hasContradiction) {
    return {
      status: "contradicted",
      relevantExcerpt: bestSentence.trim(),
    };
  }

  if (maxSentenceMatches >= 2) {
    // Keyword match alone can only attain "insufficient" (related, but unproven)
    return {
      status: "insufficient",
      relevantExcerpt: bestSentence.trim(),
    };
  }

  return {
    status: "unverified",
    relevantExcerpt: bestSentence.trim(),
  };
}

/**
 * Pass 2 Evidence Evaluator:
 * Queries external knowledge sources, extracts authoritative passages, and evaluates
 * whether the text reliably supports, contradicts, or is insufficient to back the claim.
 */
export async function verifyClaimsPass2(claims: Claim[]): Promise<Claim[]> {
  const verified: Claim[] = [];

  for (const claim of claims) {
    const candidate = await searchWikipediaForCandidate(claim.text);

    if (candidate) {
      // 1. Try authoritative AI evaluation first
      let evaluation = await verifyPassageWithAI(claim.text, candidate.extract);

      // 2. Fall back to heuristic if AI unavailable (never awards "supported" on keyword alone)
      if (!evaluation) {
        evaluation = evaluatePassageSupportHeuristic(claim.text, candidate.extract) as any;
      }

      const source: ClaimSource = {
        title: `${candidate.title} — Canonical Reference`,
        url: candidate.url,
        retrievedAt: new Date().toISOString(),
        excerpt: evaluation?.excerpt || candidate.extract.slice(0, 160),
      };

      if (evaluation?.status === "supported") {
        verified.push({
          ...claim,
          status: claim.status === "open_question" ? "open_question" : "established",
          evidenceStatus: "supported",
          sources: [source],
        });
      } else if (evaluation?.status === "contradicted") {
        verified.push({
          ...claim,
          status: "open_question",
          evidenceStatus: "contradicted",
          sources: [source],
        });
      } else {
        verified.push({
          ...claim,
          status: "interpretation",
          evidenceStatus: "insufficient",
          sources: [source],
        });
      }
    } else {
      // No reference found: mark as unverified
      verified.push({
        ...claim,
        status: claim.status === "established" ? "interpretation" : claim.status,
        evidenceStatus: "unverified",
        sources: [],
      });
    }
  }

  return verified;
}
