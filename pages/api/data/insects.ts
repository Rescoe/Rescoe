/**
 * /api/data/insects — Galerie de toutes les cartes d'adhésion mintées
 *
 * Remplace la boucle dans Adherent.tsx qui faisait ownerOf + tokenURI
 * pour chaque token (i=0 à getTotalMinted) — 300+ appels Moralis par visite.
 *
 * Ici : exécuté UNE seule fois côté serveur, résultat partagé via CDN.
 *
 * Cache stratifié :
 *   - Serveur : module-level 1h (aligné sur CDN)
 *   - CDN Vercel : Cache-Control navigateur = max-age=0 (pas de cache HTTP navigateur)
 *                  CDN-Cache-Control = max-age=3600, stale-while-revalidate=86400
 *                  → Vercel sert la réponse en cache instantanément pendant le refresh
 *   - Client localStorage : 24h (dans Adherent.tsx)
 *
 * Invalidation :
 *   - TTL 1h automatique
 *   - Post-mint : localStorage vidé côté client par l'app
 *   - Webhook futur : POST /api/revalidate (secret serveur, jamais exposé au client)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Config ──────────────────────────────────────────────────────────────────

/** Max de tokens affichés dans la galerie (réduit les appels Moralis serveur) */
const MAX_DISPLAY = 50;
/** Taille des batches parallèles pour ownerOf + tokenURI */
const BATCH_SIZE = 8;

// ─── Helpers IPFS ────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsectCard {
  id: string;
  image: string;
  name: string;
  bio: string;
}

interface ApiPayload {
  insects: InsectCard[];
  totalMinted: number;
  displayedCount: number;
  hasMore: boolean;
}

// ─── Cache serveur module-level ──────────────────────────────────────────────

let serverCache: { data: ApiPayload; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure — aligné sur CDN-Cache-Control max-age

/** Réinitialise le cache serveur de cette instance (voir /api/revalidate). */
export function resetCache(): void {
  serverCache = null;
}

// ─── Fetch d'un token individuel ─────────────────────────────────────────────

async function fetchToken(
  i: number,
  contract: ethers.Contract
): Promise<InsectCard | null> {
  try {
    // Vérifie que le token n'est pas brûlé
    const owner: string = await contract.ownerOf(i);
    if (
      !owner ||
      owner === "0x0000000000000000000000000000000000000000"
    ) {
      return null;
    }

    const tokenURI: string = await contract.tokenURI(i);

    // ── Cas 1 : tokenUri on-chain (data:application/json;base64,…) ──────────
    // Métadonnées embarquées — aucun appel IPFS nécessaire.
    if (tokenURI.startsWith("data:application/json;base64,")) {
      try {
        const b64 = tokenURI.slice("data:application/json;base64,".length);
        const json = Buffer.from(b64, "base64").toString("utf8");
        const meta = JSON.parse(json);
        return {
          id: i.toString(),
          image: String(meta?.image ?? ""),
          name: String(meta?.name ?? `Carte #${i}`),
          bio: String(meta?.bio ?? meta?.description ?? ""),
        };
      } catch {
        return null;
      }
    }

    // ── Cas 2 : tokenUri IPFS ou HTTP (ancien système) ───────────────────────
    const metaUrl = serverIPFS(tokenURI);
    if (!metaUrl) return null;

    const res = await fetch(metaUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const meta = await res.json();
    return {
      id: i.toString(),
      image: browserIPFS(meta.image || ""),
      name: String(meta.name || `Carte #${i}`),
      bio: String(meta.bio || meta.description || ""),
    };
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Cache serveur encore frais ?
  if (serverCache && Date.now() - serverCache.ts < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(serverCache.data);
  }

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  if (!contractAddress || !rpcUrl) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  try {
    // 2. Nombre total de tokens mintés (1 appel)
    const totalMinted = Number(await contract.getTotalMinted());
    const limit = Math.min(totalMinted, MAX_DISPLAY);

    // 3. Récupère les tokens par batches pour ne pas saturer le RPS
    const insects: InsectCard[] = [];

    for (let batchStart = 0; batchStart < limit; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, limit);
      const indices = Array.from(
        { length: batchEnd - batchStart },
        (_, j) => batchStart + j
      );

      const batchResults = await Promise.allSettled(
        indices.map((i) => fetchToken(i, contract))
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value !== null) {
          insects.push(result.value);
        }
      }
    }

    const data: ApiPayload = {
      insects,
      totalMinted,
      displayedCount: insects.length,
      hasMore: totalMinted > MAX_DISPLAY,
    };

    // 4. Stocke en cache serveur
    serverCache = { data, ts: Date.now() };

    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (error) {
    console.error("[/api/data/insects] Erreur:", error);

    if (serverCache) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("CDN-Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(serverCache.data);
    }

    return res.status(500).json({ error: "Impossible de charger les cartes" });
  }
}
