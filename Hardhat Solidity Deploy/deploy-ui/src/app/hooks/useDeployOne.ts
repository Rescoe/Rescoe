'use client';

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

export interface DeployBlock {
  id: string;
  contractName: string;
  args: DeployArg[];
  status: 'idle' | 'deploying' | 'done' | 'error';
  enabled?: boolean;
  deployedAddress?: string;
  content?: string;
  constructorHints?: { type: string; name: string; hint: string }[];
}

export interface DeployArg {
  type: 'static' | 'contract';
  value?: string;
  sourceBlockId?: string;
}

// 🔥 NOUVEAU: Interface contrat déployé
export interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: 'hardhat' | 'baseSepolia';
  timestamp: string;
}

export interface UseDeployOneReturn {
  blocks: DeployBlock[];
  loadedContracts: DeployedContract[];  // 🔥 NOUVEAU
  addBlock: (name: string) => Promise<void>;
  addLoadedBlock: (contract: DeployedContract) => void;  // 🔥 NOUVEAU: Load comme Remix
  updateBlock: (block: DeployBlock) => void;
  deployPipeline: () => Promise<void>;
  toggleStep: (id: string, enabled: boolean) => void;
  isDeploying: boolean;
  removeBlock: (id: string) => Promise<void>;  // 🔥 MAINTENANT ASYNC (suppr fichier)
}

