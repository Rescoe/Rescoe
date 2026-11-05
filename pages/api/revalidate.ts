/**
 * /api/revalidate — Invalidation du cache serveur sur événement blockchain
 *
 * USAGE : appelé UNIQUEMENT par des webhooks serveur-à-serveur (ex. Moralis Streams).
 * JAMAIS exposé au client. Le secret doit être dans REVALIDATE_SECRET (pas NEXT_PUBLIC_).
 *
 * Authentification :
 *   Header : x-revalidate-secret: <REVALIDATE_SECRET>
 *   OU query param secret=<REVALIDATE_SECRET> (pour tests curl uniquement)
 *
 * Paramètres :
 *   ?caches=members,insects,collections  (ou "all" pour tout réinitialiser)
 *
 * Ce que fait cet endpoint :
 *   1. Réinitialise les caches module-level de l'instance courante
 *      → La prochaine requête vers /api/data/* refetchera Moralis
 *      → Le CDN Vercel re-fetchera depuis le serveur et mettra à jour son cache
 *   2. Portée : instance Node.js courante uniquement
 *      → Les autres instances expirent sur TTL (1h)
 *      → Pour une invalidation garantie multi-instance, utiliser Vercel KV (futur)
 *
 * Exemple d'appel depuis Moralis Streams (webhook) :
 *   POST https://rescoe.fr/api/revalidate?caches=members,insects
 *   Headers: x-revalidate-secret: <REVALIDATE_SECRET>
 *   Body: { "confirmed": true, "block": {...}, "txs": [...] }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { resetCache as resetMembers } from "./data/members";
import { resetCache as resetInsects } from "./data/insects";
import { resetCache as resetCollections } from "./data/collections";
import { evictAdhesionMetadata } from "./token/adhesion-metadata";
import { timingSafeEqual } from "crypto";
import { enforceRateLimit } from "@/server/security/rateLimit";

/** Comparaison à temps constant (évite de deviner le secret par mesure de temps). */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const VALID_CACHES = ["members", "insects", "collections"] as const;
type CacheName = (typeof VALID_CACHES)[number];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Accepte GET et POST (webhooks Moralis envoient souvent des POST)
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Frein au brute-force du secret (best-effort, voir rateLimit.ts)
  if (!enforceRateLimit(req, res, "revalidate", { limit: 60, windowMs: 60_000 })) return;

  // ── Authentification ────────────────────────────────────────────────────────
  // Secret UNIQUEMENT dans les variables d'env serveur — jamais NEXT_PUBLIC_
  const expectedSecret = process.env.REVALIDATE_SECRET;
  if (!expectedSecret) {
    console.error("[/api/revalidate] REVALIDATE_SECRET non défini");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // Le secret en query string finit dans les journaux d'accès : toléré hors production
  // uniquement (tests curl). En production, seul l'en-tête est accepté.
  const fromHeader = req.headers["x-revalidate-secret"];
  const fromQuery = process.env.NODE_ENV === "production" ? undefined : req.query.secret;
  const providedSecret = typeof fromHeader === "string" ? fromHeader : typeof fromQuery === "string" ? fromQuery : "";

  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Sélection des caches à invalider ────────────────────────────────────────
  const raw = (req.query.caches as string) ?? "all";
  const requested: CacheName[] = raw === "all"
    ? [...VALID_CACHES]
    : (raw.split(",").filter((c) => VALID_CACHES.includes(c as CacheName)) as CacheName[]);

  if (requested.length === 0) {
    return res.status(400).json({ error: "Aucun cache valide spécifié", valid: VALID_CACHES });
  }

  // ── Réinitialisation ─────────────────────────────────────────────────────────
  const invalidated: CacheName[] = [];

  if (requested.includes("members")) {
    resetMembers();
    invalidated.push("members");
  }
  if (requested.includes("insects")) {
    resetInsects();
    invalidated.push("insects");
  }
  if (requested.includes("collections")) {
    resetCollections();
    invalidated.push("collections");

    // ISR on-demand : régénère les pages galerie statiques sur Vercel
    // (propagation garantie cross-instances, contrairement aux caches module-level)
    try {
      await Promise.all([
        res.revalidate("/galerie/art"),
        res.revalidate("/galerie/poesie"),
      ]);
      console.log("[/api/revalidate] ISR déclenché : /galerie/art, /galerie/poesie");
    } catch (isrErr) {
      // Non bloquant — les pages se régénèrent naturellement via revalidate:3600
      console.warn("[/api/revalidate] ISR warning:", isrErr);
    }
  }

  // Invalidation du cache metadata d'un token d'adhésion après évolution
  // Usage : POST /api/revalidate?caches=adhesion-evolution&tokenId=123
  const tokenId = typeof req.query.tokenId === "string" ? req.query.tokenId : undefined;
  if (tokenId && req.query.caches === "adhesion-evolution") {
    if (!/^\d{1,18}$/.test(tokenId)) return res.status(400).json({ error: "tokenId invalide" });
    evictAdhesionMetadata(tokenId);
    console.log(`[/api/revalidate] Cache metadata adhesion invalidé pour token ${tokenId}`);
  }

  console.log(`[/api/revalidate] Caches réinitialisés :`, invalidated);

  return res.status(200).json({
    revalidated: true,
    invalidated,
    timestamp: new Date().toISOString(),
    note: "Instance courante + ISR galerie propagé sur Vercel.",
  });
}
