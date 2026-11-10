/**
 * RPC Base (côté serveur) avec secours automatique.
 *
 * Pourquoi : la lecture des adhérents, des œuvres et des insectes passe par une seule URL RPC.
 * Quand cette URL tombe (clé révoquée, quota, panne du fournisseur), tout le site devient vide.
 * Ce module essaie les fournisseurs dans l'ordre et bascule sur le suivant en cas d'échec.
 *
 * Ordre :
 *   1. NEXT_PUBLIC_BASE_RPC_URL        (nouveau nom neutre, à privilégier)
 *   2. NEXT_PUBLIC_URL_SERVER_MORALIS  (ancien nom, conservé pour compatibilité)
 *   3. RPC publics gratuits            (secours : limités, sans garantie de service)
 *
 * Les RPC publics ne remplacent pas un fournisseur avec clé pour un vrai trafic.
 */
import { FallbackProvider, JsonRpcProvider, Network, type AbstractProvider } from "ethers";

const BASE = Network.from(8453);

/** Secours gratuits, testés le 2026-11-09 (lecture d'état et de journaux). */
export const PUBLIC_FALLBACK_RPCS = ["https://base-rpc.publicnode.com", "https://base.drpc.org"];

/** URLs RPC à essayer, dans l'ordre, sans doublon ni valeur invalide. */
export function getRpcUrls(env: NodeJS.ProcessEnv = process.env): string[] {
  const candidates = [env.NEXT_PUBLIC_BASE_RPC_URL, env.NEXT_PUBLIC_URL_SERVER_MORALIS, ...PUBLIC_FALLBACK_RPCS];
  const valid = candidates
    .map((u) => (u ?? "").trim())
    .filter((u) => /^https?:\/\//i.test(u));
  return Array.from(new Set(valid));
}

/**
 * Fournisseur de lecture : un seul appel suffit (quorum 1), le suivant est interrogé si le
 * premier échoue ou tarde. Le réseau est fixé : pas de détection de réseau au démarrage.
 */
export function getServerProvider(): AbstractProvider {
  const configs = getRpcUrls().map((url, index) => ({
    provider: new JsonRpcProvider(url, BASE, { staticNetwork: BASE, batchMaxCount: 1 }),
    priority: index + 1,
    stallTimeout: 2500,
    weight: 1,
  }));
  return new FallbackProvider(configs, BASE, { quorum: 1 });
}
