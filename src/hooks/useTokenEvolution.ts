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
} from '@/utils/evolutionHistory';  // Votre fichier

interface MembershipRaw {
  level: string | number;
  autoEvolve: boolean;
  startTimestamp: string | number;
  expirationTimestamp: string | number;
  totalYears: string | number;
  locked: boolean;
  isEgg: boolean;           // ✅ AJOUT
  isAnnual: boolean;        // ✅ AJOUT
}


export interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;           // ✅ AJOUT
  isAnnual: boolean;        // ✅ AJOUT
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

  const { uploadToIPFS, imageUri: ipfsUrl, metadataUri } = usePinataUpload();
  const { address: account, web3, isAuthenticated } = useAuth();
  const router = useRouter();

  const [hatchPriceEth, setHatchPriceEth] = useState(0);  // ✅ AJOUT


  /* =======================
     FETCH ON-CHAIN MEMBERSHIP
  ======================= */

  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const fetchMembership = async () => {
      try {
        const web3Instance = new Web3((window as any).ethereum);
        const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);

        // ✅ FIX : Try spécifique + fallback
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
        //console.log('🧬 TOKEN INFO OK:', info);

        // Prix (inchangé)
        let priceWei = "0";
        if (info.isEgg) {
          setHatchPriceEth(0);
        } else {
          try {
            priceWei = await contract.methods.baseEvolvePrice(info.level).call();
            setEvolvePriceEth(Number(priceWei) / 1e18);
          } catch {
            setEvolvePriceEth(0);
          }
        }
      } catch (e) {
        console.error("❌ fetchMembership TOTAL error:", e);
        // Fallback safe
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

      // 🔗 TOKENURI → METADATA DÉJÀ CHARGÉE (logs confirment)
      const web3Instance = new Web3((window as any).ethereum);
      const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);
      const tokenUriRaw: any = await contract.methods.tokenURI(tokenId).call();
      let tokenUri: string | null = null;

      if (Array.isArray(tokenUriRaw)) {
        tokenUri = tokenUriRaw[0] as string;
      } else if (typeof tokenUriRaw === 'string') {
        tokenUri = tokenUriRaw;
      }

      if (!tokenUri) {
        console.warn('⚠️ tokenURI invalide:', tokenUriRaw);
        return;  // Skip si pas d'URI
      }

      const response = await fetch(tokenUri);
      const currentMetadata = await response.json();
      //console.log("currentMetadata attributes[15]:", currentMetadata.attributes[15]);

      // ✅ ATTRS DICT D'ABORD
      const currentAttrs = Object.fromEntries(
        (currentMetadata.attributes || []).map((a: any) => [a.trait_type, a.value])
      );

      // ✅ PRIORITÉ : ATTRS (case sensitive)
      let currentFamily = currentAttrs.Famille ||
                         currentAttrs.family ||
                         currentAttrs.Family ||
                         currentMetadata.family ||
                         currentMetadata.famille ||
                         'unknown';

      //console.log("currentAttrs keys:", Object.keys(currentAttrs));  // Debug
      //console.log("currentFamily RAW:", currentFamily);

      /*console.log('🚀 CURRENT DIRECT:', {
        family: currentFamily,  // ✅ "Gravix"
        level: currentLevel,
        attrsKeys: Object.keys(currentAttrs).slice(0,5),
        image: currentMetadata.image?.slice(-30),
        debugFamille: currentAttrs.Famille  // "Gravix"
      });
*/
      const finalWallet = walletAddress || account || "0x0000000000000000000000000000000000";

      // 🔥 ENGINE (NO undefined → DIRECT attrs)
      const evolutionData = evolutionEngine(
        { family: currentFamily, attributes: currentAttrs }, // ✅ SANS extractIPFS
        currentLevel,
        targetLevel,
        finalWallet,
        tokenId
      );
      //console.log("evolutionData", evolutionData);

      setPreviewImageUrl(evolutionData.imageUrl);

      // 📜 HISTORIQUE (votre logique existante)
      const history = Array.isArray(currentMetadata.evolutionHistory)
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

      // ☁️ IPFS (IDENTIQUE)
      // Dans prepareEvolution, REMPLACE le bloc upload (ligne ~200)
      const pinataResult = await uploadToIPFS({
        scope: "badges",  // ✅ OBLIGATOIRE
        imageUrl: evolutionData.imageUrl,
        name: evolutionData.display_name || currentName || "Évolution Adhesion",
        bio: currentBio || "",
        role: currentRoleLabel || "Membre",
        level: targetLevel,
        attributes: evolutionData.attributes,
        family: evolutionData.family,
        sprite_name: evolutionData.sprite_name,
        color_profile: evolutionData.color_profile,
        previousImage: currentMetadata.image,
        evolutionHistory: history,
      });

      // ✅ Utilise imageUri (pas .url)
      if (!pinataResult.imageUri) {
        throw new Error("Upload IPFS image échoué");
      }

      setPreviewImageUrl(pinataResult.imageUri);  // Preview image


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
    currentName,
    currentBio,
    currentRoleLabel
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
        from: account,
        value: web3.utils.toWei(evolvePriceEth.toString(), "ether"),
        gasPrice: gasPrice.toString(),
      });

      // ✅ GESTION NOUVEAU TOKEN ID
      //console.log("✅ ÉVOLUTION OK - Gas:", receipt.gasUsed.toString());

      let newTokenId = null;

      // 1️⃣ Event LevelEvolved (PRIORITÉ)
      if (receipt.events?.LevelEvolved) {
        newTokenId = receipt.events.LevelEvolved.returnValues.tokenId;
      }

      // 2️⃣ Fallback totalSupply
      if (!newTokenId) {
        const totalSupply = await contract.methods.totalSupply().call();
        newTokenId = totalSupply;
      }

      // 3️⃣ Ultime fallback
      if (!newTokenId) {
        newTokenId = (Number(tokenId) + 1).toString();
      }

      //console.log("🎉 Nouveau token ID:", newTokenId);

      // ✅ SPA REDIRECTION
      router.push(`/AdhesionId/${contractAddress}/${newTokenId}`);

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


  // ✅ AJOUT À LA FIN (avant return)
  const hatchEgg = useCallback(async () => {
    if (!ipfsUrl || !contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }

    try {
      setIsEvolving(true);
      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      const receipt = await contract.methods.hatchEgg(tokenId, ipfsUrl).send({
        from: account,
        value: '0',  // ✅ GRATUIT
        gasPrice: gasPrice.toString(),
      });

      //console.log("🥚 ÉCLOS OK:", receipt);

      // Même logique newTokenId qu'evolve
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

      //router.push(`/AdhesionId/${contractAddress}/${newTokenId}`);
    } catch (e) {
      console.error("❌ hatch error:", e);
      alert("Erreur éclosion");
    } finally {
      setIsEvolving(false);
    }
  }, [ipfsUrl, contractAddress, tokenId, account, web3, isAuthenticated]);



  return {
    membershipInfo,
    evolvePriceEth,
    hatchPriceEth,        // ✅
    isManualEvolveReady,
    evolveIpfsUrl: ipfsUrl,     // ✅ imageUri aliasé
    metadataUri, 
    isUploadingEvolve,
    isEvolving,
    prepareEvolution,     // Utilise pour œufs ET évolutions
    evolve,               // UNIQUEMENT évolutions
    hatchEgg,             // ✅ NOUVEAU
    refreshEvolution,
    updateCurrentMetadata,
    isEgg: membershipInfo?.isEgg || false,  // ✅
  };

};
