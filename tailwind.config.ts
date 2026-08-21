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
        "magic-reveal": "magic-reveal 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "marquee-left": "marquee-left 80s linear infinite",
        "marquee-right": "marquee-right 80s linear infinite",
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
        "magic-reveal": {
          "0%": {
            opacity: "0",
            transform: "scale(1.08)",
            filter: "blur(16px) brightness(1.9) saturate(1.4)",
          },
          "60%": {
            opacity: "1",
            filter: "blur(2px) brightness(1.15) saturate(1.1)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
            filter: "blur(0) brightness(1) saturate(1)",
          },
        },
        "marquee-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        "marquee-right": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
