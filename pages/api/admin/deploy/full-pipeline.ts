/**
 * POST /api/admin/deploy/full-pipeline
 * Lance la pipeline complète Rescoe via le relayer Hardhat.
 *
 * Le relayer (RELAYER_PK dans HardhatRescoe/.env) :
 *   1. Déploie les 7 contrats
 *   2. Câble les adresses post-déploiement
 *   3. Transfère la propriété à ownerAddress
 *
 * ADMIN LOCAL UNIQUEMENT — retourne 503 sur Vercel.
 *
 * Body: {
 *   ownerAddress: string   // wallet de l'association (owner final)
 *   artistAddress: string  // wallet de l'artiste
 *   network: 'hardhat' | 'baseSepolia' | 'base'
 * }
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

const NETWORK_MAP: Record<string, string> = {
  hardhat: "localhost",
  baseSepolia: "baseSepolia",
  base: "base",
};

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  if (process.env.VERCEL) {
    return res.status(503).json({
      error:
        "La pipeline complète n'est disponible qu'en local (child_process requis).",
    });
  }

  const { ownerAddress, artistAddress, network = "baseSepolia" } = req.body ?? {};

  // Validation
  if (!ownerAddress || !artistAddress) {
    return res.status(400).json({
      error: "ownerAddress et artistAddress sont requis.",
    });
  }
  if (!ETH_ADDRESS_RE.test(ownerAddress) || !ETH_ADDRESS_RE.test(artistAddress)) {
    return res.status(400).json({
      error: "Adresses Ethereum invalides (format 0x + 40 hex).",
    });
  }

  const hardhatNetwork = NETWORK_MAP[network as string] ?? "baseSepolia";
  const configPath = path.join(HARDHAT_DIR, "pipeline-config.json");
  const resultPath = path.join(HARDHAT_DIR, "pipeline-result.json");

  // Écrire la config pour le script
  fs.writeFileSync(
    configPath,
    JSON.stringify({ ownerAddress, artistAddress }, null, 2)
  );

  // Supprimer l'ancien résultat pour éviter de lire un résidu
  try {
    fs.unlinkSync(resultPath);
  } catch {
    // pas de fichier précédent — ok
  }

  try {
    const { stdout, stderr } = await execAsync(
      `cd /d "${HARDHAT_DIR}" && npx hardhat run scripts/full-pipeline.js --network ${hardhatNetwork}`,
      { timeout: 600_000, maxBuffer: 20 * 1024 * 1024 } // 10 min max
    );

    // Lire le résultat depuis le fichier JSON (plus fiable que parser stdout)
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    } catch {
      // Fallback : extraire la ligne PIPELINE_RESULT_JSON du stdout
      const match = stdout.match(/PIPELINE_RESULT_JSON:(.+)/);
      if (match) {
        result = JSON.parse(match[1]);
      } else {
        const debugOutput = (stderr || stdout).slice(-2000);
        throw new Error(
          `Résultat introuvable dans pipeline-result.json.\n${debugOutput}`
        );
      }
    }

    if (!result.success) {
      throw new Error(String(result.error ?? "Pipeline échouée (raison inconnue)"));
    }

    // ── Enregistrer tous les contrats dans deployed.json ──────────────────
    const deployedPath = path.join(HARDHAT_DIR, "deployed.json");
    let deployed: { contracts: Record<string, unknown>[] } = { contracts: [] };
    try {
      deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
      if (!Array.isArray(deployed.contracts)) deployed.contracts = [];
    } catch {
      deployed = { contracts: [] };
    }

    const contracts = result.contracts as Record<string, string>;
    const timestamp = new Date().toISOString();
    for (const [name, address] of Object.entries(contracts)) {
      deployed.contracts.push({
        id: `${Date.now()}-${name}`,
        name,
        address,
        network,
        timestamp,
      });
    }
    fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));

    return res.status(200).json({
      ...result,
      stdout: stdout.slice(-3000), // debug partiel inclus
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  } finally {
    // Toujours nettoyer la config (contient les adresses)
    try {
      fs.unlinkSync(configPath);
    } catch {
      // non bloquant
    }
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "512kb" } },
};
