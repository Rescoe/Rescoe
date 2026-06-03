// /api/contracts/compile-hardhat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
// ✅ CHEMIN EXACT depuis ton erreur
const hardhatDir = 'C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe';

export async function POST(req: NextRequest) {
  try {
    const { mode, name, content } = await req.json();

    console.log('Hardhat dir:', hardhatDir);
    console.log('Mode:', mode, 'Contract:', name);

    // Vérifie dossier existe
    try {
      await fs.access(hardhatDir);
    } catch {
      return NextResponse.json({ 
        error: `Hardhat dir introuvable: ${hardhatDir}`,
        fix: 'Vérifie C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe existe'
      }, { status: 500 });
    }

    if (mode === 'global') {
      await execAsync(`cd /d "${hardhatDir}" && npx hardhat clean`);
      const { stdout, stderr } = await execAsync(`cd /d "${hardhatDir}" && npx hardhat compile`, { timeout: 120000 });
      
      return NextResponse.json({
        success: stdout.includes('Compiled') || !stderr,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        compiledContracts: 'Vérifie artifacts/contracts/'
      });
    }

    // SINGLE contrat (ContractEditor)
    if (content && name) {
      const contractsDir = path.join(hardhatDir, 'contracts');
      await fs.mkdir(contractsDir, { recursive: true });
      await fs.writeFile(path.join(contractsDir, `${name}.sol`), content);
    }

    await execAsync(`cd /d "${hardhatDir}" && npx hardhat clean`);
    const { stdout, stderr } = await execAsync(`cd /d "${hardhatDir}" && npx hardhat compile`, { timeout: 120000 });

    return NextResponse.json({
      success: stdout.includes('Compiled') || !stderr,
      stdout: stdout.toString(),
      stderr: stderr.toString()
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || ''
    }, { status: 500 });
  }
}
