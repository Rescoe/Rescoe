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
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';



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
  const prepareEvolution = useCallback(async (): Promise<{
    imageUri: string | null;
    metadataUri: string | null;
    isReady: boolean;
  }> => {
    if (isUploadingEvolve || isManualEvolveReady) {
      return {
        imageUri: evolveImageUri,
        metadataUri: evolveMetadataUri,
        isReady: !!evolveMetadataUri
      };
    }

    if (!membershipInfo || !contractAddress || tokenId === undefined) {
      alert("Données indisponibles");
      return { imageUri: null, metadataUri: null, isReady: false };
    }

    try {
      setIsUploadingEvolve(true);

      const currentLevel = Number(membershipInfo.level);
      const targetLevel = currentLevel + 1;
      if (currentLevel >= 3) throw new Error("Niveau max atteint");

      // ON-CHAIN → TOKEN URI
      const web3Instance = new Web3((window as any).ethereum);
      const contract = new web3Instance.eth.Contract(ABI as any, contractAddress);
      const tokenUriRaw: any = await contract.methods.tokenURI(tokenId).call();
      const tokenUri = Array.isArray(tokenUriRaw) ? tokenUriRaw[0] as string : tokenUriRaw as string;

      // IPFS → METADATA JSON
      const resolvedTokenUri = await resolveIPFS(tokenUri, true) as string;
      if (!resolvedTokenUri) {
        console.warn("❌ tokenUri invalide:", tokenId, tokenUri);
        return { imageUri: null, metadataUri: null, isReady: false };
      }

      const response = await fetch(resolvedTokenUri);
      const currentMetadataJson = await response.json();

      // ATTRIBUTES → DICT
      const attrsDict = Object.fromEntries(
        (currentMetadataJson.attributes || []).map((a: any) => [a.trait_type, a.value])
      );

      const currentData = {
        level: currentMetadataJson.level ?? 0,
        name: currentMetadataJson.name ?? "",
        display_name: currentMetadataJson.display_name ?? "",
        family: currentMetadataJson.family ?? currentMetadataJson.family_name ?? "",
        family_name: currentMetadataJson.family_name ?? "",
        image: currentMetadataJson.image ?? "",
        full_path: currentMetadataJson.full_path ?? "",
        image_path: currentMetadataJson.image_path ?? "",
        lore: currentMetadataJson.lore ?? "",
        dominant_color: currentMetadataJson.dominant_color ?? "",
        color_rgb: currentMetadataJson.color_rgb ?? [],
        sprite_name: currentMetadataJson.sprite_name ?? "",
        total_in_family: currentMetadataJson.total_in_family ?? 0,
        evolutionHistory: currentMetadataJson.evolutionHistory || [],
        ...attrsDict,
        attributes: attrsDict, // 👈 Important pour evolutionEngine
      };

      // EVOLUTION ENGINE 🚀 - RETOURNE LES BONNES DONNÉES
      const finalWallet = walletAddress || account;
      const evolutionDataRaw = evolutionEngine(
        currentData,
        currentLevel,
        targetLevel,
        finalWallet,
        tokenId
      );

      if (!evolutionDataRaw || !evolutionDataRaw.imageUrl) {
        throw new Error("Génération évolution échouée");
      }

      console.log("✅ evolutionDataRaw COMPLET:", evolutionDataRaw);
      console.log("✅ evolutionDataRaw.lore:", evolutionDataRaw.lore);
      console.log("✅ evolutionDataRaw.display_name:", evolutionDataRaw.display_name);

      setPreviewImageUrl(evolutionDataRaw.imageUrl);

      // 🔥 UTILISER DIRECTEMENT LES DONNÉES DE evolutionEngine
      const familyKey = evolutionDataRaw.family_name as keyof typeof colorProfilesJson.families;
      const spriteFilename = evolutionDataRaw.sprite_name;
      const profiles = (colorProfilesJson.families as any)[familyKey] as any[];
      const colorProfile = profiles?.find(p => p.filename === spriteFilename) ?? profiles?.[0];

      // 👉 LES ATTRIBUTS VIENNENT DE evolutionEngine
      const insectAttributes = [
        ...(evolutionDataRaw.attributes || []),
        { trait_type: "Famille", value: familyKey },
        { trait_type: "1er Propriétaire", value: finalWallet },
        { trait_type: "Insect name", value: evolutionDataRaw.display_name || "Insecte ResCoe" },
        { trait_type: "Lore", value: evolutionDataRaw.lore || "Badge d'évolution ResCoe" }, // 👈 DU evolutionEngine
        { trait_type: "TotalFamille", value: currentData.total_in_family || 0 },
        { trait_type: "Sprite", value: spriteFilename }
      ];

      const colorAttributes = colorProfile ? [
        { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
        { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
        { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
        { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
        { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },
        { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
        { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
        { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },
        { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
        { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
        { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness) },
        { trait_type: "Entropie", value: Math.round(colorProfile.metrics.entropy * 10) / 10 },
        { trait_type: "Frames", value: colorProfile.frame_count },
        { trait_type: "Pixels", value: colorProfile.total_pixels_analyzed.toLocaleString() },
        { trait_type: "TailleBytes", value: (colorProfile.gif_info.size_bytes / 1000).toFixed(1) + "KB" }
      ] : [];

      const fullAttributes = [
        ...insectAttributes.filter(attr => attr?.trait_type && !["Niveau"].includes(attr.trait_type)),
        { trait_type: "Niveau", value: targetLevel },
        ...colorAttributes
      ];

      // HISTORIQUE
      let history = currentData.evolutionHistory || [];
      const startOfDayUTC = Math.floor(new Date(Date.now()).setUTCHours(0, 0, 0, 0) / 1000);
      history.push({
        niveau: currentLevel,
        uri: tokenUri,
        image: currentMetadataJson.image,
        family: currentData.family,
        sprite_name: currentData.sprite_name,
        horodatage: startOfDayUTC,
      });

      console.log(`🚀 ${fullAttributes.length} attributs générés`);
      console.log("✅ Lore final uploading:", evolutionDataRaw.lore);

      // 📤 UPLOAD IPFS
      const uploadResult = await uploadToIPFS({
        scope: "badges",
        imageUrl: evolutionDataRaw.imageUrl,
        name: currentName || evolutionDataRaw.display_name || "Adhesion",
        bio: currentBio || "",
        role: currentRoleLabel || "Membre",
        level: targetLevel,
        attributes: fullAttributes,
        family: familyKey,
        sprite_name: spriteFilename,
        color_profile: colorProfile,
        previousImage: currentMetadataJson.image,
        evolutionHistory: history,
        custom_data: {
          lore: evolutionDataRaw.lore,  // ✅ PARFAIT - sera dans JSON final
        }
        });

      if (!uploadResult.metadataUri) throw new Error("Upload IPFS échoué");

      setEvolveImageUri(uploadResult.imageUri);
      setEvolveMetadataUri(uploadResult.metadataUri);
      setPreviewImageUrl(uploadResult.imageUri);

      // METADATA UPDATE
      const newMetadata = {
        ...currentMetadataJson,
        level: targetLevel,
        image: uploadResult.imageUri,
        display_name: evolutionDataRaw.display_name,
        lore: evolutionDataRaw.lore, // 👈 DU evolutionEngine
        family_name: familyKey,
        sprite_name: spriteFilename,
        evolutionHistory: history,
        attributes: fullAttributes,
      };
      updateCurrentMetadata(newMetadata);
      setIsManualEvolveReady(true);

      return {
        imageUri: uploadResult.imageUri,
        metadataUri: uploadResult.metadataUri,
        isReady: true,
      };

    } catch (e: any) {
      console.error("❌ prepareEvolution:", e);
      alert(e.message || "Erreur évolution");
      return { imageUri: null, metadataUri: null, isReady: false };
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
    currentName,
    currentBio,
    currentRoleLabel,
    isUploadingEvolve,
    isManualEvolveReady,
    evolveImageUri,
    evolveMetadataUri,
    colorProfilesJson
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
    // États principaux
    membershipInfo,
    evolvePriceEth,
    hatchPriceEth,

    // États évolution
    previewImageUrl,
    isManualEvolveReady,
    evolveImageUri,
    evolveMetadataUri,
    isUploadingEvolve,
    isEvolving,

    // États œuf
    isEgg: membershipInfo?.isEgg || false,

    // 🔥 NOUVEAU : getter synchrone
    getReadyState: () => ({
      isReady: !!evolveMetadataUri && isManualEvolveReady,
      metadataUri: evolveMetadataUri || null,
      imageUri: evolveImageUri || null
    }),

    // Fonctions
    prepareEvolution,        // ✅ MAINTENANT retourne Promise<{imageUri, metadataUri, isReady}>
    evolve,                  // utilise evolveMetadataUri interne
    hatchEgg,
    refreshEvolution,
    updateCurrentMetadata
  };


};
