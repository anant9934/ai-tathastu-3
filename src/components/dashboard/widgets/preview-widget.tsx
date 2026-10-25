import type { WidgetDefinition } from "@/lib/dashboard/widgets";

/**
 * Body for widgets whose data source isn't built yet: what the card will
 * contain, a muted sketch of its rows (decorative, never fake data), and what
 * it's waiting on.
 */
export function PreviewWidget({ def }: { def: WidgetDefinition }) {
  const preview = def.preview!;
  return (
    <div>
      <p className="text-sm text-muted-foreground">{preview.body}</p>
      <ul aria-hidden className="mt-4 divide-y">
        {preview.rows.map((row, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <span className="size-8 shrink-0 rounded-full border border-dashed border-border-strong" />
            <span className="min-w-0 flex-1">
              <span className="block h-2.5 w-2/5 rounded-full bg-muted" />
              <span className="mt-1.5 block font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">{row}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <span className="font-medium">Preview.</span>{" "}
        <span className="text-muted-foreground">Fills in when {preview.waitingOn} is connected.</span>
      </p>
    </div>
  );
}
