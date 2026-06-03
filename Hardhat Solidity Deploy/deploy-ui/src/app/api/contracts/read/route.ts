import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Missing contract name' },
        { status: 400 }
      );
    }

    const contractsDir = path.join(
      process.cwd(),
      '..',
      'contracts'
    );

    const filePath = path.join(contractsDir, `${name}.sol`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error) {
    console.error('❌ read error:', error);
    return NextResponse.json(
      { error: 'Failed to read contract' },
      { status: 500 }
    );
  }
}
