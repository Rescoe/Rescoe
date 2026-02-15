// pages/api/ipfs/[...cid].ts
import type { NextApiRequest, NextApiResponse } from "next";

const GATEWAYS = [
  "https://harlequin-key-marmot-538.mypinata.cloud/ipfs/",
  "https://purple-managerial-ermine-688.mypinata.cloud/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cidParts = req.query.cid;

  // /api/ipfs/[...cid] -> cidParts peut être string | string[]
  if (!cidParts) {
    return res.status(400).send("CID invalide");
  }

  const cidPath = Array.isArray(cidParts) ? cidParts.join("/") : cidParts;

  for (const gateway of GATEWAYS) {
    try {
      const url = gateway + cidPath;
      const response = await fetch(url);

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return res.status(200).send(buffer);
    } catch (e) {
      // on tente le gateway suivant
      continue;
    }
  }

  return res.status(502).send("IPFS gateway failure");
}
