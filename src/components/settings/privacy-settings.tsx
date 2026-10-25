"use client";

import { useState } from "react";

import { savePrivacyConsents } from "@/app/(dashboard)/settings/privacy/actions";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Switch } from "@/components/ui/switch";
import { useAutosave } from "@/hooks/use-autosave";
import { CONSENT_ITEMS, type ConsentChoices } from "@/lib/consent/catalog";
import { cn } from "@/lib/utils";

export function PrivacySettings({ initialChoices, isStudent }: { initialChoices: ConsentChoices; isStudent: boolean }) {
  const [choices, setChoices] = useState(initialChoices);
  const { status, error, save, retry } = useAutosave(savePrivacyConsents);
  // Faculty and alumni are always findable, so the discovery switch is for students only.
  const items = CONSENT_ITEMS.filter((item) => isStudent || item.purpose !== "mentor_discovery");

  function toggle(purpose: keyof ConsentChoices, value: boolean) {
    const next = { ...choices, [purpose]: value };
    setChoices(next);
    void save(next);
  }

  return (
    <section aria-labelledby="permissions-heading" className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="permissions-heading" className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
          Permissions
        </h2>
        <SaveStatusText status={status} error={error} onRetry={retry} />
      </div>
      <ul className="mt-4 divide-y rounded-lg border bg-card">
        {items.map((item) => {
          const id = `privacy-${item.purpose}`;
          return (
            <li key={item.purpose} className="flex gap-6 p-5">
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="cursor-pointer font-medium">
                  {item.title}
                </label>
                <p id={`${id}-body`} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
                <p className={cn("mt-2 text-sm", choices[item.purpose] ? "text-muted-foreground" : "text-foreground")}>
                  {choices[item.purpose] ? "On." : item.without}
                </p>
              </div>
              <Switch
                id={id}
                checked={choices[item.purpose]}
                onCheckedChange={(v) => toggle(item.purpose, v)}
                aria-describedby={`${id}-body`}
                className="mt-0.5"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
