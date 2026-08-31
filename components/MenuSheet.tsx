"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { openAuthSheet } from "@/components/AuthSheet";
import {
  asPlanId,
  hasRedSnap as planHasRedSnap,
} from "@/lib/generation-tiers";

/**
 * Menu principal, en feuille remontant du bas de l'écran.
 *
 * Structure et classes relevées sur le produit de référence le 28/08 en
 * lisant son DOM : marque, solde de crédits avec sa recharge, trois entrées
 * de navigation dont l'active est pleine et blanche, puis la carte Red Snap
 * en jaune Snapchat.
 *
 * Contrairement à `AuthSheet`, pas d'événement de fenêtre ici : le bouton
 * hamburger et cette feuille vivent tous deux dans `app/page.tsx`. Un simple
 * état local suffit, et les crédits déjà chargés par le studio sont passés
 * en props plutôt que rechargés — un second appel Supabase pour la même
 * donnée n'apporterait rien.
 *
 * La poignée de glissement est décorative, comme sur `AuthSheet` : le modèle
 * ferme aussi au glissé, geste non repris ici faute de pouvoir en relever le
 * seuil et la courbe autrement qu'en devinant.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Vrai quand cette entrée correspond à l'écran affiché. */
  isActive: (
    pathname: string,
    currentScreen: "studio" | "templates" | undefined,
  ) => boolean;
  /**
   * Studio et gabarits vivent dans le même DOM (rail glissable sur /),
   * pas deux routes distinctes — relevé en direct, l'URL ne change jamais.
   * Ces deux entrées font donc glisser le rail au lieu de naviguer, sur
   * app/page.tsx qui seul le possède. `undefined` sur les autres écrans
   * (ex. /gallery), où on ne fait que naviguer normalement.
   */
  screen?: "studio" | "templates";
};

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Create",
    screen: "studio",
    isActive: (p, s) => p === "/" && (s ?? "studio") === "studio",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    ),
  },
  {
    href: "/",
    label: "Templates",
    screen: "templates",
    isActive: (p, s) => p === "/" && s === "templates",
    icon: (
      <svg {...ICON_PROPS}>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
  },
  {
    href: "/gallery",
    label: "Gallery",
    isActive: (p) => p.startsWith("/gallery"),
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M18 22H4a2 2 0 0 1-2-2V6" />
        <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
        <circle cx="12" cy="8" r="2" />
        <rect width="16" height="16" x="6" y="2" rx="2" />
      </svg>
    ),
  },
];

export default function MenuSheet({
  isOpen,
  onClose,
  credits,
  planId,
  currentScreen,
  onNavigateStudio,
  onNavigateTemplates,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** `null` quand personne n'est connecté. */
  credits: number | null;
  planId: string | null;
  currentScreen?: "studio" | "templates";
  onNavigateStudio?: () => void;
  onNavigateTemplates?: () => void;
}) {
  const pathname = usePathname();

  const isLoggedIn = credits !== null;
  /**
   * Le Red Snap est réservé aux paliers Pro et Max — Lite ne l'a pas.
   *
   * Corrigé le 31/08 : la carte était masquée à ceux qui ONT l'avantage,
   * en partant du principe qu'elle ne servait qu'à le vendre. Relevé sur le
   * modèle avec un compte Pro, c'est l'inverse — il la leur montre, et son
   * bouton mène à l'écran qui explique comment envoyer un Snap rouge. Ce
   * sont eux qui en ont l'usage ; la masquer les privait du mode d'emploi
   * de ce qu'ils paient.
   *
   * La destination reste donc conditionnelle : le mode d'emploi pour un
   * abonné Pro/Max (parcours vérifié sur le modèle), la grille tarifaire
   * pour les autres, à qui montrer un tutoriel d'une option verrouillée
   * serait une impasse.
   */
  const hasRedSnap = planHasRedSnap(asPlanId(planId));

  // Échap ferme, et le défilement de la page est verrouillé tant que la
  // feuille est ouverte — sinon l'arrière-plan défile sous les doigts.
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

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close the menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="animate-sheet-up absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-env(safe-area-inset-top)-24px)] flex-col overflow-y-auto rounded-t-[47px] bg-black pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+12px)]"
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

        <div className="flex flex-col gap-2 px-6 pt-8">
          <p className="text-[1.8rem] font-bold leading-none tracking-tight text-white">
            Bluminoo
          </p>

          {/* Solde et recharge, ou invitation à se connecter : une ligne de
              crédits n'aurait rien à montrer à un visiteur non connecté. */}
          <div className="mb-8 mt-8 flex items-center justify-between gap-2">
            {isLoggedIn ? (
              <>
                <span className="flex items-center gap-2 text-[18px] font-semibold leading-7 text-white/70">
                  <svg
                    width="19"
                    height="19"
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
                  {/* Espace écrit explicitement : laissé au découpage de
                      lignes de JSX, il dépendrait de l'indentation. */}
                  <span className="tabular-nums">
                    {credits.toLocaleString("en-US")}
                  </span>
                  {" credits"}
                </span>
                <Link
                  href="/pricing"
                  onClick={onClose}
                  className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-[14px] font-semibold text-white transition active:opacity-80"
                >
                  Top up
                </Link>
              </>
            ) : (
              <>
                <span className="text-[18px] font-semibold leading-7 text-white/70">
                  Not signed in
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthSheet("signin");
                  }}
                  className="shrink-0 rounded-full bg-primary px-3.5 py-2 text-[14px] font-semibold text-white transition active:opacity-80"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {NAV_ITEMS.map((item, index) => {
            const active = item.isActive(pathname, currentScreen);
            const itemClassName = `relative flex h-14 w-full items-center justify-center gap-3 rounded-3xl px-[17px] text-[17px] font-medium transition active:opacity-70 ${
              active
                ? "bg-white text-black"
                : "border-[1.5px] border-white/15 bg-black/30 text-white"
            }`;
            // Fait glisser le rail plutôt que naviguer, quand le handler
            // correspondant existe (uniquement fourni depuis app/page.tsx,
            // seul possesseur du rail).
            const navigateRail =
              item.screen === "studio"
                ? onNavigateStudio
                : item.screen === "templates"
                  ? onNavigateTemplates
                  : undefined;

            return (
              <div key={item.label} className="contents">
                {/* Séparateur au-dessus de chaque entrée sauf la première :
                    c'est ainsi qu'ils tombent sur le modèle. */}
                {index > 0 && (
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    className="mx-6 my-1 h-[1.5px] shrink-0 bg-white/15"
                  />
                )}
                {navigateRail ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigateRail();
                      onClose();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={itemClassName}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={itemClassName}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )}
              </div>
            );
          })}

          {/* Toujours affichée, quel que soit le palier : c'est seulement la
              destination qui change. Restreindre l'affichage priverait les
              uns du mode d'emploi et les autres de l'argument de vente. */}
          <div
            role="separator"
            aria-orientation="horizontal"
            className="mx-6 my-1 h-[1.5px] shrink-0 bg-white/15"
          />
          <Link
            href={hasRedSnap ? "/red-snap" : "/pricing"}
            onClick={onClose}
            className="mt-2 flex h-[96px] items-center justify-between gap-3 rounded-3xl bg-[#FFFC00] px-5 transition active:opacity-90"
          >
            <span className="text-[18px] font-semibold leading-tight text-black">
              Send your AI generations
              <br />
              as a Red Snap
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary py-2 pl-5 pr-4 text-[15px] font-semibold text-white">
              See
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h13" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
