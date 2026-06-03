// hooks/useHatchEgg.ts — full on-chain, no IPFS
import { useState, useCallback, useEffect } from "react";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";

interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
}

interface PendingInsect {
  insectKey: string;
  displayName: string;
  family: string;
  previewImageUrl: string;
}

export const useHatchEgg = (contractAddress: string, eggTokenId: number) => {
  const { address: account, web3, isAuthenticated } = useAuth();

  const [isHatching, setIsHatching]       = useState(false);
  const [txHash, setTxHash]               = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [isReady, setIsReady]             = useState(false);
  const [eggInfo, setEggInfo]             = useState<MembershipInfo | null>(null);
  const [pendingInsect, setPendingInsect] = useState<PendingInsect | null>(null);

  // ── 1. Lire les infos de l'œuf (ethers.js + Moralis RPC) ─────────────────
  useEffect(() => {
    if (!contractAddress || eggTokenId === undefined) return;

    const load = async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
        const contract = new EthersContract(contractAddress, ABI, provider);

        // FIX: était getMembershipInfo → remplacé par le getter public membershipInfo(uint256)
        const raw = await contract.membershipInfo(eggTokenId);
        const info: MembershipInfo = {
          level:               Number(raw.level),
          autoEvolve:          Boolean(raw.autoEvolve),
          startTimestamp:      Number(raw.startTimestamp),
          expirationTimestamp: Number(raw.expirationTimestamp),
          totalYears:          Number(raw.totalYears),
          locked:              Boolean(raw.locked),
          isEgg:               Boolean(raw.isEgg),
        };

        if (!info.isEgg) {
          setError("Token n'est pas un œuf");
          return;
        }

        setEggInfo(info);

        // Vérifier la disponibilité via levelDurations[0] récupéré on-chain
        try {
          const durationRaw = await contract.levelDurations(0);
          const duration = Number(durationRaw);
          setIsReady(Math.floor(Date.now() / 1000) >= info.startTimestamp + duration);
        } catch {
          // Fallback : 120s (valeur dev)
          setIsReady(Math.floor(Date.now() / 1000) >= info.startTimestamp + 120);
        }
      } catch (e: any) {
        console.error("[HatchEgg] loadEggInfo error:", e.message);
        setError(e.message);
      }
    };

    load();
  }, [contractAddress, eggTokenId]);

  // ── 2. Pré-charger l'insecte qui va éclore (preview + params tx) ──────────
  //    Déterministe : même wallet → même insecte (lvl 0)
  useEffect(() => {
    if (!account || !eggInfo?.isEgg) return;

    const fetchPendingInsect = async () => {
      try {
        const r = await fetch(`/api/token/generate-onchain-uri?wallet=${account}&reroll=0`);
        if (!r.ok) throw new Error(`generate-onchain-uri HTTP ${r.status}`);
        const d = await r.json();
        setPendingInsect({
          insectKey:       String(d.insectName),
          displayName:     String(d.displayName),
          family:          String(d.family),
          previewImageUrl: String(d.imageUrl),
        });
      } catch (e: any) {
        // Non-bloquant — on peut éclore sans preview, on fetche au moment du clic
        console.warn("[HatchEgg] fetch pending insect failed:", e.message);
      }
    };

    fetchPendingInsect();
  }, [account, eggInfo?.isEgg]);

  // ── 3. Éclore l'œuf on-chain ──────────────────────────────────────────────
  const hatchEgg = useCallback(async () => {
    if (!isAuthenticated || !account || !web3) {
      setError("Connexion requise");
      return;
    }
    if (!eggInfo?.isEgg) {
      setError("Token n'est pas un œuf");
      return;
    }

    setIsHatching(true);
    setError(null);

    try {
      // Récupérer l'insecte si le pré-chargement a échoué
      let insect = pendingInsect;
      if (!insect) {
        const r = await fetch(`/api/token/generate-onchain-uri?wallet=${account}&reroll=0`);
        if (!r.ok) throw new Error("Impossible de sélectionner un insecte");
        const d = await r.json();
        insect = {
          insectKey:       String(d.insectName),
          displayName:     String(d.displayName),
          family:          String(d.family),
          previewImageUrl: String(d.imageUrl),
        };
        setPendingInsect(insect);
      }

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      // FIX: 4 paramètres requis — eggId + insectKey + displayName + family
      const receipt = await contract.methods
        .hatchEgg(eggTokenId, insect.insectKey, insect.displayName, insect.family)
        .send({ from: account, value: "0", gasPrice: gasPrice.toString() });

      // Récupérer le nouveau tokenId depuis l'événement LevelEvolved
      let newTokenId: string = (eggTokenId + 1).toString();
      if (receipt.events?.LevelEvolved?.returnValues?.tokenId) {
        newTokenId = receipt.events.LevelEvolved.returnValues.tokenId.toString();
      }

      setTxHash(receipt.transactionHash);
      console.log("[HatchEgg] ✅ Éclosion OK, nouveau token:", newTokenId);
    } catch (e: any) {
      console.error("[HatchEgg] error:", e.message);
      setError(e.message);
    } finally {
      setIsHatching(false);
    }
  }, [isAuthenticated, account, web3, contractAddress, eggTokenId, eggInfo, pendingInsect]);

  return {
    isHatching,
    isReady,
    txHash,
    error,
    eggInfo,
    hatchEgg,
    /** URL locale pour l'image preview de l'insecte qui va éclore */
    previewImageUrl: pendingInsect?.previewImageUrl ?? null,
    // Champs legacy (compatibilité avec HatchEggPanel existant)
    isPreparing:      false,
    hatchImageUri:    null,
    hatchMetadataUri: null,
    prepareHatch:     async () => ({ imageUri: null, metadataUri: null, isReady: false }),
  };
};
