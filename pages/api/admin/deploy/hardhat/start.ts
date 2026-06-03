/**
 * POST /api/admin/deploy/hardhat/start
 * Démarre un nœud Hardhat local sur localhost:8545.
 * ADMIN LOCAL UNIQUEMENT.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { spawn, ChildProcess } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

// Logs persistés dans globalThis pour la route /logs
if (!(globalThis as any).__hardhatLogs) {
  (globalThis as any).__hardhatLogs = [] as string[];
}
if (!(globalThis as any).__hardhatProcess) {
  (globalThis as any).__hardhatProcess = null as ChildProcess | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  if (process.env.VERCEL) {
    return res.status(503).json({ error: "Disponible uniquement en local" });
  }

  // Kill le process existant
  const existing = (globalThis as any).__hardhatProcess as ChildProcess | null;
  if (existing) {
    try {
      existing.kill("SIGTERM");
    } catch {
      // ignore
    }
  }

  (globalThis as any).__hardhatLogs = [];

  // Vérifier que Hardhat est disponible
  try {
    const { stdout } = await execAsync(
      `cd /d "${HARDHAT_DIR}" && npx hardhat --version`
    );
    console.log("[Hardhat] Version:", stdout.trim());
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "Hardhat introuvable", detail: e.message });
  }

  // Démarrer le nœud
  const proc = spawn("npx.cmd", ["hardhat", "node"], {
    cwd: HARDHAT_DIR,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: false,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  (globalThis as any).__hardhatProcess = proc;

  proc.on("spawn", () => {
    (globalThis as any).__hardhatLogs.push(`[START] PID ${proc.pid}`);
  });

  proc.on("error", (err) => {
    (globalThis as any).__hardhatLogs.push(`[ERROR] ${err.message}`);
    (globalThis as any).__hardhatProcess = null;
  });

  proc.on("exit", (code, signal) => {
    (globalThis as any).__hardhatLogs.push(`[EXIT] code=${code} signal=${signal}`);
    (globalThis as any).__hardhatProcess = null;
  });

  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l) => l.trim());
    lines.forEach((l) => (globalThis as any).__hardhatLogs.push(`[OUT] ${l}`));
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().split("\n").filter((l) => l.trim());
    lines.forEach((l) => (globalThis as any).__hardhatLogs.push(`[ERR] ${l}`));
  });

  proc.unref();

  return res.status(200).json({ status: "started", pid: proc.pid });
}
