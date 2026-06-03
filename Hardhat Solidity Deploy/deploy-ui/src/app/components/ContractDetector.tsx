'use client';
import { useState, useEffect, useCallback } from 'react';
import { DeployStep } from '../types';

interface ContractDetectorProps {
  onContractsDetected: (contracts: DeployStep[]) => void;
  onSelectContract: (contract: DeployStep) => void;
  detectedContracts?: DeployStep[];
}

export default function ContractDetector({ 
  onContractsDetected, 
  onSelectContract, 
  detectedContracts = [] 
}: ContractDetectorProps) {
  const [scanning, setScanning] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);

  const scanContracts = useCallback(async () => {
    setScanning(true);

    try {
      const res = await fetch('/api/contracts/list');
      if (!res.ok) throw new Error('API error');

      const contractNames: string[] = await res.json();

      const allDetected: DeployStep[] = contractNames.map(name => ({
        id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name,
        status: 'pending',
        enabled: true,
      }));

      setDetectedCount(allDetected.length);
      onContractsDetected(allDetected);

      console.log(`✅ ${allDetected.length} contrats détectés`);
    } catch (error) {
      console.error('❌ Scan fail:', error);
      setDetectedCount(0);
      onContractsDetected([]);
    } finally {
      setScanning(false);
    }
  }, [onContractsDetected]);

  useEffect(() => {
    scanContracts();
  }, [scanContracts]);
return (
  <div className="bg-zinc-900/95 border border-zinc-800/50 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={scanContracts}
          disabled={scanning}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:cursor-not-allowed border border-zinc-700 hover:border-zinc-600 rounded-lg font-mono text-sm font-medium transition-colors duration-200 flex items-center gap-2 min-w-[100px]"
        >
          {scanning ? (
            <>
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Rescan</span>
            </>
          )}
        </button>
        
        <div className="flex items-center gap-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700">
          <div className="w-3 h-3 bg-emerald-400 rounded-full" />
          <span className="text-xs font-mono text-zinc-300">
            {detectedCount} contrats
          </span>
        </div>
      </div>
      
      <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
        Contracts Foundry
      </div>
    </div>

    {/* Content */}
    {detectedCount === 0 ? (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center mb-4 border border-zinc-700">
          <span className="text-2xl">📂</span>
        </div>
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">
          Aucun contrat Solidity
        </h3>
        <p className="text-sm text-zinc-400 max-w-sm mx-auto">
          Place tes fichiers .sol dans <code className="bg-zinc-800 px-2 py-1 rounded font-mono text-xs border border-zinc-700">public/contracts/</code>
        </p>
      </div>
    ) : (
      <div>
        <div className={`grid gap-3 ${
          detectedCount <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
          detectedCount <= 8 ? 'grid-cols-2 sm:grid-cols-3' :
          'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        }`}>
          {detectedContracts.map((contract, index) => (
            <button
              key={contract.id}
              onClick={() => onSelectContract(contract)}
              className="group relative p-4 bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700/50 hover:border-zinc-600 rounded-xl transition-all duration-200 hover:shadow-lg min-h-[72px]"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <h4 className="font-mono text-sm font-semibold text-zinc-100 mb-2 truncate leading-tight">
                {contract.name}
              </h4>
              
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  contract.status === 'ready' 
                    ? 'bg-emerald-400' 
                    : contract.status === 'compiling' 
                    ? 'bg-amber-400' 
                    : 'bg-zinc-600'
                }`} />
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wide">
                  {contract.status === 'ready' ? 'Ready' : 
                   contract.status === 'compiling' ? 'Compiling' : 'Pending'}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {detectedCount > 12 && (
          <div className="mt-4 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500 font-mono">
            {detectedCount} contrats disponibles
          </div>
        )}
      </div>
    )}
  </div>
);

}
