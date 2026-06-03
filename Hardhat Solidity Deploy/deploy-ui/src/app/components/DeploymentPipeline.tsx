'use client';
import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

import DeployBlockCard from './DeployBlockCard';
import { DeployBlock, DeployedContract } from '@/types/deploy';
import ContractFunctions from './ContractFunctions';

interface Props {
  detectedContracts: string[];
  blocks: DeployBlock[];
  loadedContracts?: DeployedContract[];
  onAddBlock: (name: string) => void;
  onAddLoadedBlock?: (contract: DeployedContract) => void;
  onUpdateBlock: (block: DeployBlock) => void;
  onDeployPipeline: () => void;
  onToggleStep: (id: string, enabled: boolean) => void;
  onRemoveBlock: (id: string) => void;
}

export default function DeploymentPipeline({ 
  detectedContracts, 
  blocks, 
  loadedContracts = [],
  onAddBlock, 
  onAddLoadedBlock,
  onUpdateBlock, 
  onDeployPipeline,
  onToggleStep,
  onRemoveBlock
}: Props) {
  
  // 🔥 WALLET
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [showLoadedPanel, setShowLoadedPanel] = useState(false);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert('Installe MetaMask !');
      return;
    }
    
    try {
      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const sign = await prov.getSigner();
      
      setProvider(prov);
      setSigner(sign);
      setWalletAddress(await sign.getAddress());
    } catch (e: any) {
      console.error('MetaMask:', e);
      alert('Connexion échouée');
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setWalletAddress('');
  }, []);

  // Auto-connect
  useEffect(() => {
    if (window.ethereum && !provider) {
      connectWallet();
    }
  }, [connectWallet, provider]);

  return (
    <div className="space-y-6">
      {/* HEADER WALLET */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-zinc-900 to-zinc-800/50 rounded-2xl border border-zinc-700 shadow-xl">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
          🚀 RESCOE Deployer
        </h1>
        
        <div className="flex items-center gap-3">
          {provider ? (
            <>
              <div className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl font-mono text-sm border-2 border-emerald-500/40 shadow-md">
                🟢 {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </div>
              <button
                onClick={disconnectWallet}
                className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-200 rounded-xl border border-red-500/40 transition-all hover:scale-105 shadow-md"
                title="Déconnecter"
              >
                ❌
              </button>
            </>
          ) : (
            <button 
              onClick={connectWallet}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-2xl font-bold text-sm shadow-2xl hover:shadow-orange-500/50 transition-all hover:scale-[1.02]"
            >
              🔌 Connecter MetaMask
            </button>
          )}
        </div>
      </div>

      {/* Load Deployed */}
      <button
        onClick={() => setShowLoadedPanel(!showLoadedPanel)}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 border border-blue-700 rounded-2xl font-mono font-semibold text-sm hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg hover:shadow-blue-500/25"
      >
        📂 {showLoadedPanel ? 'Masquer' : `Charger ${loadedContracts.length}`} Déployés
      </button>

      {/* Panneau Loaded Contracts */}
      {showLoadedPanel && (
        <div className="p-6 bg-gradient-to-br from-blue-500/5 via-blue-600/5 to-indigo-600/5 border-2 border-blue-500/20 rounded-2xl shadow-2xl">
          <div className="text-xs text-blue-300 font-mono mb-4 uppercase tracking-wider font-semibold">
            💾 deployed.json ({loadedContracts.length})
          </div>
          
          {loadedContracts.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 flex flex-col items-center">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
                📄
              </div>
              <div className="font-mono text-lg mb-1">Aucun contrat</div>
              <div className="text-sm opacity-75">Déployez d'abord !</div>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {loadedContracts.map(contract => (
                <div key={contract.id} className="flex items-center justify-between p-4 bg-zinc-900/70 hover:bg-zinc-800/50 rounded-xl border border-zinc-700/50 hover:border-blue-500/50 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-semibold truncate text-white">{contract.name}</div>
                    <div className="text-xs text-zinc-400 font-mono truncate">
                      {contract.address.slice(0, 6)}…{contract.address.slice(-4)}
                      <span className="ml-2 px-2 py-0.5 bg-zinc-700/80 text-xs rounded font-mono">
                        {contract.network || 'hardhat'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <ContractFunctions contract={contract} />
                    
                    <button
                      onClick={() => onAddLoadedBlock?.(contract)}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 
                                 rounded-xl text-emerald-300 hover:text-emerald-100 transition-all hover:scale-110 shadow-md"
                      title="➕ Ajouter au pipeline"
                    >
                      ➕
                    </button>
                    
                    <button
                      onClick={async () => {
                        if (confirm(`Supprimer ${contract.name} ?`)) {
                          try {
                            await fetch('/api/deployed', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: contract.id }),
                            });
                            window.dispatchEvent(new CustomEvent('refreshDeployed'));
                          } catch (e) {
                            alert(`Erreur: ${e}`);
                          }
                        }
                      }}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 
                                 rounded-xl text-red-300 hover:text-red-100 transition-all hover:scale-110 shadow-md"
                      title="🗑️ Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Boutons ajout contrats */}
      <div className="flex flex-wrap gap-2 p-2 bg-zinc-900/50 rounded-xl border border-zinc-700">
        {detectedContracts.map(name => (
          <button
            key={name}
            onClick={() => onAddBlock(name)}
            className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700/50 rounded-xl text-xs font-mono font-semibold hover:text-zinc-200 transition-all hover:shadow-md"
          >
            ➕ {name}
          </button>
        ))}
      </div>

      {/* Pipeline Blocks */}
      <div className="space-y-6">
        {blocks.map(block => (
          <DeployBlockCard
            key={block.id}
            block={block}
            availableBlocks={blocks}
            onUpdate={onUpdateBlock}
            onToggle={onToggleStep}
            onRemoveBlock={onRemoveBlock}
            provider={provider}
            signer={signer}
          />
        ))}
      </div>

      {/* Bouton Deploy Pipeline */}
      {blocks.length > 0 && (
        <button
          onClick={onDeployPipeline}
          disabled={blocks.some(b => b.status === 'deploying')}
          className="w-full px-8 py-4 bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-500 
                     border-2 border-emerald-700/50 rounded-2xl font-mono font-bold text-lg shadow-2xl
                     hover:from-emerald-500 hover:to-cyan-400 hover:shadow-emerald-500/50 
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                     transition-all hover:scale-[1.02]"
        >
          🚀 Déployer Pipeline Complète
          <div className="text-xs mt-1 opacity-75 font-normal">
            ({blocks.filter(b => b.enabled !== false).length} blocks actifs)
          </div>
        </button>
      )}

      {/* Stats */}
      {blocks.length > 0 && (
        <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900/70 backdrop-blur-sm rounded-2xl border border-zinc-700 text-xs text-zinc-400 font-mono text-center">
          <div>IDLE: {blocks.filter(b => b.status === 'idle').length}</div>
          <div>DEP: {blocks.filter(b => b.status === 'deploying').length}</div>
          <div>DONE: {blocks.filter(b => b.status === 'done').length}</div>
          <div>ERR: {blocks.filter(b => b.status === 'error').length}</div>
        </div>
      )}
    </div>
  );
}
