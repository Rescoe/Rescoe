import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const hardhatDir = 'C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe';

export async function POST(req: NextRequest) {
  try {
    const { name, args = [], mode = 'baseSepolia' } = await req.json();  // 🔥 mode reçu
    if (!name) throw new Error('Missing contractName');

    // 🔥 Network dynamique
    const network = mode === 'hardhat' ? 'localhost' : 'base';

    // Écrit args
    const argsJsonPath = path.join(hardhatDir, 'temp-deploy-args.json');
    fs.writeFileSync(argsJsonPath, JSON.stringify({ contractName: name, args }));

    // 🔥 Exécute avec network dynamique
    const { stdout } = await execAsync(
      `cd /d "${hardhatDir}" && npx hardhat run scripts/deploy-universal.js --network ${network}`,
      { timeout: 180000, maxBuffer: 10 * 1024 * 1024 }
    );

    // EXTRAIT JSON (ignore dotenv)
    const jsonMatch = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*?"success":\s*(?:true|false)[^{}]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON. Stdout:\n${stdout.slice(-500)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.success) {
      throw new Error(parsed.error || 'Deploy failed');
    }

    // Nettoie
    fs.unlinkSync(argsJsonPath);
    
    return NextResponse.json(parsed);
    
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
