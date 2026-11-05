/**
 * POST /api/admin/deploy/hardhat/start
 * Démarre un nœud Hardhat local sur localhost:8545.
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { spawn, ChildProcess } from "child_process";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod, sendError } from "@/server/security/guards";
import { logServerError, redactSecrets } from "@/server/security/redact";
import { IS_WINDOWS, minimalChildEnv, NPX, runHardhat } from "@/server/deployStudio/hardhat";
import { killHardhatProcess } from "@/server/deployStudio/hardhatProcess";

// Logs persistés dans globalThis pour la route /logs
if (!(globalThis as any).__hardhatLogs) {
  (globalThis as any).__hardhatLogs = [] as string[];
}
if (!(globalThis as any).__hardhatProcess) {
  (globalThis as any).__hardhatProcess = null as ChildProcess | null;
}

const MAX_LOG_LINES = 1000;
const pushLog = (line: string) => {
  const logs = (globalThis as any).__hardhatLogs as string[];
  logs.push(redactSecrets(line));
  if (logs.length > MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  const hardhatDir = guardDeployStudio(req, res);
  if (!hardhatDir) return;

  // Arrête le process existant (le nôtre uniquement)
  killHardhatProcess();
  (globalThis as any).__hardhatLogs = [];

  // Vérifier que Hardhat est disponible
  try {
    const { stdout } = await runHardhat(hardhatDir, ["--version"], { timeout: 30_000 });
    console.log("[Hardhat] Version:", stdout.trim());
  } catch (e) {
    logServerError("deploy-studio/hardhat-version", e);
    return sendError(res, 500, "hardhat_unavailable", "Hardhat introuvable (dossier ou installation).");
  }

  // Démarrer le nœud (arguments constants, environnement minimal)
  const proc = spawn(NPX, ["hardhat", "node"], {
    cwd: hardhatDir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    shell: IS_WINDOWS,
    windowsHide: false,
    env: minimalChildEnv(),
  });

  (globalThis as any).__hardhatProcess = proc;

  proc.on("spawn", () => pushLog(`[START] PID ${proc.pid}`));
  proc.on("error", (err) => {
    pushLog(`[ERROR] ${err.message}`);
    (globalThis as any).__hardhatProcess = null;
  });
  proc.on("exit", (code, signal) => {
    pushLog(`[EXIT] code=${code} signal=${signal}`);
    (globalThis as any).__hardhatProcess = null;
  });
  proc.stdout?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter((l) => l.trim()).forEach((l) => pushLog(`[OUT] ${l}`));
  });
  proc.stderr?.on("data", (data: Buffer) => {
    data.toString().split("\n").filter((l) => l.trim()).forEach((l) => pushLog(`[ERR] ${l}`));
  });

  proc.unref();

  return res.status(200).json({ status: "started", pid: proc.pid });
}
