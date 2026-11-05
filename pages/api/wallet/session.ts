/**
 * POST /api/wallet/session
 * Échange une signature de wallet (message "connexion sécurisée", voir walletSession.ts)
 * contre un jeton de session court (30 min) à présenter en `Authorization: Bearer`.
 *
 * Body : { message: string, signature: string }
 * Réponse : { token, address, expiresAt }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, sendError } from "@/server/security/guards";
import { getSessionSecret, issueSessionToken, verifyLogin } from "@/server/security/walletSession";

export const config = { api: { bodyParser: { sizeLimit: "4kb" } } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "wallet-session", { limit: 20, windowMs: 10 * 60_000 })) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const secret = getSessionSecret();
  if (!secret) {
    console.error("[wallet-session] WALLET_SESSION_SECRET absent ou trop court (>= 32 caractères requis)");
    return sendError(res, 503, "auth_not_configured", "Service temporairement indisponible.");
  }

  const result = verifyLogin({ message: body.message, signature: body.signature, host: req.headers.host });
  if (!result.ok) return sendError(res, 401, result.error);

  const { token, expiresAt } = issueSessionToken(result.address, secret);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ token, address: result.address, expiresAt });
}
