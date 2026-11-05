/**
 * POST /api/claim — faucet de test : le relayer (RELAYER_PK) appelle faucet.claimTo(user).
 *
 * Sécurité : session wallet obligatoire (on ne réclame que pour SA propre adresse),
 * limite par IP, cooldown de 24 h par adresse après un claim réussi.
 * Body : { user: "0x…" }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import FAUCET_ABI from "@/components/ABI/Faucet.json";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireSameAddress, requireWalletSession, sendError } from "@/server/security/guards";
import { isEvmAddress } from "@/server/security/validators";
import { release, tryAcquire } from "@/server/security/inflight";
import { logServerError } from "@/server/security/redact";

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FAUCET_ADDRESS = "0xE14968f7ce8bE32ee79Aa37F82599fFADf55dDBa";

// Cooldown en mémoire (par instance) ; le contrat applique son propre cooldown on-chain.
const g = globalThis as unknown as { __rescoeFaucetLastClaim?: Map<string, number> };
const lastClaim: Map<string, number> = (g.__rescoeFaucetLastClaim ??= new Map());

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "claim", { limit: 5, windowMs: 60 * 60_000 })) return;

  const session = requireWalletSession(req, res);
  if (!session) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const user = body.user;
  if (!isEvmAddress(user)) return sendError(res, 400, "invalid_address", "Adresse invalide");
  if (!requireSameAddress(res, session, user)) return;

  const normalized = user.toLowerCase();
  const last = lastClaim.get(normalized);
  if (last && Date.now() - last < COOLDOWN_MS) {
    const remainingH = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 3_600_000);
    return sendError(res, 429, "cooldown", `Cooldown actif. Réessayez dans ${remainingH}h.`);
  }

  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;
  const PRIVATE_KEY = process.env.RELAYER_PK;
  if (!RPC_URL || !PRIVATE_KEY) {
    console.error("[claim] config manquante", { RPC_URL: !!RPC_URL, RELAYER_PK: !!PRIVATE_KEY });
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  const lockKey = `claim:${normalized}`;
  if (!tryAcquire(lockKey)) return sendError(res, 409, "in_progress", "Un claim est déjà en cours.");

  try {
    const wallet = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL));
    const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, wallet);

    const tx = await faucet.claimTo(user, { gasLimit: 200_000 });
    await tx.wait();

    lastClaim.set(normalized, Date.now());
    return res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    logServerError("claim", err);
    return sendError(res, 500, "claim_failed", "Le claim a échoué.");
  } finally {
    release(lockKey);
  }
}
