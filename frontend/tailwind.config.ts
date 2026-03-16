import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        destructive: "hsl(var(--destructive))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        "bb-cloud": "#EDEFF7",
        "bb-phantom": "#1E1E24",
        "bb-phantomLight": "#F5F6FA",
        "bb-steel": "#BCBFCC",
        "bb-steelDark": "#2B2F3D",
        "bb-blue": "#007BFC",
        "bb-blueDark": "#0066D6",
      },
    },
  },
  plugins: [],
} satisfies Config;
