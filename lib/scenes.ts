/**
 * Catalogue de scènes ("templates").
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * Jusqu'ici le prompt envoyé au modèle image était **produit à la volée** :
 * un modèle vision (kie.ai) regardait les photos de lieu de l'utilisateur et
 * rédigeait un paragraphe anglais, différent à chaque appel. Deux
 * conséquences mesurables :
 *
 * 1. Qualité non reproductible — deux utilisateurs sur la même scène
 *    obtenaient deux prompts différents, donc deux niveaux de rendu. Aucun
 *    prompt ne pouvait être testé puis figé, puisqu'aucun n'était réutilisé.
 * 2. Latence — l'analyse est un aller-retour réseau supplémentaire *en série*
 *    avant la génération (jusqu'à 45 s de timeout), sur un flux déjà long.
 *
 * Une scène ici est l'inverse : un prompt écrit, testé et **figé**. On peut
 * le corriger scène par scène quand un rendu déçoit, sans toucher au reste.
 *
 * Anatomie d'un prompt de scène — les 6 blocs sont tous nécessaires, et
 * l'ordre compte (le modèle pondère davantage le début) :
 *   1. Verrou d'identité      — ce qui ne doit pas changer, en premier.
 *   2. Décor                  — lieu, heure, météo, matériaux concrets.
 *   3. Lumière                — direction, température, contraste + ordre
 *                               explicite de ré-éclairer le sujet.
 *   4. Caméra                 — appareil, focale, ouverture, hauteur, angle.
 *   5. Imperfections          — grain, ISO, compression. C'est ce bloc qui
 *                               fait la différence entre « photo » et « image
 *                               IA » : sans lui le rendu est trop propre.
 *   6. Interdits              — dont l'interdiction de lisser la peau, qui
 *                               est le réflexe par défaut du modèle et le
 *                               premier signe qui trahit une image générée.
 */

export type SceneCategory = "lifestyle" | "voyage" | "soiree" | "sport";

export type Scene = {
  id: string;
  /** Libellé affiché dans le sélecteur. */
  label: string;
  /** Sous-titre court, une ligne, affiché sous le libellé. */
  tagline: string;
  category: SceneCategory;
  /** Vignette servie depuis public/ — sert aussi d'aperçu du rendu attendu. */
  thumbnail: string;
  /**
   * Corps du prompt : blocs 2 à 4 (décor, lumière, caméra). Les blocs 1, 5
   * et 6 sont communs à toutes les scènes et ajoutés par `buildScenePrompt`,
   * pour qu'une correction du verrou d'identité profite à toutes les scènes
   * d'un coup au lieu d'être recopiée douze fois.
   */
  body: string;
};

export const SCENE_CATEGORY_LABELS: Record<SceneCategory, string> = {
  lifestyle: "Lifestyle",
  voyage: "Voyage",
  soiree: "Soirée",
  sport: "Sport",
};

/**
 * Bloc 1 — verrou d'identité. Placé en tête du prompt final.
 *
 * Formulé en interdits concrets (« ne change pas la forme du nez ») plutôt
 * qu'en objectif abstrait (« garde la ressemblance ») : sur un modèle
 * d'édition, l'instruction négative précise tient mieux que l'intention.
 */
const IDENTITY_LOCK =
  "Keep the person from the reference photo strictly identical. Preserve the exact face geometry — " +
  "eye shape and spacing, nose shape and width, jawline, lips, ears, eyebrows — the exact skin tone and " +
  "undertone, every freckle, mole, scar and blemish, the exact hairline, hair colour, hair length and texture, " +
  "facial hair, and any glasses, jewellery or visible tattoos. Keep their body proportions and their clothing " +
  "as they are. This is the same real person photographed in a different place, not a lookalike.";

/**
 * Bloc 5 — imperfections photographiques.
 *
 * Sans ce bloc le modèle rend une image « propre » : bruit nul, dynamique
 * parfaite, bords trop nets. C'est précisément ce qui fait lire l'image
 * comme générée. On demande donc explicitement les défauts d'un capteur de
 * téléphone.
 */
const REALISM_BLOCK =
  "Render it as a real smartphone photograph, not a render: fine luminance grain, mild sensor noise in the " +
  "shadows, slightly clipped highlights, a touch of chromatic aberration at the frame edges, natural JPEG " +
  "compression, and imperfect handheld framing. Keep the dynamic range realistic rather than HDR-flat.";

/**
 * Bloc 6 — interdits.
 *
 * `Do not smooth or retouch the skin` est la ligne la plus importante du
 * fichier : le comportement par défaut du modèle est d'embellir le visage
 * (peau lissée, symétrie, teint uniformisé), et c'est le premier détail qui
 * trahit une image IA aux yeux d'un tiers.
 */
