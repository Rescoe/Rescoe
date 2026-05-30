/**
 * /api/token/adhesion-metadata — Métadonnées IPFS d'un token d'adhésion
 *
 * ?tokenId=123
 *
 * Données retournées : tokenURI + URL image résolue via IPFS
 *
 * Cache stratifié :
 *   - Serveur module-level : 24h (ne change que sur évolution, événement rare)
 *   - CDN Vercel : max-age=3600, stale-while-revalidate=86400
 *   - Navigateur (localStorage client) : 24h, invalidé manuellement post-évolution
 *
 * Invalidation serveur :
 *   - Via evictAdhesionMetadata(tokenId) appelé par /api/revalidate (futur stream Moralis)
 *   - TTL 24h automatique
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Helpers IPFS (identiques aux autres routes) ──────────────────────────────

function extractCID(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const m = uri.match(/\/ipfs\/(.+)/);
  return m ? m[1] : null;
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

// ─── Types ────────────────────────────────────────────────────────────────────

import type { AdhesionTokenMetadata } from "@/types/token";

// ─── Cache serveur module-level ───────────────────────────────────────────────

/** Map tokenId → { data, ts } */
const metaCache = new Map<string, { data: AdhesionTokenMetadata; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — ne change que sur évolution

/**
 * Invalide le cache d'un token spécifique (à appeler depuis /api/revalidate
 * lors d'un événement evolution on-chain).
 */
export function evictAdhesionMetadata(tokenId: string): void {
  metaCache.delete(tokenId);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tokenId = String(req.query.tokenId ?? "").trim();
  if (!tokenId || isNaN(Number(tokenId))) {
    return res.status(400).json({ error: "tokenId invalide" });
  }

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;
  if (!contractAddress || !rpcUrl) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  // 1. Cache serveur frais ?
  const cached = metaCache.get(tokenId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  // 2. Fetch on-chain (1 appel Moralis) + IPFS (1 fetch)
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    const tokenURI: string = await contract.tokenURI(Number(tokenId));

    let image = "";
    const ipfsUrl = serverIPFS(tokenURI);
    if (ipfsUrl) {
      try {
        const r = await fetch(ipfsUrl, { signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const meta = await r.json();
          image = browserIPFS(String(meta?.image ?? ""));
        }
      } catch {}
    }

    const data: AdhesionTokenMetadata = { tokenURI, image };
    metaCache.set(tokenId, { data, ts: Date.now() });

    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (e) {
    console.error("[/api/token/adhesion-metadata]", e);

    // Stale cache si disponible
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("CDN-Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: "Impossible de charger les métadonnées" });
  }
}
