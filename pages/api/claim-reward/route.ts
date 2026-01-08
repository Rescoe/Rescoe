import { ethers } from "ethers";
import MANAGER_ABI from "@/components/ABI/ABI_Collections.json"; // ABI de ResCoellectionManager avec confirmPointsDistributed

export async function POST(req: Request) {
  try {
    const { user } = await req.json();
    if (!ethers.isAddress(user)) return Response.json({ error: "Adresse invalide" }, { status: 400 });

    const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;
    const PRIVATE_KEY = process.env.RELAYER_PK!;
    const MANAGER_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!; // Ton manager

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const relayerWallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const manager = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, relayerWallet);

    // Vérif pending + only relayer peut appeler
    const pending = await manager.getPendingPoints(user);
    if (pending === 0n) return Response.json({ error: "Aucun point pending" }, { status: 400 });

    // Relayer distribue (assure setRewardRelayer(relayer addr) ou msg.sender autorisé)
    const tx = await manager.confirmPointsDistributed(user, { gasLimit: 250_000 });
    const receipt = await tx.wait();

    return Response.json({
      success: true,
      txHash: tx.hash,
      points: pending.toString(),
      block: receipt?.blockNumber
    });
  } catch (err: any) {
    console.error("Erreur relayer rewards:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
