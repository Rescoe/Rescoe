// /api/hardhat/start/route.ts (DEBUG + STABLE)
import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
const execAsync = promisify(require('child_process').exec);

let hardhatProcess: ChildProcess | null = null;
const hardhatLogs: string[] = [];

export async function POST(req: NextRequest) {
  // Clean
  if (hardhatProcess) hardhatProcess.kill('SIGTERM');

  const hardhatDir = 'C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe';
  hardhatLogs.length = 0;

  // 🔥 TEST PRE-SPAWN
  try {
    const { stdout } = await execAsync(`cd /d "${hardhatDir}" && npx hardhat --version`);
    console.log('Hardhat OK:', stdout.trim());
  } catch (e) {
    return NextResponse.json({ error: 'Hardhat introuvable', stdout: e.stdout }, { status: 500 });
  }

  // 🔥 SPAWN CMD DIRECT (stable Windows)
  hardhatProcess = spawn(
    'npx.cmd',  // 🔥 Windows npx
    ['hardhat', 'node'],
    {
      cwd: hardhatDir,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: false,  // Fenêtre debug
      env: { ...process.env, FORCE_COLOR: '1' }  // Couleurs
    }
  );

  // 🔥 EVENTS DEBUG
  hardhatProcess.on('spawn', () => console.log('👶 Spawné PID:', hardhatProcess?.pid));
  hardhatProcess.on('error', (err) => {
    console.error('💥 Spawn ERR:', err.message);
    hardhatProcess = null;
  });
  hardhatProcess.on('exit', (code, signal) => {
    console.log('☠️ Exit:', code, signal);
    hardhatProcess = null;
    hardhatLogs.push(`[EXIT ${code || signal}]`);
  });

  // 🔥 LOGS
  hardhatProcess.stdout?.on('data', data => {
    const line = data.toString().trim();
    if (line) {
      hardhatLogs.push(`[OUT] ${line}`);
      console.log('🟢', line);
    }
  });
  hardhatProcess.stderr?.on('data', data => {
    const line = data.toString().trim();
    if (line) {
      hardhatLogs.push(`[ERR] ${line}`);
      console.error('🔴', line);
    }
  });

  hardhatProcess.unref();
  
  return NextResponse.json({ 
    status: 'started', 
    pid: hardhatProcess.pid,
    logs: hardhatLogs
  });
}
