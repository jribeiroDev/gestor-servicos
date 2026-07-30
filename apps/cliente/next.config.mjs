/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gestor/ui", "@gestor/utils", "@gestor/database"],
  serverExternalPackages: ["web-push"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
