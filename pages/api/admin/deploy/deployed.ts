/**
 * /api/admin/deploy/deployed — CRUD des contrats déployés
 * GET  → liste tous les contrats dans deployed.json
 * POST → ajoute un contrat { contract: { name, address, network } }
 * DELETE → supprime par { id }
 *
 * Le fichier deployed.json est stocké dans <HARDHAT_DIR>/deployed.json
 * pour partager l'état entre deploy-ui et Rescoe admin.
 * ADMIN LOCAL UNIQUEMENT — protégé par guardDeployStudio.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireJsonBody, requireMethod, sendError } from "@/server/security/guards";
import { boundedString, isContractName, isEvmAddress, isPlainObject } from "@/server/security/validators";
import { isStudioNetwork } from "@/server/deployStudio/hardhat";

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: string;
  timestamp: string;
}

function loadDeployed(file: string): { contracts: DeployedContract[] } {
  if (!existsSync(file)) return { contracts: [] };
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { contracts: [] };
  }
}

function saveDeployed(file: string, data: { contracts: DeployedContract[] }) {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET", "POST", "DELETE"])) return;
  const hardhatDir = guardDeployStudio(req, res);
  if (!hardhatDir) return;

  const file = path.join(hardhatDir, "deployed.json");

  if (req.method === "GET") return res.status(200).json(loadDeployed(file));

  const body = requireJsonBody(req, res);
  if (!body) return;

  if (req.method === "POST") {
    const { contract } = body;
    if (!isPlainObject(contract) || !isContractName(contract.name) || !isEvmAddress(contract.address)) {
      return sendError(res, 400, "invalid_contract", "Champs requis : name (identifiant) et address (0x… valide).");
    }
    const network = contract.network === undefined ? "unknown" : contract.network;
    if (network !== "unknown" && !isStudioNetwork(network)) return sendError(res, 400, "invalid_network", "Réseau inconnu.");

    const deployed = loadDeployed(file);
    const entry: DeployedContract = {
      id: randomUUID(),
      name: contract.name,
      address: contract.address,
      network: network as string,
      timestamp: new Date().toISOString(),
    };
    deployed.contracts.push(entry);
    saveDeployed(file, deployed);
    return res.status(200).json({ success: true, id: entry.id });
  }

  // DELETE — supprime par id
  const id = boundedString(body.id, 100);
  if (!id) return sendError(res, 400, "invalid_id", "Champ id requis");
  const deployed = loadDeployed(file);
  deployed.contracts = deployed.contracts.filter((c) => c.id !== id);
  saveDeployed(file, deployed);
  return res.status(200).json({ success: true });
}
