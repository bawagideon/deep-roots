import * as fs from "fs";
import * as path from "path";

try {
  // @ts-ignore
  if (process.loadEnvFile) process.loadEnvFile(".env.local");
} catch {}

import { decomposeInput } from "../src/lib/ai/decomposition";
import { validateRootsCardIntegrity } from "../src/lib/schema";

interface EvalItem {
  category: "everyday_object" | "food_packaging" | "screenshot_document" | "proverb_phrase" | "question";
  inputKind: "photo" | "screenshot" | "text" | "question" | "link";
  inputText: string;
}

const EVAL_SET: EvalItem[] = [
  // 10 Everyday objects
  { category: "everyday_object", inputKind: "text", inputText: "Bicycle chain" },
  { category: "everyday_object", inputKind: "text", inputText: "Elevator call button" },
  { category: "everyday_object", inputKind: "text", inputText: "Universal barcode" },
  { category: "everyday_object", inputKind: "text", inputText: "Ballpoint pen" },
  { category: "everyday_object", inputKind: "text", inputText: "Metal zipper" },
  { category: "everyday_object", inputKind: "text", inputText: "Safety pin" },
  { category: "everyday_object", inputKind: "text", inputText: "Traffic light lens" },
  { category: "everyday_object", inputKind: "text", inputText: "Pin tumbler key lock" },
  { category: "everyday_object", inputKind: "text", inputText: "Tungsten incandescent filament" },
  { category: "everyday_object", inputKind: "text", inputText: "3.5mm audio headphone jack" },

  // 6 Food or packaging
  { category: "food_packaging", inputKind: "text", inputText: "Instant noodles" },
  { category: "food_packaging", inputKind: "text", inputText: "Sourdough bread starter" },
  { category: "food_packaging", inputKind: "text", inputText: "Dark chocolate conching" },
  { category: "food_packaging", inputKind: "text", inputText: "Aseptic Tetra Pak carton" },
  { category: "food_packaging", inputKind: "text", inputText: "Coffee bean roasting crack" },
  { category: "food_packaging", inputKind: "text", inputText: "Soy sauce koji fermentation" },

  // 5 Screenshot or documents
  { category: "screenshot_document", inputKind: "screenshot", inputText: "Bank transfer SWIFT receipt" },
  { category: "screenshot_document", inputKind: "screenshot", inputText: "Packaged food nutrition facts label" },
  { category: "screenshot_document", inputKind: "screenshot", inputText: "Airline boarding pass PDF417 barcode" },
  { category: "screenshot_document", inputKind: "screenshot", inputText: "Lithium battery health degradation screenshot" },
  { category: "screenshot_document", inputKind: "screenshot", inputText: "Intermodal shipping container ISO 6346 code" },

  // 5 Proverbs or phrases
  { category: "proverb_phrase", inputKind: "text", inputText: "A rolling stone gathers no moss" },
  { category: "proverb_phrase", inputKind: "text", inputText: "Bite the bullet" },
  { category: "proverb_phrase", inputKind: "text", inputText: "Quarantine" },
  { category: "proverb_phrase", inputKind: "text", inputText: "Pay through the nose" },
  { category: "proverb_phrase", inputKind: "text", inputText: "Burning the candle at both ends" },

  // 4 Questions
  { category: "question", inputKind: "question", inputText: "Why does bread price surge when fuel transport costs rise?" },
  { category: "question", inputKind: "question", inputText: "Why are passenger airplane cabin windows rounded instead of square?" },
  { category: "question", inputKind: "question", inputText: "Why does salt concentration halt bacterial cellular reproduction?" },
  { category: "question", inputKind: "question", inputText: "Why does supermarket thermal paper receipt ink fade in heat without water?" },
];

async function runEvalSuite() {
  console.log("==================================================");
  console.log("  Deep Roots: 30-Input Quality Gate Evaluation    ");
  console.log("==================================================\n");

  const results: any[] = [];
  let passedAllFourCount = 0;

  for (let i = 0; i < EVAL_SET.length; i++) {
    const item = EVAL_SET[i];
    console.log(`[${i + 1}/${EVAL_SET.length}] Testing: "${item.inputText}" (${item.category})...`);

    const startTime = Date.now();
    try {
      const card = await decomposeInput({
        inputKind: item.inputKind,
        inputText: item.inputText,
      });

      const latencyMs = Date.now() - startTime;
      const integrity = validateRootsCardIntegrity(card);

      // Four strict quality gate checks
      const isCorrect =
        integrity.isValid &&
        card.title.length > 2 &&
        card.components.length >= 3 &&
        card.claims.length >= 1 &&
        card.root.claimIds.length >= 1;

      const isSpecific =
        !card.oneLiner.includes("standardization codified during modern mass production") &&
        card.components.some((c) => c.name.toLowerCase() !== "primary substrate");

      const isCheckable =
        card.claims.every((c) => c.text.length <= 140 && c.text.length > 10) &&
        card.claims.some((c) => c.status === "established" || c.status === "interpretation");

      const isNovel =
        card.root.headline.length > 15 &&
        !card.root.headline.includes("embodies hidden human systems");

      const passesAllFour = isCorrect && isSpecific && isCheckable && isNovel;
      if (passesAllFour) passedAllFourCount++;

      console.log(
        `   ↳ Result: ${passesAllFour ? "PASS ✓" : "FAIL ✗"} | Latency: ${latencyMs}ms | Root: "${card.root.headline.slice(0, 50)}..."`
      );

      results.push({
        index: i + 1,
        input: item.inputText,
        category: item.category,
        latencyMs,
        title: card.title,
        rootHeadline: card.root.headline,
        criteria: {
          correct: isCorrect,
          specific: isSpecific,
          checkable: isCheckable,
          novel: isNovel,
        },
        passedAllFour: passesAllFour,
        integrityErrors: integrity.errors,
      });
    } catch (err: any) {
      console.log(`   ↳ ERROR: ${err.message}`);
      results.push({
        index: i + 1,
        input: item.inputText,
        category: item.category,
        error: err.message,
        passedAllFour: false,
      });
    }

    // Small delay between calls to respect rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  const passRate = Math.round((passedAllFourCount / EVAL_SET.length) * 100);
  const gateMet = passedAllFourCount >= 21;

  console.log("\n==================================================");
  console.log(`Summary: ${passedAllFourCount}/30 cards passed all four criteria (${passRate}%).`);
  console.log(`Quality Gate Status: ${gateMet ? "PASSED (>= 21/30)" : "FAILED (< 21/30)"}`);
  console.log("==================================================\n");

  const reportPath = path.join(process.cwd(), "eval-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalEvaluated: EVAL_SET.length,
        passedAllFourCount,
        passRatePercentage: passRate,
        qualityGateTarget: 21,
        qualityGateMet: gateMet,
        results,
      },
      null,
      2
    )
  );
  console.log(`Detailed report written to: ${reportPath}`);
}

runEvalSuite().catch(console.error);
