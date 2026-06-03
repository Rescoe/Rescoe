'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { DeployedContract } from '@/types/deploy';

interface FunctionCall {
  name: string;
  inputs: Array<{ type: string; name: string; hint: string }>;
  signature: string;
  outputs: string;
  stateMutability: string;
  abi: any[];
}

export default function ContractFunctions({ contract }: { contract: DeployedContract }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingFunc, setLoadingFunc] = useState(false);
  const [functions, setFunctions] = useState<FunctionCall[]>([]);
  const [results, setResults] = useState<{ [sig: string]: { status: 'idle' | 'loading' | 'success' | 'error'; message: string } }>({});
  const [expandedFuncs, setExpandedFuncs] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'read' | 'write'>('read');
  const inputRefs = useRef<{ [key: string]: HTMLInputElement[] }>({});
  const ethInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const copyToClipboard = async (text: string, target?: HTMLElement) => {
    try {
      await navigator.clipboard.writeText(text);
      if (target) {
        const original = target.innerHTML;
        target.innerHTML = '✅ Copié !';
        setTimeout(() => target && (target.innerHTML = original), 1500);
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const connectProvider = useCallback(async () => {
    if (!window.ethereum) {
      alert('Installe MetaMask !');
      return null;
    }
    try {
      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send("eth_requestAccounts", []);
      const signer = await prov.getSigner();
      setProvider(prov);
      setWalletAddress(await signer.getAddress());
      return prov;
    } catch (e: any) {
      console.error('MetaMask:', e);
      return null;
    }
  }, []);

  const loadFunctions = useCallback(async () => {
    setLoadingFunc(true);
    try {
      const timestamp = Date.now();
      const res = await fetch(`/api/contracts/functions?name=${encodeURIComponent(contract.name)}&ts=${timestamp}`);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      setFunctions(data.functions);
      
      console.log(`✅ ${data.functions.length} fonctions + ABI complet pour ${contract.name}`);
    } catch (e: any) {
      console.error('Erreur fonctions:', e);
    }
    setLoadingFunc(false);
  }, [contract]);

  const callFunction = useCallback(async (func: FunctionCall) => {
    console.log('🔥 CALL START', { funcName: func.name, signature: func.signature });
    
    let prov = provider;
    if (!prov) prov = await connectProvider() || null;
    if (!prov) return;

    const inputs = inputRefs.current[func.signature]?.map(el => el?.value || '') || [];
    
    if (inputs.length !== func.inputs.length) {
      setResults(prev => ({ 
        ...prev, 
        [func.signature]: { status: 'error', message: `❌ ${inputs.length}/${func.inputs.length} args` } 
      }));
      return;
    }

    setResults(prev => ({ 
      ...prev, 
      [func.signature]: { status: 'loading', message: '⏳ Exécution...' } 
    }));

    let parsedInputs: any[] = [];
    
    try {
      parsedInputs = inputs.map((input, i) => {
        const paramType = func.inputs[i]?.type;
        console.log(`🔍 Param ${i}:`, { raw: input, type: paramType });
        
        if (paramType?.endsWith('[]') && (paramType.includes('uint') || paramType.includes('int'))) {
          return input ? input.split(',').map(n => BigInt(n.trim())).filter(Boolean) : [];
        }
        if (paramType?.includes('uint') || paramType?.includes('int')) {
          return input ? BigInt(input) : 0n;
        }
        if (paramType === 'bool') return input.toLowerCase() === 'true';
        return input || '';
      });

      console.log('🚀 FINAL CALL:', {
        method: func.name,
        argsCount: parsedInputs.length,
        argsPreview: parsedInputs.slice(0, 3),
        stateMutability: func.stateMutability
      });

      const abiRes = await fetch(`/api/contracts/functions?name=${encodeURIComponent(contract.name)}`);
      const { abi } = await abiRes.json();
      const contractInstance = new ethers.Contract(contract.address, abi, prov);

      const isReadOnly = func.stateMutability === 'view' || func.stateMutability === 'pure';
      
      if (isReadOnly) {
        const result = await contractInstance[func.name](...parsedInputs);
        const display = formatResult(result);
        setResults(prev => ({ 
          ...prev, 
          [func.signature]: { status: 'success', message: display } 
        }));
      } else {
        const signer = await prov.getSigner();
        const writableContract = contractInstance.connect(signer);
        
        // 🔥 NOUVEAU : Récupère la valeur ETH si payable
        const ethValue = ethInputRefs.current[func.signature]?.value || '0';
        const value = ethers.parseEther(ethValue);
        
        console.log('💰 ETH envoyé:', ethValue, 'wei:', value.toString());
        
        const tx = await writableContract[func.name](...parsedInputs, { 
          value,
          gasLimit: 500000n 
        });
        
        console.log('📤 TX ENVOYÉE:', tx.hash);
        setResults(prev => ({ 
          ...prev, 
          [func.signature]: { status: 'loading', message: `⏳ Tx: ${tx.hash.slice(0, 10)}... ${ethValue} ETH` } 
        }));
        
        const receipt = await tx.wait();
        console.log('✅ RECEIPT:', receipt);
        setResults(prev => ({ 
          ...prev, 
          [func.signature]: { 
            status: 'success', 
            message: `✅ Block #${receipt.blockNumber} • ${receipt.hash.slice(0, 10)}... • ${ethValue} ETH` 
          } 
        }));
      }
      
    } catch (e: any) {
      console.error('💥 ERREUR COMPLÈTE:', {
        message: e.message,
        code: e.code,
        funcName: func.name,
        argsCount: parsedInputs.length,
        argsPreview: parsedInputs.slice(0, 3)
      });
      
      const msg = e.shortMessage || e.reason || e.message || 'Erreur inconnue';
      setResults(prev => ({ 
        ...prev, 
        [func.signature]: { status: 'error', message: msg } 
      }));
    }
  }, [contract, provider, connectProvider]);

  const formatResult = (result: any): string => {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'bigint') return result.toString();
    if (typeof result === 'boolean') return result ? 'true' : 'false';
    if (Array.isArray(result)) return `[${result.map(formatResult).join(', ')}]`;
    if (typeof result === 'object') return JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    return String(result);
  };

  const toggleExpand = (sig: string) => {
    setExpandedFuncs(prev => {
      const next = new Set(prev);
      next.has(sig) ? next.delete(sig) : next.add(sig);
      return next;
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadFunctions();
      connectProvider();
    }
  }, [isOpen, loadFunctions, connectProvider]);

  const readFuncs = functions.filter(f => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writeFuncs = functions.filter(f => f.stateMutability !== 'view' && f.stateMutability !== 'pure');
  const filteredFuncs = activeTab === 'read' ? readFuncs : writeFuncs;

  if (!isOpen) {
    return (
      <div 
        className="group bg-zinc-900/60 border border-zinc-700/50 hover:border-blue-500/50 
                   rounded-lg p-2.5 cursor-pointer hover:bg-zinc-800/50 transition-all"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 
                         rounded-lg flex items-center justify-center shrink-0">
            <span className="text-sm">📄</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-medium truncate">{contract.name}</div>
            <div 
              className="font-mono text-[10px] text-zinc-500 hover:text-emerald-400 cursor-pointer"
              onClick={async (e) => {
                e.stopPropagation();
                await copyToClipboard(contract.address, e.currentTarget as HTMLElement);
              }}
            >
              {contract.address.slice(0, 10)}…{contract.address.slice(-6)}
            </div>
          </div>
          <div className="flex gap-1 text-[10px] font-mono">
            <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{readFuncs.length}R</span>
            <span className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">{writeFuncs.length}W</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col">
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="font-mono font-semibold text-lg">{contract.name}</span>
            </div>
            <div 
              className="font-mono text-xs text-zinc-500 truncate pr-2 hover:text-emerald-400 cursor-pointer select-all"
              onClick={async (e) => {
                e.stopPropagation();
                await copyToClipboard(contract.address, e.currentTarget as HTMLElement);
              }}
              title="Clique pour copier l'adresse"
            >
              📋 {contract.address.slice(0, 8)}…{contract.address.slice(-4)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {walletAddress ? (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-mono">
                🟢 {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
            ) : (
              <button 
                onClick={connectProvider}
                className="text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-2 py-1 rounded font-mono transition-colors"
              >
                🔌 Connecter
              </button>
            )}
            <button
              onClick={loadFunctions}
              disabled={loadingFunc}
              className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded font-mono transition-colors disabled:opacity-50"
            >
              {loadingFunc ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

        <div className="flex bg-zinc-800/50 rounded-2xl p-1 shadow-lg">
          <button
            onClick={() => setActiveTab('read')}
            className={`flex-1 py-2.5 px-4 text-sm font-mono rounded-xl transition-all font-medium ${
              activeTab === 'read'
                ? 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white shadow-lg shadow-blue-500/25'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
            }`}
          >
            👁️ Read ({readFuncs.length})
          </button>
          <button
            onClick={() => setActiveTab('write')}
            className={`flex-1 py-2.5 px-4 text-sm font-mono rounded-xl transition-all font-medium ${
              activeTab === 'write'
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-500 text-white shadow-lg shadow-orange-500/25'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
            }`}
          >
            ✍️ Write ({writeFuncs.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-2">
        {filteredFuncs.length === 0 ? (
          <div className="text-center py-24 text-zinc-500 flex flex-col items-center">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
              {loadingFunc ? '⏳' : '🚫'}
            </div>
            <div className="font-mono text-lg mb-1">{loadingFunc ? 'Chargement...' : 'Aucune fonction'}</div>
            <div className="text-sm opacity-75">dans {activeTab === 'read' ? 'Read' : 'Write'}</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFuncs.map(func => (
              <FunctionRow 
                key={func.signature}
                func={func}
                type={activeTab}
                result={results[func.signature]}
                expanded={expandedFuncs.has(func.signature)}
                onToggle={() => toggleExpand(func.signature)}
                onCall={() => callFunction(func)}
                inputRefs={inputRefs}
                ethInputRef={ethInputRefs}
                disabled={!provider}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FunctionRow({ 
  func, 
  type,
  result, 
  expanded, 
  onToggle, 
  onCall, 
  inputRefs,
  ethInputRef,
  disabled 
}: { 
  func: FunctionCall;
  type: 'read' | 'write';
  result?: { status: string; message: string };
  expanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  inputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement[] }>;
  ethInputRef: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  disabled: boolean;
}) {
  const hasInputs = func.inputs.length > 0;
  const isPayable = func.stateMutability === 'payable';
  const isExpanded = expanded || hasInputs || isPayable;
  
  const buttonColor = type === 'read' 
    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
    : isPayable
      ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
      : 'bg-green-600 hover:bg-green-500 text-white';

  const borderColor = type === 'read' ? 'border-blue-500/30' : 'border-orange-500/30';
  const hoverBorder = type === 'read' ? 'hover:border-blue-500/50' : 'hover:border-orange-500/50';

  return (
    <div className={`bg-zinc-900/80 border ${borderColor} ${hoverBorder} rounded-lg transition-all`}>
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={hasInputs || isPayable ? onToggle : onCall}
          disabled={disabled && !(hasInputs || isPayable)}
          className={`${buttonColor} px-3 py-1.5 rounded text-xs font-mono font-medium transition-all 
                     disabled:opacity-50 disabled:cursor-not-allowed shrink-0 min-w-[80px]`}
        >
          {func.name}
        </button>

        {(hasInputs || isPayable) && (
          <button 
            onClick={onToggle}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          {result && (
            <div className={`font-mono text-xs truncate px-2 py-1 rounded ${
              result.status === 'loading' ? 'text-yellow-400 bg-yellow-500/10' :
              result.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
              result.status === 'error' ? 'text-red-400 bg-red-500/10' : 'text-zinc-400'
            }`}>
              {result.message}
            </div>
          )}
        </div>

        {func.outputs && func.outputs !== 'void' && (
          <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
            → {func.outputs}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-zinc-800 p-2 space-y-2">
          {/* 🔥 NOUVEAU : Champ ETH pour payable */}
          {isPayable && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">ETH</span>
              <input
                ref={el => {
                  ethInputRef.current[func.signature] = el;
                }}
                type="text"
                placeholder="0.001"
                defaultValue="0"
                className="flex-1 bg-zinc-800/50 border border-yellow-500/30 rounded px-2 py-1 text-xs font-mono
                          focus:outline-none focus:border-yellow-500/50 placeholder-zinc-600"
              />
              <span className="text-[10px] text-yellow-400 font-mono">ETH</span>
            </div>
          )}
          
          {/* Inputs classiques */}
          {hasInputs && func.inputs.map((input, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono w-16 shrink-0">{input.type}</span>
              <input
                ref={el => {
                  if (!inputRefs.current[func.signature]) inputRefs.current[func.signature] = [];
                  if (el) inputRefs.current[func.signature][i] = el;
                }}
                type="text"
                placeholder={input.name || `arg${i}`}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-mono
                          focus:outline-none focus:border-blue-500/50 placeholder-zinc-600"
              />
            </div>
          ))}
          
          <button
            onClick={onCall}
            disabled={disabled}
            className={`w-full ${buttonColor} py-1.5 rounded text-xs font-mono font-medium transition-all 
                       disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            🚀 Appeler {func.name}({isPayable ? '...' : ''})
          </button>
        </div>
      )}
    </div>
  );
}
