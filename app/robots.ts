import type { MetadataRoute } from "next";

const SITE_URL = "https://bluminoo.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/compte", "/galerie"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
