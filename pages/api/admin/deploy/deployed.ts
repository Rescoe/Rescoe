/**
 * /api/admin/deploy/deployed — CRUD des contrats déployés
 * GET  → liste tous les contrats dans deployed.json
 * POST → ajoute un contrat { name, address, network }
 * DELETE → supprime par { id }
 *
 * Le fichier deployed.json est stocké dans HardhatRescoe/deployed.json
 * pour partager l'état entre deploy-ui et Rescoe admin.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const HARDHAT_DIR =
  process.env.HARDHAT_DIR ||
  "C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe";

const DEPLOYED_PATH = path.join(HARDHAT_DIR, "deployed.json");

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: string;
  timestamp: string;
}

function loadDeployed(): { contracts: DeployedContract[] } {
  if (!existsSync(DEPLOYED_PATH)) return { contracts: [] };
  try {
    return JSON.parse(readFileSync(DEPLOYED_PATH, "utf8"));
  } catch {
    return { contracts: [] };
  }
}

function saveDeployed(data: { contracts: DeployedContract[] }) {
  writeFileSync(DEPLOYED_PATH, JSON.stringify(data, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — liste
  if (req.method === "GET") {
    const deployed = loadDeployed();
    return res.status(200).json(deployed);
  }

  // POST — ajoute
  if (req.method === "POST") {
    const { contract } = req.body ?? {};
    if (!contract?.name || !contract?.address) {
      return res
        .status(400)
        .json({ error: "Champs requis : name, address" });
    }

    const deployed = loadDeployed();
    const newEntry: DeployedContract = {
      id: crypto.randomUUID(),
      name: contract.name,
      address: contract.address,
      network: contract.network ?? "unknown",
      timestamp: new Date().toISOString(),
    };
    deployed.contracts.push(newEntry);
    saveDeployed(deployed);

    return res.status(200).json({ success: true, id: newEntry.id });
  }

  // DELETE — supprime par id
  if (req.method === "DELETE") {
    const { id } = req.body ?? {};
    if (!id) return res.status(400).json({ error: "Champ id requis" });

    const deployed = loadDeployed();
    deployed.contracts = deployed.contracts.filter((c) => c.id !== id);
    saveDeployed(deployed);

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
