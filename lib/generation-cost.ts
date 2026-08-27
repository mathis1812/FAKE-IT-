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
export const IMAGE_GENERATION_COST = 150;
