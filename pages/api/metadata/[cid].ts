// pages/api/metadata/[cid].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { isSafeIpfsPath } from "@/server/security/validators";

const GATEWAYS = [
  "https://harlequin-key-marmot-538.mypinata.cloud/ipfs/",
  "https://purple-managerial-ermine-688.mypinata.cloud/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, "metadata", { limit: 240, windowMs: 60_000 })) return;

  const { cid } = req.query;

  if (!cid || typeof cid !== 'string' || !isSafeIpfsPath(cid)) {
    return res.status(400).json({ error: "CID invalide" });
  }

  for (const gateway of GATEWAYS) {
    try {
      const url = `${gateway}${cid}`;
      const response = await fetch(url);

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";

      // ✅ JSON UNIQUEMENT (metadata)
      if (contentType.includes('application/json') || contentType.includes('application/ld+json')) {
        const jsonData = await response.json();
        return res.status(200).json(jsonData);
      }

      // Skip non-JSON
      continue;
    } catch (e) {
      continue;
    }
  }

  return res.status(404).json({ error: "Metadata JSON non trouvé" });
}
