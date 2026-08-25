/**
 * Construit le prompt de compositing envoyé à Gemini avec la photo du sujet
 * et les photos du lieu.
 *
 * Historique (25/08) : ce prompt était auparavant rédigé par un appel
 * d'analyse vision séparé chez kie.ai, qui examinait les photos du lieu
 * puis renvoyait un paragraphe descriptif transmis ensuite à Gemini. Cet
 * aller-retour ajoutait jusqu'à 45 s à chaque génération avec photos de
 * lieu, et un fournisseur externe de plus sur le chemin critique.
 *
 * Gemini étant multimodal, il reçoit exactement les mêmes images que le
 * modèle d'analyse : il fait donc lui-même l'analyse pendant la passe de
 * génération. La grille d'analyse imposée à kie.ai (direction et
 * température de la lumière, matières, angle de prise de vue, profondeur
 * de champ) est reprise mot pour mot ci-dessous en instructions directes,
 * pour qu'aucun critère ne se perde dans la fusion des deux étapes.
 */
export function buildPlacePrompt(userNote?: string): string {
  const note = userNote?.trim();

  return (
    "The first image is the subject (a person). The following image(s) show a real-world location. " +
    "Before compositing, study the location image(s) closely: lighting direction, color temperature, " +
    "hardness and time of day; artificial versus natural sources; materials and textures (wood, marble, " +
    "velvet, glass, concrete, foliage); ambiance and mood; camera angle, perspective and focal-length feel; " +
    "depth of field and notable background elements. " +
    "Then place the subject naturally inside that exact location. " +
    "Keep the subject perfectly identical: same face, identity, skin tone, hair, clothing, pose and expression. " +
    "Placement rules, treat these as hard constraints: choose an open, unobstructed area of the floor with enough " +
    "clear space for the whole body; never let the subject intersect, merge with or pass through furniture, objects " +
    "or clutter; if an object genuinely stands between the camera and the subject, it must occlude the subject " +
    "cleanly along a sharp, anatomically correct silhouette edge, never blend into the body; plant both feet on the " +
    "floor plane at the correct perspective with a contact shadow; scale the subject using the room's own references " +
    "(door and ceiling height, furniture, eye level) so the height reads as physically plausible. " +
    "Rebuild the background using the real geometry, materials and recognizable details of the reference location. " +
    "Relight the subject to match the location's lighting direction, color temperature and contrast; add physically " +
    "coherent shadows, reflections and color grading. " +
    "Match the camera angle, perspective, depth of field and grain of the location photos so the result looks like " +
    "one authentic smartphone photo taken on site — an ultra-realistic lifestyle shot credible enough for an " +
    "Instagram story. No text, no watermark, no extra people." +
    (note ? ` Additional user intent: ${note}.` : "")
  );
}
