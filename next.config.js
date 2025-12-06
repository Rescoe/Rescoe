/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Active le mode strict de React

  images: {
    // Indiquez vos domaines d'images autorisés ici (ajoutez d'autres domaines si nécessaire)
    domains: ['exemple.com'], // Remplacez par vos domaines d'images
  },

  // Désactivez Turbopack lorsque cela pose problème
  experimental: {
    reactRefresh: true, // Active le rafraîchissement à chaud en développement
  },

  // Configuration des redirections, si nécessaire
  async redirects() {
    return [
      {
        source: '/ancienne-page',
        destination: '/nouvelle-page',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
