/**
 * POST /api/create-onramp-session — session Stripe Crypto Onramp vers Base (ETH).
 *
 * Sécurité : session wallet obligatoire et adresse de destination = adresse de la
 * session ; limite par IP ; l'IP transmise à Stripe est celle calculée côté serveur
 * (jamais un X-Forwarded-For fourni par le client).
 * Body : { walletAddress: "0x…" }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireSameAddress, requireWalletSession, sendError } from "@/server/security/guards";
import { getClientIp } from "@/server/security/clientIp";
import { isEvmAddress } from "@/server/security/validators";
import { logServerError } from "@/server/security/redact";

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "onramp", { limit: 5, windowMs: 10 * 60_000 })) return;

  const session = requireWalletSession(req, res);
  if (!session) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const walletAddress = body.walletAddress;
  if (!isEvmAddress(walletAddress)) return sendError(res, 400, "invalid_address", "Adresse invalide");
  if (!requireSameAddress(res, session, walletAddress)) return;

  const secretKey = process.env.STRIPE_PRIVATE;
  if (!secretKey) {
    console.error("[onramp] STRIPE_PRIVATE manquant");
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  try {
    const stripe = new Stripe(secretKey);
    const OnrampSessionResource = Stripe.StripeResource.extend({
      create: Stripe.StripeResource.method({ method: "POST", path: "crypto/onramp_sessions" }),
    });

    // API bêta non typée par le SDK.
    const onramp: any = await new OnrampSessionResource(stripe).create({
      transaction_details: {
        destination_currency: "eth",
        destination_exchange_amount: "0.01",
        destination_network: "base",
        supported_destination_networks: ["base"],
        wallet_address: walletAddress,
      },
      customer_ip_address: getClientIp(req),
    });

    return res.status(200).json({ clientSecret: onramp.client_secret });
  } catch (err) {
    logServerError("onramp", err);
    return sendError(res, 502, "onramp_failed", "Impossible de créer la session de paiement.");
  }
}
