'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDualLogs } from '@/app/hooks/useGlobalLogs';

type Status = 'stopped' | 'starting' | 'running';

interface HardhatNodeManagerProps {
  onLog?: (msg: string, level?: string) => void;
}

export default function HardhatNodeManager({ onLog }: HardhatNodeManagerProps) {
  const [status, setStatus] = useState<Status>('stopped');
  const logsRef = useRef<HTMLDivElement | null>(null);
  const { logs, addLog } = useDualLogs('hardhat');

  const log = useCallback((msg: string, level: string = 'info') => {
    addLog(msg, { level });
    if (onLog) onLog(msg, level);
  }, [addLog, onLog]);

  // ----- START HARDHAT -----
  const startHardhat = useCallback(async () => {
    if (status === 'starting' || status === 'running') return;
    setStatus('starting');
    log('🚀 Démarrage Hardhat Node...');

    try {
      const res = await fetch('/api/hardhat/start', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'started' || data.status === 'already_running') {
        setStatus('running');
        log(data.status === 'started'
          ? '✅ Hardhat Node démarré'
          : 'ℹ️ Hardhat Node déjà en cours');
      }
    } catch (err: any) {
      setStatus('stopped');
      log(`❌ Erreur démarrage: ${err.message}`, 'error');
    }
  }, [status, log]);

  // ----- STOP HARDHAT -----
  const stopHardhat = useCallback(async () => {
    if (status !== 'running') return;
    log('🛑 Arrêt Hardhat Node...');
    try {
      await fetch('/api/hardhat/stop', { method: 'POST' });
      setStatus('stopped');
      log('✅ Hardhat Node arrêté', 'success');
    } catch (err: any) {
      log(`❌ Erreur arrêt: ${err.message}`, 'error');
    }
  }, [status, log]);

  // ----- POLLING STATUS -----
// HardhatNodeManager useEffect FINAL (Status + Logs LIVE)
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      // 🔥 STATUS RPC
      const statusRes = await fetch('/api/hardhat/status');
      const statusData = await statusRes.json();

      if (statusData.running && status !== 'running') {
        setStatus('running');
        log('🟢 Hardhat Node LIVE (RPC OK)', 'success');
      } else if (!statusData.running && status !== 'stopped') {
        setStatus('stopped');
        log('⚫ Hardhat Node OFF (RPC KO)', 'warn');
      }

      // 🔥 LOGS COMPLETS (20 dernières lignes)
      const logsRes = await fetch('/api/hardhat/logs');
      const { logs } = await logsRes.json();
      
      logs.slice(-10).forEach((line: string) => {  // 10 dernières
        const level = line.includes('[STDERR]') || line.includes('error') 
          ? 'error' 
          : line.includes('[EXIT]') 
          ? 'warn' 
          : 'info';
        log(line, level);
      });

    } catch (err) {
      log('🔌 API unreachable (status/logs)', 'warn');
    }
  }, 3000);  // 3s → Reactif

  return () => clearInterval(interval);
}, [log, status]);  // status pour trigger logs


  // ----- AUTO SCROLL LOGS -----
  useEffect(() => {
    if (logsRef.current && logs.length > 0) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-200">Hardhat Node</h2>
        <span className={`px-2 py-1 rounded-full text-xs font-mono ${
          status === 'running' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' :
          status === 'starting' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' :
          'bg-zinc-700/50 text-zinc-400 border border-zinc-700'
        }`}>
          {status === 'running' ? '🟢 LIVE' :
           status === 'starting' ? '⏳ STARTING' : '⚫ STOPPED'}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={startHardhat}
          disabled={status === 'running' || status === 'starting'}
          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold disabled:opacity-50"
        >
          ▶️ Start
        </button>
        <button
          onClick={stopHardhat}
          disabled={status !== 'running'}
          className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white font-bold disabled:opacity-50"
        >
          ⏹ Stop
        </button>
      </div>

      <div className="space-y-1 mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>📋 Logs Hardhat ({logs.length})</span>
          <button
            onClick={() => log('🗑️ Logs effacés', 'info')}
            className="px-2 py-0.5 bg-zinc-800/50 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors text-[10px]"
          >
            clear
          </button>
        </div>
        <div
          ref={logsRef}
          className="h-36 overflow-y-auto bg-gradient-to-b from-black/90 to-zinc-900/80 border border-zinc-800/50 backdrop-blur-sm rounded-xl p-3 font-mono text-xs max-h-36 shadow-inner"
        >
          {logs.length === 0 ? (
            <div className="italic text-zinc-500 text-center py-6">Aucun log pour le moment</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1.5 leading-tight group hover:bg-zinc-800/50 p-1 rounded transition-all">
                <span className={`font-mono text-[11px] font-semibold mr-1 ${
                  log.level === 'success' ? 'text-emerald-400' :
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-orange-400' :
                  'text-zinc-300'
                }`}>
                  {log.timestamp}
                </span>
                <span className="text-xs opacity-90">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
