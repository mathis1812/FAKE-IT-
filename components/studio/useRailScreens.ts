"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StudioScreen = "studio" | "templates";

// Distance avant de trancher entre tap et glissement — en dessous, le
// geste reste un candidat ; relevé empiriquement, assez petit pour rester
// réactif, assez grand pour ne pas gêner un tap au doigt légèrement
// tremblant.
const RAIL_DRAG_THRESHOLD = 10;

/**
 * Le rail : deux panneaux empilés qu'un glissement vertical fait défiler.
 *
 * Studio et gabarits ne sont PAS deux pages Next.js : relevé en direct sur
 * le modèle, l'URL ne change jamais en cliquant « Templates ». Ce sont
 * deux panneaux qui coexistent dans le même DOM (`<main>` + `<section>`,
 * chacun `h-dvh`), empilés dans un rail qu'on fait glisser via
 * `transform: translateY()` — clippé par un conteneur `overflow-hidden`.
 * La classe du rail sur le modèle s'appelle littéralement
 * `rail-panneaux` : le nom lui-même dit que le geste de glissement est
 * l'interaction principale, pas un simple clic.
 *
 * Tout est ici plutôt que dans l'écran : ces refs, ces états et ces cinq
 * gestionnaires ne se comprennent qu'ensemble, et trois corrections
 * successives ont montré qu'en déplacer un seul suffit à casser le geste.
 * Les commentaires détaillent chacune de ces corrections — les lire avant de
 * toucher quoi que ce soit.
 */
