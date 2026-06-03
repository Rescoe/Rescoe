/**
 * GET /api/admin/deploy/contracts/list
 * Liste les fichiers .sol disponibles dans le projet HardhatRescoe.
 * ADMIN LOCAL UNIQUEMENT — ne fonctionne pas sur Vercel (child_process).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  // Guard : prod Vercel
  if (process.env.VERCEL) {
    return res.status(503).json({ error: "Disponible uniquement en local" });
  }

  try {
    const contractsDir = path.join(HARDHAT_DIR, "contracts");

    if (!fs.existsSync(contractsDir)) {
      return res.status(404).json({
        error: `Dossier contracts introuvable : ${contractsDir}`,
      });
    }

    // Exclure les interfaces, les contrats enfants (spawned par factories) et les utilitaires
    const EXCLUDED = new Set([
      "ICollectionFactory",
      "IReward",
      "ArtNFT",
      "HaikuEditions",
      "MessageEditions",
      "SepoliaFaucet",
    ]);

    const contracts = fs
      .readdirSync(contractsDir)
      .filter(
        (f) => f.endsWith(".sol") && !EXCLUDED.has(f.replace(".sol", ""))
      )
      .map((f) => f.replace(".sol", ""));

    return res.status(200).json({ contracts });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
