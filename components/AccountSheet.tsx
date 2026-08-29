"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Feuille de compte, ouverte depuis la pastille du studio. Structure relevée
 * sur le produit de référence le 29/08 en lisant son DOM : email, badge de
 * statut, deux boutons, et la déconnexion en simple lien texte rouge — pas
 * un bouton plein, contrairement aux deux au-dessus.
 *
 * « Abonnement & packs » ouvre sur le modèle une feuille de recharge avec
 * des packs de crédits à l'unité (paiement unique, sans abonnement), une
 * ligne de monétisation que Bluminoo n'a pas : aucun produit Stripe pour ça
 * n'existe, et en créer un est une décision à prendre avec l'auteur, pas à
 * deviner ici. Le bouton mène donc à /account, qui porte déjà la vraie
 * gestion d'abonnement (portail Stripe, historique, crédits) — la
 * destination fonctionnelle la plus proche, pas une invention.
 *
 * « Réglages » mène en fait vers une vraie page (/reglages sur le modèle,
 * /settings ici) — ma première vérification l'avait ratée en cliquant trop
 * vite sans attendre la navigation. Voir app/settings/page.tsx.
 */
export default function AccountSheet({
  isOpen,
  onClose,
  email,
  planId,
}: {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  planId: string | null;
}) {
  const router = useRouter();
  const isSubscribed = !!planId;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close account"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-env(safe-area-inset-top)-24px)] flex-col overflow-y-auto rounded-t-[47px] bg-black pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        <span
          aria-hidden
          className="mx-auto h-1.5 w-9 shrink-0 rounded-full bg-white/30"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-[calc(env(safe-area-inset-top)+20px)] flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition active:opacity-70"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col gap-4 px-6 pt-8">
          <div className="flex flex-col gap-2">
            <h2
              id="account-sheet-title"
              className="text-[22px] font-semibold leading-tight text-white"
            >
              Your account
            </h2>
            <p className="break-all text-base leading-6 text-white/70">
              {email}
            </p>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[13px] font-semibold ${
                isSubscribed
                  ? "bg-primary text-white"
                  : "bg-white/10 text-white/70"
              }`}
            >
              {isSubscribed ? "Subscribed" : "Free"}
            </span>
          </div>

          <Link
            href="/account"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-3xl bg-white text-[17px] font-medium text-black transition active:opacity-70"
          >
            Subscription & packs
          </Link>

          <Link
            href="/settings"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-3xl border-[1.5px] border-white/15 bg-black/30 text-[17px] font-medium text-white transition active:opacity-70"
          >
            Settings
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-14 w-full items-center justify-center gap-2 text-[17px] font-medium text-[#ff453a] transition active:opacity-70"
          >
            <svg
              aria-hidden
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
