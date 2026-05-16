"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The three authenticated destinations, in nav order (plan §9). */
const DESTINATIONS = [
  { href: "/", label: "Tonight" },
  { href: "/log", label: "Log" },
  { href: "/catalog", label: "Catalog" },
] as const;

/**
 * The persistent bottom navigation bar (plan §9, §18) — three destinations:
 * Tonight, Log, Catalog. It renders nothing on Login, which sits outside the
 * authenticated gate and has no nav.
 */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface
        pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="column flex">
        {DESTINATIONS.map((dest) => {
          const active = pathname === dest.href;
          return (
            <li key={dest.href} className="flex-1">
              <Link
                href={dest.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-chip
                  focus-visible:outline focus-visible:outline-2
                  focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    active ? "font-emphasis text-accent" : "text-muted"
                  }`}
              >
                {dest.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
