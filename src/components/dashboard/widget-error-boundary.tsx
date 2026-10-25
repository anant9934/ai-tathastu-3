"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Component, startTransition, type ReactNode } from "react";

/**
 * Per-widget boundary: a widget that throws (in render, or in its async
 * server data fetch streamed through Suspense) shows this instead, and the
 * rest of the dashboard keeps working.
 */
export class WidgetErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Widget failed:", this.props.label, error);
  }

  render() {
    if (this.state.error) {
      return <WidgetError label={this.props.label} onReset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function WidgetError({ label, onReset }: { label: string; onReset: () => void }) {
  const router = useRouter();
  return (
    <div role="alert" className="flex h-full flex-col items-start gap-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <CircleAlert aria-hidden className="size-4" />
        {label} is temporarily unavailable.
      </p>
      <p className="text-muted-foreground">The rest of your dashboard is unaffected.</p>
      <button
        type="button"
        onClick={() => startTransition(() => { onReset(); router.refresh(); })}
        className="inline-flex items-center gap-1.5 rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <RotateCcw aria-hidden className="size-3.5" />
        Try again
      </button>
    </div>
  );
}
