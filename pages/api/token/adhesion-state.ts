/**
 * /api/token/adhesion-state — État on-chain mutable d'un token d'adhésion
 *
 * ?tokenId=123
 *
 * Données retournées :
 *   owner, role, mintTimestamp, price, name, bio, remainingTime, fin,
 *   forSale, membership, membershipInfo, mintPrice
 *
 * Cache stratifié :
 *   - Pas de cache serveur (données très mutables : temps restant, propriétaire...)
 *   - CDN Vercel : max-age=60, stale-while-revalidate=300
 *   - Navigateur : pas de localStorage (données trop volatiles)
 *
 * Appels Moralis : 4 (getTokenDetails + getUserInfo + getMembershipInfo + mintPrice)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers, formatUnits, BigNumberish } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Types ────────────────────────────────────────────────────────────────────

import type { MembershipInfo, AdhesionTokenState } from "@/types/token";

// ─── Helpers de formatage ─────────────────────────────────────────────────────

function formatSeconds(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}j ${hours}h ${minutes}m ${secs}s`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  });
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

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    const tid = Number(tokenId);

    // 3 appels en parallèle — getMembershipInfo n'existe plus, c'est le getter public membershipInfo(uint256)
    const [details, miRaw, mintPriceWei] = await Promise.all([
      contract.getTokenDetails(tid),
      contract.membershipInfo(tid),
      contract.mintPrice(),
    ]);

    const [
      owner,
      role,
      mintTimestamp,
      priceWei,
      nameOnChain,
      bioOnChain,
      remainingTimeSec,
      forSale,
    ] = details;

    // getUserInfo nécessite l'adresse owner, donc séquentiel
    const userInfo = await contract.getUserInfo(owner);
    const [membership, realName, realBio] = userInfo;

    const membershipInfo: MembershipInfo = {
      level: Number(miRaw.level),
      autoEvolve: Boolean(miRaw.autoEvolve),
      startTimestamp: Number(miRaw.startTimestamp),
      expirationTimestamp: Number(miRaw.expirationTimestamp),
      totalYears: Number(miRaw.totalYears),
      locked: Boolean(miRaw.locked),
      isEgg: Boolean(miRaw.isEgg),
      isAnnual: Boolean(miRaw.isAnnual),
    };

    const mintTs = Number(mintTimestamp);
    const remainingSec = Number(remainingTimeSec);

    const data: AdhesionTokenState = {
      owner: String(owner),
      role: Number(role),
      mintTimestamp: new Date(mintTs * 1000).toLocaleString(),
      price: formatUnits(priceWei as BigNumberish, "ether"),
      name: String(realName?.length > 0 ? realName : nameOnChain),
      bio: String(realBio?.length > 0 ? realBio : bioOnChain),
      remainingTime: formatSeconds(remainingSec),
      fin: formatDate(mintTs + remainingSec),
      forSale: Boolean(forSale),
      membership: String(membership),
      membershipInfo,
      mintPrice: formatUnits(mintPriceWei as BigNumberish, "ether"),
    };

    // CDN : 60s (données mutables mais pas extrêmement volatiles)
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (e) {
    console.error("[/api/token/adhesion-state]", e);
    return res.status(500).json({ error: "Impossible de charger l'état du token" });
  }
}
