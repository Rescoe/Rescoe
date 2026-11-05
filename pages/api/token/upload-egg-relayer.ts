/**
 * POST /api/token/upload-egg-relayer
 *
 * Même flux qu'upload-insect-relayer, adapté aux œufs (OEUF1-OEUF9).
 * L'image GIF est lue depuis public/OEUFS/OEUF{n}.gif.
 * Les traits sont standard (œuf générique) — le lore est vide car il est
 * généré par-token directement dans AdhesionRescoe._tokenLore.
 *
 * Body : { eggIndex: number }  — entier 1-9
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import fs from "fs";
import path from "path";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireWalletSession, sendError } from "@/server/security/guards";
import { release, tryAcquire } from "@/server/security/inflight";
import { hostOf, logServerError } from "@/server/security/redact";

const STORAGE_ABI = [
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "hasInsectImage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "getChunkCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "insectKey", type: "string" },
      { internalType: "string", name: "chunk",     type: "string" },
    ],
    name: "appendInsectChunk",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "insectKey",     type: "string" },
      { internalType: "string", name: "attrsFragment", type: "string" },
      { internalType: "string", name: "lore",          type: "string" },
    ],
    name: "finalizeInsect",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const CHUNK_SIZE = 20_000;

function buildEggAttrsFragment(eggIndex: number): string {
  const parts: string[] = [];
  const push = (t: string, v: unknown) =>
    parts.push(`{"trait_type":${JSON.stringify(t)},"value":${JSON.stringify(v)}}`);

  push("Stade",      "Oeuf");
  push("Type",       "Oeuf RESCOE");
  push("Cornes",     0);
  push("Forme",      "Ovoïde");
  push("Corps",      "Ovoïde");
  push("Pattes",     0);
  push("Ailes",      0);
  push("Taille",     "Moyenne");
  push("Poils",      "Lisse");
  push("Carapace",   "Membraneuse");
  push("Motif",      "Unie");
  push("Yeux",       "Fermés");
  push("Antennes",   "Absentes");
  push("Filtre",     "Aucun");
  push("Legendaire", "Non");
  push("Famille",    "Oeuf");
  push("Sprite",     `OEUF${eggIndex}`);
  push("Insect name", `Oeuf ${eggIndex}`);
  push("TotalFamille", 9);

  return parts.join(",");
}

function buildRpcList(primary?: string): string[] {
  const candidates = [
    primary,
    "https://base.llamarpc.com",
    "https://1rpc.io/base",
    "https://mainnet.base.org",
  ].filter(Boolean) as string[];
  return candidates.filter((v, i, a) => a.indexOf(v) === i);
}

function isGasCapError(msg: string): boolean {
  return (
    msg.includes("exceeds max transaction gas limit") ||
    msg.includes("gas limit exceeded") ||
    msg.includes("max transaction gas")
  );
}

function isNetworkError(msg: string): boolean {
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("could not detect network") ||
    msg.includes("SERVER_ERROR") ||
    msg.includes("server response 5") ||
    msg.includes("error code: 5")
  );
}

async function sendWithFallback(
  rpcList:              string[],
  relayerPk:            string,
  storageAddress:       string,
  gasLimit:             bigint,
  txFn:                 (contract: Contract) => Promise<{ wait: () => Promise<{ hash: string }> }>,
  label:                string
): Promise<{ txHash: string; rpcUrl: string }> {
  const errors: string[] = [];

  for (const rpcUrl of rpcList) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet   = new Wallet(relayerPk, provider);
      const contract = new Contract(storageAddress, STORAGE_ABI, wallet);

      const tx      = await txFn(contract);
      const receipt = await tx.wait();

      console.log(`[upload-egg-relayer] ✅ ${label} → ${receipt.hash} (via ${hostOf(rpcUrl)})`);
      return { txHash: receipt.hash, rpcUrl };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg.includes("Already finalized") || msg.includes("Already uploaded")) {
        console.log(`[upload-egg-relayer] ℹ️  ${label} déjà présent`);
        return { txHash: "already", rpcUrl };
      }

      if (msg.includes("insufficient funds") || msg.includes("INSUFFICIENT_FUNDS")) {
        throw new Error(`INSUFFICIENT_FUNDS:${msg}`);
      }

      if (isGasCapError(msg)) {
        errors.push(`${hostOf(rpcUrl)}: gas cap`);
        continue;
      }
      if (isNetworkError(msg)) {
        errors.push(`${hostOf(rpcUrl)}: network`);
        continue;
      }

      logServerError(`upload-egg-relayer ${hostOf(rpcUrl)} [${label}]`, e);
      throw e;
    }
  }

  throw new Error(`GAS_CAP_ALL_RPCS:${errors.join("; ")}`);
}

export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "upload-egg", { limit: 30, windowMs: 10 * 60_000 })) return;

  // Le relayer paie le gas : réservé aux wallets connectés (session signée).
  const session = requireWalletSession(req, res);
  if (!session) return;
  if (!enforceRateLimit(req, res, "upload-egg-wallet", { limit: 15, windowMs: 10 * 60_000 }, session)) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const eggIndex = body.eggIndex;
  if (typeof eggIndex !== "number" || !Number.isInteger(eggIndex) || eggIndex < 1 || eggIndex > 9) {
    return sendError(res, 400, "invalid_egg_index", "eggIndex requis (entier 1-9)");
  }

  const insectKey = `OEUF${eggIndex}`;

  const insectStorageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE;
  const relayerPk            = process.env.RELAYER_PK;

  if (!insectStorageAddress || !relayerPk) {
    console.error("[upload-egg-relayer] config manquante", { storage: !!insectStorageAddress, RELAYER_PK: !!relayerPk });
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  const lockKey = `egg:${insectKey}`;
  if (!tryAcquire(lockKey)) return sendError(res, 409, "in_progress", "Upload déjà en cours pour cet œuf.");

  const primaryRpc = process.env.RELAYER_RPC_URL ?? "https://mainnet.base.org";
  const rpcList    = buildRpcList(primaryRpc);

  try {
    const primaryProvider = new JsonRpcProvider(primaryRpc);
    const primaryWallet   = new Wallet(relayerPk, primaryProvider);

    const balance     = await primaryProvider.getBalance(primaryWallet.address);
    const MIN_BALANCE = 500_000_000_000_000n;
    if (balance < MIN_BALANCE) {
      console.error(`[upload-egg-relayer] ❌ relayer à court de fonds : ${primaryWallet.address}`);
      return sendError(res, 503, "relayer_unfunded", "Service temporairement indisponible.");
    }

    const primaryContract = new Contract(insectStorageAddress, STORAGE_ABI, primaryWallet);
    const alreadyExists   = await primaryContract.hasInsectImage(insectKey) as boolean;
    if (alreadyExists) {
      return res.status(200).json({ status: "exists" });
    }

    const gifPath   = path.join(process.cwd(), "public", "OEUFS", `OEUF${eggIndex}.gif`);
    const gifBuffer = fs.readFileSync(gifPath);

    const imageDataUri = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    const totalBytes   = Buffer.byteLength(imageDataUri, "utf8");

    const attrsFragment = buildEggAttrsFragment(eggIndex);

    const chunks: string[] = [];
    for (let i = 0; i < imageDataUri.length; i += CHUNK_SIZE) {
      chunks.push(imageDataUri.slice(i, i + CHUNK_SIZE));
    }

    console.log(
      `[upload-egg-relayer] Uploading ${insectKey}` +
      ` GIF=${Math.round(gifBuffer.length / 1024)}KB` +
      ` dataUri=${Math.round(totalBytes / 1024)}KB` +
      ` chunks=${chunks.length}`
    );

    let startChunk = 0;
    try {
      const existingCount = Number(await primaryContract.getChunkCount(insectKey) as bigint);
      if (existingCount > 0 && existingCount < chunks.length) {
        startChunk = existingCount;
      }
    } catch (_) {}

    const txHashes: string[] = [];
    let   preferredRpc = primaryRpc;

    for (let i = startChunk; i < chunks.length; i++) {
      const chunk      = chunks[i];
      const chunkBytes = Buffer.byteLength(chunk, "utf8");
      const gasLimit   = BigInt(Math.min(Math.ceil(chunkBytes * 700 + 400_000), 18_000_000));

      const orderedRpcs = [preferredRpc, ...rpcList.filter((r) => r !== preferredRpc)];

      const result = await sendWithFallback(
        orderedRpcs, relayerPk, insectStorageAddress, gasLimit,
        (contract) => (contract.appendInsectChunk as any)(insectKey, chunk, { gasLimit }),
        `chunk ${i + 1}/${chunks.length}`
      );

      if (result.txHash !== "already") {
        txHashes.push(result.txHash);
        preferredRpc = result.rpcUrl;
      }
    }

    const finalizeGasLimit = 2_000_000n;
    const orderedRpcs = [preferredRpc, ...rpcList.filter((r) => r !== preferredRpc)];

    const finalizeResult = await sendWithFallback(
      orderedRpcs, relayerPk, insectStorageAddress, finalizeGasLimit,
      (contract) => (contract.finalizeInsect as any)(insectKey, attrsFragment, "", { gasLimit: finalizeGasLimit }),
      "finalizeInsect"
    );

    if (finalizeResult.txHash !== "already") txHashes.push(finalizeResult.txHash);

    console.log(`[upload-egg-relayer] ✅ ${insectKey} uploadé en ${txHashes.length} transactions`);

    return res.status(200).json({ status: "uploaded", txHashes, chunks: chunks.length });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Messages d'erreur (ethers/RPC) = URL RPC avec clé API possible : journalisés masqués,
    // jamais renvoyés au client (l'ancien champ `details` exposait la liste des RPC).
    logServerError("upload-egg-relayer", e);

    if (msg.startsWith("INSUFFICIENT_FUNDS:")) {
      return sendError(res, 503, "relayer_unfunded", "Service temporairement indisponible.");
    }
    if (msg.startsWith("GAS_CAP_ALL_RPCS:")) {
      // Piste ops (côté serveur uniquement) : définir RELAYER_RPC_URL vers un RPC dédié.
      return sendError(res, 503, "rpc_unavailable", "Réseau momentanément indisponible, réessayez plus tard.");
    }
    return sendError(res, 500, "upload_failed", "L'enregistrement on-chain a échoué.");
  } finally {
    release(lockKey);
  }
}
