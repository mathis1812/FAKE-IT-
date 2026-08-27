import type { MetadataRoute } from "next";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";

const SITE_URL = "https://bluminoo.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  // Les pages de gabarit sont dérivées du catalogue plutôt qu'énumérées à la
  // main : un gabarit ajouté est référencé sans qu'on y pense.
  const templateRoutes = TEMPLATE_CATEGORIES.flatMap((category) => [
    { path: `/templates/category/${category.slug}`, priority: 0.6 },
    ...category.templates.flatMap((template) => [
      { path: `/templates/${template.slug}`, priority: 0.7 },
      // Les variantes sont des pages à part entière, avec leur propre titre
      // et leur propre rendu d'exemple.
      ...(template.variants ?? []).map((variant) => ({
        path: `/templates/${template.slug}/${variant.slug}`,
        priority: 0.5,
      })),
    ]),
  ]);

  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/pricing", priority: 0.8 },
    { path: "/about", priority: 0.6 },
    { path: "/sign-in", priority: 0.3 },
    { path: "/sign-up", priority: 0.3 },
    { path: "/legal", priority: 0.1 },
    { path: "/terms", priority: 0.1 },
    { path: "/privacy", priority: 0.1 },
    { path: "/templates", priority: 0.7 },
    ...templateRoutes,
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
