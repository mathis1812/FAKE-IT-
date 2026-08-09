import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0810",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        panel: "rgb(var(--panel-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "#a855f7",
          soft: "#d8b4fe",
          deep: "#7e22ce",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up-delay":
          "fade-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        reveal: "reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(18px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
