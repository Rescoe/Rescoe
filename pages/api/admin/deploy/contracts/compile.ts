/**
 * POST /api/admin/deploy/contracts/compile
 * Lance "npx hardhat compile" dans le projet Hardhat (HARDHAT_DIR).
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio (opt-in ENABLE_DEPLOY_STUDIO=true).
 *
 * Body (optionnel) : { name: string, content: string } — écrit contracts/<name>.sol avant compilation.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireJsonBody, requireMethod, sendError } from "@/server/security/guards";
import { isContractName } from "@/server/security/validators";
import { release, tryAcquire } from "@/server/security/inflight";
import { logServerError } from "@/server/security/redact";
import { resolveInside, runHardhat, sanitizeOutput } from "@/server/deployStudio/hardhat";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const MAX_SOURCE_CHARS = 500_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  const hardhatDir = guardDeployStudio(req, res);
  if (!hardhatDir) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const { name, content } = body;
  const writesSource = name !== undefined || content !== undefined;
  if (writesSource && (!isContractName(name) || typeof content !== "string" || content.length > MAX_SOURCE_CHARS)) {
    return sendError(res, 400, "invalid_source", "name (identifiant simple) et content (<= 500 Ko) requis ensemble.");
  }

  try {
    await fs.access(hardhatDir);
  } catch {
    return sendError(res, 500, "hardhat_dir_missing", "Dossier Hardhat introuvable (vérifiez HARDHAT_DIR).");
  }

  if (!tryAcquire("deploy-studio:compile")) return sendError(res, 409, "in_progress", "Compilation déjà en cours.");

  try {
    if (writesSource) {
      const contractsDir = resolveInside(hardhatDir, "contracts");
      const target = contractsDir && resolveInside(contractsDir, `${name as string}.sol`);
      if (!contractsDir || !target) return sendError(res, 400, "invalid_source", "Chemin invalide.");
      await fs.mkdir(contractsDir, { recursive: true });
      await fs.writeFile(target, content as string);
    }

    await runHardhat(hardhatDir, ["clean"], { timeout: 30_000 });
    const { stdout, stderr } = await runHardhat(hardhatDir, ["compile"], { timeout: 120_000 });

    return res.status(200).json({
      success: stdout.includes("Compiled") || !stderr,
      stdout: sanitizeOutput(stdout),
      stderr: sanitizeOutput(stderr),
    });
  } catch (err: any) {
    logServerError("deploy-studio/compile", err);
    return res.status(500).json({
      success: false,
      error: "compile_failed",
      stdout: sanitizeOutput(err?.stdout?.toString() ?? ""),
      stderr: sanitizeOutput(err?.stderr?.toString() ?? ""),
    });
  } finally {
    release("deploy-studio:compile");
  }
}