const NEGATIVE_BLOCK =
  "Do not smooth, retouch, slim or beautify the skin or the face — no beauty filter, no airbrushing, no " +
  "symmetry correction, no teeth whitening, no jaw reshaping. No added or removed people. No text, no logo, " +
  "no watermark, no caption, no border, no collage. No warped hands, no extra fingers. Do not turn the image " +
  "into an illustration, a painting or a 3D render.";

export const SCENES: Scene[] = [
  {
    id: "rooftop-sunset",
    label: "Rooftop au coucher du soleil",
    tagline: "Terrasse en hauteur, ville en contrebas",
    category: "soiree",
    thumbnail: "/landing/rooftop.jpg",
    body:
      "Place them on the terrace of a rooftop bar on the top floor of a high-rise, leaning on a glass balustrade " +
      "with a dense city skyline blurred far below and behind them. Concrete floor, low rattan seating, a few " +
      "warm bulbs strung overhead, other guests small and out of focus in the background. " +
      "It is golden hour, twenty minutes before sunset: low warm sunlight (around 3200K) rakes in from the " +
      "left and slightly behind, wrapping a bright rim around their hair and shoulder, while the front of the " +
      "face sits in soft open shade filled by the sky. Relight the subject to match exactly — warm rim on one " +
      "side, cool skylight fill on the other — and cast a long soft shadow across the floor consistent with that " +
      "sun direction. " +
      "Shot on a modern phone main camera, 26mm equivalent, f/1.8, held at chest height, slight upward tilt, " +
      "waist-up framing, subject on the left third, skyline compressed and softly out of focus behind.",
  },
  {
    id: "restaurant-gastronomique",
    label: "Table gastronomique",
    tagline: "Dîner dans un restaurant haut de gamme",
    category: "lifestyle",
    thumbnail: "/landing/restaurant.jpg",
    body:
      "Seat them at a corner table in an upscale contemporary restaurant: dark walnut panelling, a white linen " +
      "tablecloth, heavy cutlery, a half-full wine glass, a plated dish in the near foreground slightly out of " +
      "focus. Other diners and a bar are visible far behind, thrown well out of focus. " +
      "Interior evening light: a small warm pendant lamp directly above and slightly in front of the table " +
      "(around 2700K) is the key, so the light falls from above, catching the forehead, nose bridge and " +
      "cheekbones and leaving soft shadows under the brow and chin; a faint cool bounce from a window on the " +
      "far right lifts the shadow side. Relight the subject to that scheme and let a warm reflection from the " +
      "tablecloth bounce up under the jaw. " +
      "Shot on a phone at 24mm equivalent, f/1.8, held just above table height at eye level of a dining " +
      "companion, chest-up framing, shallow depth of field, background reduced to warm bokeh.",
  },
  {
    id: "jet-prive",
    label: "Jet privé",
    tagline: "Cabine cuir, hublot, avant décollage",
    category: "voyage",
    thumbnail: "/landing/jet.jpg",
    body:
      "Place them seated in the cream leather club seat of a small private jet cabin: stitched leather, a polished " +
      "veneer side table, a low oval window to their right, the opposite seat and the narrow aisle visible behind. " +
      "Daylight, aircraft still on the ground. The oval window is the only real source: hard directional daylight " +
      "(around 6000K) comes in from the right at a low angle, throwing a distinct bright window-shaped patch on " +
      "the leather and lighting the right side of the face while the left falls into deep, warm, unlit cabin " +
      "shadow filled only by the cabin's dim LED strip. Relight the subject to that strong single-source contrast " +
      "— this hard window light is what makes the shot read as real rather than staged. " +
      "Shot on a phone at 24mm equivalent, f/1.8, camera held by someone in the facing seat at seated eye level, " +
      "chest-up framing, subject slightly off-centre, cabin receding out of focus behind.",
  },
  {
    id: "voiture-luxe",
    label: "Voiture de sport",
    tagline: "Appuyé sur une sportive, rue le soir",
    category: "lifestyle",
    thumbnail: "/landing/car.jpg",
    body:
      "Place them standing beside a dark, glossy modern sports car parked at the kerb of a quiet city street at " +
      "night, one hand resting on the roof line. Wet asphalt, shop fronts and street lamps blurred far behind, " +
      "the car's paint reflecting the surrounding lights in long vertical streaks. " +
      "Night, mixed artificial light: a warm sodium street lamp above and behind the subject on the right " +
      "(around 2400K) makes a strong rim on the hair and shoulders, while cool blue-white shopfront light " +
      "(around 5500K) fills the face from the front left. Relight the subject to that warm-rim / cool-fill " +
      "split, and let the car's paint throw a soft coloured reflection onto the near arm. " +
      "Shot on a phone at 26mm equivalent, f/1.8, hand-held slightly below eye level, three-quarter body " +
      "framing, visible night-time sensor noise in the shadows and mild motion blur in the distant background.",
  },
  {
    id: "villa-piscine",
    label: "Villa avec piscine",
    tagline: "Bord de piscine, plein soleil",
    category: "voyage",
    thumbnail: "/landing/pool.jpg",
    body:
      "Place them at the edge of an infinity pool of a modern white villa: travertine deck, a row of sun " +
      "loungers with cream cushions, olive trees and a low hedge behind, a hazy hillside and sea horizon far " +
      "beyond. Water rippling in the near foreground. " +
      "Midday, hard summer sun almost overhead and slightly behind camera-left (around 5600K): strong contrast, " +
      "crisp short shadows on the deck, specular highlights on the water, and bright bounced light coming back " +
      "up from the pale stone under the chin. Relight the subject accordingly — squinting-bright key from above, " +
      "warm stone bounce from below, and dancing water caustics on the legs. " +
      "Shot on a phone at 24mm equivalent, f/1.8, held at chest height, full-body framing, subject on the right " +
      "third, slight lens flare from the sun clipping the corner of the frame.",
  },
  {
    id: "concert",
    label: "Concert",
    tagline: "Dans la foule, lumières de scène",
    category: "soiree",
    thumbnail: "/landing/concert.jpg",
    body:
      "Place them in the crowd at a large indoor concert, raised hands and silhouetted heads around and in " +
      "front of them, a bright blown-out stage and light rig far behind, haze in the air catching the beams. " +
      "Night, stage lighting only: intense saturated coloured light — magenta from the upper left, cyan from " +
      "the upper right — cuts through atmospheric haze and hits the subject from behind and above, leaving " +
      "coloured rims on the hair and shoulders and the front of the face relatively dark, lit only by spill. " +
      "Relight the subject to that back-lit coloured scheme; do not brighten the face to a flat even exposure, " +
      "the darkness is what makes it look real. " +
      "Shot on a phone at 26mm equivalent, f/1.8, arm raised above the crowd, slight downward tilt, chest-up " +
      "framing, high ISO with heavy visible noise, slight motion blur on the surrounding hands.",
  },
  {
    id: "plage-tropicale",
    label: "Plage tropicale",
    tagline: "Sable blanc, eau turquoise",
    category: "voyage",
    thumbnail: "/landing/showcase/3.webp",
    body:
      "Place them on a quiet tropical beach: fine pale sand, shallow turquoise water breaking softly behind " +
      "them, palm trees leaning in from the left edge, a couple of distant figures far down the shoreline. " +
      "Late afternoon, sun low and behind the subject to the right (around 4000K): a warm halo rims the hair " +
      "and the water sparkles into blown-out specular highlights; the face sits in open shade filled by a huge " +
      "bright sky and by warm bounce off the pale sand. Relight the subject to that back-lit scheme, with a " +
      "long shadow stretching toward the camera. " +
      "Shot on a phone at 24mm equivalent, f/1.8, held at chest height, full-body framing, low horizon line, " +
      "visible haze and mild flare from shooting toward the sun.",
  },
  {
    id: "ski-montagne",
    label: "Station de ski",
    tagline: "Sommet enneigé, ciel dégagé",
    category: "sport",
    thumbnail: "/landing/showcase/7.webp",
    body:
      "Place them at the top of a ski run: packed snow underfoot, a groomed piste dropping away behind them, " +
      "pine forest below and a jagged snow-capped ridge line across the whole background under a deep blue sky. " +
      "Bright winter midday (around 6500K): very high-altitude sun from the upper left, extremely high " +
      "contrast, and huge cold bounce coming back up off the snow which fills the shadows under the chin and " +
      "brow — an unusual bottom-lit look specific to snow. Relight the subject to that, with a hard blue-tinted " +
      "shadow cast across the snow to the right. " +
      "Shot on a phone at 26mm equivalent, f/1.8, held at eye level, waist-up framing, deep depth of field so " +
      "the distant peaks stay reasonably sharp, slightly blown-out snow highlights.",
  },
  {
    id: "yacht",
    label: "Yacht en mer",
    tagline: "Pont arrière, large ouvert",
    category: "voyage",
    thumbnail: "/landing/showcase/11.webp",
    body:
      "Place them on the aft deck of a white motor yacht under way: teak decking, chrome rails, white cushioned " +
      "bench seating, a churning wake and open sea stretching to the horizon behind them. " +
      "Late morning, clear sky (around 5800K): hard sun from high camera-right, brilliant specular sparkle on " +
      "the water, and strong cool bounce off the white superstructure filling the shadow side of the face. " +
      "Relight the subject to that bright, high-key marine light and let the wind visibly move their hair and " +
      "clothing. " +
      "Shot on a phone at 24mm equivalent, f/1.8, held at chest height, three-quarter body framing, horizon " +
      "very slightly tilted as if shot on a moving boat.",
  },
  {
    id: "rue-paris",
    label: "Rue parisienne",
    tagline: "Haussmannien, fin de journée",
    category: "lifestyle",
    thumbnail: "/landing/showcase/5.webp",
    body:
      "Place them walking on a Paris pavement: Haussmann stone façades with wrought-iron balconies running " +
      "down the street behind, a café terrace with rattan chairs to one side, parked scooters, blurred " +
      "passers-by, a zebra crossing in the mid-ground. " +
      "Late afternoon, overcast-to-hazy (around 5200K): soft, almost shadowless directional light coming down " +
      "the street from behind the camera, gentle contrast, no hard shadow edges — the flat, even light that " +
      "makes candid street photos look unposed. Relight the subject to that soft wraparound scheme. " +
      "Shot on a phone at 26mm equivalent, f/1.8, held at eye level by someone walking a few steps ahead, " +
      "full-body framing, subject mid-stride and slightly off-centre, background compressed and softly blurred.",
  },
  {
    id: "salle-de-sport",
    label: "Salle de sport",
    tagline: "Après l'entraînement",
    category: "sport",
    thumbnail: "/landing/showcase/14.webp",
    body:
      "Place them in a large modern gym: black rubber flooring, racks of dumbbells, a squat rack and cable " +
      "machines receding behind them, a mirrored wall on one side, industrial ceiling with exposed ducting. " +
      "Indoor artificial light: cool overhead LED panels (around 5000K) directly above create a hard top-down " +
      "key with short dense shadows under the brow, nose and chin, and the mirrored wall throws a weak fill " +
      "from the side. Relight the subject to that unflattering top-light — it is exactly what a real gym photo " +
      "looks like, so do not soften it. Add realistic sweat sheen on the skin and slightly flushed colour. " +
      "Shot on a phone at 26mm equivalent, f/1.8, held at chest height, waist-up framing, mild barrel " +
      "distortion, background sharp enough to read as a real room.",
  },
  {
    id: "club-vip",
    label: "Club VIP",
    tagline: "Carré privé, néons",
    category: "soiree",
    thumbnail: "/landing/showcase/16.webp",
    body:
      "Place them in the private booth of a nightclub: dark velvet banquette, a low table with bottles and " +
      "glasses catching the light, a crowded dance floor and DJ booth blurred far behind, neon strip lighting " +
      "running along the walls. " +
      "Night, club lighting only: saturated magenta and deep blue neon from either side at close range, one " +
      "bright warm downlight above the table bouncing up off the glass, and near-black everywhere else. " +
      "Relight the subject to that hard coloured cross-light, with strong colour separation between the two " +
      "sides of the face and specular highlights on the skin. Keep large parts of the frame genuinely dark. " +
      "Shot on a phone at 26mm equivalent, f/1.8, held at seated eye level, chest-up framing, very high ISO " +
      "with coarse colour noise and slight motion blur in the background crowd.",
  },
];

export const SCENE_IDS = SCENES.map((s) => s.id);

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/**
 * Assemble le prompt final d'une scène.
 *
 * L'ordre est délibéré : identité d'abord (le modèle pondère davantage le
 * début du prompt), décor/lumière/caméra ensuite, réalisme et interdits en
 * fin. La note utilisateur est insérée **avant** les interdits pour qu'elle
 * ne puisse pas les repousser hors de la zone d'attention, et elle est
 * présentée comme une préférence secondaire : sans ce cadrage, une note du
 * type « fais-moi plus mince » écraserait le verrou d'identité, qui est
 * précisément ce qu'on ne veut jamais laisser négocier.
 */
export function buildScenePrompt(scene: Scene, userNote?: string): string {
  const note = userNote?.trim();
  const parts = [IDENTITY_LOCK, scene.body, REALISM_BLOCK];

  if (note) {
    parts.push(
      `Secondary preference from the user, to honour only where it does not conflict with the identity ` +
        `and realism rules above: "${note}".`,
    );
  }

  parts.push(NEGATIVE_BLOCK);
  return parts.join(" ");
}
