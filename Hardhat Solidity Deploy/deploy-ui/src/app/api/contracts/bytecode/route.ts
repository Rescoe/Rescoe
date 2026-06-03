// api/contracts/bytecode/route.ts (NOUVEAU - 20 lignes)
import { NextRequest, NextResponse } from 'next/server';
import { loadArtifact } from '../../../../../lib/loadArtifact';  // Ton helper existant !

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contractName = searchParams.get('name');
    
    if (!contractName) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    // 🔥 REUTILISE ton loadArtifact existant
    const artifact = await loadArtifact(contractName);
    
    return NextResponse.json({
      bytecode: artifact.bytecode,  // ✅ Le bytecode compilé
      abi: artifact.abi            // Bonus
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
