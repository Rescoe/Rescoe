// hooks/useHatchEgg.ts
import { useState, useCallback, useEffect, useRef } from "react";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import { usePinataUpload } from "./usePinataUpload";
import hatchEngine from "@/utils/hatchEngine";          // ✅ moteur dédié lvl0
import colorProfilesJson from "@/data/gif_profiles_smart_colors.json";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
}

interface TokenInfo {
  tokenId: number;
  membershipInfo: MembershipInfo;
  metadata?: any;
}

interface HatchResult {
  imageUri: string | null;
  metadataUri: string | null;
  isReady: boolean;
}

/* ------------------------------------------------------------------ */
/* HOOK                                                                */
/* ------------------------------------------------------------------ */

export const useHatchEgg = (contractAddress: string, eggTokenId: number) => {
  const { address: account, web3, isAuthenticated } = useAuth();
  const { uploadToIPFS } = usePinataUpload();

  const [isHatching, setIsHatching]   = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [txHash, setTxHash]           = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const [hatchImageUri, setHatchImageUri]       = useState<string | null>(null);
  const [hatchMetadataUri, setHatchMetadataUri] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl]   = useState<string | null>(null);
  const [isReady, setIsReady]                   = useState(false);

  const eggInfoRef = useRef<TokenInfo | null>(null);

  /* ------------------------------------------------------------------ */
  /* 1. CHARGE LES INFOS DE L'ŒUF                                       */
  /* ------------------------------------------------------------------ */
  const loadEggInfo = useCallback(async (): Promise<TokenInfo | null> => {
    if (eggInfoRef.current) return eggInfoRef.current;

    try {
      console.log('[HatchEgg] Chargement œuf #', eggTokenId);

      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
      const contract = new EthersContract(contractAddress, ABI, provider);

      const raw  = await contract.getMembershipInfo(eggTokenId);
      const info: MembershipInfo = {
        level:               Number(raw.level),
        autoEvolve:          Boolean(raw.autoEvolve),
        startTimestamp:      Number(raw.startTimestamp),
        expirationTimestamp: Number(raw.expirationTimestamp),
        totalYears:          Number(raw.totalYears),
        locked:              Boolean(raw.locked),
        isEgg:               Boolean(raw.isEgg),
      };

      console.log('[HatchEgg] MembershipInfo:', info);

      if (!info.isEgg)      throw new Error("Token n'est pas un œuf");
      if (info.level !== 0) throw new Error("Niveau invalide pour un œuf");

      const readyTime = info.startTimestamp + 120;
      const now       = Date.now() / 1000;
      if (now < readyTime) throw new Error(`Œuf pas encore prêt (${Math.ceil(readyTime - now)}s)`);

      // Metadata de l'œuf pour récupérer la famille
      const uri = await contract.tokenURI(eggTokenId);
      console.log('[HatchEgg] tokenURI:', uri);

      const cid = uri.startsWith('ipfs://')
        ? uri.replace('ipfs://', '').split('?')[0]
        : uri.replace(/^https?:\/\/[^/]+\/ipfs\//, '');

      const res = await fetch(`/api/metadata/${cid}`);
      if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
      const metadata = await res.json();
      console.log('[HatchEgg] Metadata œuf:', metadata);

      const tokenInfo = { tokenId: eggTokenId, membershipInfo: info, metadata };
      eggInfoRef.current = tokenInfo;
      return tokenInfo;
    } catch (e: any) {
      console.error('[HatchEgg] loadEggInfo error:', e.message);
      setError(e.message);
      return null;
    }
  }, [contractAddress, eggTokenId]);

  /* ------------------------------------------------------------------ */
  /* 2. PRÉPARE L'ÉCLOSION                                               */
  /*    hatchEngine → insecte lvl0                                       */
  /*    uploadToIPFS → /api/pinata/upload (scope badges, pas de 401)    */
  /* ------------------------------------------------------------------ */
  const prepareHatch = useCallback(async (): Promise<HatchResult> => {
    if (isReady && hatchMetadataUri) {
      console.log('[HatchEgg] Déjà prêt, URIs en cache');
      return { imageUri: hatchImageUri, metadataUri: hatchMetadataUri, isReady: true };
    }

    if (!account) {
      setError('Wallet non connecté');
      return { imageUri: null, metadataUri: null, isReady: false };
    }

    setIsPreparing(true);
    setError(null);

    try {
      const egg = await loadEggInfo();
      if (!egg) throw new Error("Impossible de charger les infos de l'œuf");

      const eggMeta = egg.metadata || {};

      // Famille de l'œuf
      const eggFamily: string =
        eggMeta.attributes?.find((a: any) => a.trait_type === 'Famille')?.value ||
        eggMeta.family ||
        eggMeta.family_name ||
        'Thalorydes';

      console.log('[HatchEgg] Famille œuf:', eggFamily);

      // ✅ hatchEngine — pioche un insecte lvl0 (index séparé d'evolutionEngine)
      const insect = hatchEngine(eggFamily, account, eggTokenId);
      console.log('[HatchEgg] Insecte choisi:', insect);

      setPreviewImageUrl(insect.imageUrl);

      // Profil couleur
      const familyKey    = insect.family_name as keyof typeof colorProfilesJson.families;
      const profiles     = (colorProfilesJson.families as any)[familyKey] as any[] | undefined;
      const colorProfile = insect.color_profile
        ?? profiles?.find((p) => p.filename === insect.sprite_name)
        ?? profiles?.[0]
        ?? null;

      // Attributs — même structure que useTokenEvolution
      const insectAttributes = [
        ...(insect.attributes || []),
        { trait_type: 'Famille',          value: familyKey },
        { trait_type: '1er Propriétaire', value: account },
        { trait_type: 'Insect name',      value: insect.display_name },
        { trait_type: 'Lore',             value: insect.lore || 'Insecte éclos ResCoe' },
        { trait_type: 'TotalFamille',     value: 0 },
        { trait_type: 'Sprite',           value: insect.sprite_name },
        { trait_type: 'EggOrigin',        value: eggTokenId },
      ];

      const colorAttributes = colorProfile
        ? [
            { trait_type: 'Couleur1',    value: colorProfile.dominant_colors.hex[0] },
            { trait_type: 'Couleur2',    value: colorProfile.dominant_colors.hex[1] },
            { trait_type: 'Couleur3',    value: colorProfile.dominant_colors.hex[2] },
            { trait_type: 'Couleur4',    value: colorProfile.dominant_colors.hex[3] },
            { trait_type: 'Couleur5',    value: colorProfile.dominant_colors.hex[4] },
            { trait_type: 'Teinte',      value: Math.round(colorProfile.hsv.mean[0]) + '°' },
            { trait_type: 'Saturation',  value: Math.round(colorProfile.hsv.mean[1] * 100) + '%' },
            { trait_type: 'Luminosité',  value: Math.round(colorProfile.hsv.mean[2] * 100) + '%' },
            { trait_type: 'Colorful',    value: Math.round(colorProfile.metrics.colorfulness * 100) + '%' },
            { trait_type: 'Contraste',   value: Math.round(colorProfile.metrics.contrast) },
            { trait_type: 'Nettete',     value: Math.round(colorProfile.metrics.sharpness) },
            { trait_type: 'Entropie',    value: Math.round(colorProfile.metrics.entropy * 10) / 10 },
            { trait_type: 'Frames',      value: colorProfile.frame_count },
            { trait_type: 'Pixels',      value: colorProfile.total_pixels_analyzed.toLocaleString() },
            { trait_type: 'TailleBytes', value: (colorProfile.gif_info.size_bytes / 1000).toFixed(1) + 'KB' },
          ]
        : [];

      const fullAttributes = [
        ...insectAttributes.filter((a) => a?.trait_type && a.trait_type !== 'Niveau'),
        { trait_type: 'Niveau', value: 0 },
        ...colorAttributes,
      ];

      console.log('[HatchEgg] Upload /api/pinata/upload (scope: badges) …');

      const uploadResult = await uploadToIPFS({
        scope:            'badges',
        imageUrl:         insect.imageUrl,
        name:             insect.display_name,
        bio:              '',
        role:             'Membre',
        level:            0,
        attributes:       fullAttributes,
        family:           familyKey,
        sprite_name:      insect.sprite_name,
        color_profile:    colorProfile,
        previousImage:    eggMeta.image || '',
        evolutionHistory: [],
        custom_data:      { lore: insect.lore },
      });

      console.log('[HatchEgg] Upload result:', uploadResult);

      if (!uploadResult?.metadataUri) {
        throw new Error('Upload IPFS échoué — pas de metadataUri retourné');
      }

      setHatchImageUri(uploadResult.imageUri);
      setHatchMetadataUri(uploadResult.metadataUri);
      setPreviewImageUrl(uploadResult.imageUri);
      setIsReady(true);

      return { imageUri: uploadResult.imageUri, metadataUri: uploadResult.metadataUri, isReady: true };
    } catch (e: any) {
      console.error('[HatchEgg] prepareHatch error:', e.message);
      setError(e.message);
      return { imageUri: null, metadataUri: null, isReady: false };
    } finally {
      setIsPreparing(false);
    }
  }, [account, eggTokenId, loadEggInfo, uploadToIPFS, isReady, hatchImageUri, hatchMetadataUri]);

  /* ------------------------------------------------------------------ */
  /* 3. HATCH ON-CHAIN                                                   */
  /* ------------------------------------------------------------------ */
  const hatchEgg = useCallback(async () => {
    if (!isAuthenticated || !account || !web3) {
      setError('Connexion requise');
      return;
    }

    setIsHatching(true);
    setError(null);

    try {
      const result = await prepareHatch();
      if (!result.isReady || !result.metadataUri) {
        throw new Error('Préparation échouée — impossible d\'éclore');
      }

      console.log('[HatchEgg] Envoi tx hatchEgg, metadataUri:', result.metadataUri);

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      const receipt = await contract.methods
        .hatchEgg(eggTokenId, result.metadataUri)
        .send({ from: account, value: '0', gasPrice: gasPrice.toString() });

      console.log('[HatchEgg] ✅ Tx OK:', receipt.transactionHash);

      let newTokenId: string = (Number(eggTokenId) + 1).toString();
      if (receipt.events?.EggHatched?.returnValues?.newTokenId) {
        newTokenId = receipt.events.EggHatched.returnValues.newTokenId.toString();
      } else if (receipt.events?.LevelEvolved?.returnValues?.tokenId) {
        newTokenId = receipt.events.LevelEvolved.returnValues.tokenId.toString();
      }

      console.log('[HatchEgg] Nouveau tokenId:', newTokenId);
      setTxHash(receipt.transactionHash);
    } catch (e: any) {
      console.error('[HatchEgg] hatchEgg error:', e.message);
      setError(e.message);
    } finally {
      setIsHatching(false);
    }
  }, [isAuthenticated, account, web3, contractAddress, eggTokenId, prepareHatch]);

  /* ------------------------------------------------------------------ */
  /* 4. INIT                                                             */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      const egg = await loadEggInfo();
      if (!egg) return;
      await prepareHatch();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isHatching,
    isPreparing,
    isReady,
    txHash,
    error,
    previewImageUrl,
    hatchImageUri,
    hatchMetadataUri,
    hatchEgg,
    prepareHatch,
  };
};
