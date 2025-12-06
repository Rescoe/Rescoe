import { useState, useEffect, useMemo } from "react";
import { ethers, BrowserProvider, Eip1193Provider, JsonRpcProvider } from "ethers";
import { useAuth } from "@/utils/authContext";
import FAUCET_ABI from "@/components/ABI/Faucet.json";

import { Box, Button } from '@chakra-ui/react'; // Assurez-vous que Chakra UI est installé


const FAUCET_ADDRESS = "0xE14968f7ce8bE32ee79Aa37F82599fFADf55dDBa";
const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

export default function FaucetWidget() {
  const { address } = useAuth();
  const [balance, setBalance] = useState("0");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);


  const [isOpen, setIsOpen] = useState(false); // État pour contrôler l'ouverture du menu

  const handleToggle = () => {
    setIsOpen(!isOpen); // Basculer l'état ouvert/fermé
  };


  const readProvider = useMemo(() => new JsonRpcProvider(RPC_URL), []);
  const faucetRead = useMemo(
    () => new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, readProvider),
    [readProvider]
  );

  const faucetWrite = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, signer);
  }, [signer]);

  // --- Créer le signer de façon asynchrone ---
  useEffect(() => {
    const initSigner = async () => {
      if (typeof window.ethereum !== "undefined") {
        const ethereum = window.ethereum as unknown as Eip1193Provider;
        await ethereum.request({ method: "eth_requestAccounts" });
        const provider = new BrowserProvider(ethereum);
        const s = await provider.getSigner();
        setSigner(s);
      }
    };
    initSigner();
  }, []);

  // --- Fetch balance ---
  const fetchBalance = async () => {
    try {
      const bal = await readProvider.getBalance(FAUCET_ADDRESS);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.error("Erreur fetch balance:", err);
    }
  };

  // --- Fetch cooldown ---
  const fetchCooldown = async () => {
    if (!address) {
      setCooldown(0);
      return;
    }
    try {
      const cd = await faucetRead.cooldownRemaining(address);
      setCooldown(Number(cd));
    } catch (err) {
      console.error("Erreur fetch cooldown:", err);
    }
  };

  useEffect(() => { fetchBalance(); }, []);
  useEffect(() => { if (address) fetchCooldown(); }, [address]);

  // --- Claim ---
  const handleClaim = async () => {
    if (!address) return alert("Connecte ton wallet d'abord 🦊");
    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: address }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ 0.005 ETH Sepolia réclamé !");
        fetchBalance();
        fetchCooldown();
      } else {
        alert("❌ Erreur: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Erreur: " + err);
    } finally { setLoading(false); }
  };

  // --- Rendu ---
  return (
    <div className="relative">
      <Button
        onClick={handleToggle}
        className="bg-blue-500 text-white font-semibold rounded-md px-4 py-2"
      >
        Obtenir des ETH de Test
      </Button>

      {isOpen && (
        <Box className="absolute z-10 max-w-sm mx-auto p-[2px] rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-lg mt-2">
          <div className="rounded-2xl p-5 bg-white/80 backdrop-blur text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">💧 Faucet Sepolia Test</h2>
            <p className="text-gray-600 text-sm mb-3">
              0.005 ETH disponible toutes les minutes.<br />À utiliser de manière responsable 🧠
            </p>

            <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
              <p className="text-gray-700 text-sm">Solde disponible :</p>
              <p className="font-mono text-lg text-gray-900">{Number(balance).toFixed(4)} ETH</p>
            </div>

            {address ? (
              cooldown > 0 ? (
                <p className="text-sm text-gray-500 mt-2">⏳ Vous pourrez réclamer dans {cooldown}s</p>
              ) : (
                <Button
                  onClick={handleClaim}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 mt-2 font-semibold text-white rounded-xl
                    bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-600 hover:to-blue-600
                    shadow-md transition-all active:scale-95 disabled:opacity-60"
                >
                  {loading ? "Traitement..." : "💧 Récupérer des ETH Sepolia"}
                </Button>
              )
            ) : (
              <p className="text-sm text-gray-600 mt-2">Connecte ton wallet pour utiliser le faucet</p>
            )}
          </div>
        </Box>
      )}
    </div>
  );
}
