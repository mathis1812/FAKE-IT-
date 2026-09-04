/**
 * Socle de photoréalisme partagé par les deux parcours de génération.
 *
 * Principe de rédaction, à respecter si ce texte évolue : rester court,
 * généraliste et sans contradiction. Le produit sert tous les sujets et
 * tous les lieux — pas de règle calée sur un cas particulier (type de
 * personne, contre-jour, intérieur, vêtement). Une instruction trop
 * spécifique se retourne contre les scènes qu'elle n'avait pas prévues.
 *
 * Historique : une version antérieure imposait à la fois « garde la pose
 * exacte » et « choisis une zone dégagée, pieds au sol ». Le modèle a
 * tranché seul en re-posant le sujet. D'où la règle de départage énoncée
 * une fois pour toutes ci-dessous : en cas de conflit, la photo la plus
 * crédible gagne. Ne jamais réintroduire deux exigences de même rang qui
 * peuvent s'opposer.
 */
const REALISM_CORE =
  "Absolute priority: physical plausibility. Every instruction below serves that single goal — " +
  "wherever two of them could conflict, keep whichever produces the more believable photograph. " +
  "Match light direction, color temperature, hardness and quality across the whole frame; cast " +
  "coherent shadows, including contact shadows wherever a body meets a surface; keep reflections, " +
  "perspective, lens character, depth of field, noise and color grading consistent throughout. " +
  "The result must read as one ordinary photograph someone actually took, not as a composite or a " +
  "render. No text, no watermark, no added people.";

/**
 * Prompt utilisé quand le client fournit une ou plusieurs photos du lieu.
 * Gemini reçoit les mêmes images et fait l'analyse lui-même pendant la
 * génération : ce texte lui donne la grille de lecture, pas un résumé.
 */
export function buildPlacePrompt(userNote?: string): string {
  const note = userNote?.trim();

  return (
    "The first image is the subject. The following image(s) show a real location. " +
    "Produce a single photograph of that subject genuinely present in that location. " +
    REALISM_CORE +
    " Keep the subject the same recognizable person throughout. " +
    "Read the location from its own photographs — light, materials, camera height and angle, focal " +
    "length, depth of field — and rebuild the subject inside it under those exact conditions. " +
    "Place the subject where their pose belongs: enough clear space for the visible body, no " +
    "intersection or merging with furniture, objects or clutter, and a scale consistent with the " +
    "scene's own references. Anything standing between camera and subject must occlude them along a " +
    "clean silhouette edge." +
    (note ? ` Additional intent from the user: ${note}.` : "")
  );
}

/**
 * Prompt utilisé quand le client ne fournit aucune photo de lieu : sa
 * description libre est tout ce dont dispose le modèle. Sans ce socle,
 * cette phrase brute partait seule et la qualité dépendait entièrement de
 * la façon dont le client l'avait tournée.
 */
/**
 * Prompt utilisé par les gabarits de remplacement d'objet (swap véhicule) :
 * la photo montre un véhicule que le rendu doit remplacer par un modèle
 * donné, tout en gardant la scène réelle — lieu, angle, lumière — inchangée.
 *
 * `vehicleSpec` décrit couleur + modèle exact + code de génération, ex.
 * « matte black Lamborghini Aventador SVJ with gloss black details » ou
 * « dark green BMW M4 Competition (G82) ». La couleur et le millésime sont
 * portés par la fiche (cf. `VEHICLE_SWAP_SPEC` dans `template-prompts.ts`) :
 * sans eux le modèle produit une « supercar générique » approximative.
 *
 * Ne réutilise pas `buildScenePrompt` : celui-ci ajoute « garde le même
 * sujet reconnaissable », qui contredit directement un remplacement
 * d'identité. Les deux prompts servent des opérations opposées et ne
 * doivent jamais partager cette ligne.
 *
 * UNE SEULE PHRASE, sans point final, sans `REALISM_CORE` : exactement le
 * `userQuery` du produit de référence, au caractère près.
 *
 * Historique, pour éviter de refaire les mêmes essais. Une version
 * antérieure ajoutait trois phrases — « change only that vehicle », « true
 * real-world size and proportions », « licence plate left blank » — portant
 * le prompt à 456 caractères. Sur gemini-3-pro-image, les retirer n'a PAS
 * amélioré le rendu, et les remettre une par une non plus : le défaut de
 * proportions persistait quoi qu'on écrive. Il venait du modèle, pas du
 * texte.
 *
 * Depuis le 04/09 les swaps tournent sur Nano Banana 2 Lite (cf.
 * `modelForTemplate`), ce qui rend ces essais caducs — ils avaient été
 * jugés sur un autre modèle. On repart donc de la formulation de référence,
 * la plus courte, et on ne rallonge que si un rendu réel le justifie.
 *
 * Ne rien ajouter « pour bien faire » : chaque consigne pousse un modèle
 * d'édition de la retouche chirurgicale vers la re-génération de la scène.
 * Décrire l'ombre à dessiner, par exemple, donnait une ombre plate et
 * fausse ; ne rien en dire donne une ombre correcte.
 */
export function buildVehicleSwapPrompt(vehicleSpec: string): string {
  return `Replace the most prominent vehicle in the photo with a factory-stock, ${vehicleSpec}`;
}

/**
 * Prompt utilisé par les gabarits d'édition sur place (dégâts, animal rasé,
 * invasion de rats) : la photo montre une scène réelle que le rendu doit
 * modifier par un seul changement décrit, en gardant tout le reste — sujet,
 * pose, lieu, angle, lumière — inchangé.
 *
 * À l'opposé de `buildVehicleSwapPrompt` : ici l'identité du sujet doit
 * justement être préservée, pas remplacée. Les deux prompts ne partagent
 * aucune ligne pour cette raison.
 */
export function buildInPlaceEditPrompt(change: string): string {
  return (
    `The photograph shows a real scene. Produce a single photograph of that exact same scene, but ` +
    `apply this change: ${change}. ` +
    REALISM_CORE +
    " Keep everything else exactly as photographed: the subject's identity, pose and position, the " +
    "location, camera angle, framing, lighting and every object not explicitly part of the change."
  );
}

export function buildScenePrompt(description: string): string {
  return (
    "The image shows the subject. Produce a single photograph of that same subject in the scene " +
    `described here: ${description.trim()}. ` +
    REALISM_CORE +
    " Keep the subject the same recognizable person throughout. " +
    "Build the surroundings so they hold together as a real place: plausible geometry and materials, " +
    "a consistent light source, and a camera position, height and framing a person could actually " +
    "have used on site. Give the subject enough clear space, keep them clear of any object they are " +
    "not deliberately touching, and keep their scale consistent with their surroundings."
  );
}
