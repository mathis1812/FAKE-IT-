import type { Appearance } from "@clerk/types";

/** Apparence Clerk alignée sur Bluminoo Studio (#A855F7, fond ink). */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#A855F7",
    colorBackground: "#13101b",
    colorInputBackground: "#0a0810",
    colorInputText: "#f5f5f5",
    colorText: "#f5f5f5",
    colorTextSecondary: "#a3a3a3",
    colorDanger: "#f87171",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-body), system-ui, sans-serif",
  },
  elements: {
    rootBox: "mx-auto w-full",
    card: "border border-white/10 bg-[#13101b] shadow-none",
    headerTitle: "font-display text-2xl tracking-tight",
    headerSubtitle: "text-neutral-400",
    socialButtonsBlockButton:
      "border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
    formButtonPrimary:
      "bg-[#A855F7] text-[#0a0810] hover:bg-[#c084fc] shadow-none",
    footerActionLink: "text-[#A855F7] hover:text-[#d8b4fe]",
    formFieldInput:
      "border border-white/10 bg-[#0a0810] focus:border-[#A855F7] focus:ring-[#A855F7]",
    identityPreviewEditButton: "text-[#A855F7]",
    userButtonPopoverCard: "border border-white/10 bg-[#13101b]",
  },
};
