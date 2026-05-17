import type { Metadata } from "next";
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