export function useDeployOne(
  provider: ethers.BrowserProvider | null,
  account: string,
  addLog: (msg: string) => void,
  addresses: Record<string, string>,
  setAddresses: (addrs: Record<string, string>) => void
): UseDeployOneReturn {
  const [blocks, setBlocks] = useState<DeployBlock[]>([]);
  const [loadedContracts, setLoadedContracts] = useState<DeployedContract[]>([]);  // 🔥 NOUVEAU
  const [isDeploying, setIsDeploying] = useState(false);

  // 🔥 CHARGEMENT contrats persistés au montage (Remix-style)
  const fetchDeployed = useCallback(async () => {
    try {
      const res = await fetch('/api/deployed');
      const data = await res.json();
      const contracts = data.contracts || [];
      setLoadedContracts(contracts);
      addLog(`📂 ${contracts.length} contrats chargés depuis deployed.json`);
    } catch (e) {
      addLog('📂 Aucun fichier deployed.json trouvé');
    }
  }, [addLog]);

  useEffect(() => {
    fetchDeployed();
  }, [fetchDeployed]);

  useEffect(() => {
  const refreshDeployed = () => fetchDeployed();
  window.addEventListener('refreshDeployed', refreshDeployed);
  return () => window.removeEventListener('refreshDeployed', refreshDeployed);
}, []);


  const fetchAbiHints = useCallback(async (contractName: string) => {
    try {
      const res = await fetch(`/api/contracts/abi?name=${encodeURIComponent(contractName)}`);
      if (!res.ok) return null;
      const abiInfo = await res.json();
      return abiInfo.argHints || [];
    } catch {
      return null;
    }
  }, []);

  const addBlock = useCallback(async (name: string) => {
    addLog(`🔍 Détection ABI ${name}...`);
    const hints = await fetchAbiHints(name);
    const autoArgs: DeployArg[] = hints 
      ? hints.map((hint: any) => ({
          type: 'static' as const,
          value: hint.hint || ''
        }))
      : [{ type: 'static' as const, value: '' }];

    const newBlock: DeployBlock = {
      id: crypto.randomUUID(),
      contractName: name,
      args: autoArgs,
      status: 'idle',
      enabled: true,
      constructorHints: hints || undefined,
    };

    setBlocks(prev => [...prev, newBlock]);
    addLog(`✅ + ${name} (${autoArgs.length} args auto: ${hints?.map(h => h.type).join(', ') || 'manuel'})`);
  }, [addLog, fetchAbiHints]);

  // 🔥 NOUVEAU: Ajouter bloc depuis loaded contracts (comme "At Address" Remix)
  const addLoadedBlock = useCallback((contract: DeployedContract) => {
    const newBlock: DeployBlock = {
      id: crypto.randomUUID(),
      contractName: contract.name,
      args: [],
      status: 'done',
      enabled: true,
      deployedAddress: contract.address,
    };
    setBlocks(prev => [...prev, newBlock]);
    addLog(`📂 + ${contract.name} (${contract.address.slice(0,10)}…) chargé depuis fichier`);
  }, [addLog]);

  const updateBlock = useCallback((updated: DeployBlock) => {
    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
  }, []);

  const toggleStep = useCallback((id: string, enabled: boolean) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled } : b));
  }, []);

  // 🔥 SUPPR ASYNC: Supprime UI + fichier deployed.json
  const removeBlock = useCallback(async (id: string) => {
    const blockName = blocks.find(b => b.id === id)?.contractName || 'unknown';
    
    // Suppr fichier si DONE avec adresse
    const block = blocks.find(b => b.id === id);
    // Dans removeBlock callback
    if (block?.status === 'done' && block.deployedAddress) {
      try {
        await fetch('/api/deployed', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: blockId }),  // 🔥 id DU BLOCK ou loaded
        });
        addLog(`🗑️ Supprimé du fichier par ID: ${blockId}`);
      } catch (e) {
        addLog(`⚠️ Erreur suppr API: ${e}`);
      }
    }

    
    setBlocks(prev => prev.filter(b => b.id !== id));
    addLog(`🗑️ "${blockName}" supprimé de la pipeline`);
  }, [blocks, loadedContracts, addLog, fetchDeployed]);

  const deployPipeline = useCallback(async () => {
    const enabledBlocks = blocks.filter(b => b.enabled !== false);
    if (enabledBlocks.length === 0) return addLog('⚠️ Aucun bloc activé');

    setIsDeploying(true);
    addLog(`🚀 PIPELINE: ${enabledBlocks.map(b => b.contractName).join(' → ')}`);

    const deployed: Record<string, string> = { ...addresses };

    for (const block of enabledBlocks) {
      addLog(`🚀 ${block.contractName} START (args: ${block.args.length})`);
      updateBlock({ ...block, status: 'deploying' });

      try {
        const resolvedArgs = block.args.map(arg => {
          if (arg.type === 'static') return arg.value || '';
          const sourceBlock = blocks.find(b => b.id === arg.sourceBlockId);
          return sourceBlock?.deployedAddress || '';
        }).filter(Boolean);

        addLog(`📤 Envoi args: [${resolvedArgs.join(', ')}]`);

        const res = await fetch('/api/contracts/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: block.contractName,
            args: resolvedArgs,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        let address = data.address || 
                     data.deployedAddress || 
                     data.result?.address ||
                     (typeof data === 'string' ? data : 
                     Object.values(data)[0] as string);

        if (!address || address.length < 10) {
          throw new Error(`Adresse manquante: ${JSON.stringify(Object.keys(data || {}))}`);
        }

        // 🔥 SAUVEGARDE dans deployed.json APRÈS SUCCÈS
        await fetch('/api/deployed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contract: {
              id: crypto.randomUUID(),
              name: block.contractName,
              address,
              network: 'hardhat',  // TODO: adapter selon mode
              timestamp: new Date().toISOString(),
            }
          }),
        });
        addLog(`💾 ${block.contractName} sauvé dans deployed.json`);

        deployed[block.id] = address;
        updateBlock({
          ...block,
          status: 'done',
          deployedAddress: address,
        });
        setAddresses(deployed);
        addLog(`✅ ${block.contractName}: ${address.slice(0,10)}…`);

        // Refresh loadedContracts
        await fetchDeployed();

      } catch (error: any) {
        updateBlock({ ...block, status: 'error' });
        addLog(`❌ ${block.contractName}: ${error.message}`);
        addLog(`💡 Vérifie: args = [${block.args.map(a => a.value || '""').join(', ')}]`);
        break;
      }
    }

    setIsDeploying(false);
    addLog('🏁 Pipeline TERMINÉ');
  }, [blocks, addLog, addresses, setAddresses, updateBlock, loadedContracts, fetchDeployed]);

  return {
    blocks,
    loadedContracts,  // 🔥 EXPOSÉ
    addBlock,
    addLoadedBlock,   // 🔥 NOUVEAU
    updateBlock,
    deployPipeline,
    toggleStep,
    isDeploying,
    removeBlock,
  };
}
