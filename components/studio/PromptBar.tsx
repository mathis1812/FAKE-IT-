"use client";

import { useEffect, useRef, useState } from "react";
import {
  IMAGE_QUALITIES,
  isQualityOpen,
  photoCost,
  QUALITY_LABEL,
  VIDEO_DURATIONS,
  videoCost,
  type GenerationMode,
  type ImageQuality,
  type VideoDuration,
} from "@/lib/generation-tiers";
import type { PlanId } from "@/lib/stripe";

const PROMPT_PLACEHOLDER = "Describe the scene you want…";
/**
 * Placeholder court pour l'état plié : le champ y est étroit (Templates
 * occupe la gauche), et la phrase longue passait sur deux lignes en se
 * coupant. Le modèle fait pareil — « Modifier… » plié, phrase entière
 * déplié.
 */
const PROMPT_PLACEHOLDER_SHORT = "Edit…";

/**
 * Panneau d'aide, ouvert par le (i) en haut à droite du champ. Sur le
 * modèle il ne s'ouvre pas par-dessus la barre : c'est la barre elle-même
 * qui vire au bleu et échange son contenu, d'où le fait que ce texte vive
 * ici et pas dans un composant de bulle séparé. Contenu traduit du modèle,
 * pas inventé.
 */
const HELP_TITLE = "For a better result";
const HELP_LINES = [
  "Just describe what you want to change, nothing else. The rest of the image is preserved automatically.",
  "Also use a sharp, well-lit and well-framed photo: it makes all the difference.",
];

/**
 * Barre du bas, deux états comme le modèle :
 * - replié (champ vide et sans focus) : le bouton Templates est un pavé
 *   séparé à gauche, le champ est court, sa flèche seule au centre-droit ;
 * - déplié (focus ou texte) : Templates s'efface, le champ occupe toute la
 *   largeur et grandit, la rangée d'outils (mode + résolution) apparaît en
 *   bas à gauche, le coût rejoint la flèche.
 *
 * Le textarea est le MÊME élément dans les deux états (seules ses classes
 * changent) : le remonter ferait perdre le focus au moment où le clic
 * déclenche justement la bascule.
 *
 * Les états d'ouverture (focus, aide, sélecteur de résolution) vivent ici et
 * pas dans l'écran : ils ne décrivent que l'apparence de cette barre, et les
 * remonter obligerait l'écran à connaître des règles qui ne le regardent pas
 * — par exemple qu'ouvrir l'aide doit empêcher la barre de se replier.
 */
