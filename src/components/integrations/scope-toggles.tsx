"use client";

import { Switch } from "@/components/ui/switch";
import type { IntegrationScope } from "@/db/schema";
import { SCOPE_COPY } from "@/lib/integrations/scopes";

export function ScopeToggles({
  scopes,
  requested = [],
  appName,
  onChange,
  disabled,
  idPrefix = "scope",
}: {
  scopes: Record<IntegrationScope, boolean>;
  requested?: IntegrationScope[];
  appName?: string;
  onChange: (id: IntegrationScope, on: boolean) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <ul className="mt-2 divide-y">
      {SCOPE_COPY.map((s) => {
        const id = `${idPrefix}-${s.id}`;
        const blocked = s.id === "eris" && !scopes.skills;
        return (
          <li key={s.id} className="flex items-start justify-between gap-4 py-3">
            <label htmlFor={id} className="min-w-0 cursor-pointer">
              <span className="block text-sm font-medium">
                {s.label}
                {appName && requested.includes(s.id) && (
                  <span className="ml-2 rounded-full border px-2 py-0.5 align-middle text-xs font-normal text-muted-foreground">
                    Requested by {appName}
                  </span>
                )}
              </span>
              <span id={`${id}-detail`} className="block text-sm text-muted-foreground">
                {s.detail}
              </span>
            </label>
            <Switch
              id={id}
              checked={scopes[s.id] && !blocked}
              disabled={disabled || blocked}
              aria-describedby={`${id}-detail`}
              onCheckedChange={(on) => onChange(s.id, on)}
              className="mt-0.5"
            />
          </li>
        );
      })}
    </ul>
  );
}
