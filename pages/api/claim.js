import { ethers } from "ethers";
import FAUCET_ABI from "@/components/ABI/Faucet.json";

// Rate-limit en mémoire : 1 claim par adresse toutes les 24h
const lastClaim = new Map();
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { user } = req.body;
    if (!user || !ethers.isAddress(user)) {
      return res.status(400).json({ error: "Adresse invalide" });
    }

    const normalized = user.toLowerCase();
    const last = lastClaim.get(normalized);
    if (last && Date.now() - last < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (Date.now() - last);
      const remainingH = Math.ceil(remainingMs / 3600000);
      return res.status(429).json({ error: `Cooldown actif. Réessayez dans ${remainingH}h.` });
    }

    const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;
    const PRIVATE_KEY = process.env.RELAYER_PK;
    const FAUCET_ADDRESS = "0xE14968f7ce8bE32ee79Aa37F82599fFADf55dDBa";

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, wallet);

    const tx = await faucet.claimTo(user, { gasLimit: 200_000 });
    await tx.wait();

    lastClaim.set(normalized, Date.now());

    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Erreur relay:", err.message);
    res.status(500).json({ error: err.message });
  }
}
