/**
 * POST /api/token/invalidate-insect-cache
 *
 * Appelé par le client immédiatement après une évolution ou une éclosion réussie.
 * Purge le cache serveur module-level de /api/token/insects pour l'adresse concernée.
 *
 * Body : { address: string }
 * Réponse : { ok: true }
 *
 * Sans ce endpoint, le client voit son ancien insecte pendant 5 min (TTL serveur)
 * même après avoir dispatché RESCOE_DATA_CHANGED.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { evictInsectsCache } from "./insects";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { address } = req.body as { address?: string };
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: "address invalide" });
  }

  evictInsectsCache(address);
  return res.status(200).json({ ok: true });
}
