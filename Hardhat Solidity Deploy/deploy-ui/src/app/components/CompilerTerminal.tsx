'use client';
import { useState, useRef, useCallback } from 'react';

interface CompilerTerminalProps {
  onCompile?: () => void;
  disabled?: boolean;
}

export default function CompilerTerminal({
  onCompile,
  disabled = false,
}: CompilerTerminalProps) {
  const [compileLogs, setCompileLogs] = useState('');
  const [compileSuccess, setCompileSuccess] = useState<boolean | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const handleCompileGlobal = useCallback(async () => {
    setCompileLogs('🔄 Lancement compilation globale Hardhat (32 contrats)...\n');
    setCompileSuccess(null);

    try {
      const res = await fetch('/api/contracts/compile-hardhat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'global' }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const result = await res.json();

      let logs = `📝 Compilation GLOBALE Hardhat\n`;
      logs += `─────────────────────────────\n`;

      if (result.success) {
        logs += `✅ SUCCÈS (${result.compiledContracts || 0} contrats compilés)\n`;
        setCompileSuccess(true);
      } else {
        logs += `❌ ÉCHEC\n`;
        setCompileSuccess(false);
      }

      logs += `─────────────────────────────\n`;

      /* ===== STDOUT COMPLET ===== */
      const stdout = result.stdout || result.out || '';
      logs += `STDOUT:\n${stdout.trim() || '(aucun output)'}\n\n`;

      /* ===== STDERR COMPLET ===== */
      const stderr = result.stderr || result.err || '';
      logs += `STDERR:\n${stderr.trim() || '(aucune erreur)'}\n`;

      /* ===== COMPTEUR CONTRATS + ARTIFACTS ===== */
      logs += `\n─────────────────────────────\n`;
      logs += `📁 Artifacts: artifacts/contracts/ (*.json générés)\n`;
      if (result.artifactsCount) {
        logs += `📊 ${result.artifactsCount} artifacts créés\n`;
      }

      /* ===== DEBUG RAW (optionnel) ===== */
      if (result.debug) {
        logs += `\n🔍 DEBUG:\n${JSON.stringify(result.debug, null, 2).slice(0, 500)}...\n`;
      }

      setCompileLogs(logs);
      onCompile?.();

      // Auto-scroll bottom
      setTimeout(() => {
        logsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      const errorMsg = err.message || String(err);
      setCompileLogs(
        `💥 ERREUR COMPILATION\n─────────────────────────────\n${errorMsg}\n\n💡 Vérifie:\n• HardhatRescoe/contracts/*.sol existants\n• npx hardhat compile manuel\n• API /api/contracts/compile-hardhat`
      );
      setCompileSuccess(false);
    }
  }, [onCompile]);

  return (
    <div className="bg-black/80 border border-zinc-700/50 rounded-2xl p-6 h-72 flex flex-col shadow-2xl">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold tracking-wide text-zinc-200">
          🌐 Hardhat Global Compiler
        </h3>
        <button
          onClick={handleCompileGlobal}
          disabled={disabled}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 
                     hover:from-emerald-600 hover:to-green-700 active:scale-[0.98]
                     disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed
                     rounded-xl font-bold text-sm shadow-lg border border-emerald-400/50
                     transition-all duration-200"
        >
          {disabled ? '⏳ En cours...' : '⚙️ Compile All (32 contrats)'}
        </button>
      </div>

      {/* STATUS BADGE */}
      {compileSuccess !== null && (
        <div
          className={`mb-4 px-4 py-2 rounded-xl font-mono text-sm font-semibold inline-flex items-center gap-2 transition-all ${
            compileSuccess
              ? 'bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300 shadow-emerald-500/25 shadow-lg'
              : 'bg-orange-500/20 border-2 border-orange-500/50 text-orange-300 shadow-orange-500/25 shadow-lg'
          }`}
        >
          {compileSuccess ? '✅ Compilation réussie' : '❌ Compilation échouée'}
        </div>
      )}

      {/* LOGS TERMINAL */}
      <div className="flex-1 min-h-0 overflow-hidden bg-zinc-950/90 border border-zinc-700 rounded-xl">
        <div className="h-full overflow-y-auto p-4 font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-900">
          <pre className="text-zinc-300 whitespace-pre-wrap">
            {compileLogs || '$ npx hardhat clean && npx hardhat compile --force\n$ Projet Hardhat prêt (scan contracts/)'}
          </pre>
          <div ref={logsRef} />
        </div>
      </div>

      {/* FOOTER HINT */}
      {!compileLogs && (
        <div className="text-zinc-500 text-xs mt-2 opacity-75 font-mono">
          Clique Compile → clean + compile tous les .sol → artifacts prêts pour deploy
        </div>
      )}
    </div>
  );
}
