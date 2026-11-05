/**
 * GET /api/admin/deploy/contracts/abi?name=AdhesionRescoe
 * Retourne l'ABI et les hints du constructeur d'un contrat compilé.
 * ADMIN LOCAL UNIQUEMENT.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";
import path from "path";
import { guardDeployStudio } from "@/server/security/deployStudioGuard";
import { requireMethod, sendError } from "@/server/security/guards";
import { isContractName } from "@/server/security/validators";
import { logServerError } from "@/server/security/redact";

async function loadArtifact(HARDHAT_DIR: string, contractName: string) {
  const contractsDir = path.join(HARDHAT_DIR, "artifacts", "contracts");

  // Cherche artifacts/contracts/<Name>.sol/<Name>.json
  let artifactPath = path.join(
    contractsDir,
    `${contractName}.sol`,
    `${contractName}.json`
  );

  try {
    await fs.access(artifactPath);
  } catch {
    // Fallback : cherche dans tous les sous-dossiers .sol
    const entries = await fs.readdir(contractsDir, { withFileTypes: true });
    const solDirs = entries
      .filter((f) => f.isDirectory() && f.name.endsWith(".sol"))
      .map((f) => f.name.replace(".sol", ""));

    const match = solDirs.find((d) =>
      d.toLowerCase().includes(contractName.toLowerCase())
    );
    if (!match) {
      throw new Error(
        `Artifact introuvable pour "${contractName}". Le contrat est-il compilé ?`
      );
    }
    artifactPath = path.join(
      contractsDir,
      `${match}.sol`,
      `${contractName}.json`
    );
    await fs.access(artifactPath);
  }

  const raw = await fs.readFile(artifactPath, "utf8");
  return JSON.parse(raw);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!requireMethod(req, res, ["GET"])) return;
  const HARDHAT_DIR = guardDeployStudio(req, res);
  if (!HARDHAT_DIR) return;

  // Identifiant simple uniquement : empêche "../" dans les chemins d'artifacts.
  const { name } = req.query;
  if (!isContractName(name)) return sendError(res, 400, "invalid_name", "Paramètre ?name= invalide");

  try {
    const artifact = await loadArtifact(HARDHAT_DIR, name);
    const abi: any[] = artifact.abi ?? [];
    const bytecode: string = artifact.bytecode ?? "";

    const constructor = abi.find((i) => i.type === "constructor");
    const inputs = constructor?.inputs ?? [];

    // ─── Hints descriptifs par nom d'argument connu ──────────────────────────
    // Évite d'afficher "0x..." sans contexte dans l'UI Deploy Studio.
    const KNOWN_ARG_HINTS: Record<string, string> = {
      // Ownable — owner = vault de l'association (admin), PAS le RELAYER_PK
      initialOwner:      "0x... [initialOwner] vault de l'association (owner admin — PAS le RELAYER_PK). Le RELAYER_PK est configuré séparément via setUploader().",
      // AdhesionRescoe
      _artist:           "0x... [_artist] artiste, bénéficiaire 1.99% royalties NFT (address(0) = asso reçoit tout)",
      _insectStorage:    "0x... [_insectStorage] adresse InsectImageStorageV2/V3 (0x000...000 = à câbler après via setInsectStorage)",
      // Factories
      _adhesionContract: "0x... [_adhesionContract] adresse AdhesionRescoe",
      adhesionContract:  "0x... [adhesionContract] adresse AdhesionRescoe",
      _adhesion:         "0x... [_adhesion] adresse AdhesionRescoe",
      _association:      "0x... [_association] wallet bénéficiaire royalties (owner asso — PAS ResCoellectionManager)",
      // MasterFactory
      _artFactory:       "0x... [_artFactory] adresse ArtFactory",
      _poetryFactory:    "0x... [_poetryFactory] adresse PoetryFactory",
      _messageFactory:   "0x... [_messageFactory] adresse MessageFactory",
      // ResCoellectionManager
      factory_address:   "0x... [factory_address] adresse MasterFactory",
      _masterFactory:    "0x... [_masterFactory] adresse MasterFactory",
      // TokenManagement
      _adhesionContractAddr: "0x... [_adhesionContractAddr] adresse AdhesionRescoe",
    };

    return res.status(200).json({
      contractName: name,
      abi,
      bytecode,
      expectedArgsCount: inputs.length,
      constructorSignature: inputs
        .map((i: any) => `${i.type} ${i.name || "arg"}`)
        .join(", "),
      argHints: inputs.map((i: any, idx: number) => {
        // Cherche un hint connu par nom exact, sinon hint générique par type
        const knownHint = KNOWN_ARG_HINTS[i.name];
        const genericHint = i.type?.includes("address")
          ? `0x... [${i.name || `arg${idx}`}]`
          : i.type?.includes("uint")
          ? "0"
          : "";
        return {
          type: i.type,
          name: i.name || `arg${idx}`,
          hint: knownHint ?? genericHint,
        };
      }),
    });
  } catch (err) {
    logServerError("deploy-studio/abi", err);
    return sendError(res, 404, "artifact_not_found", "Artifact introuvable. Le contrat est-il compilé ?");
  }
}
