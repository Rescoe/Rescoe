// api/deploy-metamask/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, args = [] } = await req.json();
    if (!name) throw new Error('Missing contractName');

    // 🔥 Récupère bytecode depuis ton API existante
    const bytecodeRes = await fetch(
      `http://localhost:3000/api/contracts/bytecode?name=${encodeURIComponent(name)}`
    );
    
    if (!bytecodeRes.ok) throw new Error('Bytecode not found');
    const { bytecode } = await bytecodeRes.json();

    // 🔥 ABI depuis ton API existante
    const abiRes = await fetch(
      `http://localhost:3000/api/contracts/abi?name=${encodeURIComponent(name)}`
    );
    const { abi } = await abiRes.json();

    return NextResponse.json({
      success: true,
      bytecode,
      abi,
      // Adresse prédite (simplifiée)
      predictedAddress: '0x' + 'a'.repeat(40) // À calculer côté client
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
