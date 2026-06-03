/**
 * GET /api/admin/deploy/hardhat/logs
 * Retourne les dernières lignes de log du nœud Hardhat.
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const logs: string[] = (globalThis as any).__hardhatLogs ?? [];

  return res.status(200).json({
    logs: logs.slice(-50),
    total: logs.length,
  });
}
