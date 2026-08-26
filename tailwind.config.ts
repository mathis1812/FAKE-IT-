import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette relevée sur usenoway.com : noir pur, accent bleu vif, et
        // un grand panneau clair qui vient trancher dans le noir.
        ink: "#000000",
        panel: "#0c1111",
        line: "#232828",
        light: "#fbfbfb",
        muted: "#a8a8a8",
        faint: "#4f4f4f",
        primary: {
          DEFAULT: "#0285fe",
          soft: "#4da8ff",
          deep: "#0166c7",
        },
      },
      fontFamily: {
        // Une seule famille sur tout le site, comme le modèle. Les deux
        // alias sont conservés le temps de la refonte : le balisage existant
        // utilise encore font-display et font-body un peu partout.
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        body: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        // L'interlettrage négatif des titres est la signature typographique
        // du modèle : -1px à 40px, -0.8px à 32px.
        title: "-0.025em",
        display: "-0.03em",
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
