// RPC par défaut si aucune variable n'est définie : un RPC public gratuit (limité, sans garantie).
// Pour un vrai trafic, définir NEXT_PUBLIC_BASE_RPC_URL (fournisseur avec clé) sur Vercel.
const FALLBACK_RPC = "https://base-rpc.publicnode.com";

const nextConfig = {
  // Le code lit encore l'ancien nom NEXT_PUBLIC_URL_SERVER_MORALIS (44 fichiers) : on le fait
  // pointer vers le nouveau nom neutre quand il existe, et vers un RPC public sinon.
  // Une valeur NEXT_PUBLIC_* est figée au build : toute modification demande un redéploiement.
  env: {
    NEXT_PUBLIC_URL_SERVER_MORALIS:
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
      process.env.NEXT_PUBLIC_URL_SERVER_MORALIS ||
      FALLBACK_RPC,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

module.exports = nextConfig;
