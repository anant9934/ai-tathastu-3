import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center px-6 py-16 sm:px-10">
      <div className="max-w-md">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">404</p>
        <h1 className="mt-3 font-heading text-5xl leading-tight">Nothing here.</h1>
        <p className="mt-3 text-muted-foreground">That page doesn&apos;t exist, or it moved.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-sm text-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Go to your dashboard
        </Link>
      </div>
    </main>
  );
}
