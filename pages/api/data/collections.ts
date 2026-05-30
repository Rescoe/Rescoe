/**
 * /api/data/collections — Collections publiques + œuvres + poèmes
 *
 * Remplace les appels Moralis directs de useRescoeData.ts :
 *   getTotalCollectionsMinted → getCollectionsPaginated → getCollectionURI → IPFS
 *   + getTokenPaginated → tokenURI → IPFS (par collection Art)
 *   + getLastUniqueHaikusMinted → getTokenFullDetails (par collection Poésie)
 *
 * Cache stratifié identique aux autres routes /api/data/* :
 *   - Serveur module-level : 1h
 *   - CDN Vercel (CDN-Cache-Control) : max-age=3600, stale-while-revalidate=86400
 *   - Navigateur : max-age=0 (géré par localStorage 24h dans useRescoeData.ts)
 *
 * Invalidation :
 *   - TTL 1h automatique
 *   - Webhook Moralis Streams → POST /api/revalidate (secret serveur uniquement)
 *   - Post-mint côté client → localStorage vidé via cacheInvalidation.ts
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";
import ABI_ART from "@/components/ABI/ABI_ART.json";
import ABI_HAIKU from "@/components/ABI/HaikuEditions.json";

// ─── Helpers IPFS (identiques aux autres routes) ─────────────────────────────

function extractCID(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const m = uri.match(/\/ipfs\/(.+)/);
  if (m) return m[1];
  return null;
}

function serverIPFS(uri: string): string | null {
  const cid = extractCID(uri);
  if (cid) return `https://ipfs.io/ipfs/${cid}`;
  if (uri.startsWith("http")) return uri;
  return null;
}

function browserIPFS(uri: string): string {
  if (!uri) return "";
  const cid = extractCID(uri);
  if (cid) return `/api/ipfs/${cid}`;
  if (uri.startsWith("http")) return uri;
  return uri;
}

async function fetchIPFSJson(uri: string): Promise<Record<string, unknown> | null> {
  try {
    const url = serverIPFS(uri);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NftData {
  id: string;
  image: string;
  name: string;
  artist: string;
  mintContractAddress: string;
}

export interface HaikuData {
  poemText: string[];
  mintContractAddress: string;
  uniqueIdAssociated: string;
}

export interface CollectionData {
  id: string;
  name: string;
  collectionType: string;
  artist: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
  nfts: NftData[];
  haikus: HaikuData[];
}

interface ApiPayload {
  collections: CollectionData[];
  totalCollections: number;
}

// ─── Cache serveur module-level ──────────────────────────────────────────────

let serverCache: { data: ApiPayload; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Réinitialise le cache serveur de cette instance (voir /api/revalidate). */
export function resetCache(): void {
  serverCache = null;
}

// ─── Fetch NFTs d'une collection Art ─────────────────────────────────────────

async function fetchArtNFTs(
  contractAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<NftData[]> {
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return [];
  }
  try {
    const artContract = new ethers.Contract(contractAddress, ABI_ART, provider);
    const tokenIds: bigint[] = await artContract.getTokenPaginated(0, 19);

    const results = await Promise.allSettled(
      tokenIds.map(async (tokenId): Promise<NftData | null> => {
        try {
          const tokenURI: string = await artContract.tokenURI(tokenId);
          const meta = await fetchIPFSJson(tokenURI);
          if (!meta) return null;
          return {
            id: tokenId.toString(),
            image: browserIPFS(String(meta.image || "")),
            name: String(meta.name || ""),
            artist: String(meta.artist || ""),
            mintContractAddress: contractAddress,
          };
        } catch {
          return null;
        }
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<NftData> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
  } catch {
    return [];
  }
}

// ─── Fetch poèmes d'une collection Poésie ────────────────────────────────────

async function fetchPoems(
  contractAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<HaikuData[]> {
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return [];
  }
  try {
    const haikuContract = new ethers.Contract(contractAddress, ABI_HAIKU, provider);
    const count = Number(await haikuContract.getLastUniqueHaikusMinted());
    if (!count) return [];

    const max = Math.min(5, count);
    const results = await Promise.allSettled(
      Array.from({ length: max }, (_, i) => i).map(
        async (id): Promise<HaikuData | null> => {
          try {
            const data: unknown[] = await haikuContract.getTokenFullDetails(id);
            const poemText = data.map((t) => String(t));
            while (poemText.length < 8) poemText.push(`Ligne ${poemText.length + 1}`);
            return {
              poemText,
              mintContractAddress: contractAddress,
              uniqueIdAssociated: id.toString(),
            };
          } catch {
            return null;
          }
        }
      )
    );

    return results
      .filter((r): r is PromiseFulfilledResult<HaikuData> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
  } catch {
    return [];
  }
}

// ─── Helper headers CDN ──────────────────────────────────────────────────────

function setCacheHeaders(res: NextApiResponse, xCache: string, short = false) {
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.setHeader(
    "CDN-Cache-Control",
    short
      ? "public, max-age=60, stale-while-revalidate=600"
      : "public, max-age=3600, stale-while-revalidate=86400"
  );
  res.setHeader("X-Cache", xCache);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Cache serveur frais ?
  if (serverCache && Date.now() - serverCache.ts < CACHE_TTL_MS) {
    setCacheHeaders(res, "HIT");
    return res.status(200).json(serverCache.data);
  }

  const registryAddress = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  if (!registryAddress || !rpcUrl) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const registry = new ethers.Contract(registryAddress, ABIRESCOLLECTION, provider);

  try {
    // 2. Récupère le registre des collections (2 appels)
    const total = Number(await registry.getTotalCollectionsMinted());
    const paginated: unknown[][] = await registry.getCollectionsPaginated(0, total);

    // 3. Filtre les collections featured et les hydrate en parallèle
    const featured = paginated.filter((tuple) => tuple && tuple[6]);

    const collections = (
      await Promise.allSettled(
        featured.map(async (tuple): Promise<CollectionData | null> => {
          try {
            const id = tuple[0]!.toString();
            const name = String(tuple[1] || "");
            const collectionType = String(tuple[2] || "");
            const artist = String(tuple[3] || "");
            const rawAddr = tuple[4];
            const mintContractAddress = String(
              Array.isArray(rawAddr) ? rawAddr[0] : rawAddr
            );
            const isFeatured = Boolean(tuple[6]);

            // Metadata IPFS de la collection
            const uri: string = await registry.getCollectionURI(tuple[0]);
            const meta = await fetchIPFSJson(uri);
            const imageUrl = browserIPFS(String(meta?.image || ""));

            // Œuvres selon le type
            let nfts: NftData[] = [];
            let haikus: HaikuData[] = [];

            if (collectionType === "Art") {
              nfts = await fetchArtNFTs(mintContractAddress, provider);
            } else if (collectionType === "Poesie") {
              haikus = await fetchPoems(mintContractAddress, provider);
            }

            return { id, name, collectionType, artist, imageUrl, mintContractAddress, isFeatured, nfts, haikus };
          } catch {
            return null;
          }
        })
      )
    )
      .filter(
        (r): r is PromiseFulfilledResult<CollectionData> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    const data: ApiPayload = { collections, totalCollections: total };
    serverCache = { data, ts: Date.now() };
    setCacheHeaders(res, "MISS");
    return res.status(200).json(data);
  } catch (error) {
    console.error("[/api/data/collections] Erreur:", error);

    if (serverCache) {
      setCacheHeaders(res, "STALE", true);
      return res.status(200).json(serverCache.data);
    }

    return res.status(500).json({ error: "Impossible de charger les collections" });
  }
}
