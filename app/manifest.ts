import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the app installable to a phone home screen as a
 * standalone (chrome-less) launch. Deliberately no service worker: this is an
 * online-only, auth-gated personal app, so offline caching would only add the
 * classic stale-cache footguns for no benefit.
 *
 * `theme_color`/`background_color` track the app `bg` (DESIGN.md), not the
 * violet icon field, so the system status bar blends into the cool-grey top of
 * every screen with no seam. The light/dark `theme-color` split is emitted from
 * the `viewport` export in `app/layout.tsx`; this single value is the fallback.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pick Me a Dinner",
    short_name: "Dinner",
    description: "Helps one household decide what's for dinner.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#f3f4f6",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
