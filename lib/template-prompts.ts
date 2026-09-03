import "server-only";

import {
  buildInPlaceEditPrompt,
  buildVehicleSwapPrompt,
} from "@/lib/place-prompt";
import { categoryOfTemplate, VEHICLE_MODELS } from "@/lib/templates";
import {
  GTA5_WORLD_PROMPT,
  LEGO_WORLD_PROMPT,
  MINECRAFT_WORLD_PROMPT,
} from "@/lib/world-prompts";

/**
 * Les prompts des gabarits, tenus à l'écart du navigateur.
 *
 * `lib/templates.ts` ne porte plus que ce qu'un écran a le droit de voir —
 * slugs, libellés, images, structure des variantes — et il est importé par
 * des composants clients (`app/page.tsx`, `TemplateShelf`). Un prompt laissé
 * dans ce module partait donc en clair dans le bundle client, ce que
 * `TemplateView` était censé empêcher.
 *
 * Ce fichier est `server-only` : seule `app/api/generate/route.ts` le lit,
 * via `resolveTemplatePrompt`, à partir des seuls identifiants d'URL.
 *
 * Les clés doivent rester alignées sur `TEMPLATE_CATEGORIES` : un gabarit
 * sans entrée ici renvoie 400 « Unknown template ». Le test
 * `__tests__/template-prompts.test.ts` vérifie cet alignement.
 */
type PromptEntry =
  | { prompt: string; variants?: never }
  | { prompt?: never; variants: Record<string, string> };

/**
 * Swap véhicule : couleur d'usine + modèle exact + code de génération, par
 * slug. Gemini ne reçoit que du texte pour la voiture cible — sans couleur
 * ni millésime il produit une « supercar générique » aux proportions et à
 * la face avant approximatives. Ces specs reprennent 1:1 les requêtes du
 * front usenoway (fichier `noway_templates_extracted.json`), seule donnée
 * de cette extraction directement réutilisable.
 *
 * Une clé manquante retombe sur `VEHICLE_MODELS[].target` (nom nu) via le
 * `?? target` ci-dessous ; le test d'alignement du catalogue couvre la
 * complétude.
 */
const VEHICLE_SWAP_SPEC: Record<string, string> = {
  "aventador-svj": "matte black Lamborghini Aventador SVJ with gloss black details",
  "gt3-rs": "full black Porsche 911 GT3 RS (992)",
  chiron: "full black Bugatti Chiron Super Sport",
  revuelto: "orange Lamborghini Revuelto with black details",
  m4: "dark green BMW M4 Competition (G82)",
  rs6: "full black Audi RS6 Avant (C8)",
  rs3: "full black Audi RS3 Sportback (8Y)",
  "812-superfast": "dark grey Ferrari 812 Superfast",
  "amg-gt-black-series": "light grey Mercedes-AMG GT Black Series",
  sf90: "red Ferrari SF90 Stradale",
  m3: "dark blue BMW M3 Competition (G80)",
  "911-turbo-s": "full black Porsche 911 Turbo S (992)",
  "huracan-sto": "full black Lamborghini Huracán STO",
  "golf-r": "full black Volkswagen Golf R (Mk8)",
  "c63-s": "full black Mercedes-AMG C 63 S E Performance (W206)",
  "a45-s": "full black Mercedes-AMG A 45 S (W177)",
  temerario: "full black Lamborghini Huracán Tecnica",
  "gtr-nismo": "white Nissan GT-R Nismo (R35)",
  r8: "red Audi R8 V10 performance (4S)",
  m2: "matte black BMW M2 (G87) with silver wheels",
  "720s": "dark green McLaren 720S",
};

/** Swap véhicule : un prompt par modèle, sans variante. */
const VEHICLE_PROMPTS: Record<string, PromptEntry> = Object.fromEntries(
  VEHICLE_MODELS.map(({ slug, target }) => [
    slug,
    { prompt: buildVehicleSwapPrompt(VEHICLE_SWAP_SPEC[slug] ?? target) },
  ]),
);

