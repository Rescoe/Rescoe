import { ethers } from "ethers";
import FAUCET_ABI from "@/components/ABI/Faucet.json";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: "Adresse manquante" });

    const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;
    const PRIVATE_KEY = process.env.RELAYER_PK;
    const FAUCET_ADDRESS = "0x1093cba97d078F66931f87E756b35D17a485C3E9";

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const faucet = new ethers.Contract(FAUCET_ADDRESS, FAUCET_ABI, wallet);

    // Appel direct claim en passant l'adresse (tu peux adapter la fonction claim du contrat)
    const tx = await faucet.claimTo(user, { gasLimit: 200_000 });
    await tx.wait();

    res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Erreur relay:", err.message);
    res.status(500).json({ error: err.message });
  }
}
