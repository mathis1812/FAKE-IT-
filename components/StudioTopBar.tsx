"use client";

import Link from "next/link";
import { useState } from "react";
import AccountSheet from "@/components/AccountSheet";
import MenuSheet from "@/components/MenuSheet";
import RechargeSheet from "@/components/RechargeSheet";

/**
 * Barre supérieure partagée par le studio et la page des gabarits — les deux
 * pages du modèle portent le même en-tête (menu, compte, crédits) mais un
 * titre central différent : le mot-symbole sur le studio, « Templates »
 * souligné sur la page des gabarits.
 *
 * Extraite pour ne pas dupliquer les trois feuilles (menu, compte, recharge)
 * ni leur câblage. Elle ne va pas chercher la session elle-même : le studio
 * la possède déjà (il en a besoin pour le gating), il la passe en props ;
 * un double appel Supabase serait inutile.
 */
export default function StudioTopBar({
  credits,
  planId,
  email,
  accountInitial,
  title,
}: {
  credits: number | null;
  planId: string | null;
  email: string;
  accountInitial: string;
  /** Titre central. Absent : le mot-symbole (studio). Présent : titre souligné. */
  title?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  return (
    <>
      {/* Barre fixe posée au-dessus du contenu. Le conteneur ne capte pas le
          pointeur pour ne pas bloquer le défilement dessous ; seuls les
          boutons le réactivent. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open the menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Your account"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-[15px] font-semibold text-white transition active:opacity-80"
          >
            {accountInitial}
          </button>
        </div>

        {title ? (
          // Titre de section souligné, centré sur la page (pas sur l'espace
          // restant, sinon il se décalerait selon la largeur des boutons).
          <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
            <span className="whitespace-nowrap text-[1.3rem] font-bold tracking-tight text-white">
              {title}
            </span>
            <span
              aria-hidden
              className="mt-1 h-[2.5px] w-8 rounded-full bg-[#ff453a]"
            />
          </div>
        ) : (
          <Link
            href="/landing"
            className="pointer-events-auto absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[1.8rem] font-bold tracking-tight text-white transition active:opacity-70"
          >
            Bluminoo
          </Link>
        )}

        {credits !== null && (
          <button
            type="button"
            onClick={() => setRechargeOpen(true)}
            aria-label={`${credits} credits — see the plans`}
            aria-haspopup="dialog"
            className="pointer-events-auto flex h-[42px] w-[92px] shrink-0 items-center justify-center gap-1 rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
            {/* tabular-nums : sans lui, la pastille se décale à chaque
                changement de crédits, les chiffres n'ayant pas la même
                largeur dans Geist. */}
            <span className="text-[15px] font-semibold tabular-nums">
              {credits.toLocaleString("en-US")}
            </span>
          </button>
        )}
      </header>

      <MenuSheet
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        credits={credits}
        planId={planId}
      />

      <AccountSheet
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        onOpenRecharge={() => setRechargeOpen(true)}
        email={email}
        planId={planId}
      />

      <RechargeSheet
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
      />
    </>
  );
}
