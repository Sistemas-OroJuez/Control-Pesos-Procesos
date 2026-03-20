import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Permite que el build termine aunque haya errores de TypeScript
    ignoreBuildErrors: true,
  },
  eslint: {
    // Permite que el build termine aunque haya errores de Linting
    ignoreDuringBuilds: true,
  },
  // Aquí puedes agregar otras opciones compatibles si las necesitas en el futuro
};

export default nextConfig;