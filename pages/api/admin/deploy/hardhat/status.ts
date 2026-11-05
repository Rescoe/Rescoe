/**
 * GET /api/admin/deploy/hardhat/status
 * Vérifie si le nœud Hardhat local répond sur localhost:8545.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod } from "@/server/security/guards";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!requireMethod(req, res, ["GET"])) return;
  if (!guardDeployStudio(req, res)) return;

  try {
    const response = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(3000),
    });

    const data = await response.json();
    return res.status(200).json({ running: !!data.result });
  } catch {
    return res.status(200).json({ running: false });
  }
}