/** Pranks : édition sur place, certains gabarits déclinés en variantes. */
const PRANK_PROMPTS: Record<string, PromptEntry> = {
  "voiture-accidentee": {
    variants: {
      modere: buildInPlaceEditPrompt(
        "light collision damage on the car — a dented door and a scraped bumper, paint scratches, no fire, no emergency vehicles",
      ),
      fort: buildInPlaceEditPrompt(
        "heavy crash damage on the car — a crumpled front end, a shattered windshield, a broken headlight and a deployed airbag visible through the window, no fire",
      ),
      extreme: buildInPlaceEditPrompt(
        "the car burned out and totalled — charred blackened bodywork, melted panels, shattered windows, tires burned down to the rims",
      ),
    },
  },
  "animal-rase": {
    prompt: buildInPlaceEditPrompt(
      "the animal completely shaved, bare smooth skin visible with no fur anywhere, keeping its exact pose and expression",
    ),
  },
  "lendemain-de-soiree": {
    prompt: buildInPlaceEditPrompt(
      "the room wrecked the morning after a house party — empty bottles, crushed cans, pizza boxes, spilled drinks and confetti strewn across the floor, stains on the sofa, cushions thrown around, keeping the room's exact layout, furniture and framing",
    ),
  },
  inondation: {
    prompt: buildInPlaceEditPrompt(
      "the room flooded with murky standing water covering the floor, furniture partly submerged and belongings floating on the surface, damp marks climbing the walls, keeping the room's exact layout, furniture and framing",
    ),
  },
  "degats-maison": {
    variants: {
      plafond: buildInPlaceEditPrompt(
        "the ceiling collapsed and caved in — exposed broken beams, insulation and plaster debris scattered on the floor below",
      ),
      sol: buildInPlaceEditPrompt(
        "the floor collapsed and caved in — a jagged broken opening exposing the structure below, debris scattered around the edges",
      ),
    },
  },
  rat: {
    variants: {
      seul: buildInPlaceEditPrompt(
        "a single realistic rat standing on the floor in the foreground",
      ),
      invasion: buildInPlaceEditPrompt(
        "dozens of realistic rats covering the floor, an overwhelming infestation",
      ),
    },
  },
};

/** Worlds : prompts complets rédigés à la main, cf. `lib/world-prompts.ts`. */
const WORLD_PROMPTS: Record<string, PromptEntry> = {
  minecraft: { prompt: MINECRAFT_WORLD_PROMPT },
  "gta-5": { prompt: GTA5_WORLD_PROMPT },
  lego: { prompt: LEGO_WORLD_PROMPT },
};

export const TEMPLATE_PROMPTS: Record<string, PromptEntry> = {
  ...VEHICLE_PROMPTS,
  ...PRANK_PROMPTS,
  ...WORLD_PROMPTS,
};

/**
 * Un style d'univers est souvent mieux rendu quand le modèle reçoit un
 * exemple visuel du style en plus de la photo à transformer : c'est un levier
 * de fidélité fort. `POST /api/generate` joint alors l'`exampleImage` du
 * gabarit comme seconde image, et ajoute `STYLE_REFERENCE_INSTRUCTION` au
 * prompt pour cadrer son rôle. Les pranks et le swap véhicule éditent la
 * scène réelle : pas de référence à donner.
 *
 * Exception `gta-5` : sa fiche (los_santos_game) n'envoie que la photo user.
 * Son prompt décrit tout le look moteur de jeu lui-même, et joindre l'exemple
 * (une scène précise avec personnage et panneau) ferait fuiter ce contenu
 * dans le rendu. On ne joint donc PAS de référence pour GTA.
 */
const STYLE_REFERENCE_EXCLUDED = new Set(["gta-5"]);

export function templateUsesStyleReference(templateSlug: string): boolean {
  if (STYLE_REFERENCE_EXCLUDED.has(templateSlug)) return false;
  return categoryOfTemplate(templateSlug)?.slug === "worlds";
}

/**
 * Verrou du ratio de sortie (`imageConfig.aspectRatio` passé à Gemini).
 *
 * Réservé aux univers : ce sont des re-rendus complets de la scène, où
 * gemini-3-pro-image dérive sinon vers un autre cadrage. Le swap véhicule et
 * les pranks sont des éditions chirurgicales — forcer le ratio pousse le
 * modèle d'édition à recomposer toute l'image (sol repeint, gabarit du
 * véhicule faussé, cadrage décalé). On le laisse éditer sans contrainte,
 * comme une requête nue « remplace la voiture par… ».
 */
