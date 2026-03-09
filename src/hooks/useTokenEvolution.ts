// hooks/useTokenEvolution.ts
import { useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import evolutionEngine from "../utils/evolutionEngine";
import { usePinataUpload } from "./usePinataUpload";
import ABI from "../components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import { useRouter } from 'next/router';
import {
  buildEvolutionHistory,
  EvolutionStep
} from '@/utils/evolutionHistory';
import { resolveIPFS } from "@/utils/resolveIPFS";


interface MembershipRaw {
  level: string | number;
  autoEvolve: boolean;
  startTimestamp: string | number;
  expirationTimestamp: string | number;
  totalYears: string | number;
  locked: boolean;
  isEgg: boolean;
  isAnnual: boolean;
}


export interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
  isAnnual: boolean;
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

  // 🔥 AJOUT : Stocker les URIs séparément
  const [evolveImageUri, setEvolveImageUri] = useState<string | null>(null);
  const [evolveMetadataUri, setEvolveMetadataUri] = useState<string | null>(null);

  const { uploadToIPFS, isUploading } = usePinataUpload();
  const { address: account, web3, isAuthenticated } = useAuth();
  const router = useRouter();

  const [hatchPriceEth, setHatchPriceEth] = useState(0);


  /* =======================
     FETCH ON-CHAIN MEMBERSHIP + PRIX EXACT
  ======================= */
  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const fetchMembership = async () => {
      try {
        const web3Instance = new Web3((window as any).ethereum);
        const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

        // Info membre
        let infoRaw: MembershipRaw = { level: '0', autoEvolve: false, startTimestamp: '0',
          expirationTimestamp: '0', totalYears: '0', locked: false, isEgg: false, isAnnual: false };

        try {
          infoRaw = await contract.methods.getMembershipInfo(tokenId).call();
        } catch (membershipErr) {
          console.warn('⚠️ getMembershipInfo échoué → fallback lvl 0:', membershipErr);
        }

        const info: MembershipInfo = {
          level: Number(infoRaw.level),
          autoEvolve: Boolean(infoRaw.autoEvolve),
          startTimestamp: Number(infoRaw.startTimestamp),
          expirationTimestamp: Number(infoRaw.expirationTimestamp),
          totalYears: Number(infoRaw.totalYears),
          locked: Boolean(infoRaw.locked),
          isEgg: Boolean(infoRaw.isEgg),
          isAnnual: Boolean(infoRaw.isAnnual),
        };

        setMembershipInfo(info);
        console.log('🧬 TOKEN INFO OK:', info);

        // ✅ PRIX EXACT = LOGIQUE CONTRAT
        let priceEth = 0;
        if (!info.isEgg) {
          try {
            const basePriceWei = await contract.methods.baseEvolvePrice(info.level).call();
            const basePrice = Number(basePriceWei);

            let finalPriceWei = basePrice;
            if (!info.autoEvolve && info.totalYears >= 1) {
              finalPriceWei = Math.floor(basePrice / 10);
            }

            priceEth = finalPriceWei / 1e18;
            setEvolvePriceEth(priceEth);
            console.log(`💰 Prix lvl${info.level}: ${priceEth.toFixed(6)} ETH
              (base:${(basePrice/1e18).toFixed(6)}, /10:${!info.autoEvolve && info.totalYears >= 1})`);
          } catch (priceErr) {
            console.error('❌ Prix fail:', priceErr);
            setEvolvePriceEth(0);
          }
        } else {
          setHatchPriceEth(0);
        }
      } catch (e) {
        console.error("❌ fetchMembership TOTAL error:", e);
        setMembershipInfo({ level: 0, autoEvolve: false, startTimestamp: 0, expirationTimestamp: 0,
          totalYears: 0, locked: false, isEgg: false, isAnnual: false });
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
      alert("Données indisponibles");
      return;
    }

    try {
      setIsUploadingEvolve(true);

      const currentLevel = Number(membershipInfo.level);
      const targetLevel = currentLevel + 1;
      if (currentLevel >= 3) throw new Error("Niveau max");

      const web3Instance = new Web3((window as any).ethereum);
      const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

      const tokenUriRaw: any = await contract.methods.tokenURI(tokenId).call();
      let tokenUri: string | null = Array.isArray(tokenUriRaw) ? tokenUriRaw[0] as string : tokenUriRaw as string;

      const resolvedTokenUri = await resolveIPFS(tokenUri!, true) as string;
      if (!resolvedTokenUri) {
        console.warn("❌ tokenUri invalide:", tokenId, tokenUri);
        return;
      }

      const response = await fetch(resolvedTokenUri);
      const currentMetadataJson = await response.json();


      /* ============================
         ATTRIBUTES → DICTIONARY
      ============================ */

      const currentAttrs = Object.fromEntries(
        (currentMetadataJson.attributes || []).map((a: any) => [a.trait_type, a.value])
      );

      const currentFamily =
        currentAttrs.Famille ||
        currentAttrs.family ||
        currentMetadataJson.family ||
        "unknown";



      /* ============================
         EVOLUTION ENGINE
      ============================ */

      const finalWallet = walletAddress || account;

      const evolutionData = evolutionEngine(
        { family: currentFamily, attributes: currentAttrs },
        currentLevel,
        targetLevel,
        finalWallet,
        tokenId
      );

      setPreviewImageUrl(evolutionData.imageUrl);



      /* ============================
         HISTORIQUE BULLET PROOF
      ============================ */

      let history: any[] = [];

      if (Array.isArray(currentMetadataJson["histoire de l'évolution"])) {
        history = [...currentMetadataJson["histoire de l'évolution"]];
      }
      else if (Array.isArray(currentMetadataJson.evolutionHistory)) {
        history = [...currentMetadataJson.evolutionHistory];
      }
      else if (Array.isArray(currentMetadataJson.evolution_history)) {
        history = [...currentMetadataJson.evolution_history];
      }

      history.push({
        niveau: currentLevel,
        uri: tokenUri,
        image: currentMetadataJson.image,
        family: currentMetadataJson.family,
        sprite_name: currentMetadataJson.sprite_name,
        horodatage: Math.floor(Date.now() / 1000)
      });



      /* ============================
         UPLOAD IPFS - 🔥 RÉCUPÉRER LES 2 URIs
      ============================ */

      const uploadResult = await uploadToIPFS({

        scope: "badges",

        imageUrl: evolutionData.imageUrl,

        name: evolutionData.display_name || currentName || "Adhésion",

        bio: currentBio || "",

        role: currentRoleLabel || "Membre",

        level: targetLevel,

        attributes: evolutionData.attributes,

        family: evolutionData.family,

        sprite_name: evolutionData.sprite_name,

        color_profile: evolutionData.color_profile,

        previousImage: currentMetadataJson.image,

        evolutionHistory: history

      });

      // 🔥 STOCKER LES DEUX URIs
      setEvolveImageUri(uploadResult.imageUri);
      setEvolveMetadataUri(uploadResult.metadataUri);
      setPreviewImageUrl(uploadResult.imageUri);



      const newMetadata = {
        ...currentMetadataJson,
        ...evolutionData,
        level: targetLevel,
        image: uploadResult.imageUri,
        evolutionHistory: history
      };

      updateCurrentMetadata(newMetadata);

      setIsManualEvolveReady(true);

    }

    catch (e: any) {

      console.error("prepareEvolution error:", e);
      alert(e.message);

    }

    finally {

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
    currentName,
    currentBio,
    currentRoleLabel,
    isUploadingEvolve,
    isManualEvolveReady
  ]);


  /* =======================
     EVOLVE ON-CHAIN - 🔥 ENVOYER LE METADATA URI
  ======================= */

  const evolve = useCallback(async () => {
    // 🔥 UTILISER metadataUri AU LIEU DE imageUri
    if (!evolveMetadataUri || !contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }

    try {
      setIsEvolving(true);

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      // 🔥 ENVOYER evolveMetadataUri AU CONTRAT
      const receipt = await contract.methods.evolve(tokenId, evolveMetadataUri).send({
        from: account,
        value: web3.utils.toWei(evolvePriceEth.toString(), "ether"),
        gasPrice: gasPrice.toString(),
      });

      console.log("✅ ÉVOLUTION OK - Gas:", receipt.gasUsed.toString());

      let newTokenId = null;

      if (receipt.events?.LevelEvolved) {
        newTokenId = receipt.events.LevelEvolved.returnValues.tokenId;
      }

      if (!newTokenId) {
        const totalSupply = await contract.methods.totalSupply().call();
        newTokenId = totalSupply;
      }

      if (!newTokenId) {
        newTokenId = (Number(tokenId) + 1).toString();
      }

      console.log("🎉 Nouveau token ID:", newTokenId);

      router.push(`/AdhesionId/${contractAddress}/${newTokenId}`);

    } catch (e) {
      console.error("❌ evolve error:", e);
      alert("Erreur transaction");
    } finally {
      setIsEvolving(false);
    }
  }, [evolveMetadataUri, contractAddress, tokenId, evolvePriceEth, account, web3, isAuthenticated]);


  const refreshEvolution = useCallback(() => {
    setPreviewImageUrl(null);
    setIsManualEvolveReady(false);
    setEvolveImageUri(null);
    setEvolveMetadataUri(null);
  }, []);


  // ✅ HATCH EGG - 🔥 AUSSI UTILISER METADATA URI
  const hatchEgg = useCallback(async () => {
    // 🔥 UTILISER metadataUri AU LIEU DE imageUri
    if (!evolveMetadataUri || !contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }

    try {
      setIsEvolving(true);
      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      // 🔥 ENVOYER evolveMetadataUri AU CONTRAT
      const receipt = await contract.methods.hatchEgg(tokenId, evolveMetadataUri).send({
        from: account,
        value: '0',
        gasPrice: gasPrice.toString(),
      });

      console.log("🥚 ÉCLOS OK:", receipt);

      let newTokenId = (Number(tokenId) + 1).toString();

      if (receipt.events?.EggHatched?.returnValues) {
        const eventData = receipt.events.EggHatched.returnValues;
        newTokenId = eventData.newTokenId?.toString() || newTokenId;
      }

      if (receipt.events?.LevelEvolved?.returnValues) {
        const eventData = receipt.events.LevelEvolved.returnValues;
        newTokenId = eventData.tokenId?.toString() || newTokenId;
      }

      router.push(`/u/dashboard`);

    } catch (e) {
      console.error("❌ hatch error:", e);
      alert("Erreur éclosion");
    } finally {
      setIsEvolving(false);
    }
  }, [evolveMetadataUri, contractAddress, tokenId, account, web3, isAuthenticated]);



  return {
    membershipInfo,
    evolvePriceEth,
    hatchPriceEth,
    isManualEvolveReady,
    evolveImageUri,           // 🔥 NOUVEAU
    evolveMetadataUri,        // 🔥 NOUVEAU
    isUploadingEvolve,
    isEvolving,
    prepareEvolution,
    evolve,
    hatchEgg,
    refreshEvolution,
    updateCurrentMetadata,
    isEgg: membershipInfo?.isEgg || false,
  };

};
