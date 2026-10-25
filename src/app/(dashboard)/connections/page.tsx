import { ArrowLeft, Plug } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ConnectorCards } from "@/components/connectors/connector-grid";
import { flashFrom, loadSourceCards } from "@/lib/connectors/cards";
import { requireOnboardedUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage({ searchParams }: PageProps<"/connections">) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="pb-6 border-b border-[#E7EAF3]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">Your Connected Sources</h1>
            <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
              Connected sources add verified evidence to your profile and refresh in the background. Disconnecting a source deletes imported items and recalculates your scores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Plug className="size-4" />
              Live Sync Active
            </span>
          </div>
        </div>
      </header>
      <Suspense fallback={<CardsSkeleton />}>
        <Cards searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Cards({ searchParams }: Pick<PageProps<"/connections">, "searchParams">) {
  const { user } = await requireOnboardedUser();
  const [cards, params] = await Promise.all([loadSourceCards(user), searchParams]);
  return <ConnectorCards cards={cards} flash={flashFrom(params)} context="connections" />;
}

function CardsSkeleton() {
  return (
    <div role="status" aria-label="Loading your sources" className="mt-10 grid animate-pulse grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} aria-hidden className="h-44 rounded-lg border bg-muted" />
      ))}
    </div>
  );
}
