import type { MetadataRoute } from "next";

// Installable web app (Add to Home Screen). Icons are generated from the
// brand app icon; the maskable one keeps the art inside Android's safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Tathastu",
    short_name: "Tathastu",
    description: "Career intelligence for students building a future in AI.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0604",
    theme_color: "#0a0604",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
