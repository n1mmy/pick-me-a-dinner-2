"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "./login/actions";

/** The three authenticated destinations, in nav order (plan §9). */
const DESTINATIONS = [
  { href: "/", label: "Tonight" },
  { href: "/log", label: "Log" },
  { href: "/catalog", label: "Catalog" },
] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

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
        desktop:left-0 desktop:flex desktop:w-[var(--rail-width)] desktop:flex-col
        desktop:border-r desktop:border-t-0 desktop:pb-0"
    >
      <span
        className="hidden font-display text-name font-name text-ink
          desktop:block desktop:px-4 desktop:pb-5 desktop:pt-6"
      >
        Pick Me a Dinner
      </span>
      <ul
        className="mx-auto flex max-w-column px-4 desktop:mx-0 desktop:max-w-none
          desktop:flex-1 desktop:flex-col desktop:gap-1 desktop:px-3"
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
                      ? "font-emphasis text-action desktop:bg-raised"
                      : "text-muted"
                  }`}
              >
                {dest.label}
              </Link>
            </li>
          );
        })}
        <li className="desktop:mt-auto">
          <form action={logout}>
            <button
              type="submit"
              aria-label="Log out"
              className={`flex min-h-14 items-center justify-center px-3
                text-muted transition-colors duration-micro hover:text-ink
                desktop:min-h-0 desktop:rounded-input desktop:p-2 ${focusRing}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
