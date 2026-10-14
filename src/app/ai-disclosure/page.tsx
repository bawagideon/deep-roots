"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Search, HelpCircle } from "lucide-react";

export default function AIDisclosurePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen px-6 pt-6 pb-16 bg-[#0E1411]">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#151D18] border border-[#2A372F] flex items-center justify-center text-[#EAF1EC] hover:bg-[#1D2822] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[20px] font-bold text-[#EAF1EC]">
          AI Transparency & Verification
        </h1>
      </div>

      <div className="prose prose-invert max-w-none text-[#9AAAA0] text-[14px] leading-relaxed flex flex-col gap-6">
        <div className="p-4 bg-[#151D18] border border-[#2A372F] rounded-[18px]">
          <h2 className="text-[16px] font-bold text-[#FFC857] mb-1">
            Our Verification Philosophy
          </h2>
          <p className="text-[13px] text-[#EAF1EC]">
            AI models can produce false etymologies, historical confusions, and
            invented scientific claims. Deep Roots does not present AI output as
            unquestionable truth. Every card is decomposed into checkable claims
            and cross-examined against public reference sources.
          </p>
        </div>

        <section>
          <h3 className="text-[16px] font-bold text-[#EAF1EC] mb-2">
            1. The Two-Pass Pipeline
          </h3>
          <p>
            When you scan or submit an input:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Pass 1 (Decomposition):</strong> The model breaks the object
              into components, cultural layers, and checkable claims with strict
              Zod schema validation.
            </li>
            <li>
              <strong>Pass 2 (Evidence & Verification):</strong> Claims are queried
              against Wikipedia and public knowledge repositories. If a claim
              cannot be substantiated by reliable references, its status is
              automatically downgraded to <em>interpretation</em> or{" "}
              <em>open question</em>.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-[16px] font-bold text-[#EAF1EC] mb-2">
            2. Three-Tier Claim Statuses
          </h3>
          <div className="space-y-3 mt-2">
            <div className="p-3 bg-[#151D18] rounded-xl border border-[#2A372F]">
              <span className="text-[13px] font-bold text-[#9BE564] block">
                • ESTABLISHED
              </span>
              <span className="text-[12px] text-[#9AAAA0]">
                Supported by direct consensus and verified secondary literature or
                encyclopedic references.
              </span>
            </div>
            <div className="p-3 bg-[#151D18] rounded-xl border border-[#2A372F]">
              <span className="text-[13px] font-bold text-[#FFC857] block">
                • INTERPRETATION
              </span>
              <span className="text-[12px] text-[#9AAAA0]">
                Plausible cultural, economic, or psychological framing with multiple
                perspectives or emerging historical context.
              </span>
            </div>
            <div className="p-3 bg-[#151D18] rounded-xl border border-[#2A372F]">
              <span className="text-[13px] font-bold text-[#7FB8FF] block">
                • OPEN QUESTION
              </span>
              <span className="text-[12px] text-[#9AAAA0]">
                Unresolved debates, missing etymological records, or areas of active
                scientific inquiry.
              </span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[16px] font-bold text-[#EAF1EC] mb-2">
            3. Reporting Inaccuracies
          </h3>
          <p>
            Every claim card includes a &quot;Report an inaccuracy&quot; tool. If you spot a
            factual error, let us know. Reports feed our evaluation benchmark
            suite to continuously improve accuracy and prevent regressions.
          </p>
        </section>
      </div>
    </div>
  );
}
