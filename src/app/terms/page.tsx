"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
        <h1 className="text-[20px] font-bold text-[#EAF1EC]">Terms of Service</h1>
      </div>

      <div className="prose prose-invert max-w-none text-[#9AAAA0] text-[14px] leading-relaxed flex flex-col gap-5">
        <p>Last updated: October 2026</p>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            1. Purpose of the Service
          </h2>
          <p>
            Deep Roots is an educational discovery platform designed to deconstruct
            objects, proverbs, ideas, and artifacts into their constituent systems,
            historical origins, and cultural lenses.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            2. Acceptable Use
          </h2>
          <p>
            You agree not to upload illegal, harassing, infringing, or harmful
            content. You may not attempt to reverse engineer or circumvent our rate
            limits, server-side quotas, or authentication checks.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            3. AI & Knowledge Generation
          </h2>
          <p>
            Card decomposition and rabbit-hole deepenings are generated using
            artificial intelligence and checked against factual sources where
            available. We distinguish established facts from interpretations and
            unanswered questions. Content is provided for educational and curiosity
            purposes.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            4. Subscriptions & Billing
          </h2>
          <p>
            Subscriptions renew automatically according to the cycle selected at
            checkout. You can cancel at any time in Settings. Upon cancellation,
            Pro features remain active until the end of your billing cycle.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            5. Contact
          </h2>
          <p>
            For inquiries regarding these terms, contact{" "}
            <a href="mailto:legal@deeproots.app" className="text-[#FFC857]">
              legal@deeproots.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
