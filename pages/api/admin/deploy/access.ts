/**
 * GET /api/admin/deploy/access
 * Indique à l'UI si le Deploy Studio est utilisable. Répond toujours 200 avec
 * `{ enabled, code?, message? }` : l'UI affiche un message clair au lieu d'une erreur.
 * N'effectue aucune action ; ne révèle que le motif du refus (jamais de chemin ni de secret).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { evaluateDeployStudioAccess, isMainnetAllowed } from "@/server/security/deployStudioGuard";
import { requireMethod } from "@/server/security/guards";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET"])) return;

  const decision = evaluateDeployStudioAccess(req);
  res.setHeader("Cache-Control", "no-store");
  if (!decision.allowed) {
    return res.status(200).json({ enabled: false, code: decision.code, message: decision.message });
  }
  return res.status(200).json({ enabled: true, mainnetAllowed: isMainnetAllowed() });
}
