/**
 * /api/token/art-state — État on-chain mutable d'une œuvre d'art
 *
 * ?contract=0x...&tokenId=123
 *
 * Données retournées :
 *   owner, mintDate, forsale, price, priceHistory, transactions, collectionId
 *
 * Cache stratifié :
 *   - Pas de cache serveur (propriétaire et état de vente changent fréquemment)
 *   - CDN Vercel : max-age=30, stale-while-revalidate=120
 *   - Navigateur : pas de localStorage
 *
 * Appels Moralis : 1 (getTokenFullDetails)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers, formatUnits } from "ethers";
import ABI from "@/components/ABI/ABI_ART.json";

// ─── Types ────────────────────────────────────────────────────────────────────

import type { ArtTokenState } from "@/types/token";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: bigint | number): string {
  return new Date(Number(ts) * 1000).toLocaleString();
}

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

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const artContract = new ethers.Contract(contract, ABI, provider);

    // 1 seul appel Moralis
    const fullDetails = await artContract.getTokenFullDetails(Number(tokenId));

    const owner: string = fullDetails.owner;
    const mintDate: bigint = fullDetails.mintDate;
    const currentPrice: bigint = fullDetails.currentPrice;
    const forsale: boolean = fullDetails.forSale;
    const priceHistory: bigint[] = fullDetails.priceHistory ?? [];
    const transactions: { seller: string; buyer: string; timestamp: bigint; price: bigint }[] =
      fullDetails.transactions ?? [];
    const collectionId: bigint = fullDetails[6] ?? BigInt(0);

    const data: ArtTokenState = {
      owner,
      mintDate: formatTimestamp(mintDate),
      forsale,
      price: formatUnits(currentPrice, 18),
      priceHistory: priceHistory.map((p) => Number(p) / 1e18),
      transactions: transactions.map((tx) => ({
        oldOwner: tx.seller,
        newOwner: tx.buyer,
        date: formatTimestamp(tx.timestamp),
        price: formatUnits(tx.price, 18),
      })),
      collectionId: Number(collectionId),
    };

    // État mutable : cache court
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);

    // Token inexistant (burn) → 404 propre
    if (msg.includes("ERC721NonexistentToken")) {
      return res.status(404).json({ error: "Token inexistant ou détruit" });
    }

    console.error("[/api/token/art-state]", e);
    return res.status(500).json({ error: "Impossible de charger l'état du token" });
  }
}
