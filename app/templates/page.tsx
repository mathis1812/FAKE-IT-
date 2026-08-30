import { redirect } from "next/navigation";

/**
 * `/templates` n'existe plus comme écran à part : relevé en direct sur le
 * modèle, l'URL ne change jamais en cliquant « Templates » — studio et
 * gabarits vivent dans le même DOM sur `/`, glissés via un rail (voir
 * app/page.tsx). Ce fichier ne reste que pour ne pas casser d'anciens
 * liens ou entrées de sitemap ; il redirige vers l'écran réel.
 */
export default function TemplatesRedirect() {
  redirect("/?screen=templates");
}
