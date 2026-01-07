// hooks/useTokenEvolution.ts - ✅ BULLET-PROOF HISTORIQUE INFINI
import { useState, useEffect, useCallback, useRef } from "react";
import Web3 from "web3";
import evolutionEngine from "../utils/evolutionEngine";
import { usePinataUpload } from "./usePinataUpload";
import ABI from "../components/ABI/ABIAdhesionEvolve.json";
import { useAuth } from "@/utils/authContext";



export interface MembershipInfo {
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
  walletAddress,  // 🔥 AJOUTÉ
  currentImage,
  currentName,
  currentBio,
  currentRoleLabel,
  onMetadataLoaded,
}: any) => {
  /* =======================
     STATE
  ======================= */

  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo | null>(null);
  const [evolvePriceEth, setEvolvePriceEth] = useState<number>(0);

  const [currentMetadata, setCurrentMetadata] = useState<any>(null);
  const lastStableMetadataRef = useRef<any>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isManualEvolveReady, setIsManualEvolveReady] = useState(false);

  const [isUploadingEvolve, setIsUploadingEvolve] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);

  const { uploadToIPFS, ipfsUrl } = usePinataUpload();

  const { address: account, web3, isAuthenticated } = useAuth();


  /* =======================
     FETCH ON-CHAIN MEMBERSHIP
  ======================= */

  // Remplace TON useEffect par ÇA :
  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const fetchMembership = async () => {
      try {
        const web3Instance = new Web3((window as any).ethereum);
        const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

        const infoRaw: any = await contract.methods.getMembershipInfo(tokenId).call();
        if (!infoRaw) return;

        const info: MembershipInfo = {
          level: Number(infoRaw.level),
          autoEvolve: Boolean(infoRaw.autoEvolve),
          startTimestamp: Number(infoRaw.startTimestamp),
          expirationTimestamp: Number(infoRaw.expirationTimestamp),
          totalYears: Number(infoRaw.totalYears),
          locked: Boolean(infoRaw.locked),
        };

        setMembershipInfo(info);

        // ✅ FIX : essaie TOUS les levels + fallback
        let priceWei: any = "0";
        try {
          priceWei = await contract.methods.baseEvolvePrice(info.level).call();
        } catch (levelError) {
          console.warn('⚠️ baseEvolvePrice(', info.level, ') échoue, essai level-1:', levelError);
          try {
            priceWei = await contract.methods.baseEvolvePrice(Math.max(0, info.level - 1)).call();
          } catch (fallbackError) {
            console.warn('⚠️ Fallback échoue aussi, price=0');
            priceWei = "0";
          }
        }

        setEvolvePriceEth(Number(priceWei) / 1e18);
        console.log('💰 Prix final:', Number(priceWei) / 1e18);
      } catch (e) {
        console.error("Erreur getMembershipInfo:", e);
      }
    };

    fetchMembership();
  }, [contractAddress, tokenId]);


  /* =======================
     METADATA SYNC (appelée par TokenPage)
  ======================= */

  const updateCurrentMetadata = useCallback(
    (metadata: any) => {
      if (!metadata) return;

      setCurrentMetadata(metadata);
      // snapshot stable
      lastStableMetadataRef.current = JSON.parse(JSON.stringify(metadata));

      if (onMetadataLoaded) {
        onMetadataLoaded(metadata);
      }
    },
    [onMetadataLoaded]
  );

  /* =======================
     PRÉPARATION ÉVOLUTION - BULLET-PROOF
  ======================= */

  const prepareEvolution = useCallback(async () => {
  if (isUploadingEvolve || isManualEvolveReady) {
    console.warn("⛔ Evolution déjà préparée");
    return;
  }

  if (!membershipInfo || !lastStableMetadataRef.current || !contractAddress || tokenId === undefined) {
    alert("Données d'évolution indisponibles");
    return;
  }

  const base = lastStableMetadataRef.current;

  try {
    setIsUploadingEvolve(true);

    // 🔒 SOURCE DE VÉRITÉ = BLOCKCHAIN
    const currentLevelOnChain = Number(membershipInfo.level);  // ✅ 0n → 0
    const targetLevel = currentLevelOnChain + 1;               // ✅ 1

    if (currentLevelOnChain >= 3) {
      throw new Error("Niveau max atteint (on-chain)");
    }

    // ✅ LIT DIRECT BLOCKCHAIN
    const web3 = new Web3((window as any).ethereum);
    const contract = new web3.eth.Contract(ABI as any, contractAddress);
    const currentUri: string = await contract.methods.tokenURI(tokenId).call();
    console.log("🔗 URI ACTUEL lvl N:", currentUri);

    const response = await fetch(currentUri);
    const currentMetadataJson = await response.json();
    console.log("📜 METADATA ACTUEL lvl N:", currentMetadataJson);

    console.log('🔍 IPFS ATTRS:', {
      famille: currentMetadataJson.attributes?.find((a: any) => a.trait_type === 'Famille')?.value,
      sprite: currentMetadataJson.attributes?.find((a: any) => a.trait_type === 'Sprite')?.value,
      taille: currentMetadataJson.attributes?.find((a: any) => a.trait_type === 'Taille')?.value
    });

    // 🔥 FIX : walletAddress OU account de useAuth
    const finalWallet = walletAddress || account || '0x0000000000000000000000000000000000000000';

    // ✅ APPEL CORRECT AVEC 5 PARAMS
    const evolutionData = evolutionEngine(
      currentMetadataJson,
      currentLevelOnChain,
      targetLevel,
      finalWallet,  // ✅ WALLET
      tokenId       // ✅ TOKEN_ID
    );

    setPreviewImageUrl(evolutionData.imageUrl);
    console.log('✅ ÉLU:', evolutionData.family, `${(evolutionData.evolution_score*100).toFixed(1)}%`);


    setPreviewImageUrl(evolutionData.imageUrl);
    console.log('✅ ÉLU:', evolutionData.family, `${(evolutionData.evolution_score * 100).toFixed(1)}%`);

    // ✅ HISTORIQUE BULLET-PROOF (tous formats)
    let fullEvolutionHistory: any[] = [];
    if (Array.isArray(currentMetadataJson["histoire de l'évolution"])) {
      fullEvolutionHistory = [...currentMetadataJson["histoire de l'évolution"]];
    } else if (Array.isArray(currentMetadataJson.evolutionHistory)) {
      fullEvolutionHistory = [...currentMetadataJson.evolutionHistory];
    } else if (Array.isArray(currentMetadataJson.evolution_history)) {
      fullEvolutionHistory = [...currentMetadataJson.evolution_history];
    }

    fullEvolutionHistory.push({
      niveau: currentLevelOnChain,
      uri: currentUri,
      image: base.image,
      family: currentMetadataJson.family,
      sprite_name: currentMetadataJson.sprite_name,
      horodatage: Math.floor(Date.now() / 1000),
    });

    console.log("📜 HISTORIQUE lvl N+1:", `${fullEvolutionHistory.length} entrées`);

    // 🔥 UPLOAD **IDENTIQUE ADMIN** (35+ attrs couleur)
    const pinataResult = await uploadToIPFS({
      imageUrl: evolutionData.imageUrl,                    // ✅ LVL1
      name: evolutionData.display_name || currentName,     // ✅ "Chenille X"
      bio: currentBio,
      role: currentRoleLabel,
      level: targetLevel,

      // ✅ 35+ ATTRIBUTS (comme admin !)
      attributes: evolutionData.attributes,                // Morpho LVL1
      family: evolutionData.family,                        // ✅ "chenille_verte"
      sprite_name: evolutionData.sprite_name,              // ✅ "001_chenille_verte.gif"

      // 🔥 COULEURS LVL1 (identique genInsect25)
      color_profile: evolutionData.best_profile,           // HSV, RGB, metrics

      previousImage: currentMetadataJson.image,            // IPFS LVL0
      evolutionHistory: fullEvolutionHistory               // Historique complet
    });

    console.log("✅ IPFS LVL1:", pinataResult.url);

    if (!pinataResult?.url) {
      throw new Error("Pinata sans URI");
    }

    // ✅ UI UPDATE
    const newMetadata = {
      ...base,
      level: targetLevel,
      family: evolutionData.family,
      sprite_name: evolutionData.sprite_name,
      display_name: evolutionData.display_name,
      attributes: evolutionData.attributes,
      image: evolutionData.imageUrl,
      color_profile: evolutionData.best_profile,
      evolutionHistory: fullEvolutionHistory,
      "histoire de l'évolution": fullEvolutionHistory     // Compatibilité
    };

    updateCurrentMetadata(newMetadata);
    lastStableMetadataRef.current = JSON.parse(JSON.stringify(newMetadata));
    setIsManualEvolveReady(true);

    console.log("✅ PRÊT POUR EVOLVE() - LVL1:", evolutionData.family);

  } catch (e: any) {
    console.error("❌ Erreur préparation:", e);
    alert(`Erreur évolution: ${e.message}`);
  } finally {
    setIsUploadingEvolve(false);
  }
}, [
  membershipInfo, currentName, currentBio, currentRoleLabel,
  contractAddress, tokenId, uploadToIPFS, updateCurrentMetadata,
  walletAddress, account  // 🔥 AJOUTÉS

]);

  /* =======================
     ÉVOLUTION ON-CHAIN
  ======================= */

  const evolve = useCallback(async () => {
    if (!ipfsUrl || !contractAddress || tokenId === undefined) return;

    if (!isAuthenticated || !account || !web3) {
      alert("Connectez-vous avant de faire évoluer le token");
      return;
    }

    try {
      setIsEvolving(true);
      console.log("🚀 TRANSACTION EVOLVE - NOUVEAU URI:", ipfsUrl, "via", account);

      // ✅ UNIQUEMENT web3 de useAuth() (Web3Auth/Metamask OK)
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
      console.error("❌ Erreur évolution:", e);
      alert("Erreur transaction évolution");
    } finally {
      setIsEvolving(false);
    }
  }, [ipfsUrl, contractAddress, tokenId, evolvePriceEth, account, web3, isAuthenticated]);



  const refreshEvolution = useCallback(() => {
    setPreviewImageUrl(null);
    setIsManualEvolveReady(false);
  }, []);

  /* =======================
     API PUBLIQUE (CONTRAT) - INCHANGÉE
  ======================= */

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
