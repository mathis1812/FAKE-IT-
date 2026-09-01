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

/** Swap véhicule : un prompt par modèle, sans variante. */
const VEHICLE_PROMPTS: Record<string, PromptEntry> = Object.fromEntries(
  VEHICLE_MODELS.map(({ slug, target }) => [
    slug,
    { prompt: buildVehicleSwapPrompt(target) },
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
 * Un style d'univers (Minecraft, LEGO, GTA V) est bien mieux rendu quand le
 * modèle reçoit un exemple visuel du style en plus de la photo à
 * transformer : c'est un levier de fidélité bien plus fort qu'un prompt plus
 * long. `POST /api/generate` joint alors l'`exampleImage` du gabarit comme
 * seconde image, et ajoute `STYLE_REFERENCE_INSTRUCTION` au prompt pour
 * cadrer son rôle. Les pranks et le swap véhicule, eux, éditent la scène
 * réelle : pas de référence de style à donner.
 */
export function templateUsesStyleReference(templateSlug: string): boolean {
  return categoryOfTemplate(templateSlug)?.slug === "worlds";
}

/** Ajouté au prompt quand une image de référence de style est jointe. */
export const STYLE_REFERENCE_INSTRUCTION =
  "\n\nSTYLE REFERENCE: one extra image is attached only as a style reference. " +
  "Match its rendering technique, materials, textures, color treatment and finish. " +
  "Ignore its content entirely — the subject, pose, location, framing and " +
  "composition come exclusively from the first image.";

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
