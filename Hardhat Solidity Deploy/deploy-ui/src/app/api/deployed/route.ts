import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DEPLOYED_PATH = path.join(process.cwd(), 'deployed.json');

async function loadDeployed() {
  try {
    const data = await readFile(DEPLOYED_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { contracts: [] };
  }
}

async function saveDeployed(data: any) {
  await writeFile(DEPLOYED_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
  const deployed = await loadDeployed();
  return NextResponse.json(deployed);
}

export async function POST(req: NextRequest) {
  const { contract } = await req.json();
  const deployed = await loadDeployed();
  
  // 🔥 AJOUTE TOUJOURS avec UUID unique
  const newContract = { 
    ...contract, 
    id: crypto.randomUUID(),  // 🔥 UUID unique même si même name
    timestamp: new Date().toISOString() 
  };
  
  deployed.contracts.push(newContract);
  await saveDeployed(deployed);
  
  console.log(`💾 AJOUTÉ ${newContract.name} (${newContract.address.slice(0,10)}…). Total: ${deployed.contracts.length}`);
  return NextResponse.json({ success: true, id: newContract.id });
}


export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const deployed = await loadDeployed();
  deployed.contracts = deployed.contracts.filter((c: any) => c.id !== id);
  await saveDeployed(deployed);
  return NextResponse.json({ success: true });
}
