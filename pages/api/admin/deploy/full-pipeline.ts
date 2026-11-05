/**
 * POST /api/admin/deploy/full-pipeline
 * Lance la pipeline complète Rescoe via le relayer Hardhat.
 *
 * Le relayer (RELAYER_PK dans HardhatRescoe/.env) :
 *   1. Déploie les 7 contrats
 *   2. Câble les adresses post-déploiement
 *   3. Transfère la propriété à ownerAddress
 *
 * ADMIN LOCAL UNIQUEMENT — retourne 503 sur Vercel.
 *
 * Body: {
 *   ownerAddress: string   // wallet de l'association (owner final)
 *   artistAddress: string  // wallet de l'artiste
 *   network: 'hardhat' | 'baseSepolia' | 'base'
 * }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { guardDeployStudio, isMainnetAllowed } from "@/server/security/deployStudioGuard";
import { requireJsonBody, requireMethod, sendError } from "@/server/security/guards";
import { isEvmAddress } from "@/server/security/validators";
import { release, tryAcquire } from "@/server/security/inflight";
import { logServerError } from "@/server/security/redact";
import { isStudioNetwork, NETWORK_MAP, runHardhat, sanitizeOutput } from "@/server/deployStudio/hardhat";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!requireMethod(req, res, ["POST"])) return;
  const HARDHAT_DIR = guardDeployStudio(req, res);
  if (!HARDHAT_DIR) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const { ownerAddress, artistAddress, network = "baseSepolia" } = body;

  // Validation stricte (checksum inclus si adresse en casse mixte)
  if (!isEvmAddress(ownerAddress) || !isEvmAddress(artistAddress)) {
    return sendError(res, 400, "invalid_address", "ownerAddress et artistAddress doivent être des adresses Ethereum valides.");
  }
  if (!isStudioNetwork(network)) return sendError(res, 400, "invalid_network", "Réseau inconnu.");
  if (network === "base" && !isMainnetAllowed()) {
    return sendError(res, 403, "mainnet_disabled", "Déploiement mainnet désactivé (ENABLE_DEPLOY_STUDIO_MAINNET=true requis).");
  }

  const hardhatNetwork = NETWORK_MAP[network];
  const configPath = path.join(HARDHAT_DIR, "pipeline-config.json");
  const resultPath = path.join(HARDHAT_DIR, "pipeline-result.json");

  if (!tryAcquire("deploy-studio:pipeline")) return sendError(res, 409, "in_progress", "Une pipeline est déjà en cours.");

  try {
    // Écrire la config pour le script
    fs.writeFileSync(
      configPath,
      JSON.stringify({ ownerAddress, artistAddress }, null, 2)
    );

    // Supprimer l'ancien résultat pour éviter de lire un résidu
    try {
      fs.unlinkSync(resultPath);
    } catch {
      // pas de fichier précédent — ok
    }

    const { stdout, stderr } = await runHardhat(
      HARDHAT_DIR,
      ["run", "scripts/full-pipeline.js", "--network", hardhatNetwork],
      { timeout: 600_000, maxBuffer: 20 * 1024 * 1024 } // 10 min max
    );

    // Lire le résultat depuis le fichier JSON (plus fiable que parser stdout)
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    } catch {
      // Fallback : extraire la ligne PIPELINE_RESULT_JSON du stdout
      const match = stdout.match(/PIPELINE_RESULT_JSON:(.+)/);
      if (match) {
        result = JSON.parse(match[1]);
      } else {
        const debugOutput = sanitizeOutput((stderr || stdout).slice(-2000));
        throw new Error(
          `Résultat introuvable dans pipeline-result.json.\n${debugOutput}`
        );
      }
    }

    if (!result.success) {
      throw new Error(String(result.error ?? "Pipeline échouée (raison inconnue)"));
    }

    // ── Enregistrer tous les contrats dans deployed.json ──────────────────
    const deployedPath = path.join(HARDHAT_DIR, "deployed.json");
    let deployed: { contracts: Record<string, unknown>[] } = { contracts: [] };
    try {
      deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
      if (!Array.isArray(deployed.contracts)) deployed.contracts = [];
    } catch {
      deployed = { contracts: [] };
    }

    const contracts = result.contracts as Record<string, string>;
    const timestamp = new Date().toISOString();
    for (const [name, address] of Object.entries(contracts)) {
      deployed.contracts.push({
        id: `${Date.now()}-${name}`,
        name,
        address,
        network,
        timestamp,
      });
    }
    fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));

    return res.status(200).json({
      ...result,
      stdout: sanitizeOutput(stdout.slice(-3000)), // debug partiel inclus, secrets masqués
    });
  } catch (err: unknown) {
    logServerError("deploy-studio/pipeline", err);
    return res.status(500).json({ success: false, error: "pipeline_failed" });
  } finally {
    release("deploy-studio:pipeline");
    // Toujours nettoyer la config (contient les adresses)
    try {
      fs.unlinkSync(configPath);
    } catch {
      // non bloquant
    }
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "512kb" } },
};
