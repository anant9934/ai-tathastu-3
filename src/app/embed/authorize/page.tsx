import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { EmbedAuthorize } from "@/components/embed/embed-authorize";
import { isAllowedEmbedOrigin } from "@/lib/embed-token";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = { title: "Share your profile" };

/**
 * Popup opened by public/embed.js on the pilot site. Signed-in users approve
 * sharing a compact profile card with that origin; the token goes back to
 * the opener via postMessage (no third-party cookies involved).
 */
export default function EmbedAuthorizePage({ searchParams }: PageProps<"/embed/authorize">) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Authorize searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Authorize({ searchParams }: Pick<PageProps<"/embed/authorize">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const origin = typeof params.origin === "string" ? params.origin : null;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/embed/authorize?origin=${encodeURIComponent(origin ?? "")}`)}`);
  }
  if (!isAllowedEmbedOrigin(origin)) return <Problem>This site isn&apos;t allowed to show AI Tathastu profiles.</Problem>;
  if (!(await isFeatureEnabled("pilot_site_embed"))) return <Problem>The profile widget isn&apos;t enabled yet.</Problem>;
  return <EmbedAuthorize origin={origin} />;
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-sm">
      <p className="font-heading text-3xl">Can&apos;t share here.</p>
      <p role="alert" className="mt-2 text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
