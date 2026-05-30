/**
 * collectionsData.ts — Logique de fetch collections partagée
 *
 * Utilisée à la fois par :
 *   - pages/api/data/collections.ts (handler API, avec cache module-level)
 *   - getStaticProps de pages/galerie/art.tsx et pages/galerie/poesie.tsx (ISR)
 *
 * Ne dépend d'aucun contexte Next.js (pas de NextApiRequest/Response).
 * Compatible Node.js pur → appelable au build time.
 */

import { ethers } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";

// ─── Type retourné (metadata de collection sans NFTs/haïkus) ────────────────

export interface GalerieCollection {
  id: string;
  name: string;
  collectionType: string;
  creator: string;
  imageUrl: string;          // /api/ipfs/<CID> — chemin relatif navigateur
  mintContractAddress: string;
  isFeatured: boolean;
}

// ─── Helpers IPFS ─────────────────────────────────────────────────────────────

function extractCID(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const m = uri.match(/\/ipfs\/(.+)/);
  return m ? m[1] : null;
}

/** Résolution côté serveur (ipfs.io) pour le fetch de métadonnées */
function serverIPFSUrl(uri: string): string | null {
  const cid = extractCID(uri);
  if (cid) return `https://ipfs.io/ipfs/${cid}`;
  if (uri.startsWith("http")) return uri;
  return null;
}

/** URL image renvoyée dans la réponse : proxy /api/ipfs/CID côté navigateur */
function browserImageUrl(imageUri: string): string {
  if (!imageUri) return "";
  const cid = extractCID(imageUri);
  if (cid) return `/api/ipfs/${cid}`;
  if (imageUri.startsWith("http")) return imageUri;
  return "";
}

/** Récupère l'URL d'image d'une collection depuis son URI IPFS de collection */
async function resolveCollectionImage(collectionUri: string): Promise<string> {
  try {
    const url = serverIPFSUrl(collectionUri);
    if (!url) return "";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return "";
    const meta = await res.json();
    return browserImageUrl(String(meta?.image ?? ""));
  } catch {
    return "";
  }
}

// ─── Fetch principal ──────────────────────────────────────────────────────────

/**
 * Récupère toutes les collections depuis le registre on-chain.
 * Résout les métadonnées IPFS pour l'imageUrl de chaque collection.
 *
 * N'inclut PAS les NFTs ni les haïkus (chargés à la demande côté client).
 */
export async function fetchGalerieCollections(): Promise<GalerieCollection[]> {
  const registryAddress = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;

  if (!registryAddress || !rpcUrl) {
    console.warn("[collectionsData] Variables d'env manquantes");
    return [];
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const registry = new ethers.Contract(registryAddress, ABIRESCOLLECTION, provider);

  // 2 appels Moralis : total + liste complète
  const total = Number(await registry.getTotalCollectionsMinted());
  if (!total) return [];

  const paginated: unknown[][] = await registry.getCollectionsPaginated(0, total);

  const results = await Promise.allSettled(
    paginated.map(async (tuple): Promise<GalerieCollection | null> => {
      try {
        const id = String(tuple[0] ?? "");
        const name = String(tuple[1] ?? "");
        const collectionType = String(tuple[2] ?? "");
        const creator = String(tuple[3] ?? "");
        const rawAddr = tuple[4];
        const mintContractAddress = String(
          Array.isArray(rawAddr) ? rawAddr[0] : rawAddr
        );
        const isFeatured = Boolean(tuple[6]);

        // 1 appel Moralis pour l'URI + 1 fetch IPFS
        const uri: string = await registry.getCollectionURI(tuple[0]);
        const imageUrl = await resolveCollectionImage(uri);

        return { id, name, collectionType, creator, imageUrl, mintContractAddress, isFeatured };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<GalerieCollection> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}
