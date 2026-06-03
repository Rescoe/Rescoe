'use client';
import { useState } from 'react';
import { ethers } from 'ethers';

interface MetaMaskConnectProps {
  account: string;
  onConnect: (account: string, provider: ethers.BrowserProvider) => void;
  className?: string;
}

export default function MetaMaskConnect({ account, onConnect, className = '' }: MetaMaskConnectProps) {
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    if (!window.ethereum) {
      alert('Installe MetaMask !');
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      onConnect(addr, provider);
    } catch (error) {
      console.error('MetaMask error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={connect}
      disabled={loading || !!account}
      className={`w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? '🔄 Connexion...' : account ? `${account.slice(0,6)}...${account.slice(-4)}` : '🔗 Connect MetaMask'}
    </button>
  );
}
