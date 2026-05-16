import type { Config } from "tailwindcss";

/**
 * §16 design foundation as Tailwind theme tokens. Every value resolves to a
 * CSS custom property declared in `app/globals.css`, so screens consume shared
 * tokens (`bg-bg`, `text-h1`, `p-3`, ...) and never inline a hex literal.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        accent: "var(--color-accent)",
        chip: "var(--color-chip)",
        home: "var(--color-home)",
        rest: "var(--color-rest)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
      },
      fontFamily: {
        sans: ["-apple-system", "system-ui", "sans-serif"],
      },
      fontSize: {
        meta: "var(--text-meta)",
        chip: "var(--text-chip)",
        body: "var(--text-body)",
        name: "var(--text-name)",
        h1: "var(--text-h1)",
      },
      fontWeight: {
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
        control: "9px",
        input: "8px",
        badge: "4px",
      },
      screens: {
        desktop: "720px",
      },
    },
  },
  plugins: [],
};

export default config;
