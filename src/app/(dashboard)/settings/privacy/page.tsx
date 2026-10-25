import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { PrivacySettings } from "@/components/settings/privacy-settings";
import { CONSENT_PURPOSES, type ConsentChoices } from "@/lib/consent/catalog";
import { getCurrentConsents } from "@/lib/consent/store";
import { requireOnboardedUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="pb-6 border-b border-[#E7EAF3]">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Settings</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">Your permissions</h1>
            <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
              Control data sharing choices and AI reasoning consents. Changes apply immediately and govern profile indexing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8FAF4] text-[#19C58A] border border-[#19C58A]/20">
              <ShieldCheck className="size-4" />
              Consents Active
            </span>
          </div>
        </div>
      </header>
      <Suspense fallback={<div role="status" aria-label="Loading permissions" className="mt-10 h-96 animate-pulse rounded-lg border bg-muted" />}>
        <Choices />
      </Suspense>
    </div>
  );
}

async function Choices() {
  await connection();
  const { user } = await requireOnboardedUser();
  const latest = await getCurrentConsents(user.id);
  const initial = Object.fromEntries(CONSENT_PURPOSES.map((p) => [p, latest[p]?.granted === true])) as ConsentChoices;
  return <PrivacySettings initialChoices={initial} isStudent={user.role === "student"} />;
}
