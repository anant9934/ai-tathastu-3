import type { MatchCard } from "@/lib/matches";

/** Faculty "Students who match your expertise" / alumni "Top student talent". */
export function MatchesWidget({ visible, hidden }: { visible: MatchCard[]; hidden: number }) {
  return (
    <div>
      <ul className="divide-y">
        {visible.map((m) => (
          <li key={m.studentId} className="flex items-start gap-3 py-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-xs"
            >
              {m.name
                .split(/\s+/)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{m.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{Math.round(m.score * 100)}% fit</span>
              </p>
              <p className="truncate text-sm text-muted-foreground">{[m.role, m.university].filter(Boolean).join(" · ")}</p>
              {m.reasons.length > 0 && <p className="mt-1 text-sm">{m.reasons.join(". ")}.</p>}
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          {hidden} more matching {hidden === 1 ? "student hasn't" : "students haven't"} made their profile visible to mentors yet.
        </p>
      )}
    </div>
  );
}
