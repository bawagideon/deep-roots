import { Claim, ClaimSource } from "@/types/roots";

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
    // Extract key entities or terms (first 6 words or main noun phrases)
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
  } catch (err) {
    return null;
  }
}

/**
 * Semantic & Entity Verifier:
 * Assesses whether the retrieved excerpt actually substantiates the claim assertion,
 * rather than simply sharing a title.
 */
function evaluatePassageSupport(
  claimText: string,
  extract: string
): {
  status: "supported" | "contradicted" | "insufficient";
  relevantExcerpt: string;
} {
  const normExtract = extract.toLowerCase();
  const normClaim = claimText.toLowerCase();

  // Extract core keywords from claim
  const keywords = normClaim
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["this", "that", "with", "from", "were", "been", "have", "they"].includes(w));

  if (keywords.length === 0) {
    return {
      status: "insufficient",
      relevantExcerpt: extract.slice(0, 200),
    };
  }

  // Count keyword overlaps
  const matchedKeywords = keywords.filter((kw) => normExtract.includes(kw));
  const overlapRatio = matchedKeywords.length / keywords.length;

  // Find most relevant sentence in the extract
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

  // Check for contradiction cues
  const contradictionWords = ["disproven", "myth", "incorrectly", "contrary to", "falsely attributed", "no evidence that"];
  const hasContradiction = contradictionWords.some((w) => normExtract.includes(w) && keywords.some((kw) => normExtract.includes(kw)));

  if (hasContradiction) {
    return {
      status: "contradicted",
      relevantExcerpt: bestSentence.trim(),
    };
  }

  // Requires at least 50% keyword overlap AND at least 2 distinct key entity matches in the passage
  if (overlapRatio >= 0.45 && maxSentenceMatches >= 2) {
    return {
      status: "supported",
      relevantExcerpt: bestSentence.trim(),
    };
  }

  return {
    status: "insufficient",
    relevantExcerpt: bestSentence.trim(),
  };
}

/**
 * Pass 2 Evidence Evaluator:
 * For each claim, queries knowledge sources, extracts relevant passages, and evaluates
 * whether the text supports, contradicts, or is insufficient to back the claim.
 * Downgrades unbacked claims to 'interpretation' or 'open_question' and sets evidenceStatus.
 */
export async function verifyClaimsPass2(claims: Claim[]): Promise<Claim[]> {
  const verified: Claim[] = [];

  for (const claim of claims) {
    // 1. If claim already has a verified excerpt and source, re-verify status
    if (claim.sources && claim.sources.length > 0 && claim.sources[0].excerpt) {
      const evaluation = evaluatePassageSupport(claim.text, claim.sources[0].excerpt);
      verified.push({
        ...claim,
        evidenceStatus: evaluation.status,
        status: evaluation.status === "supported" ? claim.status : "interpretation",
      });
      continue;
    }

    // 2. Retrieve real candidate reference
    const candidate = await searchWikipediaForCandidate(claim.text);

    if (candidate) {
      const evaluation = evaluatePassageSupport(claim.text, candidate.extract);

      const source: ClaimSource = {
        title: `${candidate.title} — Reference`,
        url: candidate.url,
        retrievedAt: new Date().toISOString(),
        excerpt: evaluation.relevantExcerpt,
      };

      if (evaluation.status === "supported") {
        verified.push({
          ...claim,
          status: claim.status === "open_question" ? "open_question" : "established",
          evidenceStatus: "supported",
          sources: [source],
        });
      } else if (evaluation.status === "contradicted") {
        verified.push({
          ...claim,
          status: "open_question",
          evidenceStatus: "contradicted",
          sources: [source],
        });
      } else {
        // Insufficient support from passage: downgrade unbacked established claim
        verified.push({
          ...claim,
          status: "interpretation",
          evidenceStatus: "insufficient",
          sources: [source],
        });
      }
    } else {
      // No reference found: mark as unverified and downgrade
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
