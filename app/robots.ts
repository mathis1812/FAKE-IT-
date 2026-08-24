import type { MetadataRoute } from "next";

const SITE_URL = "https://bluminoo.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/account", "/gallery"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
