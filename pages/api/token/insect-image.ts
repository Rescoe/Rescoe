/**
 * GET /api/token/insect-image?tokenId=123
 *
 * Sert l'image GIF du badge d'adhésion directement depuis la chaîne.
 * Fonctionne pour les tokens on-chain (data URI) et IPFS (legacy).
 *
 * Cache : 24h CDN + navigateur (les images on-chain ne changent qu'à l'évolution).
 * Après une évolution, le client invalide son cache en rechargant la page.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

function extractCID(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const m = uri.match(/\/ipfs\/(.+)/);
  return m ? m[1] : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const tokenId = String(req.query.tokenId ?? "").trim();
  if (!tokenId || isNaN(Number(tokenId))) {
    return res.status(400).json({ error: "tokenId invalide" });
  }
  // Le paramètre `t` = startTimestamp sert de cache-buster côté CDN.
  // Il est ignoré côté serveur — on lit toujours le tokenURI actuel depuis la chaîne.

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const rpcUrl          = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;
  if (!contractAddress || !rpcUrl) return res.status(500).end();

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ABI, provider);
    const tokenURI: string = await contract.tokenURI(Number(tokenId));

    // ── On-chain : data:application/json;base64,... ────────────────────────────
    if (tokenURI.startsWith("data:application/json;base64,")) {
      const b64  = tokenURI.slice("data:application/json;base64,".length);
      const meta = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      const imageUri: string = String(meta?.image ?? "");

      if (imageUri.startsWith("data:image/gif;base64,")) {
        const gifBase64 = imageUri.slice("data:image/gif;base64,".length);
        const gifBuffer = Buffer.from(gifBase64, "base64");
        res.setHeader("Content-Type", "image/gif");
        // 24h : image stable jusqu'à prochaine évolution
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        res.setHeader("CDN-Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.send(gifBuffer);
      }

      // Autre format d'image embarqué (PNG, SVG...)
      if (imageUri.startsWith("data:")) {
        const [header, b64img] = imageUri.split(",", 2);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : "image/gif";
        const imgBuffer = Buffer.from(b64img, "base64");
        res.setHeader("Content-Type", mime);
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        res.setHeader("CDN-Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return res.send(imgBuffer);
      }
    }

    // ── IPFS legacy : redirection vers le proxy ───────────────────────────────
    // Pour les anciens tokens pré-InsectImageStorage
    let ipfsImageUrl: string | null = null;

    if (tokenURI.startsWith("data:application/json;base64,")) {
      // On-chain JSON mais image non-data (cas théorique)
      const b64  = tokenURI.slice("data:application/json;base64,".length);
      const meta = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      const img  = String(meta?.image ?? "");
      const cid  = extractCID(img);
      if (cid) ipfsImageUrl = `/api/ipfs/${cid}`;
    } else {
      // tokenURI lui-même est IPFS → fetch metadata puis image
      const cid = extractCID(tokenURI);
      if (cid) {
        try {
          const r = await fetch(`https://ipfs.io/ipfs/${cid}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (r.ok) {
            const meta = await r.json();
            const imgCid = extractCID(String(meta?.image ?? ""));
            if (imgCid) ipfsImageUrl = `/api/ipfs/${imgCid}`;
          }
        } catch {}
      }
    }

    if (ipfsImageUrl) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(302, ipfsImageUrl);
    }

    return res.status(404).json({ error: "Image non trouvée" });
  } catch (e) {
    console.error("[/api/token/insect-image]", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
