import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plug, ShieldCheck } from "lucide-react";

import { requireOnboardedUser } from "@/lib/dal";

import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Account & Settings | AI Tathastu",
};

export default function SettingsHubPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

async function SettingsContent() {
  await requireOnboardedUser();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">
          Settings & Data Governance
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Control your AI data consents, active third-party connectors, and profile visibility.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Privacy & AI Consent Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs hover:shadow-md transition-all">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-[#FF496D] mb-4">
              <ShieldCheck className="size-5" />
            </div>
            <h2 className="font-sans text-base sm:text-lg font-bold text-[#11182B]">
              Privacy & AI Extraction
            </h2>
            <p className="text-xs text-[#617493] mt-1.5 leading-relaxed">
              Manage your explicit permissions for external LLMs (Groq/Gemini), automated resume parsing, and research peer discovery.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">External AI Reasoning</span>
                <span className="font-semibold text-emerald-600">Active</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">Mentor & Peer Discovery</span>
                <span className="font-semibold text-emerald-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Analytics & Aggregation</span>
                <span className="font-semibold text-emerald-600">Allowed</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href="/settings/privacy"
              className="inline-flex min-h-[44px] items-center justify-between w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors touch-manipulation"
            >
              <span>Manage Privacy & Consents</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Connected Sources & Integrations Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs hover:shadow-md transition-all">
          <div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-[#2878F0] mb-4">
              <Plug className="size-5" />
            </div>
            <h2 className="font-sans text-base sm:text-lg font-bold text-[#11182B]">
              Connected Data Sources
            </h2>
            <p className="text-xs text-[#617493] mt-1.5 leading-relaxed">
              Link external profiles to power your proof-of-work: GitHub, Kaggle, ORCID, and academic portals.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">GitHub Repositories</span>
                <span className="font-semibold text-emerald-600">Connected</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">ORCID Scholarly Record</span>
                <span className="font-semibold text-slate-400">Available</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-600">Kaggle & Competitions</span>
                <span className="font-semibold text-slate-400">Available</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href="/settings/integrations"
              className="inline-flex min-h-[44px] items-center justify-between w-full px-4 py-2.5 rounded-xl bg-[#2878F0] text-white text-xs font-semibold hover:bg-[#2063CC] transition-colors shadow-xs touch-manipulation"
            >
              <span>Manage Integrations</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
