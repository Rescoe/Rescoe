/**
 * /api/token/art-metadata — Métadonnées IPFS immuables d'une œuvre d'art
 *
 * ?contract=0x...&tokenId=123
 *
 * Données retournées : image, name, description, artist
 *
 * Cache stratifié :
 *   - Serveur module-level : permanent (TTL 30 jours, CID IPFS jamais modifié)
 *   - CDN Vercel : max-age=31536000, immutable
 *   - Navigateur (localStorage client) : permanent, pas de TTL
 *
 * Logique : une fois le NFT minté, son tokenURI pointe vers un CID IPFS
 * qui ne change JAMAIS (différent du token d'adhésion qui évolue).
 * On peut donc cacher indéfiniment.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABI_ART.json";

// ─── Helpers IPFS ─────────────────────────────────────────────────────────────

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

import type { ArtTokenMetadata } from "@/types/token";

// ─── Cache serveur module-level ───────────────────────────────────────────────

/** Map "contract_tokenId" → { data, ts } */
const metaCache = new Map<string, { data: ArtTokenMetadata; ts: number }>();
// 30 jours — dans les faits, permanent (CID immuable)
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const contract = String(req.query.contract ?? "").trim();
  const tokenId = String(req.query.tokenId ?? "").trim();

  if (!contract || !ethers.isAddress(contract)) {
    return res.status(400).json({ error: "contract invalide" });
  }
  if (!tokenId || isNaN(Number(tokenId))) {
    return res.status(400).json({ error: "tokenId invalide" });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;
  if (!rpcUrl) return res.status(500).json({ error: "Missing env vars" });

  const cacheKey = `${contract}_${tokenId}`;

  // 1. Cache serveur frais ?
  const cached = metaCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    // CID immuable → immutable en CDN
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  // 2. Fetch on-chain (1 appel tokenURI) + IPFS (1 fetch)
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const artContract = new ethers.Contract(contract, ABI, provider);

    const tokenURI: string = await artContract.tokenURI(Number(tokenId));

    let meta: Record<string, unknown> = {};
    const ipfsUrl = serverIPFS(tokenURI);
    if (ipfsUrl) {
      try {
        const r = await fetch(ipfsUrl, { signal: AbortSignal.timeout(8000) });
        if (r.ok) meta = await r.json();
      } catch {}
    }

    const data: ArtTokenMetadata = {
      image: browserIPFS(String(meta.image ?? "")),
      name: String(meta.name ?? ""),
      description: String(meta.description ?? ""),
      artist: String(meta.artist ?? ""),
    };

    metaCache.set(cacheKey, { data, ts: Date.now() });

    // CID IPFS immuable → cache permanent
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (e) {
    console.error("[/api/token/art-metadata]", e);

    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("CDN-Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: "Impossible de charger les métadonnées" });
  }
}
