import type { MetadataRoute } from "next";

const SITE_URL = "https://fakeit-delta.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/tarifs", priority: 0.8 },
    { path: "/a-propos", priority: 0.6 },
    { path: "/connexion", priority: 0.3 },
    { path: "/inscription", priority: 0.3 },
    { path: "/mentions-legales", priority: 0.1 },
    { path: "/cgv", priority: 0.1 },
    { path: "/confidentialite", priority: 0.1 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
