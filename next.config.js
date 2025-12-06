/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: false, // ⛔ Désactive Turbopack pour le build (et donc les erreurs thread-stream/pino)
  },
};

module.exports = nextConfig;
