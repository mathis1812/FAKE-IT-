/**
 * `/templates` sert la même page que le studio : c'est là que vit l'étagère,
 * et c'est la destination du bouton « Templates » comme des retours depuis
 * les grilles de catégorie. Un alias plutôt qu'une copie — deux écrans à
 * maintenir en parallèle finiraient par diverger.
 *
 * Pas de `metadata` ici : le studio est un composant client, qui ne peut pas
 * en exporter. Le titre vient de `app/layout.tsx`, comme pour `/`.
 */
export { default } from "../page";