export function useRailScreens() {
  const [screen, setScreen] = useState<StudioScreen>("studio");
  const railRef = useRef<HTMLDivElement>(null);
  // Le panneau gabarits défile en interne (overflow-y-auto) : pour ne pas
  // voler ce défilement, on ne considère un tiré vers le bas comme "retour
  // au studio" que si la liste est déjà tout en haut au moment du toucher.
  const templatesPanelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    startY: number;
    startX: number;
    startTranslate: number;
    startScrollTop: number;
    /**
     * Faux tant qu'on n'a pas franchi le seuil : le geste peut encore
     * devenir un tap sur une carte, un défilement de liste, ou notre
     * glissement de rail. `null` (via dragRef.current = null) annule le
     * candidat sans jamais le confirmer.
     */
    confirmed: boolean;
  } | null>(null);
  // Ref, pas état : doit être lu de façon synchrone par le handler de clic
  // qui avale le tap terminant un glissement confirmé (voir plus bas), sans
  // attendre un re-render.
  const isRailDraggingRef = useRef(false);
  const [dragTranslate, setDragTranslate] = useState<number | null>(null);

  /**
   * Hauteur réelle d'un panneau, mesurée sur le conteneur `h-dvh`.
   *
   * Les panneaux sont dimensionnés en CSS (`h-dvh`) mais déplacés en JS. Tant
   * que le déplacement se calculait sur `window.innerHeight`, les deux
   * divergeaient : `dvh` se recalcule en continu quand la barre d'adresse
   * mobile apparaît ou disparaît, alors qu'`innerHeight` n'était relu qu'au
   * rendu React suivant — et aucun écouteur de redimensionnement ne
   * provoquait ce rendu. Le rail se décalait donc du panneau, laissant voir
   * une bande de l'écran voisin, et le seuil de bascule du glissement se
   * mesurait sur une hauteur fausse.
   *
   * Un `ResizeObserver` sur l'élément qui porte `h-dvh` rend CSS et JS
   * d'accord par construction : c'est la même hauteur, plus une estimation.
   */
  const viewportRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setPanelHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const screenTranslate = useCallback(
    (s: StudioScreen) => {
      if (s !== "templates") return 0;
      // Avant la première mesure — rendu serveur, tout premier rendu client —
      // on retombe sur `innerHeight` plutôt que sur 0, sinon le rail
      // afficherait brièvement le studio alors que l'écran est « templates ».
      if (panelHeight > 0) return -panelHeight;
      return typeof window === "undefined" ? 0 : -window.innerHeight;
    },
    [panelHeight],
  );

  const onRailPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Un champ de saisie garde la main entière sur le geste : y glisser
      // doit placer le curseur ou sélectionner du texte, pas basculer
      // l'écran. Les autres cibles (dont les cartes, désormais) démarrent
      // un candidat — voir onRailPointerMove pour la suite du tri.
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      dragRef.current = {
        startY: e.clientY,
        startX: e.clientX,
        startTranslate: screenTranslate(screen),
        startScrollTop:
          screen === "templates"
            ? (templatesPanelRef.current?.scrollTop ?? 0)
            : 0,
        confirmed: false,
      };
      // Aucune capture de pointeur ici — elle est prise plus tard, au moment
      // où le geste devient un vrai glissement. Voir `onRailPointerMove`.
    },
    [screen, screenTranslate],
  );

  const onRailPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaY = e.clientY - drag.startY;

      if (!drag.confirmed) {
        const deltaX = e.clientX - drag.startX;
        if (
          Math.abs(deltaY) < RAIL_DRAG_THRESHOLD ||
          Math.abs(deltaX) > Math.abs(deltaY)
        ) {
          return;
        }
        if (screen === "templates" && (deltaY <= 0 || drag.startScrollTop > 0)) {
          // Tiré vers le haut, ou liste pas tout en haut : c'est un
          // défilement normal de la liste, pas un retour au studio. On
          // abandonne le candidat sans avoir jamais appelé preventDefault,
          // le défilement natif suit donc son cours.
          dragRef.current = null;
          return;
        }
        drag.confirmed = true;
        isRailDraggingRef.current = true;

        // La capture est prise ICI, et pas au premier contact.
        //
        // Sur LE RAIL, pas sur `e.target` : la cible est la carte ou l'image
        // touchée, et si elle est re-rendue ou retirée pendant le geste, la
        // capture se perd, plus aucun pointermove n'arrive, et le rail se
        // fige à mi-course. Le rail, lui, reste monté d'un bout à l'autre.
        //
        // Mais la prendre dès `pointerdown` cassait TOUS les clics du rail :
        // la capture détourne le `pointerup` vers l'élément capturant, et le
        // navigateur en déduit que le `click` appartient au rail plutôt qu'au
        // bouton touché. Le bouton ne recevait donc jamais son `onClick` —
        // c'est ce qui rendait les sélecteurs de résolution et de mode
        // inertes. Relevé le 08/09 : `pointerdown` sur « 2K », `pointerup` et
        // `click` sur le rail.
        //
        // Ici, le seuil est déjà franchi : le geste ne peut plus devenir un
        // tap, donc rien de cliquable n'est sacrifié.
        railRef.current?.setPointerCapture(e.pointerId);
      }

      // Confirmé : on prend la main sur le geste, y compris s'il a commencé
      // sur une carte (lien) — sinon le retour est bloqué partout où
      // l'écran gabarits est couvert de cartes, ce qui le rend impraticable.
      e.preventDefault();
      // Même hauteur que celle des panneaux : cf. `panelHeight`.
      const vh = panelHeight || window.innerHeight;
      const next = Math.min(0, Math.max(-vh, drag.startTranslate + deltaY));
      setDragTranslate(next);
    },
    [panelHeight, screen],
  );

  const onRailPointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.confirmed) {
      isRailDraggingRef.current = false;
      return;
    }
    const vh = panelHeight || window.innerHeight;
    const traveled = dragTranslate ?? screenTranslate(screen);
    const destination = screen === "templates" ? "studio" : "templates";
    // Bascule dès qu'on a franchi le quart de l'écran DANS LE SENS DU
    // GLISSEMENT, comme un tiroir qu'on relâche à mi-course. Le seuil se
    // mesure depuis le point de départ du geste, pas comme une valeur
    // absolue de translateY : une valeur absolue rendait le retour
    // templates → studio bien plus dur à déclencher que l'aller (il aurait
    // fallu franchir les 3/4 de l'écran au lieu d'un quart) — c'est ce qui
    // rendait le retour au studio quasi impossible à obtenir.
    const progress = Math.abs(traveled - drag.startTranslate);
    const next = progress > vh / 4 ? destination : screen;
    setDragTranslate(null);
    setScreen(next);
    // Le tap qui clôt le geste (click, synthétisé juste après pointerup)
    // doit encore trouver la garde levée pour être avalé par
    // onRailClickCapture — on ne la relâche qu'au tour suivant.
    setTimeout(() => {
      isRailDraggingRef.current = false;
    }, 0);
  }, [dragTranslate, panelHeight, screen, screenTranslate]);

  /**
   * Réclame le geste vertical AVANT que le navigateur ne le prenne.
   *
   * Le panneau des gabarits est défilable. Sur mobile, le navigateur décide
   * dès le premier `touchmove` si un geste vertical lui appartient — et une
   * fois le défilement lancé, plus rien ne l'annule. Le `preventDefault()`
   * des gestionnaires de pointeur, appelé seulement après le seuil de dix
   * pixels, arrivait donc toujours trop tard : le glissement démarrait sur
   * quelques pixels, le navigateur coupait, le parcours restait sous le
   * quart de hauteur et le rail retombait sur les gabarits. Vu de
   * l'utilisateur : le studio s'entrouvre puis se referme, et le retour est
   * impossible.
   *
   * L'écouteur est posé à la main parce que React ne permet pas de choisir
   * `passive: false`, et qu'un écouteur passif ne peut rien empêcher.
   *
   * La décision se prend au premier mouvement, sur le seul cas où elle est
   * certaine : écran gabarits, liste tout en haut, doigt qui descend. Là, le
   * geste ne peut être qu'un retour au studio — il n'y a rien à défiler vers
   * le haut. Tout le reste est laissé au navigateur, donc la liste continue
   * de défiler normalement.
   */
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.confirmed) {
        e.preventDefault();
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      if (
        screen === "templates" &&
        drag.startScrollTop === 0 &&
        touch.clientY - drag.startY > 0
      ) {
        e.preventDefault();
      }
    };

    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [screen]);

  /**
   * Le navigateur nous retire le geste : défilement natif qu'il a décidé de
   * prendre, geste système, appel entrant, second doigt posé.
   *
   * On ANNULE — le rail revient à son écran courant. Câbler `pointercancel`
   * sur `onRailPointerUp`, comme c'était le cas, revenait à traiter cet
   * arrachement comme un relâché délibéré : si le doigt avait déjà parcouru
   * un quart de hauteur, l'écran basculait alors que l'utilisateur n'avait
   * rien terminé. C'est la cause des changements d'écran involontaires.
   */
  const onRailPointerCancel = useCallback(() => {
    dragRef.current = null;
    setDragTranslate(null);
    // Même report que pour un relâché : le clic synthétisé doit encore
    // trouver la garde levée. Cf. `onRailClickCapture`.
    setTimeout(() => {
      isRailDraggingRef.current = false;
    }, 0);
  }, []);

  // Un glissement confirmé qui s'est terminé sur une carte (lien) ou un
  // bouton ne doit pas aussi déclencher son clic — sinon relâcher après
  // avoir glissé jusqu'au studio ouvre en plus le gabarit sous le doigt.
  const onRailClickCapture = useCallback((e: React.MouseEvent) => {
    if (isRailDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Ouvre directement sur le panneau gabarits quand on arrive via
  // /?screen=templates — le lien « retour » d'une page de gabarit profond
  // (ex. /templates/category/<c>) doit ramener sur l'étagère, pas sur le
  // studio. Volontairement APRÈS l'hydratation (pas dans l'état initial) :
  // le serveur ne connaît pas `window.location.search`, y répondre dans
  // l'initialiseur du state aurait désynchronisé le premier rendu client
  // du rendu serveur.
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("screen") === "templates"
    ) {
      setScreen("templates");
    }
  }, []);

  /**
   * Prêt à étaler sur le rail : les cinq gestionnaires plus le style de
   * transformation. Rendu comme un bloc pour qu'on ne puisse pas en câbler
   * quatre sur cinq — `pointercancel` oublié, c'était précisément le bug des
   * bascules involontaires.
   */
  const railProps = {
    ref: railRef,
    onPointerDown: onRailPointerDown,
    onPointerMove: onRailPointerMove,
    onPointerUp: onRailPointerUp,
    onPointerCancel: onRailPointerCancel,
    onClickCapture: onRailClickCapture,
    // Glisser depuis une carte déclenche sinon le glissé-déposé natif
    // du navigateur sur son image (dragstart), qui vole le geste : le
    // doigt/la souris continue de bouger mais plus aucun événement
    // pointermove/pointerup n'atteint nos handlers, et l'écran reste
    // bloqué à mi-course. On le désamorce ici, à la racine du rail.
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    style: {
      transform: `translateY(${dragTranslate ?? screenTranslate(screen)}px)`,
      transition:
        dragTranslate === null
          ? "transform 0.64s cubic-bezier(0.22,1,0.36,1)"
          : "none",
    } as React.CSSProperties,
  };

  return {
    screen,
    setScreen,
    viewportRef,
    templatesPanelRef,
    railProps,
  };
}
