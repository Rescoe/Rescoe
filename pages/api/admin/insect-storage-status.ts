/**
 * /api/admin/insect-storage-status
 * Checks InsectImageStorage.hasInsectMeta(key) for every insect key on Base mainnet.
 *
 * Query param: ?address=0x...  (connected wallet – must match OWNER_ADDRESS)
 *
 * Returns JSON:
 * {
 *   total: 1091,
 *   uploaded: N,
 *   byLevel: { 0: { total, uploaded }, 1: ..., 2: ..., 3: ... },
 *   byFamily: { FamilyName: { total, uploaded }, ... },
 *   notUploaded: ["key1", ...]
 * }
 *
 * Simple in-memory cache: 60 s TTL.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import nftMetadata from "@/data/nft_metadata_clean.json";

// ─── constants ────────────────────────────────────────────────────────────────

const OWNER_ADDRESS = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879";
const CONTRACT_ADDRESS = "0x1BD2F00C37a39F87dC08A491C416F04a7F6D4A78";
const BASE_RPC = "https://mainnet.base.org";
const BATCH_SIZE = 20;
const CACHE_TTL_MS = 60_000;

const ABI = [
  "function hasInsectMeta(string calldata insectKey) external view returns (bool)",
];

// ─── in-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: StatusResponse;
  ts: number;
}
let cache: CacheEntry | null = null;

// ─── types ────────────────────────────────────────────────────────────────────

interface LevelBucket { total: number; uploaded: number }
interface FamilyBucket { total: number; uploaded: number }

interface StatusResponse {
  total: number;
  uploaded: number;
  byLevel: Record<number, LevelBucket>;
  byFamily: Record<string, FamilyBucket>;
  notUploaded: string[];
  cachedAt?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

type InsectEntry = {
  level: number;
  family_name: string;
  [key: string]: unknown;
};

function getAllKeys(): { key: string; level: number; family: string }[] {
  return Object.entries(nftMetadata as Record<string, InsectEntry>).map(
    ([key, entry]) => ({
      key,
      level: entry.level ?? 0,
      family: entry.family_name ?? "Unknown",
    })
  );
}

async function checkBatch(
  contract: ethers.Contract,
  keys: string[]
): Promise<boolean[]> {
  return Promise.all(keys.map((k) => contract.hasInsectMeta(k)));
}

// ─── handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") return res.status(405).end();

  // Auth gate
  const { address } = req.query;
  if (
    typeof address !== "string" ||
    address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()
  ) {
    return res
      .status(403)
      .json({ error: "Accès réservé à l'admin" });
  }

  // Cache hit
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return res
      .status(200)
      .setHeader("X-Cache", "HIT")
      .json(cache.data);
  }

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const allInsects = getAllKeys();

    // Initialise accumulators
    const byLevel: Record<number, LevelBucket> = {};
    const byFamily: Record<string, FamilyBucket> = {};
    const notUploaded: string[] = [];
    let uploaded = 0;

    for (const { level, family } of allInsects) {
      if (!byLevel[level]) byLevel[level] = { total: 0, uploaded: 0 };
      byLevel[level].total++;
      if (!byFamily[family]) byFamily[family] = { total: 0, uploaded: 0 };
      byFamily[family].total++;
    }

    // Batched RPC calls
    for (let i = 0; i < allInsects.length; i += BATCH_SIZE) {
      const batch = allInsects.slice(i, i + BATCH_SIZE);
      const results = await checkBatch(
        contract,
        batch.map((b) => b.key)
      );

      results.forEach((has, idx) => {
        const { key, level, family } = batch[idx];
        if (has) {
          uploaded++;
          byLevel[level].uploaded++;
          byFamily[family].uploaded++;
        } else {
          notUploaded.push(key);
        }
      });
    }

    const data: StatusResponse = {
      total: allInsects.length,
      uploaded,
      byLevel,
      byFamily,
      notUploaded,
      cachedAt: new Date().toISOString(),
    };

    cache = { data, ts: Date.now() };

    return res
      .status(200)
      .setHeader("X-Cache", "MISS")
      .json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[insect-storage-status] Error:", msg);
    return res.status(500).json({ error: "Erreur RPC", details: msg });
  }
}
