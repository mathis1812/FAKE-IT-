"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";

const AUTH_PREFIXES = ["/sign-in", "/sign-up"];

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuth = AUTH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isAuth) {
    return <div className="studio-content min-h-screen">{children}</div>;
  }

  return (
    <div className="studio-content min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
        <footer className="mt-12 text-center text-[11px] uppercase tracking-[0.18em] text-neutral-700">
          Gemini Flash Image · Kling O3 · React Bits
        </footer>
      </main>
    </div>
  );
}
