import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En Next.js 16, si Turbopack da problemas con librerías de Node, 
  // a veces es necesario indicar que no intente optimizar estas librerías de servidor
  serverExternalPackages: ["@google-cloud/vision"],
};

export default nextConfig;