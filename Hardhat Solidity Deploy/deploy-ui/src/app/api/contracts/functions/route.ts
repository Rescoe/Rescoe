import { NextRequest, NextResponse } from 'next/server';
import { loadArtifact } from '../../../../../lib/loadArtifact';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contractName = searchParams.get('name');
    if (!contractName) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    const artifact = await loadArtifact(contractName);

    // 🔥 TOUT L'ABI du contrat (pour ethers.Contract)
    const fullAbi = artifact.abi;

    // Parse les fonctions avec leur ABI complet
    const functions = fullAbi
      .filter((item: any) => item.type === 'function')
      .map((fn: any) => ({
        name: fn.name,
        signature: `${fn.name}(${(fn.inputs ?? [])
          .map((i: any) => `${i.type}${i.name ? ` ${i.name}` : ''}`)
          .join(', ')})`,
        inputs: (fn.inputs ?? []).map((i: any, idx: number) => ({
          type: i.type,
          name: i.name || `arg${idx}`,
          hint: i.name || `Paramètre ${idx + 1}`  // 🔥 Bonus hint
        })),
        outputs: fn.outputs?.length 
          ? fn.outputs.map((o: any) => o.type).join(', ') 
          : 'void',
        stateMutability: fn.stateMutability || 'nonpayable',
        constant: ['view', 'pure'].includes(fn.stateMutability || ''),
        abi: [fn]  // 🔥 ABI COMPLET de cette fonction spécifique
      }));

    return NextResponse.json({
      contractName,
      functions,
      abi: fullAbi,  // 🔥 ABI COMPLET du contrat (pour ContractFunctions.tsx)
      count: functions.length
    });

  } catch (error: any) {
    console.error('API functions error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
