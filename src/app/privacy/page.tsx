"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 className="text-[20px] font-bold text-[#EAF1EC]">Privacy Policy</h1>
      </div>

      <div className="prose prose-invert max-w-none text-[#9AAAA0] text-[14px] leading-relaxed flex flex-col gap-5">
        <p>Last updated: October 2026</p>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            1. Zero-Retention Image Policy
          </h2>
          <p>
            When you scan an object using your camera, image data is resized,
            stripped of EXIF metadata on your device, and processed ephemerally in
            server memory. We do not store, retain, sell, or use your uploaded
            photos to train public machine learning models.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            2. Local-First Knowledge Graph
          </h2>
          <p>
            By default, your saved roots, custom rabbit holes, and knowledge
            connections are saved locally on your device. When you connect an
            account (Google or Email), your knowledge graph is encrypted in
            transit and at rest to enable cross-device syncing.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            3. Safe Link Fetching & Anti-SSRF
          </h2>
          <p>
            When you paste links to inspect, our backend enforces strict network
            isolation: private networks, loopback ranges, and cloud metadata
            services are strictly prohibited. We only fetch public HTML content
            necessary for summarization.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            4. Data Portability & Erasure
          </h2>
          <p>
            You retain 100% ownership of your knowledge tree. You can export your
            entire collection in open Markdown or JSON formats at any time. You
            can also delete your account and all associated data with a single
            click in Settings.
          </p>
        </section>

        <section>
          <h2 className="text-[17px] font-bold text-[#EAF1EC] mb-1.5">
            5. Contact
          </h2>
          <p>
            For privacy inquiries or data requests, contact{" "}
            <a href="mailto:privacy@deeproots.app" className="text-[#FFC857]">
              privacy@deeproots.app
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
