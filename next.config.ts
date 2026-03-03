/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! ADVERTENCIA !!
    // Esto permite que el build termine aunque haya errores de TypeScript.
    // Úsalo para desbloquear el despliegue ahora mismo.
    ignoreBuildErrors: true,
  },
  // Si también tienes errores de ESLint, añade esto:
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
