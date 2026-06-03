// app/api/hardhat/logs/route.ts (LOGS LIVE)
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    logs: (globalThis as any).hardhatLogs?.slice(-50) || [],
    total: (globalThis as any).hardhatLogs?.length || 0
  });
}
