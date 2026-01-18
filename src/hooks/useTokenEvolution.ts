// hooks/useTokenEvolution.ts
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import evolutionEngine from "../utils/evolutionEngine";
import { usePinataUpload } from "./usePinataUpload";
import ABI from "../components/ABI/ABIAdhesionEvolve.json";
import { useAuth } from "@/utils/authContext";

interface MembershipRaw {
  level: string | number;
  autoEvolve: boolean;
  startTimestamp: string | number;
  expirationTimestamp: string | number;
  totalYears: string | number;
  locked: boolean;
}

interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
}



export const useTokenEvolution = ({
  contractAddress,
  tokenId,
  walletAddress,
  currentName,
  currentBio,
  currentRoleLabel,
  onMetadataLoaded,
}: any) => {
  /* =======================
     STATE
  ======================= */

  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo | null>(null);
  const [evolvePriceEth, setEvolvePriceEth] = useState(0);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isManualEvolveReady, setIsManualEvolveReady] = useState(false);
  const [isUploadingEvolve, setIsUploadingEvolve] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);

  const { uploadToIPFS, ipfsUrl } = usePinataUpload();
  const { address: account, web3, isAuthenticated } = useAuth();

  /* =======================
     FETCH ON-CHAIN MEMBERSHIP
  ======================= */

  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const fetchMembership = async () => {
      try {
        const web3Instance = new Web3((window as any).ethereum);
        const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

        const infoRaw: MembershipRaw = await contract.methods.getMembershipInfo(tokenId).call() as unknown as MembershipRaw;
        if (!infoRaw || typeof infoRaw !== "object") return;

        const info: MembershipInfo = {
          level: Number(infoRaw.level),
          autoEvolve: Boolean(infoRaw.autoEvolve),
          startTimestamp: Number(infoRaw.startTimestamp),
          expirationTimestamp: Number(infoRaw.expirationTimestamp),
          totalYears: Number(infoRaw.totalYears),
          locked: Boolean(infoRaw.locked),
        };


        setMembershipInfo(info);

        let priceWei = "0";
        try {
          priceWei = await contract.methods.baseEvolvePrice(info.level).call();
        } catch {
          priceWei = "0";
        }

        setEvolvePriceEth(Number(priceWei) / 1e18);
      } catch (e) {
        console.error("❌ getMembershipInfo error:", e);
      }
    };

    fetchMembership();
  }, [contractAddress, tokenId]);

  /* =======================
     METADATA SYNC (UI ONLY)
  ======================= */

  const updateCurrentMetadata = useCallback(
    (metadata: any) => {
      if (!metadata) return;
      onMetadataLoaded?.(metadata);
    },
    [onMetadataLoaded]
  );

  /* =======================
     PREPARE EVOLUTION (CLEAN)
  ======================= */

  const prepareEvolution = useCallback(async () => {
    if (isUploadingEvolve || isManualEvolveReady) return;
    if (!membershipInfo || !contractAddress || tokenId === undefined) {
      alert("Données d'évolution indisponibles");
      return;
    }

    try {
      setIsUploadingEvolve(true);

      const currentLevel = Number(membershipInfo.level);
      const targetLevel = currentLevel + 1;

      if (currentLevel >= 3) {
        throw new Error("Niveau maximum atteint");
      }

      // 🔗 SOURCE DE VÉRITÉ : BLOCKCHAIN
      const web3Instance = new Web3((window as any).ethereum);
      const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

      const tokenUri: string = await contract.methods.tokenURI(tokenId).call();
      const response = await fetch(tokenUri);
      const currentMetadata = await response.json();

      const finalWallet =
        walletAddress ||
        account ||
        "0x0000000000000000000000000000000000000000";

      // 🔥 ENGINE (sera refactoré ensuite)
      const evolutionData = evolutionEngine(
        currentMetadata,
        currentLevel,
        targetLevel,
        finalWallet,
        tokenId
      );

      setPreviewImageUrl(evolutionData.imageUrl);

      // 📜 HISTORIQUE
      const history =
        Array.isArray(currentMetadata.evolutionHistory)
          ? [...currentMetadata.evolutionHistory]
          : [];

      history.push({
        niveau: currentLevel,
        uri: tokenUri,
        image: currentMetadata.image,
        family: currentMetadata.family,
        sprite_name: currentMetadata.sprite_name,
        horodatage: Math.floor(Date.now() / 1000),
      });

      // ☁️ IPFS
      const pinataResult = await uploadToIPFS({
        imageUrl: evolutionData.imageUrl,
        name: evolutionData.display_name || currentName,
        bio: currentBio,
        role: currentRoleLabel,
        level: targetLevel,
        attributes: evolutionData.attributes,
        family: evolutionData.family,
        sprite_name: evolutionData.sprite_name,
        color_profile: evolutionData.color_profile,
        previousImage: currentMetadata.image,
        evolutionHistory: history,
      });

      if (!pinataResult?.url) {
        throw new Error("Upload IPFS échoué");
      }

      updateCurrentMetadata({
        ...currentMetadata,
        ...evolutionData,
        level: targetLevel,
        image: evolutionData.imageUrl,
        evolutionHistory: history,
      });

      setIsManualEvolveReady(true);
    } catch (e: any) {
      console.error("❌ prepareEvolution error:", e);
      alert(e.message || "Erreur évolution");
    } finally {
      setIsUploadingEvolve(false);
    }
  }, [
    membershipInfo,
    contractAddress,
    tokenId,
    walletAddress,
    account,
    uploadToIPFS,
    updateCurrentMetadata,
    isUploadingEvolve,
    isManualEvolveReady,
  ]);

  /* =======================
     EVOLVE ON-CHAIN
  ======================= */

  const evolve = useCallback(async () => {
    if (!ipfsUrl || !contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }

    try {
      setIsEvolving(true);

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      const receipt = await contract.methods.evolve(tokenId, ipfsUrl).send({
        from: account,                    // ✅ account de useAuth()
        value: web3.utils.toWei(evolvePriceEth.toString(), "ether"),
        gasPrice: gasPrice.toString(),    // ✅ recette low gas
        maxFeePerGas: null as any,        // ✅ legacy tx
        maxPriorityFeePerGas: null as any
      });


        console.log("✅ ÉVOLUTION OK - Gas utilisé:", receipt.gasUsed);

        // ✅ newTokenId (contrat modifié ou fallback)
        const newTokenId = receipt.events?.EvolveCompleted?.returnValues?.newTokenId ||
                          receipt.events?.LevelEvolved?.returnValues?.tokenId ||
                          tokenId + 1; // fallback si contrat pas encore updaté

        console.log("✅ Nouveau Token ID:", newTokenId);
        window.location.href = `/AdhesionId/${contractAddress}/${newTokenId}`;


    } catch (e) {
      console.error("❌ evolve error:", e);
      alert("Erreur transaction");
    } finally {
      setIsEvolving(false);
    }
  }, [ipfsUrl, contractAddress, tokenId, evolvePriceEth, account, web3, isAuthenticated]);

  const refreshEvolution = useCallback(() => {
    setPreviewImageUrl(null);
    setIsManualEvolveReady(false);
  }, []);

  return {
    membershipInfo,
    evolvePriceEth,
    isManualEvolveReady,
    previewImageUrl,
    evolveIpfsUrl: ipfsUrl,
    isUploadingEvolve,
    isEvolving,
    prepareEvolution,
    evolve,
    refreshEvolution,
    updateCurrentMetadata,
  };
};
