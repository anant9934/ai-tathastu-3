import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { choosePersona } from "@/app/onboarding/persona-actions";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { PERSONAS } from "@/db/schema";
import { requireRoleChoice } from "@/lib/dal";
import { PERSONA_COPY } from "@/lib/onboarding/personas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Who are you here as? · AI Tathastu" };

/** Step 0: the persona decides the rest of onboarding and the dashboard. */
export default function RolePage() {
  return (
    <>
      <header className="max-w-2xl">
        <p className="font-mono text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <span className="font-bold text-[#FF2A85]">00</span> / 06 · GETTING STARTED
        </p>
        <h1 className="mt-2.5 font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-[1.15] tracking-tight text-[#0F172A]">
          Who are you here <span className="font-serif italic font-normal text-[#FF2A85]">as</span>?
        </h1>
        <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Your answers, your dashboard and who you&apos;re matched with depend on this. Everyone adds a resume and
          connects their work; the questions in between are different.
        </p>
      </header>
      <Suspense fallback={<StepSkeleton />}>
        <RoleChoice />
      </Suspense>
    </>
  );
}

async function RoleChoice() {
  const { user, state } = await requireRoleChoice();
  const current = state.currentStep === "role" ? null : user.role;

  return (
    <form action={choosePersona} className="mt-8 pb-16">
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Choose how you'll use AI Tathastu">
        {PERSONAS.map((persona, i) => {
          const copy = PERSONA_COPY[persona];
          const isCurrent = current === persona;
          return (
            <li key={persona} className="flex">
              <button
                type="submit"
                name="persona"
                value={persona}
                className={cn(
                  "group flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-5 sm:p-7 text-left shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer touch-manipulation",
                  "focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/30 focus-visible:outline-none active:scale-[0.99]",
                  isCurrent
                    ? "border-[#FF5A5F] bg-[#FFF5F7]/30 ring-2 ring-[#FF5A5F]/20 shadow-md"
                    : "border-slate-200/90 hover:border-slate-300",
                )}
              >
                <div className="flex w-full items-center justify-between font-mono text-xs tracking-wider text-slate-500 uppercase">
                  <span className="font-semibold text-slate-700">
                    <span className="text-[#FF2A85] mr-1">{String(i + 1).padStart(2, "0")}</span> · {copy.label}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 normal-case">
                      <Check aria-hidden className="size-3 stroke-[2.5]" /> Current
                    </span>
                  )}
                </div>
                <span className="mt-4 sm:mt-5 block font-heading text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  {copy.title}
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-slate-500">
                  {copy.blurb}
                </span>
                <span className="mt-4 sm:mt-5 block w-full border-t border-slate-100 pt-3.5 sm:pt-4 text-xs text-slate-600">
                  <span className="sr-only">You get: </span>
                  {copy.gets.map((g, j) => (
                    <span key={g} className="mt-2 flex items-start gap-2 first:mt-0 font-medium">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#EA580C]" />
                      {g}
                      {j < copy.gets.length - 1 && <span className="sr-only">;</span>}
                    </span>
                  ))}
                </span>
                <div className="mt-auto w-full pt-5 sm:pt-6">
                  <span
                    className={cn(
                      "inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl py-2.5 px-4 text-xs font-semibold transition-all duration-150 shadow-xs",
                      isCurrent
                        ? "bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-rose-500/20"
                        : "bg-slate-900 text-white group-hover:bg-slate-800",
                    )}
                  >
                    {isCurrent ? "Continue" : "Choose this path"}
                    <ArrowRight aria-hidden className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {current && (
        <p className="mt-6 max-w-xl text-xs text-slate-500 font-medium">
          Switching starts that path from its first step. Anything you&apos;ve already saved, like your resume, is kept.
        </p>
      )}
    </form>
  );
}
