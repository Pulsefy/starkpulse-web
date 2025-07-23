/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // Comentamos esto temporalmente para desarrollo
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // trailingSlash: true, // Comentamos esto también
};

module.exports = nextConfig;
