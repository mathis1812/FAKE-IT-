import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0a0908",
        champagne: {
          DEFAULT: "#d4af77",
          soft: "#f5e6c8",
          deep: "#c9a227",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      animation: {
        "star-movement-bottom":
          "star-movement-bottom linear infinite alternate",
        "star-movement-top": "star-movement-top linear infinite alternate",
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up-delay":
          "fade-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
      },
      keyframes: {
        "star-movement-bottom": {
          "0%": { transform: "translate(0%, 0%)", opacity: "1" },
          "100%": { transform: "translate(-100%, 0%)", opacity: "0" },
        },
        "star-movement-top": {
          "0%": { transform: "translate(0%, 0%)", opacity: "1" },
          "100%": { transform: "translate(100%, 0%)", opacity: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
