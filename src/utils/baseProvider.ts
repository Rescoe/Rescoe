/**
 * Providers de LECTURE côté navigateur : un seul par URL, réseau fixé.
 *
 * Pourquoi (panne constatée le 2026-11-11) : `new JsonRpcProvider(url)` sans réseau fixé détecte
 * le réseau au démarrage ; si le RPC est injoignable (limite atteinte, panne, clé refusée), il
 * réessaie TOUTES LES SECONDES, POUR TOUJOURS, en écrivant « failed to detect network » dans la
 * console. Le code en créait un nouveau à chaque rafraîchissement du solde (toutes les 30 s) sans
 * jamais le détruire : des milliers d'instances zombies, 57 000 messages et des centaines de Mo
 * de mémoire après une journée, avec un site de plus en plus lent.
 *
 * Ici : (1) le réseau est fixé (`staticNetwork`) donc aucune détection ni boucle de réessai ;
 * (2) l'instance est créée une seule fois par URL et réutilisée.
 *
 * Un provider de lecture ne porte pas d'état utilisateur : le partager est sans risque.
 */
import { JsonRpcProvider, Network } from "ethers";

/** Base mainnet par défaut ; surchargeable pour un test sur un autre réseau. */
const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453);

/** RPC public utilisé si aucune URL n'est configurée (limité, sans garantie de service). */
export const DEFAULT_PUBLIC_RPC = "https://base-rpc.publicnode.com";

const cache = new Map<string, JsonRpcProvider>();

/** Provider de lecture partagé pour (url, chaîne). Sans URL, repli sur le RPC public. */
export function getReadProvider(url?: string | null, chainId: number = DEFAULT_CHAIN_ID): JsonRpcProvider {
  const rpc = (url ?? "").trim() || DEFAULT_PUBLIC_RPC;
  const key = `${chainId}|${rpc}`;
  let provider = cache.get(key);
  if (!provider) {
    const network = Network.from(chainId);
    provider = new JsonRpcProvider(rpc, network, { staticNetwork: network });
    cache.set(key, provider);
  }
  return provider;
}

/** Provider Base par défaut (RPC configuré dans NEXT_PUBLIC_URL_SERVER_MORALIS / NEXT_PUBLIC_BASE_RPC_URL). */
export function getBaseProvider(): JsonRpcProvider {
  return getReadProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
}
