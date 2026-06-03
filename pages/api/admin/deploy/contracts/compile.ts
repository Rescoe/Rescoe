/**
 * POST /api/admin/deploy/contracts/compile
 * Lance "npx hardhat compile" dans le projet HardhatRescoe.
 * ADMIN LOCAL UNIQUEMENT — utilise child_process.exec.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  if (process.env.VERCEL) {
    return res.status(503).json({ error: "Disponible uniquement en local" });
  }

  try {
    // Vérifier que le dossier existe
    await fs.access(HARDHAT_DIR);
  } catch {
    return res
      .status(500)
      .json({ error: `Dossier Hardhat introuvable : ${HARDHAT_DIR}` });
  }

  const { mode = "global", name, content } = req.body ?? {};

  try {
    // Si on fournit un contenu, on l'écrit avant de compiler
    if (content && name) {
      const contractsDir = path.join(HARDHAT_DIR, "contracts");
      await fs.mkdir(contractsDir, { recursive: true });
      await fs.writeFile(path.join(contractsDir, `${name}.sol`), content);
    }

    // Clean puis compile
    await execAsync(`cd /d "${HARDHAT_DIR}" && npx hardhat clean`, {
      timeout: 30_000,
    });

    const { stdout, stderr } = await execAsync(
      `cd /d "${HARDHAT_DIR}" && npx hardhat compile`,
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );

    const success = stdout.includes("Compiled") || !stderr;

    return res.status(200).json({
      success,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    });
  }
}
