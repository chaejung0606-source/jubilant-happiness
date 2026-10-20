import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

        // brand mint/sage scale (무광 세라믹)
        brand: {
          50: "#eef6f1", 100: "#dcece4", 200: "#c3ddd0", 300: "#a7cbb8", 400: "#8fbaa4",
          500: "#77a891", 600: "#5f8f79", 700: "#4d7563", 800: "#405f51", 900: "#364f44",
        },
        // 세라믹 전용 팔레트
        ceramic: {
          pageBg: "#F3EDE3", surface: "#FFF9EF", surface2: "#F8F1E7", cream: "#EFE7DA",
          mint: "#AFCFC1", mintDark: "#8FB9A8", sky: "#B7D8E8", skySoft: "#D4E8EF",
          sage: "#9FB7A4", pink: "#EEC7C2", ink: "#2F3A37", sub: "#7C817B",
          line: "rgba(120, 110, 95, 0.12)",
        },
        // 파스텔 서페이스 팔레트 (스탯 카드·배지·악센트). 상태 의미를 이 톤으로 표현한다.
        pastel: {
          lavender: "#EFE7DA", lavenderInk: "#8a7644",
          purple: "#DDE8DF", purpleInk: "#48705a",
          pink: "#F2DDD7", pinkInk: "#a96b60",
          rose: "#F1E1D5", roseInk: "#a9714a",
          sky: "#D9E9F0", skyInk: "#3f7488",
          mint: "#D6E8DD", mintInk: "#3d7a61",
          cream: "#F3EAD4", creamInk: "#8a7326",
          apricot: "#F5E3D0", apricotInk: "#a5703c",
          coral: "#F2D9D3", coralInk: "#b25a4f",
        },
      },
      borderRadius: {
        lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem", "3xl": "1.75rem", card: "1.75rem",
      },
      boxShadow: {
        soft: "8px 8px 20px rgba(160, 140, 110, 0.14), -6px -6px 16px rgba(255, 255, 255, 0.72)",
        "soft-lg": "16px 16px 38px rgba(150, 130, 105, 0.17), -10px -10px 26px rgba(255, 255, 255, 0.82)",
        clay: "8px 8px 24px rgba(150, 130, 105, 0.2), -8px -8px 24px rgba(255, 255, 255, 0.9)",
        pill: "4px 4px 10px rgba(150, 130, 100, 0.18), -4px -4px 10px rgba(255, 255, 255, 0.78)",
        neu: "8px 8px 20px rgba(160, 140, 110, 0.16), -6px -6px 16px rgba(255, 255, 255, 0.75)",
        "neu-lg": "14px 14px 34px rgba(150, 130, 105, 0.18), -10px -10px 26px rgba(255, 255, 255, 0.82)",
        "neu-btn": "4px 4px 10px rgba(150, 130, 100, 0.18), -4px -4px 10px rgba(255, 255, 255, 0.8)",
        "neu-inset": "inset 4px 4px 8px rgba(150, 130, 100, 0.18), inset -4px -4px 8px rgba(255, 255, 255, 0.75)",
      },
      keyframes: {
        "fade-in-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: { "fade-in-up": "fade-in-up 0.4s ease-out both", float: "float 4s ease-in-out infinite" },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
