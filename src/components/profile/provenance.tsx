import { BadgeCheck, PencilLine, PlugZap } from "lucide-react";

import type { FactOrigin, ProfileFact } from "@/db/schema";
import { cn } from "@/lib/utils";

const ORIGIN_LABEL: Record<FactOrigin, string> = {
  resume: "Resume",
  github: "GitHub",
  kaggle: "Kaggle",
  stack_exchange: "Stack Exchange",
  portfolio: "Portfolio",
  linkedin_oidc: "LinkedIn",
  linkedin_dma: "LinkedIn",
  linkedin_export: "LinkedIn",
  linkedin_scrape: "LinkedIn",
  leetcode: "LeetCode",
  orcid: "ORCID",
  hackerrank: "HackerRank",
  user_entered: "You",
};

export const originLabel = (o: string) => ORIGIN_LABEL[o as FactOrigin] ?? o;

export function SourceBadge({ origin, evidence }: { origin: string; evidence?: string | null }) {
  return (
    <span
      title={evidence ? `“${evidence}”` : undefined}
      className="inline-flex h-5 items-center rounded-sm border border-border-strong px-1.5 font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase"
    >
      <span className="sr-only">Source: </span>
      {originLabel(origin)}
    </span>
  );
}

/** How the fact earned its place: confirmed or edited by the user, or straight from a connected source's API. */
export function Verification({
  confirmation,
  origin,
  className,
}: {
  confirmation: ProfileFact["confirmation"];
  origin: string;
  className?: string;
}) {
  const kind =
    confirmation === "edited" ? "edited" : confirmation === "confirmed" ? "confirmed" : origin !== "resume" ? "api" : null;
  if (!kind) return null;
  const { Icon, text, tone } = {
    confirmed: { Icon: BadgeCheck, text: "Confirmed by you", tone: "text-success" },
    edited: { Icon: PencilLine, text: "Edited by you", tone: "text-foreground" },
    api: { Icon: PlugZap, text: `From ${originLabel(origin)}`, tone: "text-muted-foreground" },
  }[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone, className)} title={text}>
      <Icon aria-hidden className="size-3.5" />
      <span className="sr-only">{text}</span>
    </span>
  );
}
