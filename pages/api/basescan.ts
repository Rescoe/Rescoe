/**
 * GET /api/basescan?address=0x… — transactions internes d'une adresse (Basescan).
 * Route publique de lecture : adresse validée (pas d'injection de paramètres), limite par IP.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireMethod, sendError } from "@/server/security/guards";
import { isEvmAddress } from "@/server/security/validators";
import { logServerError } from "@/server/security/redact";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET"])) return;
  if (!enforceRateLimit(req, res, "basescan", { limit: 60, windowMs: 60_000 })) return;

  const { address } = req.query;
  if (!isEvmAddress(address)) return sendError(res, 400, "invalid_address", "Adresse invalide");

  try {
    const url = new URL("https://api.basescan.org/api");
    url.search = new URLSearchParams({
      module: "account",
      action: "txlistinternal",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "100",
      sort: "desc",
      apikey: process.env.BASESCAN_API_KEY || "YourFreeKey",
    }).toString();

    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Basescan ${response.status}`);
    return res.json(await response.json());
  } catch (error) {
    logServerError("basescan", error);
    return sendError(res, 502, "upstream_error", "Erreur lors de la requête Basescan.");
  }
}