export default function PromptBar({
  userNote,
  setUserNote,
  quality,
  setQuality,
  mode,
  setMode,
  videoDuration,
  setVideoDuration,
  videoOpen,
  plan,
  canSubmit,
  onGenerate,
  onOpenTemplates,
  hasTemplates,
}: {
  userNote: string;
  setUserNote: (note: string) => void;
  quality: ImageQuality;
  setQuality: (quality: ImageQuality) => void;
  mode: GenerationMode;
  setMode: (mode: GenerationMode) => void;
  videoDuration: VideoDuration;
  setVideoDuration: (duration: VideoDuration) => void;
  /** Vidéo ouverte au palier — Pro et Max seulement. */
  videoOpen: boolean;
  plan: PlanId | null;
  canSubmit: boolean;
  onGenerate: () => void;
  onOpenTemplates: () => void;
  hasTemplates: boolean;
}) {
  /**
   * La barre active fait apparaître les outils (mode + résolution) à la
   * place du bouton Templates : sur le modèle les deux ne coexistent jamais,
   * ce qui évite de faire déborder la rangée sur un écran étroit.
   */
  const [barFocused, setBarFocused] = useState(false);
  /**
   * Sélecteur de résolution replié par défaut : relevé sur le modèle, seul
   * le cran choisi est visible, et le toucher déplie les autres (les crans
   * repliés y passent en `max-width: 0`, pas en `display:none`, pour que
   * l'ouverture glisse au lieu de sauter).
   */
  const [resolutionOpen, setResolutionOpen] = useState(false);
  /**
   * Panneau d'aide : sur le modèle il ne se superpose pas à la barre, c'est
   * la barre qui vire au bleu et échange son contenu.
   */
  const [infoOpen, setInfoOpen] = useState(false);
  /**
   * Largeur mesurée du bouton Templates : sur le modèle, ce n'est pas un
   * simple `hidden`/`flex` (qui saute instantanément) mais un conteneur
   * `overflow-hidden` dont la largeur glisse jusqu'à 0px en 550ms au focus,
   * repoussant le textarea dans l'espace libéré. Une largeur figée en dur
   * casserait sur une traduction plus longue que "Templates" ; on la mesure
   * donc, comme cardSize pour la carte.
   */
  const templatesBtnRef = useRef<HTMLButtonElement>(null);
  const [templatesBtnWidth, setTemplatesBtnWidth] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const btn = templatesBtnRef.current;
    if (!btn) return;
    const observer = new ResizeObserver(([entry]) => {
      // border-box : largeur réellement occupée dans la mise en page,
      // padding inclus — celle qu'il faut reproduire sur le conteneur.
      const width =
        entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
      setTemplatesBtnWidth(width);
    });
    observer.observe(btn, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  /** Outils visibles dès que le champ est actif ou porte du texte. */
  // `infoOpen` compte aussi : le panneau d'aide vit DANS la barre dépliée,
  // donc la laisser se replier (au moment où le clic sur le (i) fait perdre
  // le focus au champ) emporterait le panneau qu'on vient d'ouvrir.
  const showTools = barFocused || userNote.trim().length > 0 || infoOpen;

  // La rangée d'outils est démontée quand la barre se replie : sans ce
  // nettoyage, un sélecteur laissé ouvert se retrouverait déjà déplié à la
  // réouverture suivante, sans que le client l'ait redemandé.
  useEffect(() => {
    if (!showTools) setResolutionOpen(false);
  }, [showTools]);

  const isVideo = mode === "video";

  // Le sélecteur segmenté reste ouvert en changeant de mode, sinon il
  // afficherait des durées sous un libellé de résolution le temps d'un rendu.
  useEffect(() => {
    setResolutionOpen(false);
  }, [mode]);

  // Un palier qui perd la vidéo (fin d'abonnement, rétrogradation) ne doit
  // pas laisser le studio en mode vidéo : le bouton d'envoi afficherait un
  // coût que la route refuserait ensuite en 403.
  useEffect(() => {
    if (!videoOpen && mode === "video") setMode("photo");
  }, [videoOpen, mode, setMode]);

  const cost = isVideo ? videoCost(videoDuration) : photoCost(quality);

  /**
   * Le segmenté à droite du mode : crans de résolution en photo, durées en
   * vidéo. Une seule liste normalisée plutôt que deux blocs JSX jumeaux —
   * l'animation de repli (max-w-0, jamais display:none) et les rôles ARIA
   * sont délicats, les dupliquer les ferait diverger.
   */
  const options: {
    key: string;
    label: string;
    open: boolean;
    active: boolean;
    select: () => void;
  }[] = isVideo
    ? VIDEO_DURATIONS.map((d) => ({
        key: String(d),
        label: `${d}s`,
        // Aucune durée n'est verrouillée : le palier ouvre la vidéo ou pas,
        // et les trois durées vont avec.
        open: true,
        active: videoDuration === d,
        select: () => setVideoDuration(d),
      }))
    : IMAGE_QUALITIES.map((q) => ({
        key: q,
        label: QUALITY_LABEL[q],
        open: isQualityOpen(q, plan),
        active: quality === q,
        select: () => setQuality(q),
      }));

  return (
    // Pas de gap ici : l'écart avec le textarea vient du mr-2 du bouton
    // Templates lui-même (comme sur le modèle), pour qu'il disparaisse
    // avec lui quand le conteneur se réduit à 0 plutôt que de laisser un
    // espace vide fixe.
    <div className="mt-3 flex items-end pb-[calc(env(safe-area-inset-bottom)+8px)]">
      {/* Templates : sur le modèle, ce conteneur voit sa largeur glisser
          jusqu'à 0 (550ms) au focus plutôt que de disparaître d'un coup
          (hidden/flex sautait instantanément) — le textarea gagne alors
          l'espace libéré au même rythme. Le bouton reste monté (jamais
          display:none) pour que le ResizeObserver continue de le mesurer
          et pour que le focus du textarea ne soit jamais interrompu par un
          démontage de sibling. */}
      <div
        aria-hidden={showTools}
        className="h-16 shrink-0 overflow-hidden transition-[width] duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: showTools ? 0 : (templatesBtnWidth ?? undefined) }}
      >
        <button
          ref={templatesBtnRef}
          type="button"
          tabIndex={showTools ? -1 : undefined}
          onClick={onOpenTemplates}
          disabled={!hasTemplates || showTools}
          className="mr-2 flex h-16 w-max shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-primary px-5 text-[15px] font-semibold text-white transition active:opacity-70 disabled:pointer-events-none disabled:opacity-40"
        >
          Templates
        </button>
      </div>

      <div className="relative flex-1">
        {/* Le fond, l'arrondi et la hauteur vivent sur ce conteneur, pas
            sur le textarea : c'est lui qui vire au bleu pour le panneau
            d'aide, et le textarea (devenu transparent) n'est qu'un de ses
            deux contenus échangés en fondu — même structure que le modèle,
            où ce conteneur porte l'attribut data-saisie. */}
        <div
          className={`relative overflow-hidden rounded-[32px] transition-[min-height,background-color] duration-[550ms,450ms] ease-[cubic-bezier(0.22,1,0.36,1),ease-in-out] ${
            infoOpen
              ? "min-h-[136px] bg-primary"
              : showTools
                ? "min-h-[112px] bg-white/[0.07]"
                : "min-h-16 bg-white/[0.07]"
          }`}
        >
          {/* Panneau d'aide : en flux normal, c'est lui qui donne sa
              hauteur au conteneur quand il est là. */}
          {infoOpen && (
            <>
              <div className="flex flex-col px-5 pb-5 pt-4 text-white">
                <p className="pr-12 text-[15px] font-semibold leading-tight">
                  {HELP_TITLE}
                </p>
                {HELP_LINES.map((line) => (
                  <p
                    key={line}
                    className="mt-2 text-[13px] leading-[18px] text-white/90"
                  >
                    {line}
                  </p>
                ))}
              </div>
              <button
                type="button"
                aria-label="Close"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setInfoOpen(false)}
                className="absolute right-3.5 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-primary-deep text-white transition active:opacity-70"
              >
                <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </>
          )}

          {/* Contenu normal : jamais démonté quand l'aide s'ouvre, sinon le
              champ perdrait son focus (et donc la barre se replierait). Il
              sort du flux et s'efface, comme sur le modèle. */}
          <div
            className={`transition-opacity duration-200 ${
              infoOpen
                ? "pointer-events-none absolute inset-0 opacity-0"
                : "opacity-100"
            }`}
          >
            <textarea
              rows={1}
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              onFocus={() => setBarFocused(true)}
              onBlur={() => setBarFocused(false)}
              placeholder={
                showTools ? PROMPT_PLACEHOLDER : PROMPT_PLACEHOLDER_SHORT
              }
              aria-label="Describe the scene you want"
              // transition-[min-height] : sur le modèle, c'est la barre qui
              // grandit en douceur (550ms) qui donne l'impression que les
              // outils "montent" en apparaissant — eux ne font qu'un fondu
              // d'opacité (voir animate-tools-in). Sans cette transition ici,
              // la barre sautait instantanément à sa hauteur dépliée.
              className={`relative z-10 block w-full resize-none overflow-hidden bg-transparent px-5 text-[17px] font-medium leading-6 text-white caret-white outline-none transition-[min-height] duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] placeholder:text-white/35 ${
                showTools
                  ? "min-h-[112px] pb-16 pr-14 pt-[18px]"
                  : "min-h-16 pb-[19px] pr-16 pt-[18px]"
              }`}
            />

            {/* (i) en haut à droite du champ, présent seulement déplié —
                mêmes position et fondu que sur le modèle. */}
            {showTools && (
              <button
                type="button"
                aria-label="How to get a better result"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setInfoOpen(true)}
                className="animate-tools-in absolute right-2 top-[10px] z-20 flex h-10 w-10 items-center justify-center text-white/45 transition active:opacity-70"
              >
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </button>
            )}

            {/* État replié : la flèche seule, centrée à droite, sans coût. */}
            {!showTools && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={!canSubmit}
                aria-label={`Generate for ${cost} credits`}
                className="absolute right-1.5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#333333] p-1.5 transition active:opacity-70 disabled:opacity-60"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-white/15 text-white">
                  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5m-7 7 7-7 7 7" />
                  </svg>
                </span>
              </button>
            )}

            {/* État déplié : rangée d'outils épinglée en bas. pointer-events-none
                sur le conteneur pour ne pas voler le focus au textarea ;
                onMouseDown preventDefault pour qu'un clic sur un outil ne le
                fasse pas perdre le focus (sinon la rangée se replierait avant
                le clic). Chaque enfant réactive le pointeur. */}
            {/* Ferme le sélecteur de résolution au toucher n'importe où
                ailleurs, comme sur le modèle. Sous la rangée d'outils (z-30
                contre z-40) pour ne pas intercepter les clics sur les crans
                eux-mêmes. */}
            {showTools && resolutionOpen && (
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setResolutionOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
            )}

            {showTools && (
              <div
                onMouseDown={(e) => e.preventDefault()}
                className={`animate-tools-in pointer-events-none absolute inset-x-[6.5px] bottom-[6.5px] flex items-center gap-1.5 [&>*]:pointer-events-auto ${
                  resolutionOpen ? "z-40" : "z-20"
                }`}
              >
                {/* Mode + résolution dans un conteneur défilable : sur un écran
                    large tout tient, sur mobile ils glissent horizontalement
                    (sans ascenseur visible) plutôt que de pousser le bouton
                    d'envoi hors champ. min-w-0 autorise ce conteneur à passer
                    sous la largeur de son contenu, condition du défilement. */}
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {/* Mode : Photo ou Vidéo, comme sur le modèle. Le cran
                      inactif se replie pendant que le segmenté de droite est
                      ouvert — les deux groupes se partagent la largeur, et
                      c'est ainsi que le modèle fait de la place aux trois
                      crans plutôt que de pousser l'envoi hors de l'écran. */}
                  <div
                    className="flex h-12 shrink-0 items-center rounded-full bg-[#333333] p-1"
                    role="radiogroup"
                    aria-label="Generation mode"
                  >
                    {(["photo", "video"] as const).map((m) => {
                      const active = mode === m;
                      const locked = m === "video" && !videoOpen;
                      const collapsed = resolutionOpen && !active;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={locked || collapsed}
                          aria-hidden={collapsed || undefined}
                          tabIndex={collapsed ? -1 : undefined}
                          title={
                            locked ? "Video is available on Pro and Max" : undefined
                          }
                          onClick={() => setMode(m)}
                          className={`flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full text-[14px] font-semibold capitalize transition-[max-width,padding,background-color,color] duration-[400ms,400ms,300ms,300ms] ease-[cubic-bezier(0.22,1,0.36,1),cubic-bezier(0.22,1,0.36,1),ease,ease] ${
                            collapsed
                              ? "pointer-events-none max-w-0 px-0"
                              : "max-w-24 px-4"
                          } ${
                            active
                              ? "bg-primary text-white"
                              : locked
                                ? "text-white/25"
                                : "text-white/40 active:opacity-70"
                          }`}
                        >
                          {m}
                          {locked && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                              <rect width="14" height="10" x="5" y="11" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 8 0" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Résolution : segmenté inline 1K/2K/4K, comme le modèle. Le
                      cran choisi est plein bleu ; ceux au-dessus du palier sont
                      grisés avec un cadenas et désactivés ; 1K reste ouvert à
                      tous. */}
                  <div
                    className="flex h-12 shrink-0 items-center rounded-full bg-[#333333] p-1"
                    role={resolutionOpen ? "radiogroup" : undefined}
                    aria-label={
                      resolutionOpen
                        ? isVideo
                          ? "Video duration"
                          : "Image resolution"
                        : undefined
                    }
                  >
                    {options.map(({ key, label, open, active, select }) => {
                      // Replié, seul le cran choisi occupe de la place : les
                      // autres passent en max-w-0/px-0 (jamais display:none, pour
                      // que l'ouverture glisse) et sortent de l'ordre de
                      // tabulation. C'est le cran choisi qui porte alors le rôle
                      // de bouton d'ouverture.
                      const collapsed = !resolutionOpen && !active;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!open || collapsed}
                          aria-hidden={collapsed || undefined}
                          tabIndex={collapsed ? -1 : undefined}
                          onClick={() => {
                            if (!resolutionOpen) {
                              setResolutionOpen(true);
                              return;
                            }
                            select();
                            setResolutionOpen(false);
                          }}
                          {...(resolutionOpen
                            ? { role: "radio", "aria-checked": active }
                            : {
                                "aria-haspopup": true,
                                "aria-expanded": false,
                                "aria-label": isVideo
                                  ? `Duration: ${label}`
                                  : `Resolution: ${label}`,
                              })}
                          className={`flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full text-[14px] font-semibold tabular-nums transition-[max-width,padding,background-color,color] duration-[400ms,400ms,300ms,300ms] ease-[cubic-bezier(0.22,1,0.36,1),cubic-bezier(0.22,1,0.36,1),ease,ease] ${
                            collapsed
                              ? "pointer-events-none max-w-0 px-0"
                              : resolutionOpen
                                ? "w-11 max-w-11 px-0"
                                : "max-w-[52px] px-3"
                          } ${
                            active && resolutionOpen
                              ? "bg-primary text-white"
                              : open
                                ? "text-white active:opacity-70"
                                : "text-white/25"
                          }`}
                        >
                          {label}
                          {!open && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                              <rect width="18" height="11" x="3" y="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bouton d'envoi, hors du conteneur défilable : toujours
                    visible, épinglé à droite. Coût (⚡ + nombre) puis le rond de
                    la flèche — deux cercles imbriqués comme sur le modèle. */}
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={!canSubmit}
                  aria-label={`Generate for ${cost} credits`}
                  className="flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[#333333] pl-3.5 pr-1.5 transition active:opacity-70 disabled:opacity-60"
                >
                  <span className="flex items-center gap-1 text-[15px] font-bold tabular-nums text-white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                    </svg>
                    {cost}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5m-7 7 7-7 7 7" />
                    </svg>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
