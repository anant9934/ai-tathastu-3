export function StepSkeleton({ label = "Loading your progress…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="mt-10">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 rounded-lg border bg-muted" />
        ))}
      </div>
    </div>
  );
}
