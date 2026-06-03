import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // process.cwd() = HardhatRescoe/deploy-ui
    const contractsDir = path.join(
      process.cwd(),
      '..',
      'contracts'
    );

    console.log('📁 contractsDir =', contractsDir);

    if (!fs.existsSync(contractsDir)) {
      console.error('❌ contracts dir not found:', contractsDir);
      return NextResponse.json([], { status: 200 });
    }

    const contracts = fs
      .readdirSync(contractsDir)
      .filter(f => f.endsWith('.sol'))
      .map(f => f.replace('.sol', ''));

    return NextResponse.json(contracts);
  } catch (error) {
    console.error('❌ list contracts error:', error);
    return NextResponse.json(
      { error: 'Failed to list contracts' },
      { status: 500 }
    );
  }
}
