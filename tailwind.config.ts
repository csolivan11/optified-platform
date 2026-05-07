import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    // Increase base container sizing for a more generous, editorial feel
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        sm: "2rem",
        lg: "3rem",
        xl: "4rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ─── Brand palette — Optified navy system ───
        // Primary surfaces derived from brand navy #192C4C.
        navy: {
          50: "#F1F4FA",
          100: "#D9E0EE",
          200: "#B3C1DD",
          300: "#7A8FB8",
          400: "#455C8A",
          500: "#2A3F60",
          600: "#192C4C", // BRAND PRIMARY
          700: "#122342",
          800: "#0F1D33",
          900: "#091425",
          950: "#050B16",
        },
        // Brand grayscale (from brand guidelines)
        cloud: "#EDEFF7",
        smoke: "#D3D6E0",
        steel: "#BCBFCC",
        space: "#9DA2B3",
        graphite: "#6E7180",
        arsenic: "#40424D",
        phantom: "#1E1E24",

        // Functional status accents (user explicitly approved these)
        success: {
          DEFAULT: "#10B981",
          dim: "#065F46",
          glow: "rgba(16,185,129,0.15)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          dim: "#78350F",
        },
        danger: {
          DEFAULT: "#EF4444",
          dim: "#7F1D1D",
        },
        info: {
          DEFAULT: "#60A5FA",
          dim: "#1E3A5F",
        },
        accent: {
          DEFAULT: "#A78BFA",
          dim: "#4C1D95",
        },

        // ─── Semantic tokens (shadcn-compatible, mapped to brand) ───
        // These allow shadcn components to inherit the navy system automatically.
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },

      fontFamily: {
        // Manrope is the primary per brand guidelines
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui"],
      },

      // Slightly expanded type scale — more editorial than stock Tailwind
      fontSize: {
        "display-lg": ["4rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "800" }],
        display: ["3rem", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "800" }],
        "h1": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "h2": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" }],
        "h3": ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.6", letterSpacing: "-0.005em" }],
        "body": ["0.9375rem", { lineHeight: "1.6" }],
        "caption": ["0.8125rem", { lineHeight: "1.5" }],
        "overline": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.1em", fontWeight: "600" }],
      },

      // Generous spacing — luxury feel comes from whitespace
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },

      boxShadow: {
        // Subtle, high-end shadows (no harsh black drops)
        "elevation-1": "0 1px 2px 0 rgba(9, 20, 37, 0.04), 0 1px 3px 0 rgba(9, 20, 37, 0.06)",
        "elevation-2": "0 4px 12px -2px rgba(9, 20, 37, 0.08), 0 2px 6px -1px rgba(9, 20, 37, 0.05)",
        "elevation-3": "0 12px 32px -8px rgba(9, 20, 37, 0.12), 0 4px 12px -2px rgba(9, 20, 37, 0.06)",
        "glow-success": "0 0 24px -4px rgba(16, 185, 129, 0.35)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
