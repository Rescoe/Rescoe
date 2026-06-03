// /lib/loadArtifact.ts
import fs from 'fs/promises';
import path from 'path';

const hardhatDir = 'C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe';

export async function loadArtifact(contractName: string) {
  // 🔥 FIX : cherche TOUS les .sol possibles
  const contractsDir = path.join(hardhatDir, 'artifacts/contracts');
  
  // 1. Essaie contracts/ContractName.sol/ContractName.json
  let artifactPath = path.join(contractsDir, `${contractName}.sol`, `${contractName}.json`);
  try {
    await fs.access(artifactPath);
  } catch {
    // 2. Cherche dans TOUS les sous-dossiers .sol
    const files = await fs.readdir(contractsDir, { withFileTypes: true });
    const solDirs = files
      .filter(f => f.isDirectory() && f.name.endsWith('.sol'))
      .map(f => f.name.replace('.sol', ''));

    const matchingDir = solDirs.find(dir => dir.toLowerCase().includes(contractName.toLowerCase()));
    if (matchingDir) {
      artifactPath = path.join(contractsDir, `${matchingDir}.sol`, `${contractName}.json`);
      await fs.access(artifactPath);
    } else {
      throw new Error(`Artifact introuvable pour ${contractName} dans ${contractsDir}`);
    }
  }

  const raw = await fs.readFile(artifactPath, 'utf8');
  const artifact: any = JSON.parse(raw);

  if (!Array.isArray(artifact.abi)) {
    throw new Error(`ABI absente (${contractName})`);
  }

  return artifact;
}
