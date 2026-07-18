import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="fr">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
