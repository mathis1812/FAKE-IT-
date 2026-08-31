/**
 * Routes qui portent leur propre en-tête fixe (le studio, ou TemplateHeader)
 * et n'ont donc pas besoin de celui du site — ni de son pied de page.
 *
 * Un seul point de vérité pour `SiteHeader` et `SiteFooter` : les tenir
 * synchronisés à la main dans deux fichiers a déjà laissé passer /gallery et
 * /settings une fois, chacun ajoutant son écran sans penser à l'autre.
 */
export function hasOwnHeader(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/templates") ||
    pathname === "/gallery" ||
    pathname === "/settings" ||
    pathname === "/pricing" ||
    pathname === "/red-snap"
  );
}
