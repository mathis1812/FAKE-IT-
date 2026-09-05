/**
 * Coût d'une génération, en crédits.
 *
 * Isolé de `lib/credits.ts` parce que ce dernier importe le client Supabase
 * de service : un composant client qui aurait besoin du montant y aurait
 * embarqué du code serveur. Le montant est affiché à l'utilisateur avant
 * qu'il ne lance une génération, il doit donc être lisible des deux côtés.
 *
 * Source unique : `lib/credits.ts` le réexporte plutôt que de le redéclarer,
 * sans quoi les deux valeurs finiraient par diverger.
 */
export const IMAGE_GENERATION_COST = 100;

/**
 * Coût d'une retouche, en crédits.
 *
 * Même montant qu'une génération : c'est le même appel au même modèle, sur
 * une image d'entrée qui se trouve être un rendu précédent plutôt qu'une
 * photo. Rien ne justifierait de le facturer moins, ni plus.
 *
 * Constante distincte malgré l'égalité : les deux actions sont annoncées
 * séparément au client, et l'une pourra bouger sans l'autre. Les faire
 * pointer sur la même valeur rendrait ce découplage impossible sans
 * retrouver tous les appels.
 */
export const EDIT_COST = 100;
