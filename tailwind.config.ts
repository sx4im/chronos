import type { Config } from "tailwindcss";

// Lets opacity modifiers (e.g. bg-success/12, hover:bg-primary/90) work on
// colors defined as plain hex CSS vars, while keeping `var(--x)` usable directly.
const c =
  (name: string) =>
  ({ opacityValue }: { opacityValue?: string | number }) =>
    opacityValue === undefined || opacityValue === 1 || opacityValue === "1"
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: c("--background"),
        foreground: c("--foreground"),
        card: {
          DEFAULT: c("--card"),
          foreground: c("--card-foreground"),
        },
        popover: {
          DEFAULT: c("--popover"),
          foreground: c("--popover-foreground"),
        },
        primary: {
          DEFAULT: c("--primary"),
          foreground: c("--primary-foreground"),
        },
        secondary: {
          DEFAULT: c("--secondary"),
          foreground: c("--secondary-foreground"),
        },
        muted: {
          DEFAULT: c("--muted"),
          foreground: c("--muted-foreground"),
        },
        accent: {
          DEFAULT: c("--accent"),
          foreground: c("--accent-foreground"),
        },
        destructive: {
          DEFAULT: c("--destructive"),
          foreground: c("--destructive-foreground"),
        },
        border: c("--border"),
        input: c("--input"),
        ring: c("--ring"),
        chart: {
          "1": c("--chart-1"),
          "2": c("--chart-2"),
          "3": c("--chart-3"),
          "4": c("--chart-4"),
          "5": c("--chart-5"),
        },
        sidebar: {
          DEFAULT: c("--sidebar"),
          foreground: c("--sidebar-foreground"),
          primary: c("--sidebar-primary"),
          "primary-foreground": c("--sidebar-primary-foreground"),
          accent: c("--sidebar-accent"),
          "accent-foreground": c("--sidebar-accent-foreground"),
          border: c("--sidebar-border"),
          ring: c("--sidebar-ring"),
        },
        vintage: {
          "dark-green": c("--accent-olive"),
          "warm-brown": c("--accent-terracotta"),
          "light-beige": c("--bg-cream"),
        },
        canvas: c("--canvas"),
        ink: c("--ink"),
        hairline: c("--hairline"),
        "on-primary": c("--on-primary"),
        brand: {
          pink: c("--brand-pink"),
          teal: c("--brand-teal"),
          lavender: c("--brand-lavender"),
          peach: c("--brand-peach"),
          ochre: c("--brand-ochre"),
          mint: c("--brand-mint"),
          coral: c("--brand-coral"),
        },
        surface: {
          soft: c("--surface-soft"),
          card: c("--surface-card"),
          strong: c("--surface-strong"),
          dark: c("--surface-dark"),
          "dark-elevated": c("--surface-dark-elevated"),
        },
        success: c("--success"),
        warning: c("--warning"),
        error: c("--error"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        pill: "9999px",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "slide-in": {
          from: {
            transform: "translateX(100%)",
            opacity: "0",
          },
          to: {
            transform: "translateX(0)",
            opacity: "1",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
      perspective: {
        "1000": "1000px",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    function ({ addUtilities }: { addUtilities: (utilities: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        ".perspective-1000": { perspective: "1000px" },
      });
    },
  ],
} satisfies Config;
