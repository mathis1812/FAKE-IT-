import type { VideoDuration } from "@/lib/generation-tiers";

/**
 * Kling 3.0 (Kuaishou), servi par la queue fal.ai — photo → vidéo.
 *
 * Choisi contre Seedance 2.5, essayé puis abandonné le 08/09 : à qualité
 * jugée équivalente, Kling coûte 0,126 $/s contre 0,221 $/s pour Seedance en
 * 480p, et 0,473 $/s en 720p. Sur la grille tarifaire du produit de référence
 * (150 crédits/seconde, cf. `VIDEO_COST_PER_SECOND`), la marge passe de ~63 %
 * à ~79 % sur le palier le moins favorable — et le 720p de Seedance, lui,
 * tombait à ~21 %.
 *
 * Variantes disponibles chez fal si le rendu devait être revu à la hausse :
 * `v3/turbo/standard` (720p, 0,112 $/s), `v3/turbo/pro` (1080p, 0,14 $/s),
 * `v3/4k` (0,42 $/s). Toutes restent moins chères que Seedance en 720p.
 */
export const KLING_VIDEO_MODEL_ID =
  "fal-ai/kling-video/v3/standard/image-to-video";

/**
 * L'audio est actif, et ce n'est pas un défaut hérité : il fait passer le
 * tarif de 0,084 $/s à 0,126 $/s, mais la page tarifs promet explicitement
 * « Videos with sound, 4 to 8s » (cf. `components/PricingCatalogue.tsx`). Le
 * couper ferait mentir l'offre pour économiser 0,04 $ la seconde.
 */
const KLING_GENERATE_AUDIO = true;

/**
 * Défauts de l'API réémis tels quels. Les écrire ici plutôt que de les
 * laisser implicites a un but : si fal en change un, notre rendu ou notre
 * facture ne doivent pas changer sans qu'une ligne de ce dépôt bouge.
 */
const KLING_SHOT_TYPE = "customize";
const KLING_NEGATIVE_PROMPT = "blur, distort, and low quality";
const KLING_CFG_SCALE = 0.5;

/**
 * Corps de requête pour une génération photo → vidéo.
 *
 * ⚠️ Le champ s'appelle `start_image_url`, PAS `image_url`. C'est le piège de
 * la migration depuis Seedance, qui utilisait `image_url` : un mauvais nom ne
 * lève aucune erreur de type, et fal répond une validation refusée que le
 * client ne voit que sous la forme d'une génération échouée — après débit,
 * puis remboursement.
 *
 * ⚠️ `duration` a pour défaut `"5"`, qui n'appartient pas à notre grille
 * (4/6/8). Elle est donc toujours envoyée explicitement, depuis le choix du
 * client. Le modèle accepte 3 à 15 secondes : une durée non contrôlée
 * coûterait jusqu'à cinq fois le tarif d'un 3 s. `VideoDuration` l'interdit
 * ici par construction, et la route revalide ce qui vient du réseau.
 *
 * Contrairement à Seedance, Kling n'expose AUCUN champ `resolution` : elle est
 * portée par la variante du modèle (voir `KLING_VIDEO_MODEL_ID`). Il n'y a
 * donc rien à épingler de ce côté, et rien qui puisse dériver en silence.
 */
export function buildKlingVideoInput({
  imageUrl,
  prompt,
  duration,
}: {
  imageUrl: string;
  prompt: string;
  duration: VideoDuration;
}): Record<string, unknown> {
  return {
    start_image_url: imageUrl,
    prompt,
    // Chaîne, pas nombre : `duration` est une énumération de chaînes côté
    // fal. Un entier est refusé.
    duration: String(duration),
    generate_audio: KLING_GENERATE_AUDIO,
    shot_type: KLING_SHOT_TYPE,
    negative_prompt: KLING_NEGATIVE_PROMPT,
    cfg_scale: KLING_CFG_SCALE,
  };
}
