import type { MetadataRoute } from "next";

const SITE_URL = "https://bluminoo.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/pricing", priority: 0.8 },
    { path: "/about", priority: 0.6 },
    { path: "/sign-in", priority: 0.3 },
    { path: "/sign-up", priority: 0.3 },
    { path: "/legal", priority: 0.1 },
    { path: "/terms", priority: 0.1 },
    { path: "/privacy", priority: 0.1 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
