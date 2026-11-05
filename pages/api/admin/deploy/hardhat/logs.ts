/**
 * GET /api/admin/deploy/hardhat/logs
 * Retourne les dernières lignes de log du nœud Hardhat (déjà masquées côté écriture).
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod } from "@/server/security/guards";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET"])) return;
  if (!guardDeployStudio(req, res)) return;

  const logs: string[] = (globalThis as any).__hardhatLogs ?? [];

  return res.status(200).json({
    logs: logs.slice(-50),
    total: logs.length,
  });
}
