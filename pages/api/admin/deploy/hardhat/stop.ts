/**
 * POST /api/admin/deploy/hardhat/stop
 * Arrête le nœud Hardhat local démarré par le Deploy Studio (ce processus uniquement).
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod } from "@/server/security/guards";
import { killHardhatProcess } from "@/server/deployStudio/hardhatProcess";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!guardDeployStudio(req, res)) return;

  const stopped = killHardhatProcess();
  return res.status(200).json({ status: stopped ? "stopped" : "not_running" });
}
