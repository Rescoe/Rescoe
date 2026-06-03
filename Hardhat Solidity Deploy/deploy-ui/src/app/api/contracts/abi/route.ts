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

    const constructor = artifact.abi.find((i: any) => i.type === 'constructor');
    const inputs = constructor?.inputs ?? [];

    return NextResponse.json({
      contractName,
      expectedArgsCount: inputs.length,
      constructorSignature: inputs.map((i: any) =>
        `${i.type} ${i.name || 'arg'}`
      ).join(', '),
      argHints: inputs.map((i: any, idx: number) => ({
        type: i.type,
        name: i.name || `arg${idx}`,
        hint:
          i.type?.includes('address') ? '0x...' :
          i.type?.includes('uint') ? '1' :
          i.type?.includes('string') ? '"text"' : ''
      }))
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
