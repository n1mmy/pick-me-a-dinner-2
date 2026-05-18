import type { Config } from "tailwindcss";

/**
 * Design foundation as Tailwind theme tokens. Every value resolves to a CSS
 * custom property declared in `app/globals.css`, so screens consume shared
 * tokens (`bg-bg`, `text-h1`, `p-3`, ...) and never inline a hex literal.
 * DESIGN.md is the canonical source.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        raised: "var(--color-raised)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        "kind-home": "var(--color-kind-home)",
        "kind-restaurant": "var(--color-kind-restaurant)",
        "kind-home-wash": "var(--color-kind-home-wash)",
        "kind-restaurant-wash": "var(--color-kind-restaurant-wash)",
        "recency-overdue": "var(--color-recency-overdue)",
        "recency-mid": "var(--color-recency-mid)",
        "recency-recent": "var(--color-recency-recent)",
        action: "var(--color-action)",
        "action-hover": "var(--color-action-hover)",
        "action-ink": "var(--color-action-ink)",
        success: "var(--color-success)",
        "success-wash": "var(--color-success-wash)",
        danger: "var(--color-danger)",
        "danger-wash": "var(--color-danger-wash)",
        planned: "var(--color-planned)",
        exclude: "var(--color-exclude)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-geist-sans)", "-apple-system", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        meta: "var(--text-meta)",
        chip: "var(--text-chip)",
        body: "var(--text-body)",
        name: "var(--text-name)",
        h1: "var(--text-h1)",
      },
      fontWeight: {
        name: "var(--weight-name)",
        emphasis: "var(--weight-emphasis)",
        h1: "var(--weight-h1)",
      },
      spacing: {
        "1": "var(--space-1)",
        "1.5": "var(--space-1_5)",
        "2": "var(--space-2)",
        "3": "var(--space-3)",
        "4": "var(--space-4)",
        "5.5": "var(--space-5_5)",
      },
      maxWidth: {
        column: "var(--column-max)",
      },
      borderRadius: {
        control: "6px",
        input: "6px",
        badge: "3px",
      },
      transitionDuration: {
        micro: "var(--motion-micro)",
        short: "var(--motion-short)",
        medium: "var(--motion-medium)",
      },
      screens: {
        desktop: "720px",
      },
    },
  },
  plugins: [],
};

export default config;
