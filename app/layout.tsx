import type { Metadata } from "next";
import { BottomNav } from "./bottom-nav";
import "./globals.css";

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
    <html lang="en">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
