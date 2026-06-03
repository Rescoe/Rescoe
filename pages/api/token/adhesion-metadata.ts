/**
 * /api/token/adhesion-metadata — Métadonnées IPFS d'un token d'adhésion
 *
 * ?tokenId=123
 *
 * Données retournées : tokenURI + URL image résolue via IPFS
 *
 * Cache stratifié :
 *   - Serveur module-level : 24h (ne change que sur évolution, événement rare)
 *   - CDN Vercel : max-age=3600, stale-while-revalidate=86400
 *   - Navigateur (localStorage client) : 24h, invalidé manuellement post-évolution
 *
 * Invalidation serveur :
 *   - Via evictAdhesionMetadata(tokenId) appelé par /api/revalidate (futur stream Moralis)
 *   - TTL 24h automatique
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Helpers IPFS (identiques aux autres routes) ──────────────────────────────

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

import type { AdhesionTokenMetadata } from "@/types/token";

// ─── Cache serveur module-level ───────────────────────────────────────────────

/** Map tokenId → { data, ts } */
const metaCache = new Map<string, { data: AdhesionTokenMetadata; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — ne change que sur évolution

/**
 * Invalide le cache d'un token spécifique (à appeler depuis /api/revalidate
 * lors d'un événement evolution on-chain).
 */
export function evictAdhesionMetadata(tokenId: string): void {
  metaCache.delete(tokenId);
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

  // 1. Cache serveur frais ?
  const cached = metaCache.get(tokenId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  // 2. Fetch on-chain (1 appel Moralis)
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    // ── tokenURI on-chain ─────────────────────────────────────────────────────
    // Cas spécial : InsectStorage pas encore configuré → revert custom error.
    // On retourne un résultat vide (200) au lieu d'un 500, pour ne pas bloquer la page.
    let tokenURI = "";
    let uriWarning: string | undefined;

    try {
      tokenURI = await contract.tokenURI(Number(tokenId));
    } catch (uriErr: unknown) {
      const err = uriErr as { reason?: string; data?: string; message?: string };
      const isStorageNotSet =
        err?.reason === "InsectStorageNotSet()" ||
        String(err?.data ?? "").startsWith("0x6e1245fc") ||
        String(err?.message ?? "").includes("InsectStorageNotSet");

      if (isStorageNotSet) {
        // Configuration post-déploiement incomplète — les images ne sont pas encore uploadées.
        // On retourne une metadata vide et non-cachée pour que la page puisse afficher
        // un état informatif plutôt qu'un spinner infini ou une erreur 500.
        uriWarning = "InsectStorage non configuré — run setup-insect-storage.js puis upload-insect-images.js";
        console.warn("[/api/token/adhesion-metadata] InsectStorageNotSet sur tokenId", tokenId);
      } else {
        // Autre revert (tokenId inexistant, erreur réseau…) → propagate
        throw uriErr;
      }
    }

    let image = "";
    let insectFamily      = "";
    let insectDisplayName = "";
    let insectLevel: number | undefined;
    let insectArtistAddress: string | undefined;

    if (!uriWarning && tokenURI) {
      // ── Cas 1 : tokenUri on-chain (data:application/json;base64,…) ────────
      // Métadonnées intégralement embarquées — aucun appel IPFS nécessaire.
      if (tokenURI.startsWith("data:application/json;base64,")) {
        try {
          const b64 = tokenURI.slice("data:application/json;base64,".length);
          const json = Buffer.from(b64, "base64").toString("utf8");
          const meta = JSON.parse(json);
          image             = String(meta?.image ?? "");
          insectFamily      = String(meta?.family ?? "");
          // "ResCoe - VulpinSpectraAlpha | Vulpin" → strip prefix
          insectDisplayName = String(meta?.name ?? "").replace(/^ResCoe\s[-—]\s?/, "");
          // Attributs on-chain : Niveau + Artiste
          const attrs = meta?.attributes as Array<{ trait_type: string; value: unknown }> | undefined;
          const niveauAttr  = attrs?.find((a) => a.trait_type === "Niveau");
          const artisteAttr = attrs?.find((a) => a.trait_type === "Artiste");
          if (niveauAttr  !== undefined) insectLevel = Number(niveauAttr.value);
          if (artisteAttr !== undefined) insectArtistAddress = String(artisteAttr.value);
        } catch {
          // JSON invalide — on laisse les champs vides
        }
      }
      // ── Cas 2 : tokenUri IPFS ou HTTP (ancien système) ───────────────────
      else {
        const ipfsUrl = serverIPFS(tokenURI);
        if (ipfsUrl) {
          try {
            const r = await fetch(ipfsUrl, { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
              const meta = await r.json();
              image         = browserIPFS(String(meta?.image ?? ""));
              insectFamily  = String(meta?.family ?? "");
            }
          } catch {}
        }
      }
    }

    const data: AdhesionTokenMetadata = {
      tokenURI,
      image,
      ...(insectFamily          ? { insectFamily }          : {}),
      ...(insectDisplayName     ? { insectDisplayName }     : {}),
      ...(insectLevel !== undefined ? { insectLevel }       : {}),
      ...(insectArtistAddress   ? { insectArtistAddress }   : {}),
      ...(uriWarning            ? { warning: uriWarning }   : {}),
    };

    // Ne pas cacher un résultat vide dû à une config manquante (TTL court pour recheck)
    if (uriWarning) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Cache", "SKIP");
    } else {
      metaCache.set(tokenId, { data, ts: Date.now() });
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.setHeader("X-Cache", "MISS");
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error("[/api/token/adhesion-metadata]", e);

    // Stale cache si disponible
    if (cached) {
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("CDN-Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: "Impossible de charger les métadonnées" });
  }
}
