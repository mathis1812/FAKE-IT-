import type { PlanId } from "@/lib/stripe";

/**
 * Qualités d'image, coûts, et ce que chaque palier d'abonnement débloque.
 *
 * Relevé le 29/08 dans le bundle du produit de référence (constantes
 * `QUALITY_COST`, `RESOLUTION_LABEL`, `CRANS_IMAGE`, `DUREES_VIDEO`,
 * `coutCredits`) plutôt qu'estimé depuis l'écran : le coût du 4K n'est
 * jamais affichable sur un compte Pro, où il est verrouillé.
 *
 * Aucune dépendance serveur ici — ce module est importé par des composants
 * client pour afficher un coût avant génération, et par la route de
 * génération pour le facturer. Une seule source, donc pas de dérive
 * possible entre ce qui est annoncé et ce qui est débité.
 */

export type ImageQuality = "normal" | "high" | "max";
export type GenerationMode = "photo" | "video";

/**
 * Ordre croissant des paliers — l'index sert aux comparaisons de droits.
 * Exporté pour que l'écran d'abonnement puisse proposer le palier suivant
 * sans redéfinir cet ordre de son côté (deux listes divergeraient).
 */
export const PLAN_ORDER: PlanId[] = ["lite", "pro", "max"];

export const IMAGE_QUALITIES: ImageQuality[] = ["normal", "high", "max"];

export const QUALITY_LABEL: Record<ImageQuality, "1K" | "2K" | "4K"> = {
  normal: "1K",
  high: "2K",
  max: "4K",
};

export const QUALITY_COST: Record<ImageQuality, number> = {
  normal: 100,
  high: 150,
  max: 250,
};

/**
 * Palier minimum requis par qualité. `null` = ouvert à tous, y compris sans
 * abonnement : c'est ce qui permet au parcours gratuit d'exister.
 */
const QUALITY_GATE: Record<ImageQuality, PlanId | null> = {
  normal: null,
  high: "pro",
  max: "max",
};

/** Palier minimum pour la vidéo et pour le Red Snap — les deux sur Pro. */
const VIDEO_GATE: PlanId = "pro";
const RED_SNAP_GATE: PlanId = "pro";

export const VIDEO_DURATIONS = [4, 6, 8] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];
export const DEFAULT_VIDEO_DURATION: VideoDuration = 6;

/**
 * 150 crédits par seconde — vérifié sur les trois durées du modèle
 * (4s=600, 6s=900, 8s=1200) plutôt que déduit d'une seule.
 */
const VIDEO_COST_PER_SECOND = 150;

/**
 * Rétrécit la valeur brute lue dans `profiles.plan` (une colonne texte, donc
 * `string`) vers un `PlanId`. Toute valeur inconnue — un ancien palier
 * `essentiel` resté en base, une faute de frappe — devient `null`, donc
 * traitée comme « sans abonnement » plutôt que d'ouvrir des droits par
 * accident. Préférable à un cast, qui accorderait ces droits en silence.
 */
export function asPlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  return (PLAN_ORDER as string[]).includes(value) ? (value as PlanId) : null;
}

/**
 * TEMPORAIRE (demandé le 31/08, "pour le moment ... pour je puisse avoir
 * accès") : lève toutes les barrières de palier — qualité, vidéo, Red Snap —
 * tant qu'aucun produit Stripe réel n'est encore configuré, pour permettre
 * de tester le parcours complet sans abonnement. À repasser à `false` une
 * fois les produits Stripe (LITE/PRO/MAX) créés et l'accès payant voulu.
 */
export const TESTING_UNLOCK_ALL_TIERS = false;

/** `plan` vaut `null` pour un visiteur sans abonnement. */
function meetsPlan(plan: PlanId | null, required: PlanId): boolean {
  if (TESTING_UNLOCK_ALL_TIERS) return true;
  if (!plan) return false;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required);
}

export function isQualityOpen(
  quality: ImageQuality,
  plan: PlanId | null,
): boolean {
  const gate = QUALITY_GATE[quality];
  if (gate === null) return true;
  return meetsPlan(plan, gate);
}

/** La meilleure qualité ouverte à ce palier — sert de valeur par défaut. */
export function maxQualityFor(plan: PlanId | null): ImageQuality {
  for (let i = IMAGE_QUALITIES.length - 1; i >= 0; i--) {
    const quality = IMAGE_QUALITIES[i];
    if (isQualityOpen(quality, plan)) return quality;
  }
  return "normal";
}

export function isVideoOpen(plan: PlanId | null): boolean {
  return meetsPlan(plan, VIDEO_GATE);
}

/**
 * Le Red Snap est réservé aux paliers Pro et Max — Lite ne l'a pas.
 *
 * Corrigé le 29/08 : une vérification antérieure avait conclu à tort que
 * les trois paliers étaient équivalents. Les boutons Lite et Pro étaient
 * `disabled` sur le compte observé (déjà abonné Pro, rétrogradation
 * impossible), donc les clics de comparaison ne changeaient jamais la
 * sélection et relisaient toujours la même liste.
 */
export function hasRedSnap(plan: PlanId | null): boolean {
  return meetsPlan(plan, RED_SNAP_GATE);
}

export function photoCost(quality: ImageQuality): number {
  return QUALITY_COST[quality];
}

export function videoCost(duration: VideoDuration): number {
  return duration * VIDEO_COST_PER_SECOND;
}

/**
 * Qualité appliquée aux gabarits. Le modèle la fixe à 2K quel que soit le
 * palier (`CRAN_TEMPLATE = "high"`) : un gabarit a un rendu de référence
 * montré au client, il doit sortir au même niveau pour tout le monde.
 *
 * Le 4K a été essayé le 03/09 puis abandonné : plus lourd et plus lent, sans
 * gain visible. La photo d'entrée dépasse rarement 4000 px, donc demander du
 * 4K en sortie revient à faire agrandir le modèle — le défaut même que la
 * pleine résolution d'entrée avait corrigé (cf. `ENCODE_STEPS` dans
 * `lib/studio-image.ts`).
 */
export const TEMPLATE_QUALITY: ImageQuality = "high";
