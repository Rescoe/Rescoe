'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { DeployBlock, DeployArg } from '@/types/deploy';

interface DeployBlockCardProps {
  block: DeployBlock;
  availableBlocks: DeployBlock[];
  onUpdate: (block: DeployBlock) => void;
  onRemoveBlock?: (id: string) => void;
  provider?: ethers.BrowserProvider | null;
  signer?: ethers.JsonRpcSigner | null;
}

export default function DeployBlockCard({
  block,
  availableBlocks,
  onUpdate,
  onRemoveBlock,
  provider,
  signer,
}: DeployBlockCardProps) {
  const [constructorHints, setConstructorHints] = useState<any[]>([]);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'prepare' | 'ready' | 'deploying' | 'done'>('idle');
  const [bytecode, setBytecode] = useState('');
  const [contractAbi, setContractAbi] = useState<any[]>([]);

  const updateArgValue = (index: number, value: string) => {
    const newArgs = block.args.map((arg, i) => i === index ? { ...arg, value } : arg);
    onUpdate({ ...block, args: newArgs });
  };

  const setArgSource = (index: number, sourceId?: string) => {
    const newArgs = block.args.map((arg, i) =>
      i === index
        ? sourceId
          ? { type: 'contract' as const, sourceBlockId: sourceId }
          : { type: 'static' as const, value: '' }
        : arg
    );
    onUpdate({ ...block, args: newArgs });
  };

  const addArg = () => {
    onUpdate({
      ...block,
      args: [...block.args, { type: 'static' as const, value: '' }],
    });
  };

  const removeArg = (index: number) => {
    const newArgs = block.args.filter((_, i) => i !== index);
    onUpdate({ ...block, args: newArgs });
  };

  const handleRemove = () => {
    if (onRemoveBlock) {
      onRemoveBlock(block.id);
    }
  };

const handlePrepareMetaMask = useCallback(async () => {
  console.log('🔥 PREPARE:', block.contractName);
  setDeployStatus('prepare');
  
  try {
    const res = await fetch(`/api/contracts/bytecode?name=${encodeURIComponent(block.contractName)}`);
    console.log('API Status:', res.status, res.ok);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('API Error:', errorText);
      throw new Error(`API fail: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ API DATA:', {
      hasBytecode: !!data.bytecode,
      bytecodeLen: data.bytecode?.length,
      hasAbi: !!data.abi,
      abiLen: data.abi?.length
    });
    
    // 🔥 SAFE ASSIGN
    setBytecode(data.bytecode || '');
    setContractAbi(Array.isArray(data.abi) ? data.abi : []);
    setDeployStatus('ready');
    
  } catch (error: any) {
    console.error('💥 PREPARE FAIL:', error);
    onUpdate({ ...block, status: 'error', content: error.message });
    setDeployStatus('idle');
  }
}, [block.contractName, onUpdate]);


  // Remplace TON handleDeployMetaMask par ÇA
const handleDeployMetaMask = useCallback(async () => {
  // 🔥 SAFE LOGS
  console.log('🔍 DEBUG DEPLOY:', { 
    provider: !!provider, 
    signer: !!signer, 
    bytecode: !!bytecode, 
    abiLength: contractAbi?.length || 'undefined',
    abiIsArray: Array.isArray(contractAbi),
    blockName: block.contractName 
  });
  
  // 🔥 SAFE CHECKS
  if (!provider) return alert('Connecte MetaMask !');
  if (!signer) return alert('Signer manquant !');
  if (!bytecode) return alert('Prépare d\'abord !');
  if (!contractAbi || !Array.isArray(contractAbi) || contractAbi.length === 0) {
    console.error('❌ ABI ISSUE:', contractAbi);
    return alert('ABI manquante ! Prépare à nouveau.');
  }

  setDeployStatus('deploying');
  
  try {
    console.log('🚀 Factory creation...');
    const factory = new ethers.ContractFactory(contractAbi, bytecode, signer);
    
    // Parse args
    const deployArgs = block.args.map(arg => {
      if (arg.type === 'contract') {
        const sourceBlock = availableBlocks.find(b => b.id === arg.sourceBlockId);
        return sourceBlock?.deployedAddress || '0x0000000000000000000000000000000000000000';
      }
      return arg.value || '';
    });
    
    console.log('📦 Deploy args:', deployArgs);

    const contract = await factory.deploy(...deployArgs, { gasLimit: 3000000n });
    console.log('📤 TX envoyée:', contract.deploymentTransaction()?.hash);
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('✅ Deployed !', address);


// 🔥 SAUVEGARDE AUTO deployed.json
try {
  await fetch('/api/deployed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contract: {
        name: block.contractName,
        address: address,
        network: 'metamask-local',  // Ou détecte chainId
        deployedTx: contract.deploymentTransaction()?.hash,
        timestamp: new Date().toISOString()
      }
    })
  });
  console.log('💾 Sauvegardé dans deployed.json');
} catch (saveError) {
  console.warn('⚠️ Save fail:', saveError);
}

onUpdate({
  ...block,
  status: 'done',
  deployedAddress: address,
  deployedTx: contract.deploymentTransaction()?.hash,
  useMetamask: true
});

    onUpdate({
      ...block,
      status: 'done',
      deployedAddress: address,
      deployedTx: contract.deploymentTransaction()?.hash,
      useMetamask: true
    });
    
    setDeployStatus('done');
  } catch (error: any) {
    console.error('💥 Deploy error:', error);
    onUpdate({ 
      ...block, 
      status: 'error', 
      content: error.shortMessage || error.message || 'Deploy échoué' 
    });
    setDeployStatus('idle');
  }
}, [provider, signer, bytecode, contractAbi, block, availableBlocks, onUpdate]);


  // 🔥 RELAYER DEPLOY (ton ancien code)
  const handleRelayerDeploy = useCallback(async () => {
    // Ton code relayer existant ici
    console.log('Relayer deploy:', block.contractName);
  }, [block.contractName]);

  useEffect(() => {
    if (block.contractName) {
      fetch(`/api/contracts/abi?name=${encodeURIComponent(block.contractName)}&ts=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.argHints) {
            setConstructorHints(data.argHints);
            onUpdate({ ...block, constructorHints: data.argHints });
          }
        })
        .catch(e => console.error('ABI load fail:', e));
    }
  }, [block.contractName, onUpdate]);

  const useMetamask = block.useMetamask ?? false;

  return (
    <div className="group bg-zinc-900/90 border-2 border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-5 space-y-4 transition-all hover:shadow-emerald-500/10 shadow-lg">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-mono text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            {block.contractName}
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
            block.status === 'done'
              ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50'
              : block.status === 'error'
              ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50'
              : block.status === 'deploying'
              ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 animate-pulse'
              : 'bg-zinc-600/30 text-zinc-400 border border-zinc-600/50'
          }`}>
            {block.status === 'deploying' ? '⚡' : ''}{block.status.toUpperCase()}
          </span>
        </div>

        {/* ENABLE TOGGLE + 🗑️ */}
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={block.enabled !== false}
              onChange={(e) => onUpdate({ ...block, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-600 transition-colors"></div>
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
          </label>

          <button
            onClick={handleRemove}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all group-hover:bg-zinc-800/50 hover:scale-110 w-10 h-10 flex items-center justify-center shadow-md hover:shadow-red-500/25"
            title={`🗑️ Supprimer ${block.contractName}`}
          >
            <span className="text-xl">×</span>
          </button>
        </div>
      </div>

      {/* ARGS (INCHANGÉ) */}
      <div className="space-y-3">
        {block.args.map((arg, i) => {
          const hints = constructorHints[i] || { name: `arg${i + 1}`, type: 'unknown' };
          return (
            <div key={i} className="flex gap-3 items-start p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 hover:border-zinc-600 group/arg hover:bg-zinc-800/70 transition-all">
              <div className="flex-none w-28 text-sm text-zinc-300 font-mono mt-1.5">
                <div className="font-bold text-zinc-100 truncate max-w-[7rem]">
                  {hints.name}
                </div>
                <div className={`text-[11px] px-1 py-0.5 rounded-full mt-1 font-mono ${
                  hints.type.includes('uint')
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : hints.type.includes('address')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : hints.type.includes('string')
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                }`}>
                  {hints.type}
                </div>
              </div>

              <div className="flex-1 relative">
                <input
                  className="w-full bg-zinc-950/50 border border-zinc-600/50 rounded-xl px-4 py-3 text-base font-mono placeholder-zinc-500 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all hover:border-zinc-500 read-only:bg-emerald-950/50 read-only:cursor-default"
                  placeholder={
                    hints.hint ||
                    (hints.type?.includes('uint')
                      ? '1000'
                      : hints.type?.includes('address')
                      ? '0x123...'
                      : hints.type?.includes('string')
                      ? '"MonToken"'
                      : hints.type?.includes('bool')
                      ? 'true'
                      : 'valeur...')
                  }
                  value={arg.type === 'static' ? arg.value || '' : `← ${availableBlocks.find(b => b.id === arg.sourceBlockId)?.contractName}`}
                  onChange={(e) => updateArgValue(i, e.target.value)}
                  readOnly={arg.type === 'contract'}
                />
                {arg.type === 'contract' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-xs font-mono">
                    🔗 contrat
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-[100px]">
                {availableBlocks
                  .filter(b => b.id !== block.id && b.status === 'done')
                  .slice(0, 4)
                  .map(b => (
                    <button
                      key={b.id}
                      onClick={() => setArgSource(i, b.id)}
                      className="px-2 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-mono rounded-lg border border-emerald-500/30 hover:border-emerald-400/50 transition-all group-hover/arg:scale-105 whitespace-nowrap"
                      title={`${b.contractName}\n${b.deployedAddress}`}
                    >
                      {b.contractName.slice(0, 6)}
                    </button>
                  ))}
                {availableBlocks.filter(b => b.status === 'done').length > 4 && (
                  <div className="text-xs text-zinc-500 text-center">...</div>
                )}
              </div>

              <button
                onClick={() => removeArg(i)}
                className="flex-none w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-all group-hover/arg:bg-zinc-700"
                title="Supprimer paramètre"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
          );
        })}

        <button
          onClick={addArg}
          className="w-full flex items-center justify-center gap-2 p-3 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 border-2 border-dashed border-zinc-700 rounded-xl font-mono font-semibold text-sm transition-all hover:border-zinc-600 hover:shadow-md"
        >
          ➕ Ajouter paramètre
        </button>
      </div>

      {/* 🔥 NOUVEAU : SECTION DEPLOY */}
      {block.enabled !== false && (
        <div className="pt-4 border-t border-zinc-800 space-y-3">
          {/* Toggle MetaMask/Relayer */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-zinc-900/50 to-zinc-800/30 rounded-xl border border-zinc-700">
            <label className="flex items-center gap-3 text-sm cursor-pointer group">
              <input
                type="checkbox"
                checked={useMetamask}
                onChange={(e) => {
                  onUpdate({ ...block, useMetamask: e.target.checked });
                  setDeployStatus('idle');
                }}
                className="w-5 h-5 text-orange-500 bg-zinc-800 border-zinc-700 rounded focus:ring-orange-500 focus:ring-2"
              />
              <span className="font-mono text-zinc-300 group-hover:text-orange-400 transition-colors">
                🦊 Deploy depuis MetaMask
              </span>
            </label>
            
            <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
              useMetamask
                ? 'bg-gradient-to-r from-orange-400/20 to-yellow-400/20 text-orange-400 border border-orange-400/40'
                : 'bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 text-emerald-400 border border-emerald-400/40'
            }`}>
              {useMetamask ? 'MetaMask' : 'Relayer'}
            </span>
          </div>

          {/* Boutons Deploy */}
          <div className="space-y-2">
            {useMetamask ? (
              /* 🔥 METAMASK BUTTONS */
              <div className="space-y-2">
                <button
                  onClick={deployStatus === 'idle' ? handlePrepareMetaMask : handleDeployMetaMask}
                  disabled={!provider || deployStatus === 'deploying'}
                  className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl font-mono font-bold text-sm shadow-2xl transition-all border-2 ${
                    deployStatus === 'idle' && provider
                      ? 'bg-zinc-900/50 hover:bg-orange-500/10 border-zinc-700/50 hover:border-orange-500/50 text-zinc-200 hover:text-orange-300 hover:shadow-orange-500/20'
                      : deployStatus === 'ready'
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white border-orange-500/50 shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02]'
                      : deployStatus === 'deploying'
                      ? 'bg-gradient-to-r from-amber-400/40 to-yellow-400/40 text-white border-amber-400/50 shadow-amber-400/20 animate-pulse'
                      : 'bg-zinc-800/30 text-zinc-500 border-zinc-700/50 cursor-not-allowed'
                  }`}
                >
                  {deployStatus === 'idle' && '⚙️ Préparer MetaMask'}
                  {deployStatus === 'prepare' && '🔄 Chargement bytecode...'}
                  {deployStatus === 'ready' && '🚀 Deploy MetaMask'}
                  {deployStatus === 'deploying' && '⏳ Confirmation...'}
                  
                  {deployStatus === 'deploying' && (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                </button>
                
                {!provider && (
                  <div className="text-xs text-orange-400 text-center p-2 bg-orange-500/10 rounded-xl border border-orange-500/30 font-mono">
                    🔌 Connecte MetaMask pour déployer
                  </div>
                )}
              </div>
            ) : (
              /* RELAYER BUTTON (ton ancien) */
              <button
                onClick={handleRelayerDeploy}
                className="w-full p-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/40 border-2 border-emerald-500/50 text-emerald-400 hover:text-emerald-200 font-mono font-bold text-sm rounded-2xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
              >
                ⚙️ Deploy Relayer
              </button>
            )}
          </div>
        </div>
      )}

      {/* RESULTS (INCHANGÉ) */}
      {block.deployedAddress && (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-2 border-emerald-500/30 rounded-xl backdrop-blur-sm shadow-emerald-500/20">
          <div className="text-emerald-400 text-sm font-mono">
            📍 {block.deployedAddress.slice(0, 42)}…
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(block.deployedAddress!)}
            className="ml-auto px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 hover:text-emerald-100 text-xs font-mono rounded-lg border border-emerald-500/50 transition-all"
            title="Copier adresse"
          >
            📋
          </button>
        </div>
      )}

      {block.status === 'error' && (
        <div className="p-3 bg-red-500/10 border-2 border-red-500/30 rounded-xl text-red-400 text-sm font-mono flex items-center gap-2">
          ❌ Erreur déploiement
          <span className="text-xs bg-red-500/20 px-2 py-1 rounded font-mono">
            {block.content || 'Vérifie args'}
          </span>
        </div>
      )}
    </div>
  );
}
