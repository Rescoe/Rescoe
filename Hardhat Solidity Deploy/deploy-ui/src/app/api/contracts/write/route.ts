import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, content } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Missing name or content' },
        { status: 400 }
      );
    }

    const contractsDir = path.join(
      process.cwd(),
      '..',
      'contracts'
    );

    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }

    const filePath = path.join(contractsDir, `${name}.sol`);

    fs.writeFileSync(filePath, content, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ write error:', error);
    return NextResponse.json(
      { error: 'Failed to write contract' },
      { status: 500 }
    );
  }
}
