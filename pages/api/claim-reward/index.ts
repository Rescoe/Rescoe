/**
 * POST /api/claim-reward
 * Le relayer (RELAYER_PK) paie le gas de la distribution des points en attente.
 *
 * Sécurité : session wallet obligatoire, et l'adresse visée doit être celle de la
 * session (on ne peut déclencher une transaction relayer que pour SES propres points).
 * Body : { user: "0x…" }
 */
import { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import MANAGER_ABI from "@/components/ABI/ABI_Collections.json";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireSameAddress, requireWalletSession, sendError } from "@/server/security/guards";
import { isEvmAddress } from "@/server/security/validators";
import { release, tryAcquire } from "@/server/security/inflight";
import { logServerError } from "@/server/security/redact";

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "claim-reward", { limit: 10, windowMs: 60_000 })) return;

  const session = requireWalletSession(req, res);
  if (!session) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const user = body.user;
  if (!isEvmAddress(user)) return sendError(res, 400, "invalid_address", "Adresse invalide");
  if (!requireSameAddress(res, session, user)) return;
  if (!enforceRateLimit(req, res, "claim-reward-user", { limit: 3, windowMs: 60_000 }, user)) return;

  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;
  const PRIVATE_KEY = process.env.RELAYER_PK;
  const MANAGER_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

  if (!RPC_URL || !PRIVATE_KEY || !MANAGER_ADDRESS) {
    // On journalise QUELLES variables manquent (booléens), jamais leur valeur.
    console.error("[claim-reward] config manquante", {
      RPC_URL: !!RPC_URL,
      RELAYER_PK: !!PRIVATE_KEY,
      MANAGER_ADDRESS: !!MANAGER_ADDRESS,
    });
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  const lockKey = `claim-reward:${user.toLowerCase()}`;
  if (!tryAcquire(lockKey)) return sendError(res, 409, "in_progress", "Une distribution est déjà en cours.");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const manager = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, relayerWallet) as ethers.Contract & {
      getPendingPoints: (user: string) => Promise<bigint>;
      rewardRelayer: () => Promise<string>;
      distributeToAdhesion: (user: string, overrides?: any) => Promise<ethers.TransactionResponse>;
    };

    // 1. Vérif pending
    const pending = await manager.getPendingPoints(user);
    if (pending === 0n) return sendError(res, 400, "no_pending_points", "Aucun point pending");

    // 2. Vérif relayer autorisé
    const currentRelayer = await manager.rewardRelayer();
    if (currentRelayer.toLowerCase() !== (await relayerWallet.getAddress()).toLowerCase()) {
      return sendError(res, 403, "relayer_not_authorized", "Relayer non autorisé");
    }

    // 3. Execute
    const tx = await manager.distributeToAdhesion(user, { gasLimit: 300_000 });
    const receipt = await tx.wait();
    if (!receipt) throw new Error("Transaction receipt manquant");

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      points: pending.toString(),
      block: receipt.blockNumber,
      status: receipt.status,
    });
  } catch (err) {
    // Le message d'ethers peut contenir l'URL RPC (clé API) : jamais renvoyé au client.
    logServerError("claim-reward", err);
    return sendError(res, 500, "claim_failed", "La distribution a échoué.");
  } finally {
    release(lockKey);
  }
}
