"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MOBILE_BREAKPOINT_QUERY = "(min-width: 768px)";

const NAV_ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/galerie", label: "Galerie" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/a-propos", label: "À propos" },
] as const;

/**
 * Header partagé par toutes les pages : logo, nav desktop, et bouton
 * hamburger qui ouvre un panneau de navigation en overlay sur mobile.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Ferme le panneau mobile à chaque changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reflète l'état de session Supabase (null = pas encore su, évite un
  // flash "Connexion" pendant l'hydratation).
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Verrouille le scroll du body tant que le panneau mobile est ouvert.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Échap ferme le panneau mobile.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Ferme le panneau mobile si le viewport franchit le breakpoint `md`
  // (≥768px) pendant qu'il est ouvert, pour éviter un scroll verrouillé
  // sans moyen visible de fermer le panneau (bouton et scrim masqués).
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setOpen(false);
    };
    onChange(mql);
    // Safari < 14 n'a que l'API dépréciée addListener/removeListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [open]);

  return (
    <Fragment>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-baseline gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
              Blumin<span className="text-primary">oo</span>
            </h1>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500 sm:inline">
              Studio
            </span>
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                      active
                        ? "bg-primary text-ink"
                        : "text-neutral-400 hover:text-neutral-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {isLoggedIn !== null && (
              <Link
                href={isLoggedIn ? "/compte" : "/connexion"}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300 transition hover:border-white/20 hover:text-white"
              >
                {isLoggedIn ? "Mon compte" : "Connexion"}
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="cursor-pointer rounded-xl border border-white/10 p-2 text-neutral-300 transition hover:border-white/20 hover:text-white md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              {open ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <div className="md:hidden">
            <div
              id="mobile-nav-panel"
              className="absolute inset-x-0 top-full z-30 border-b border-white/[0.06] bg-ink/95 backdrop-blur-2xl"
            >
              <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition ${
                        active
                          ? "bg-primary text-ink"
                          : "text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {isLoggedIn !== null && (
                  <Link
                    href={isLoggedIn ? "/compte" : "/connexion"}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    {isLoggedIn ? "Mon compte" : "Connexion"}
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
      </header>

      {open && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
    </Fragment>
  );
}
