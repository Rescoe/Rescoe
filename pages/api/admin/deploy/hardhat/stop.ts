/**
 * POST /api/admin/deploy/hardhat/stop
 * Arrête le nœud Hardhat local.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { ChildProcess } from "child_process";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (process.env.VERCEL) {
    return res.status(503).json({ error: "Disponible uniquement en local" });
  }

  // Tenter d'abord via le process référencé
  const proc = (globalThis as any).__hardhatProcess as ChildProcess | null;
  if (proc) {
    try {
      proc.kill("SIGTERM");
      (globalThis as any).__hardhatProcess = null;
    } catch {
      // fallback ci-dessous
    }
  }

  // Fallback Windows : tuer tous les node.exe (Hardhat node)
  exec("taskkill /F /FI \"WINDOWTITLE eq hardhat*\" /T", () => {});

  return res.status(200).json({ status: "stopped" });
}
