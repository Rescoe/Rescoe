// pages/api/ipfs/[...cid].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { isSafeIpfsPath } from "@/server/security/validators";

const GATEWAYS = [
  // Publics recurseurs GRATUITS d'abord (pas de limite bande passante pour toi)
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://w3s.link/ipfs/",           // Web3.Storage gratuit NFT
  //"https://www.rescoe.xyz/ipfs/",     // Ou /api/ si prefères
  "https://nftstorage.link/ipfs/",

  // TES DÉDIÉS Pinata EN DERNIER (économise bande passante gratuite)
  "https://harlequin-key-marmot-538.mypinata.cloud/ipfs/",
  "https://purple-managerial-ermine-688.mypinata.cloud/ipfs/",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Method not allowed");
  if (!enforceRateLimit(req, res, "ipfs", { limit: 240, windowMs: 60_000 })) return;

  const cidParts = req.query.cid;
  if (!cidParts) {
    return res.status(400).send("CID invalide");
  }

  const cidPath = Array.isArray(cidParts) ? cidParts.join("/") : cidParts;
  if (!isSafeIpfsPath(cidPath)) return res.status(400).send("CID invalide");

  for (const gateway of GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const url = `${gateway}${cidPath}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' } // Évite certains blocks
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return res.status(200).send(buffer);
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(`Gateway ${gateway} failed:`, e.message);
      continue;
    }
  }

  return res.status(502).send("IPFS gateway failure");
}
