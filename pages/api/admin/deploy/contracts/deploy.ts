/**
 * POST /api/admin/deploy/contracts/deploy
 * Déploie un contrat via le script Hardhat universel (scripts/deploy-universal.js).
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio. Le réseau "base" (mainnet)
 * exige en plus ENABLE_DEPLOY_STUDIO_MAINNET=true.
 *
 * Body: { name: string, args: (string|number|boolean|array)[], mode: 'hardhat' | 'baseSepolia' | 'base' }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import { guardDeployStudio, isMainnetAllowed } from "@/server/security/deployStudioGuard";
import { requireJsonBody, requireMethod, sendError } from "@/server/security/guards";
import { isContractName, parseDeployArgs } from "@/server/security/validators";
import { release, tryAcquire } from "@/server/security/inflight";
import { logServerError } from "@/server/security/redact";
import { isStudioNetwork, NETWORK_MAP, resolveInside, runHardhat } from "@/server/deployStudio/hardhat";

// Augmenter la limite de body (contrats peuvent être volumineux)
export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  const hardhatDir = guardDeployStudio(req, res);
  if (!hardhatDir) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const { name, args = [], mode = "baseSepolia" } = body;
  if (!isContractName(name)) return sendError(res, 400, "invalid_name", "Nom de contrat invalide.");
  const parsedArgs = parseDeployArgs(args);
  if (!parsedArgs) return sendError(res, 400, "invalid_args", "Arguments de constructeur invalides.");
  if (!isStudioNetwork(mode)) return sendError(res, 400, "invalid_network", "Réseau inconnu.");
  if (mode === "base" && !isMainnetAllowed()) {
    return sendError(res, 403, "mainnet_disabled", "Déploiement mainnet désactivé (ENABLE_DEPLOY_STUDIO_MAINNET=true requis).");
  }

  const argsJsonPath = resolveInside(hardhatDir, "temp-deploy-args.json");
  if (!argsJsonPath) return sendError(res, 500, "invalid_path");

  if (!tryAcquire("deploy-studio:deploy")) return sendError(res, 409, "in_progress", "Un déploiement est déjà en cours.");

  try {
    // Arguments transmis au script via un fichier (pas via la ligne de commande).
    fs.writeFileSync(argsJsonPath, JSON.stringify({ contractName: name, args: parsedArgs }));

    const { stdout } = await runHardhat(
      hardhatDir,
      ["run", "scripts/deploy-universal.js", "--network", NETWORK_MAP[mode]],
      { timeout: 180_000 }
    );

    // Extraire le JSON de la sortie (ignore les lignes dotenv/console)
    const jsonMatch = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*?"success":\s*(?:true|false)[^{}]*\}/);
    if (!jsonMatch) throw new Error("Réponse inattendue du script de déploiement.");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.success) throw new Error(String(parsed.error || "Déploiement échoué"));

    return res.status(200).json(parsed);
  } catch (err) {
    logServerError("deploy-studio/deploy", err);
    return res.status(500).json({ success: false, error: "deploy_failed" });
  } finally {
    try {
      fs.unlinkSync(argsJsonPath);
    } catch {
      // non bloquant
    }
    release("deploy-studio:deploy");
  }
}
