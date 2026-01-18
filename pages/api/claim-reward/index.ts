import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from "ethers";
import MANAGER_ABI from "@/components/ABI/ABI_Collections.json";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method POST only' });
  }

  try {
    const { user } = req.body as { user: string }; // ✅ Type body

    console.log('Claim request for user:', user);

    if (!ethers.isAddress(user)) {
      return res.status(400).json({ error: "Adresse invalide" });
    }

    const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS;
    const PRIVATE_KEY = process.env.RELAYER_PK;
    const MANAGER_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

    if (!RPC_URL || !PRIVATE_KEY || !MANAGER_ADDRESS) {
      console.error('Config manquante:', {
        RPC_URL: !!RPC_URL,
        PRIVATE_KEY: !!PRIVATE_KEY,
        MANAGER_ADDRESS: !!MANAGER_ADDRESS
      });
      return res.status(500).json({ error: "Configuration manquante (.env)" });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(PRIVATE_KEY!, provider); // ✅ Non-null

    console.log('Relayer address:', await relayerWallet.getAddress());

    const manager = new ethers.Contract(
      MANAGER_ADDRESS,
      MANAGER_ABI,
      relayerWallet
    ) as ethers.Contract & {
      getPendingPoints: (user: string) => Promise<bigint>;
      rewardRelayer: () => Promise<string>;
      distributeToAdhesion: (user: string, overrides?: any) => Promise<ethers.TransactionResponse>;
    }; // ✅ ABI typing

    // 1. Vérif pending
    const pending = await manager.getPendingPoints(user);
    console.log(`Pending points for ${user}: ${pending.toString()}`);

    if (pending === 0n) {
      return res.status(400).json({ error: "Aucun point pending", pending: 0 });
    }

    // 2. Vérif relayer autorisé
    const currentRelayer = await manager.rewardRelayer();
    const relayerAddress = await relayerWallet.getAddress();
    console.log(`Contract relayer: ${currentRelayer}, Caller: ${relayerAddress}`);

    if (currentRelayer.toLowerCase() !== relayerAddress.toLowerCase()) {
      return res.status(403).json({ error: "Relayer non autorisé", expected: currentRelayer });
    }

    // 3. Execute
    console.log('Calling distributeToAdhesion...');
    const tx = await manager.distributeToAdhesion(user, {
      gasLimit: 300_000
    });

    console.log('TX sent:', tx.hash);

    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Transaction receipt manquant");
    }

    console.log('TX confirmed:', receipt.blockNumber);

    res.status(200).json({
      success: true,
      txHash: tx.hash,
      points: pending.toString(),
      block: receipt.blockNumber,
      status: receipt.status
    });


  } catch (err) {
    // ✅ Type guard pour unknown → Error
    const error = err as Error & {
      reason?: string;
      code?: string | number;
      data?: any;
    };

    console.error("=== FULL ERROR ===");
    console.error('Message:', error.message);
    console.error('Reason:', error.reason ?? 'N/A');
    console.error('Code:', error.code ?? 'N/A');
    console.error('Data:', error.data ?? 'N/A');
    console.error("==================");

    res.status(500).json({
      error: error.message ?? 'Erreur inconnue',
      reason: error.reason ?? undefined,
      code: error.code ?? undefined,
      data: error.data ?? undefined
    });
  }
}