export function templateLocksAspectRatio(templateSlug: string): boolean {
  return categoryOfTemplate(templateSlug)?.slug === "worlds";
}

/** Ajouté au prompt quand une image de référence de style est jointe. */
export const STYLE_REFERENCE_INSTRUCTION =
  "\n\nSTYLE REFERENCE: one extra image is attached only as a style reference. " +
  "Match its rendering technique, materials, textures, color treatment and finish. " +
  "Ignore its content entirely — the subject, pose, location, framing and " +
  "composition come exclusively from the first image.";

/**
 * Contrôle qualité optionnel d'un rendu de gabarit. Après la première
 * génération, `POST /api/generate` demande au juge si le rendu satisfait
 * `criteria` ; si non, il régénère UNE fois en ajoutant `retrySuffix` au
 * prompt (sans re-débiter de crédits). Best-effort : voir
 * `assessTemplateResult`.
 *
 * Seuls les univers en ont besoin (transformation totale, plus incertaine).
 * Les pranks et le swap véhicule sont des éditions fiables : pas de check.
 * Les critères reprennent les `quality_guardrails` des fiches JSON.
 */
type QualityCheck = { criteria: string; retrySuffix: string };

const TEMPLATE_QUALITY_CHECKS: Record<string, QualityCheck> = {
  minecraft: {
    criteria:
      "- The person stays a real, un-stylized photograph (face, skin and outfit NOT turned into blocks).\n" +
      "- The environment around them is rebuilt from Minecraft-style voxel cubes.\n" +
      "- No game interface, hotbar, health bar, text or logo is visible.",
    retrySuffix:
      "The previous result was off. Regenerate keeping the person pixel-identical to the source photograph — same face, outfit, pose and position — and only rebuild the surrounding environment in voxel blocks.",
  },
  "gta-5": {
    // v2 : le lieu doit rester le même (pas de relocalisation), et un petit
    // HUD graphique en bas à gauche est ATTENDU — mais sans texte/chiffres ni
    // marque réelle. Ne pas traiter le HUD comme un défaut.
    criteria:
      "- The whole image looks like a 3D video-game engine render, NOT a real photograph and NOT a flat cartoon/illustration.\n" +
      "- It is the SAME location as the source: the scene has not been moved to a different room, street or city.\n" +
      "- The person is recognizably the same individual, with the same outfit and pose.\n" +
      "- No real brand name or real logo is visible.\n" +
      "- A small graphic HUD in a corner is allowed and expected; only fail the HUD if it shows readable text or numbers.",
    retrySuffix:
      "Regenerate. Keep the exact same location, layout, camera angle, face, outfit and pose as the source photograph. Change only the rendering: make it a real-time game engine screenshot with shader skin, sculpted hair, baked cloth folds, warm contrasted game lighting and a small graphic HUD in the bottom left corner. Not a photograph, not a cartoon.",
  },
  lego: {
    criteria:
      "- The person is turned into a glossy LEGO minifigure, still recognizable (matching hair and outfit colors).\n" +
      "- The whole environment is rebuilt from visible LEGO bricks with studs.\n" +
      "- No game interface, LEGO logo, set number, text or watermark is visible.",
    retrySuffix:
      "The previous result was off. Regenerate as a glossy brick-built LEGO set render: the person as a recognizable minifigure with matching hair and printed outfit, the whole environment rebuilt from visible LEGO bricks with studs, same position and framing.",
  },
};

export function getQualityCheck(templateSlug: string): QualityCheck | null {
  return TEMPLATE_QUALITY_CHECKS[templateSlug] ?? null;
}

/**
 * Résout le prompt à appliquer, à partir des seuls identifiants d'URL.
 *
 * Renvoie `null` si le gabarit est inconnu, si une variante est demandée
 * pour un gabarit qui n'en a pas, ou si un gabarit à variantes est demandé
 * sans en préciser une valide — dans ces cas il n'existe aucun prompt à
 * appliquer, et l'appelant refuse la requête plutôt que de deviner.
 */
export function resolveTemplatePrompt(
  templateSlug: string,
  variantSlug?: string,
): string | null {
  const entry = TEMPLATE_PROMPTS[templateSlug];
  if (!entry) return null;

  if (entry.variants) {
    if (!variantSlug) return null;
    return entry.variants[variantSlug] ?? null;
  }

  if (variantSlug) return null;
  return entry.prompt;
}
