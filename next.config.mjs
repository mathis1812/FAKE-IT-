/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/tarifs", destination: "/pricing", permanent: true },
      { source: "/compte", destination: "/account", permanent: true },
      { source: "/connexion", destination: "/sign-in", permanent: true },
      { source: "/inscription", destination: "/sign-up", permanent: true },
      { source: "/galerie", destination: "/gallery", permanent: true },
      { source: "/a-propos", destination: "/about", permanent: true },
      { source: "/cgv", destination: "/terms", permanent: true },
      { source: "/confidentialite", destination: "/privacy", permanent: true },
      { source: "/mentions-legales", destination: "/legal", permanent: true },
    ];
  },
};

export default nextConfig;
