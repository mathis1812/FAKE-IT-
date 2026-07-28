import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FakeIt — Luxe instantané",
  description:
    "Uploadez une photo et générez une version ultra-réaliste avec un élément de luxe intégré.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${syne.variable} ${outfit.variable}`}>
      <body className="bg-ink text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
