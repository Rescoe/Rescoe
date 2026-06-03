import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  // Priorité: public/contrat (copie tes .sol)
  const publicDir = path.join(process.cwd(), 'public/contracts');
  let files: string[] = [];
  
  if (fs.existsSync(publicDir)) {
    files = fs.readdirSync(publicDir)
      .filter(f => f.endsWith('.sol'))
      .map(f => f.replace('.sol', ''));
  }
  
  // Fallback: hardhat-root/contrat
  const hardhatDir = path.join(process.cwd(), '../../contracts');
  if (fs.existsSync(hardhatDir) && files.length === 0) {
    files = fs.readdirSync(hardhatDir)
      .filter(f => f.endsWith('.sol'))
      .map(f => f.replace('.sol', ''));
  }
  
  return NextResponse.json(files);
}
