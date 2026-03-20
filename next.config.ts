import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indispensable para librerías de servidor como Google Cloud Vision en Next 15/16
  serverExternalPackages: ["@google-cloud/vision"],
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;