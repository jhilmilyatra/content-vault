import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      letterSpacing: {
        tighter: '-0.03em',
        tightest: '-0.05em',
        apple: '-0.022em',
      },
      colors: {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "natural": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        "micro": "150ms",
        "fast": "200ms",
        "normal": "250ms",
        "slow": "300ms",
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
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out-down": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(8px)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.96)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(100%)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "subtle-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "progress-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "accordion-up": "accordion-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "fade-in": "fade-in 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "fade-out-down": "fade-out-down 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "scale-in": "scale-in 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "scale-out": "scale-out 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "slide-up": "slide-up 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "slide-down": "slide-down 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shimmer": "shimmer 8s ease-in-out infinite",
        "subtle-bounce": "subtle-bounce 2s ease-in-out infinite",
        "progress-indeterminate": "progress-indeterminate 1.5s ease-in-out infinite",
      },
      backdropBlur: {
        xs: "4px",
        glass: "12px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;