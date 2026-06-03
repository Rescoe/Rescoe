'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import dynamic from 'next/dynamic';
import { DeployStep } from './types';

import {useDeployOne} from './hooks/useDeployOne';

import MetaMaskConnect from './components/MetaMaskConnect';
import ContractDetector from './components/ContractDetector';
import ContractEditor from './components/ContractEditor';
import CompilerTerminal from './components/CompilerTerminal';
import DeploySteps from './components/DeploySteps';
import DeploymentPipeline from './components/DeploymentPipeline';

// HardhatNodeManager en dynamic pour éviter SSR mismatch
const HardhatNodeManager = dynamic(
  () => import('./components/HardhatNodeManager'),
  { ssr: false, loading: () => <div className="p-4 text-zinc-400 text-center">Chargement Hardhat Node…</div> }
);

export default function DeployPage() {
  // ----- STATE GLOBAL -----
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [deploySteps, setDeploySteps] = useState<DeployStep[]>([]);
  const [mode, setMode] = useState<'hardhat' | 'baseSepolia'>('hardhat');  // 🔥 NOUVEAU
  const detectedContractNames = deploySteps.map(s => s.name);

  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<DeployStep | null>(null);
  const [contractContent, setContractContent] = useState('// Sélectionne un contrat...\n');
  const [isCompiling, setIsCompiling] = useState(false);

  // ----- LOG UTILS -----
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('fr-FR');
    setLogs(prev => [...prev.slice(-200), `[${ts}] ${msg}`]);
  }, []);

  // ----- WALLET -----
  const handleConnect = useCallback((addr: string, prov: ethers.BrowserProvider) => {
    setAccount(addr);
    setProvider(prov);
    addLog(`Wallet connecté: ${addr.slice(0, 10)}…`);
  }, [addLog]);

  // ----- CONTRACT DETECTION -----
  const handleContractsDetected = useCallback((steps: DeployStep[]) => {
    setDeploySteps(steps);
    addLog(`${steps.length} contrats détectés`);
  }, [addLog]);

  const selectContract = useCallback((step: DeployStep) => {
    setSelectedContract(step);
    setContractContent(step.content || '// Contenu contrat...\n');
    addLog(`Édition ${step.name}.sol`);
  }, [addLog]);

  const handleEditorContentChange = useCallback((content: string) => {
    setContractContent(content);
    if (selectedContract) {
      setDeploySteps(prev =>
        prev.map(s => (s.id === selectedContract.id ? { ...s, content } : s))
      );
    }
  }, [selectedContract]);

  // ----- COMPILATION -----
  const compileHardhat = useCallback(async () => {
    setIsCompiling(true);
    addLog('Compilation Hardhat lancée');
    // TODO: appeler endpoint de compilation
    setIsCompiling(false);
  }, [addLog]);

  // ----- DEPLOYMENT -----
  const {
    blocks,
    addBlock,
    loadedContracts,     // 🔥 AJOUTE
    addLoadedBlock,      // 🔥 AJOUTE
    updateBlock,
    deploySingleStep,
    deployPipeline,
    toggleStep,
    setBlocksFromDrag,
    isDeploying,
    removeBlock,
  } = useDeployOne(provider, account, addLog, addresses, setAddresses, mode);  // 🔥 mode passé

  const setStepsFromDrag = useCallback((steps: DeployStep[]) => setDeploySteps(steps), []);

  // ----- RENDER -----
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* HEADER */}
      <header className="px-10 py-8 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <h1 className="text-4xl font-extrabold tracking-tight">
          RESCOE Deploy Studio
          <span className="text-zinc-500 font-normal ml-3">v4</span>
        </h1>
        {/* 🔥 TOGGLE MODES */}
        <div className="flex items-center gap-4 mt-4">
          <span className="text-sm text-zinc-400">Mode:</span>
          <button
            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${
              mode === 'hardhat' 
                ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/50' 
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700'
            }`}
            onClick={() => setMode('hardhat')}
          >
            🛠️ Hardhat (localhost)
          </button>
          <button
            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${
              mode === 'baseSepolia' 
                ? 'bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/50' 
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700'
            }`}
            onClick={() => setMode('baseSepolia')}
          >
            🌐 Base Sepolia
          </button>
        </div>
        <p className="text-sm text-zinc-400 mt-2">
          {mode === 'hardhat' ? '🛠️ Hardhat Dev (localhost:8545)' : '🌐 Base Sepolia Testnet (84532)'}
        </p>
      </header>

      {/* MAIN CONTENT */}
      <main className="px-10 py-10 space-y-12 relative">
        {/* EDITOR FULLSCREEN OVERLAY */}
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl pointer-events-auto">
            <div className="flex-1 overflow-hidden">
             <ContractEditor
              contractName={selectedContract.name}
              content={contractContent}
              onContentChange={handleEditorContentChange}
              onSave={() => addLog(`${selectedContract.name}.sol sauvé`)}
              onCompile={compileHardhat}
              onClose={() => {
                setSelectedContract(null);
                setContractContent('// Sélectionne un contrat...\n');
                addLog('✕ Éditeur fermé');
              }}
            />
            </div>
          </div>
        )}

        {/* 🔥 STEP 1: HARDHAT NODE (SEULEMENT HARDHAT MODE) */}
        {mode === 'hardhat' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            <HardhatNodeManager />
            {/* STEP 2: WALLET & DETECTION */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-xl">
              <h2 className="text-lg font-bold tracking-wide text-zinc-200">Wallet & Contract Detection</h2>
              <MetaMaskConnect account={account} onConnect={handleConnect} />
              <ContractDetector
                detectedContracts={deploySteps}
                onContractsDetected={handleContractsDetected}
                onSelectContract={selectContract}
              />
            </div>
          </section>
        )}

        {/* 🔥 WALLET EN BASE SEPOLIA (SANS HARDHAT) */}
        {mode === 'baseSepolia' && (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-10">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-xl invisible" />
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 space-y-6 shadow-xl">
              <h2 className="text-lg font-bold tracking-wide text-zinc-200 mb-4">🌐 Base Sepolia Wallet</h2>
              <MetaMaskConnect account={account} onConnect={handleConnect} />
              <div className="text-xs text-zinc-500 mt-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                Chain ID: <strong>84532</strong> | RPC: sepolia.base.org
              </div>
            </div>
          </section>
        )}

        {/* COMPILATION (SEULEMENT HARDHAT) */}
        {mode === 'hardhat' && (
          <section className="bg-black/80 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold tracking-wide text-zinc-200 mb-4">Hardhat Compilation</h2>
            <CompilerTerminal onCompile={compileHardhat} disabled={isCompiling} />
          </section>
        )}

        {/* DEPLOYMENT PIPELINE */}
        <section className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-lg font-bold tracking-wide text-zinc-200 mb-6">
            {mode === 'hardhat' ? '🛠️' : '🌐'} Deployment Pipeline ({mode === 'hardhat' ? 'Localhost' : 'Base Sepolia'})
          </h2>
            <DeploymentPipeline
              detectedContracts={detectedContractNames}
              blocks={blocks}
              loadedContracts={loadedContracts}      // 🔥 LIGNE 1
              onAddLoadedBlock={addLoadedBlock}      // 🔥 LIGNE 2
              onAddBlock={addBlock}
              onUpdateBlock={updateBlock}
              onDeployPipeline={deployPipeline}
              onToggleStep={toggleStep}
              onRemoveBlock={removeBlock}
            />

        </section>

        {/* LIVE LOGS */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-wide text-zinc-200">Live Logs</h2>
            <div className="text-xs text-zinc-500">{logs.length} lignes</div>
          </div>
          <div className="h-64 overflow-y-auto bg-black/50 border border-zinc-700 rounded-xl p-4 font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="italic text-zinc-500 text-center py-8">Aucune activité</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="leading-relaxed hover:bg-zinc-800/50 px-2 py-1 rounded transition-colors">
                  {log}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
