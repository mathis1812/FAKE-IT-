"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { openAuthSheet } from "@/components/AuthSheet";
import { createClient } from "@/lib/supabase/client";

/**
 * En-tête partagé, réduit au strict nécessaire comme sur le modèle : la
 * marque à gauche, un seul bouton à droite. Ni navigation desktop, ni menu
 * mobile — les liens produit vivent désormais dans le pied de page.
 *
 * Non collant et sans fond : il repose directement sur le noir de la page.
 */
export default function SiteHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // `null` tant que la session n'est pas connue : évite d'afficher
  // brièvement « Sign in » à un utilisateur déjà connecté pendant
  // l'hydratation.
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

  return (
    <header className="flex items-center justify-between px-4 pt-3 sm:px-6">
      <Link
        href="/"
        className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-[26px]"
      >
        Bluminoo
      </Link>

      {isLoggedIn !== null &&
        (isLoggedIn ? (
          <Link
            href="/account"
            className="rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
          >
            My account
          </Link>
        ) : (
          // Ouvre la feuille de connexion plutôt que de naviguer : /sign-in
          // reste atteignable en direct, mais le parcours courant ne quitte
          // plus la page.
          <button
            type="button"
            onClick={openAuthSheet}
            className="rounded-full bg-white px-5 py-2.5 text-[15px] font-semibold text-black transition hover:bg-white/90"
          >
            Sign in
          </button>
        ))}
    </header>
  );
}
