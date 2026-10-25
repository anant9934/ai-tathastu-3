import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b px-6 py-4 sm:px-10">
        <Link href="/dashboard" className="rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <BrandLogo />
        </Link>
        <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Admin</span>
      </header>
      <main className="px-6 py-10 sm:px-10">{children}</main>
    </div>
  );
}
