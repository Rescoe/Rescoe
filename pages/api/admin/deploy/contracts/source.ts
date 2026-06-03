/**
 * GET /api/admin/deploy/contracts/source?name=ContractName
 * Retourne le fichier source Solidity d'un contrat Hardhat.
 * ADMIN LOCAL UNIQUEMENT — retourne 503 sur Vercel.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

/**
 * Recursively search for a .sol file by name within a directory.
 */
function findSolFile(dir: string, fileName: string): string | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      const found = findSolFile(fullPath, fileName);
      if (found) return found;
    } else if (entry === fileName) {
      return fullPath;
    }
  }

  return null;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  if (process.env.VERCEL) {
    return res
      .status(503)
      .json({ error: "Disponible uniquement en local (non disponible sur Vercel)" });
  }

  const { name } = req.query;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Paramètre ?name= requis" });
  }

  // Sanitize: no path traversal
  const safeName = path.basename(name.replace(/[^a-zA-Z0-9_]/g, ""));
  if (!safeName) {
    return res.status(400).json({ error: "Nom de contrat invalide" });
  }

  const contractsDir = path.join(HARDHAT_DIR, "contracts");
  const fileName = `${safeName}.sol`;

  const filePath = findSolFile(contractsDir, fileName);

  if (!filePath) {
    return res
      .status(404)
      .json({ error: `Fichier source "${fileName}" introuvable dans ${contractsDir}` });
  }

  let source: string;
  try {
    source = readFileSync(filePath, "utf8");
  } catch (err: unknown) {
    return res.status(500).json({ error: (err as Error).message });
  }

  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(source);
}
