"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The three authenticated destinations, in nav order (plan §9). */
const DESTINATIONS = [
  { href: "/", label: "Tonight" },
  { href: "/log", label: "Log" },
  { href: "/catalog", label: "Catalog" },
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Primary navigation — three destinations: Tonight, Log, Catalog. It performs
 * the DESIGN.md structural shift: a bottom tab bar on mobile (< 720px) and a
 * persistent left rail on desktop (>= 720px). It renders nothing on Login,
 * which sits outside the authenticated gate.
 */
export function AppNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface
        pb-[env(safe-area-inset-bottom)] desktop:inset-x-auto desktop:inset-y-0
        desktop:left-0 desktop:w-[var(--rail-width)] desktop:border-r
        desktop:border-t-0 desktop:pb-0"
    >
      <span
        className="hidden font-display text-name font-name text-ink
          desktop:block desktop:px-4 desktop:pb-5 desktop:pt-6"
      >
        Pick Me a Dinner
      </span>
      <ul
        className="mx-auto flex max-w-column px-4 desktop:mx-0 desktop:max-w-none
          desktop:flex-col desktop:gap-1 desktop:px-3"
      >
        {DESTINATIONS.map((dest) => {
          const active = pathname === dest.href;
          return (
            <li key={dest.href} className="flex-1 desktop:flex-none">
              <Link
                href={dest.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-chip
                  transition-colors duration-micro desktop:min-h-0
                  desktop:justify-start desktop:rounded-input desktop:px-3
                  desktop:py-2 desktop:text-body ${focusRing} ${
                    active
                      ? "font-emphasis text-accent desktop:bg-raised"
                      : "text-muted"
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
