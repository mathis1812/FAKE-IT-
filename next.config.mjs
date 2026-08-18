/** @type {import('next').NextConfig} */
    const nextConfig = {
    reactStrictMode: true,
    // jose 6.x (tiré par @supabase/auth-js 2.111+) n'est pas compatible avec
    // le bundler Edge de Next 14 sans cette déclaration.
    serverExternalPackages: ["jose"],
    };

    export default nextConfig;
    