/**
 * /api/token/insects — Liste complète des insectes d'un wallet
 *
 * ?address=0x...
 *
 * Retourne : tokenId, name, image, level, membershipInfo, canEvolve, isEgg
 *
 * Cache serveur 5 min (TTL court car l'état évolue — évolutions, hatching)
 * Cache CDN  : max-age=120, stale-while-revalidate=300
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsectMembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
  isAnnual: boolean;
}

export interface InsectData {
  id: number;
  name: string;
  image: string;
  level: number;
  membershipInfo: InsectMembershipInfo;
  canEvolve: boolean;
  isEgg: boolean;
}

// ─── Cache serveur module-level ───────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const insectCache = new Map<string, { data: InsectData[]; ts: number }>();

export function evictInsectsCache(address: string): void {
  insectCache.delete(address.toLowerCase());
}

/** Vide TOUTES les entrées du cache serveur (post-evolution broadcast). */
export function evictAllInsectsCache(): void {
  insectCache.clear();
}

const LEVEL_MAX = 3;

// ─── IPFS helpers ────────────────────────────────────────────────────────────

/**
 * URL de l'image du badge.
 * Le paramètre `t` = startTimestamp sert de cache-buster :
 * il change à chaque évolution → CDN charge la nouvelle image immédiatement.
 */
function resolveImageUrl(tokenId: number, startTimestamp: number): string {
  return `/api/token/insect-image?tokenId=${tokenId}&t=${startTimestamp}`;
}

function extractName(tokenId: number, tokenURI: string): string {
  if (tokenURI.startsWith("data:application/json;base64,")) {
    try {
      const b64 = tokenURI.slice("data:application/json;base64,".length);
      const meta = JSON.parse(atob(b64));
      if (meta?.name) return String(meta.name);
    } catch {}
  }
  return `Insecte #${tokenId}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = String(req.query.address ?? "").trim().toLowerCase();
  if (!address || !/^0x[0-9a-f]{40}$/i.test(address)) {
    return res.status(400).json({ error: "address invalide" });
  }

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;
  if (!contractAddress || !rpcUrl) {
    return res.status(500).json({ error: "Missing env vars" });
  }

  // ?bust=1 → le client vient d'évoluer, on ignore le cache serveur
  const forceRefresh = req.query.bust === "1";

  // Cache frais (sauf si force refresh demandé) ?
  const cached = insectCache.get(address);
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    // 1 appel : liste des tokens
    const tokenIds: bigint[] = await contract.getTokensByOwner(address);

    if (tokenIds.length === 0) {
      insectCache.set(address, { data: [], ts: Date.now() });
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(200).json([]);
    }

    // Fetch levelDurations (3 appels) + tokenURI + membershipInfo par token — en parallèle
    const [dur0, dur1, dur2, ...tokenResults] = await Promise.all([
      contract.levelDurations(0),
      contract.levelDurations(1),
      contract.levelDurations(2),
      ...tokenIds.map(async (tokenId) => {
        const id = Number(tokenId);
        try {
          const [tokenURI, membershipInfoRaw] = await Promise.all([
            contract.tokenURI(tokenId),
            contract.membershipInfo(tokenId),
          ]);
          return { id, tokenURI, membershipInfoRaw };
        } catch {
          return { id, tokenURI: null, membershipInfoRaw: null };
        }
      }),
    ]);

    const levelDurations = [Number(dur0), Number(dur1), Number(dur2)];
    const now = Math.floor(Date.now() / 1000);

    const insects: InsectData[] = (tokenResults as Array<{ id: number; tokenURI: string | null; membershipInfoRaw: any }>)
      .filter((t) => t.tokenURI && t.membershipInfoRaw)
      .map(({ id, tokenURI, membershipInfoRaw }) => {
        const membershipInfo: InsectMembershipInfo = {
          level: Number(membershipInfoRaw.level),
          autoEvolve: Boolean(membershipInfoRaw.autoEvolve),
          startTimestamp: Number(membershipInfoRaw.startTimestamp),
          expirationTimestamp: Number(membershipInfoRaw.expirationTimestamp),
          totalYears: Number(membershipInfoRaw.totalYears),
          locked: Boolean(membershipInfoRaw.locked),
          isEgg: Boolean(membershipInfoRaw.isEgg),
          isAnnual: Boolean(membershipInfoRaw.isAnnual),
        };

        const canEvolve =
          !membershipInfo.isEgg &&
          membershipInfo.level < LEVEL_MAX &&
          !membershipInfo.locked &&
          now >= membershipInfo.startTimestamp + levelDurations[membershipInfo.level];

        return {
          id,
          name: extractName(id, tokenURI!),
          image: resolveImageUrl(id, membershipInfo.startTimestamp),
          level: membershipInfo.level,
          membershipInfo,
          canEvolve,
          isEgg: membershipInfo.isEgg,
        };
      });

    insectCache.set(address, { data: insects, ts: Date.now() });

    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(insects);
  } catch (error: any) {
    console.error("[/api/token/insects]", error);
    return res.status(500).json({ error: "Erreur blockchain", detail: error?.message });
  }
}
