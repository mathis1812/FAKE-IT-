import type { VideoDuration } from "@/lib/generation-tiers";

/**
 * Seedance 2.5 (ByteDance), servi par la queue fal.ai — photo → vidéo.
 *
 * Le corps de requête est isolé ici, et pur, pour une raison précise : trois
 * de ses champs ont un défaut qui coûte de l'argent, et les oublier ne lève
 * aucune erreur. C'est exactement le genre de régression silencieuse que
 * `__tests__/seedance.test.ts` doit attraper (cf. AGENTS.md §7).
 */

export const SEEDANCE_MODEL_ID = "bytedance/seedance-2.5/image-to-video";

/**
 * ⚠️ `duration` accepte `"auto"`, et c'est le DÉFAUT de l'API. Le modèle
 * choisit alors lui-même une longueur entre 4 et 30 secondes, facturée à la
 * seconde : un clip parti à 30 s en 720p coûte ~13,87 $ au lieu des ~2,84 $
 * d'un 6 s. La durée est donc toujours envoyée explicitement, depuis le choix
 * du client, et `"auto"` n'est jamais une valeur possible ici — le type
 * `VideoDuration` (4 | 6 | 8) l'interdit par construction.
 *
 * ⚠️ `resolution` vaut `"720p"` par DÉFAUT, soit le tarif haut : 0,473 $/s
 * contre 0,221 $/s en 480p.
 *
 * Le 480p est retenu pour l'ouverture parce qu'il est le seul à tenir la
 * grille tarifaire relevée sur le produit de référence (150 crédits/seconde,
 * cf. `VIDEO_COST_PER_SECOND` dans `lib/generation-tiers.ts`) : il laisse
 * ~63 % de marge sur le palier le moins favorable, là où le 720p tomberait à
 * ~21 %. Passer en 720p suppose de monter le tarif à ~300 crédits/seconde —
 * donc de s'écarter du produit de référence, ce qui doit être une décision,
 * pas un défaut d'API hérité.
 */
export const SEEDANCE_RESOLUTION = "480p";

/**
 * L'audio est généré dans le même espace latent que l'image — c'est l'apport
 * du modèle, et les tarifs ci-dessus l'incluent déjà. Le désactiver ne ferait
 * pas baisser la facture.
 */
const SEEDANCE_GENERATE_AUDIO = true;

/**
 * `"auto"` est ici la bonne valeur, et la seule : en photo → vidéo le cadre
 * de sortie suit celui de la photo d'entrée. Contrairement à `duration`, ce
 * défaut-là ne coûte rien.
 */
const SEEDANCE_ASPECT_RATIO = "auto";

/**
 * Corps de requête complet. Tous les champs sont émis explicitement, y
 * compris ceux dont la valeur coïncide avec le défaut de l'API : un défaut
 * qui change du côté du fournisseur changerait sinon notre facture sans
 * qu'aucune ligne de ce dépôt n'ait bougé.
 */
export function buildSeedanceInput({
  imageUrl,
  prompt,
  duration,
}: {
  imageUrl: string;
  prompt: string;
  duration: VideoDuration;
}): Record<string, unknown> {
  return {
    image_url: imageUrl,
    prompt,
    // Chaîne, pas nombre : l'API déclare `duration` et `resolution` comme des
    // énumérations de chaînes ("4", "6", "8" / "480p"). Un entier est refusé.
    duration: String(duration),
    resolution: SEEDANCE_RESOLUTION,
    aspect_ratio: SEEDANCE_ASPECT_RATIO,
    generate_audio: SEEDANCE_GENERATE_AUDIO,
    bitrate_mode: "standard",
  };
}
