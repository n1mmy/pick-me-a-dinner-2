import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppNav } from "./app-nav";
import "./globals.css";

/**
 * The three project faces, all self-hosted via `next/font` (no CDN, no layout
 * shift): Fraunces for display, Geist for UI/body, Geist Mono for data. Each
 * exposes a CSS variable consumed by `tailwind.config.ts` / `globals.css`.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Pick Me a Dinner",
  description: "Helps one household decide what's for dinner.",
  manifest: "/manifest.webmanifest",
  // Standalone home-screen install (see app/manifest.ts). `appleWebApp` emits
  // the iOS-only meta that makes "Add to Home Screen" launch chrome-less; the
  // status bar is left "default" (opaque, content below) to match the
  // safe-area-contained layout — we deliberately don't run content under the
  // notch.
  appleWebApp: {
    capable: true,
    title: "Dinner",
    statusBarStyle: "default",
  },
  // Next emits the standardized `mobile-web-app-capable`; older iOS Safari
  // keys chrome-less launch off the apple-prefixed name, so ship both.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

/**
 * `theme-color` tints the standalone status bar / task-switcher chrome. It
 * tracks the app `bg` per theme (DESIGN.md) so the system chrome blends into
 * the cool-grey top of every screen.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c1f" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        {children}
        <AppNav />
      </body>
    </html>
  );
}
