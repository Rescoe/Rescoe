/**
 * POST /api/admin/deploy/contracts/deploy
 * Déploie un contrat via le script Hardhat universel.
 * ADMIN LOCAL UNIQUEMENT.
 *
 * Body: { name: string, args: string[], mode: 'hardhat' | 'baseSepolia' | 'base' }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

// Réseau mappé selon le mode
const NETWORK_MAP: Record<string, string> = {
  hardhat: "localhost",
  baseSepolia: "baseSepolia",
  base: "base",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  if (process.env.VERCEL) {
    return res.status(503).json({ error: "Disponible uniquement en local" });
  }

  const { name, args = [], mode = "baseSepolia" } = req.body ?? {};

  if (!name) {
    return res.status(400).json({ error: "Paramètre name requis" });
  }

  const network = NETWORK_MAP[mode] ?? "baseSepolia";

  // Écrire les args pour le script
  const argsJsonPath = path.join(HARDHAT_DIR, "temp-deploy-args.json");
  fs.writeFileSync(
    argsJsonPath,
    JSON.stringify({ contractName: name, args })
  );

  try {
    const { stdout } = await execAsync(
      `cd /d "${HARDHAT_DIR}" && npx hardhat run scripts/deploy-universal.js --network ${network}`,
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    );

    // Extraire le JSON de la sortie (ignore les lignes dotenv/console)
    const jsonMatch = stdout.match(
      /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*?"success":\s*(?:true|false)[^{}]*\}/
    );

    if (!jsonMatch) {
      throw new Error(`Réponse inattendue du script :\n${stdout.slice(-500)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.success) {
      throw new Error(parsed.error || "Déploiement échoué");
    }

    // Nettoyer le fichier temp
    try {
      fs.unlinkSync(argsJsonPath);
    } catch {
      // non bloquant
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    // Nettoyer même en cas d'erreur
    try {
      fs.unlinkSync(argsJsonPath);
    } catch {
      // non bloquant
    }
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
}

// Augmenter la limite de body (contrats peuvent être volumineux)
export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
};
