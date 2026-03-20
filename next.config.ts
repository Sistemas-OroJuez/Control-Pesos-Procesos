import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En Next.js 16+, estas son las llaves correctas para saltar errores en el build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Turbopack y otras configs van aquí si las necesitas
};

export default nextConfig;