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
