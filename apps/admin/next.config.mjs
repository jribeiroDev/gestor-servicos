/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gestor/ui", "@gestor/utils", "@gestor/database"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
