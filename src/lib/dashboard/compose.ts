// Composition engine: turns the worker's scored list plus the user's prefs
// into what the dashboard renders. No scoring happens here; this only applies
// overrides the user made since the last recompute. Client-safe and pure.

import type { WidgetPref } from "@/db/schema";
import type { ProfileViewDoc, ScoredWidget, WidgetState } from "@/lib/dashboard/types";
import { widgetsFor, type WidgetDefinition } from "@/lib/dashboard/widgets";

export type ComposedWidget = {
  def: WidgetDefinition;
  scored: ScoredWidget | undefined;
  state: WidgetState;
  pinned: boolean;
};

type Prefs = Pick<WidgetPref, "widgetId" | "dismissed" | "pinned">[];

export function compose(view: ProfileViewDoc, prefs: Prefs): { visible: ComposedWidget[]; hidden: ComposedWidget[] } {
  const prefFor = (id: string) => prefs.find((p) => p.widgetId === id);
  const rank = new Map(view.widgets.map((w, i) => [w.id, i]));

  // Only the persona's own widgets; views from before personas are students'.
  const all = widgetsFor(view.persona ?? "student").map((def): ComposedWidget => {
    const scored = view.widgets.find((w) => w.id === def.id);
    const eligible = def.eligibility(view, scored);
    return {
      def,
      scored,
      // Ineligible (or not in the scored list) renders the widget's empty state.
      state: !eligible || !scored ? "empty" : scored.state,
      pinned: prefFor(def.id)?.pinned ?? false,
    };
  });

  // Final pass (plan §2.3): dismissed → hidden; pinned → first; then widgets
  // with something to show before empty ones (the worker orders them this way
  // too; repeated here because eligibility can also empty a widget, and older
  // stored views predate that rule). Within each band, the worker's P(w) order.
  const order = (w: ComposedWidget) => rank.get(w.def.id) ?? Number.MAX_SAFE_INTEGER;
  const isEmpty = (w: ComposedWidget) => Number(w.state === "empty");
  const visible = all
    .filter((w) => !prefFor(w.def.id)?.dismissed)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || isEmpty(a) - isEmpty(b) || order(a) - order(b));
  const hidden = all.filter((w) => prefFor(w.def.id)?.dismissed);
  return { visible, hidden };
}
