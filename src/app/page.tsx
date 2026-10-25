import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "AI Tathastu — The Mind Behind Your Work",
  description:
    "The AI/ML home of your campus. Repositories, notebooks, papers, hackathons — gathered into one verified profile.",
};

export default function Home() {
  return (
    <Suspense fallback={<LandingPage />}>
      <HomeWithAuth />
    </Suspense>
  );
}

async function HomeWithAuth() {
  await connection();
  const session = await auth();
  return <LandingPage user={session?.user} />;
}
