/**
 * GET /api/admin/deploy/contracts/list
 * Liste les fichiers .sol disponibles dans le projet HardhatRescoe.
 * ADMIN LOCAL UNIQUEMENT — ne fonctionne pas sur Vercel (child_process).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod, sendError } from "@/server/security/guards";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET"])) return;
  const HARDHAT_DIR = guardDeployStudio(req, res);
  if (!HARDHAT_DIR) return;

  try {
    const contractsDir = path.join(HARDHAT_DIR, "contracts");

    if (!fs.existsSync(contractsDir)) {
      return sendError(res, 404, "contracts_dir_missing", "Dossier contracts introuvable (vérifiez HARDHAT_DIR).");
    }

    // Exclure les interfaces, les contrats enfants (spawned par factories) et les utilitaires
    const EXCLUDED = new Set([
      "ICollectionFactory",
      "IReward",
      "ArtNFT",
      "HaikuEditions",
      "MessageEditions",
      "SepoliaFaucet",
    ]);

    const contracts = fs
      .readdirSync(contractsDir)
      .filter(
        (f) => f.endsWith(".sol") && !EXCLUDED.has(f.replace(".sol", ""))
      )
      .map((f) => f.replace(".sol", ""));

    return res.status(200).json({ contracts });
  } catch {
    return sendError(res, 500, "list_failed");
  }
}
