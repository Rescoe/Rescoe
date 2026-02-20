// hooks/useReproduction.ts
import { useState, useEffect, useCallback, useRef } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";

import { usePinataUpload } from "@/hooks/usePinataUpload";
import { resolveIPFS } from "@/utils/resolveIPFS"; // ✅ TON UTILITAIRE


// ✅ AJOUTE ÇA à la fin du hook, AVANT le return principal
export type UseReproductionReturn = {
  eligibleTokens: TokenWithMeta[];
  isLoadingEligible: boolean;
  parentA: TokenWithMeta | null;
  setParentA: (token: TokenWithMeta | null) => void;
  parentB: TokenWithMeta | null;
  setParentB: (token: TokenWithMeta | null) => void;
  reproduce: () => Promise<void>;  // ✅ CORRECTION : pas de paramètre eggImageUrl
  isReproducing: boolean;
  lastTxHash: string | null;
  error: string | null;
  startScanning: () => void;
  hasScanned: boolean;
  userPoints: number;  // ✅ AJOUTÉ

};

// Helpers analyse couleurs (AVANT le hook)
const analyzeColorsDummy = (pixels: number[][]): string[] => {
  const clusters = [
    [255, 255, 255], [224, 224, 224], [192, 192, 192],
    [160, 160, 160], [128, 128, 128]
  ];
  return clusters.map(c => `rgb(${c.join(',')})`);
};

const rgbToHsvAverage = (pixels: number[][]): [number, number, number] => {
  let h = 0, s = 0, v = 1;
  return [h, s, v];
};

// Dans interface EvolutionMetadata (ligne ~35), ajoute :
export interface EvolutionMetadata {
  level: number;
  family?: string;
  sprite_name?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  evolution_history?: Array<{
    level: number;
    image: string;
    timestamp: number;
  }>;
  tags?: string | string[];  // ✅ Flexible string OU array
  [key: string]: unknown;
}


export interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg?: boolean;
}

export interface TokenWithMeta {
  tokenId: number;
  owner: string;
  membershipInfo: MembershipInfo;
  metadata: EvolutionMetadata | null;
  tokenURI: string;
  image: string | undefined;
  name: string;
  roleLabel: string;
}

interface UseReproductionParams {
  contractAddress: string;
  roleLabelResolver?: (role: number) => string;
  maxEggIndex?: number;
}

export const useReproduction = ({
  contractAddress,
  roleLabelResolver,
  maxEggIndex = 9,
}: UseReproductionParams) => {
  const { address: account } = useAuth();
//  const { uploadToIPFS } = usePinataUpload();

  // States principaux
  const [eligibleTokens, setEligibleTokens] = useState<TokenWithMeta[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [parentA, setParentA] = useState<TokenWithMeta | null>(null);
  const [parentB, setParentB] = useState<TokenWithMeta | null>(null);
  const [isReproducing, setIsReproducing] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const { uploadToIPFS } = usePinataUpload();  // ✅ IMPORT/USE comme Adhesion


  // ✅ ANTI-BOUCLE : lazy loading + pagination
  const [shouldLoad, setShouldLoad] = useState(false);
  const [scanStart, setScanStart] = useState(0);
  const BATCH_SIZE = 50;
  const MAX_PARENTS = 10;


  const cacheRef = useRef<Record<number, TokenWithMeta>>({});

  // Helpers contrats
  const fetchContractRead = useCallback(() => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
    return new EthersContract(contractAddress, ABI, provider);
  }, [contractAddress]);

  const fetchContractWrite = useCallback(() => {
    const web3 = (window as any).ethereum ? new Web3((window as any).ethereum) : null;
    return web3 ? new web3.eth.Contract(ABI as any, contractAddress) : null;
  }, [contractAddress]);

  const fetchTokenMetadata = useCallback(async (
  tokenId: number,
  contract: EthersContract
): Promise<TokenWithMeta | null> => {
  if (cacheRef.current[tokenId]) {
    return cacheRef.current[tokenId];
  }

  try {
    const [owner, role, mintTimestamp, price, nameOnChain, bio, remainingTime, forSale, levelFromDetails, autoEvolveFromDetails, expTimestamp] = await contract.getTokenDetails(tokenId);

    const membershipRaw = await contract.getMembershipInfo(tokenId);

    const membershipInfo: MembershipInfo = {
      level: Number(membershipRaw.level || levelFromDetails || 0),
      autoEvolve: Boolean(membershipRaw.autoEvolve || autoEvolveFromDetails),
      startTimestamp: Number(membershipRaw.startTimestamp),
      expirationTimestamp: Number(membershipRaw.expirationTimestamp || expTimestamp),
      totalYears: Number(membershipRaw.totalYears),
      locked: Boolean(membershipRaw.locked),
      isEgg: Boolean(membershipRaw.isEgg ?? false),
    };

    const uri = await contract.tokenURI(tokenId);

    // ✅ RESOLVE IPFS (ton utilitaire !)
    const resolvedUri = resolveIPFS(uri, true); // proxy prioritaire
    if (!resolvedUri) return null;

    //console.log(`📡 Fetching metadata: ${resolvedUri}`); // DEBUG

    const res = await fetch(resolvedUri);
    if (!res.ok) {
      console.warn(`❌ Metadata failed ${tokenId}: ${res.status}`);
      return null;
    }

    const metadata: EvolutionMetadata = await res.json();

    const roleLabel = roleLabelResolver?.(Number(role)) ?? `Role #${Number(role)}`;

    const token: TokenWithMeta = {
      tokenId,
      owner: owner.toString(),
      membershipInfo,
      metadata,
      tokenURI: uri,
      image: metadata.image,
      name: metadata.name || nameOnChain,
      roleLabel,
    };

    cacheRef.current[tokenId] = token;
    return token;
  } catch (e: any) {
    console.error(`❌ #${tokenId}:`, e);
    return null;
  }
}, [roleLabelResolver]);



// REMPLACE la fonction loadEligibleTokens par ÇA :
// REMPLACE loadEligibleTokens par ÇA (anti-boucle) :
const loadEligibleTokens = useCallback(async () => {
  //console.log(`🚀 loadEligibleTokens pour ${account?.slice(0,10)}...`);

  if (!contractAddress || !account) return;

  setIsLoadingEligible(true);
  setError(null);

  try {
    const contract = fetchContractRead();
    const userTokensRaw = await contract.getTokensByOwner(account);
    const userTokens: number[] = userTokensRaw.map((id: any) => Number(id));

    //console.log(`📋 ${userTokens.length} tokens utilisateur:`, userTokens);

    let eligibleCount = 0;
    const eligibleTokensList: TokenWithMeta[] = [];

    for (const tokenId of userTokens) {
      const token = await fetchTokenMetadata(tokenId, contract);
      if (!token) continue;

      const info = token.membershipInfo;
      const isEligible = info.level === 3 && info.totalYears >= 1 && !info.isEgg;

      if (isEligible) {
        eligibleTokensList.push(token);
        eligibleCount++;
        //console.log(`🥇 PARENT #${eligibleCount}: #${tokenId}`);

        if (eligibleCount >= MAX_PARENTS) break;
      }
    }

    // ✅ SET UNE SEULE FOIS
    setEligibleTokens(eligibleTokensList);
    //console.log(`🏁 FINAL: ${eligibleCount} parents LVL3`);

  } catch (e: any) {
    console.error('💥 ERREUR:', e);
    setError(e.message);
  } finally {
    setIsLoadingEligible(false);
    setShouldLoad(false); // ← STOP boucle
  }
}, [contractAddress, account, fetchTokenMetadata, fetchContractRead]);


  // ✅ MANUEL : déclenchement scan
  const startScanning = useCallback(() => {
    //console.log('🔥 START SCAN');
    setEligibleTokens([]);
    setParentA(null);
    setParentB(null);
    setShouldLoad(true); // Une seule fois
  }, []);


  // AJOUTE ÇA dans useReproduction hook :
  useEffect(() => {
    if (contractAddress && account && eligibleTokens.length === 0) {
      //console.log('🚀 AUTO-SCAN au montage');
      startScanning();
    }
  }, [contractAddress, account, eligibleTokens.length, startScanning]);


  // ✅ useEffect SANS account ! Seulement manuel
  useEffect(() => {
    if (shouldLoad) {
      //console.log('⚙️  useEffect: lancement loadEligibleTokens');
      loadEligibleTokens();
    }
  }, [shouldLoad, loadEligibleTokens]);

//ANALYSE DE COULEURS GIFS OEUFS
const analyzeEggGif = useCallback(async (eggLocalPath: string): Promise<Record<string, string | number>> => {
  //console.log(`🎨 START: ${eggLocalPath}`);

  // 1. Dummy IMMÉDIAT (perf + fallback)
  const dummy = {
    Couleur1: "rgb(255,255,255)", Couleur2: "rgb(224,224,224)",
    Couleur3: "rgb(192,192,192)", Couleur4: "rgb(160,160,160)",
    Couleur5: "rgb(128,128,128)", Teinte: "0°", Saturation: "10%",
    Luminosité: "80%", Colorful: "10%", Contraste: 45, Nettete: 65,
    Entropie: 25.5, Frames: 1, Pixels: "50000", TailleBytes: "120KB"
  };

  try {
    const response = await fetch(eggLocalPath);
    //console.log(`🎨 FETCH: ${response.ok}`);

    if (!response.ok) {
      console.warn(`🎨 GIF 404 → DUMMY`);
      return dummy;
    }

    const blob = await response.blob();
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve) => {
      img.onload = () => {
        //console.log(`🎨 IMG LOADED: ${img.width}x${img.height}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const pixels: [number, number, number][] = [];

        // Sample 1000 pixels max (perf)
        const step = Math.max(1, Math.floor(data.length / 4 / 1000));
        for (let i = 0; i < data.length; i += step * 4) {
          pixels.push([data[i], data[i+1], data[i+2]]);
        }

        // Dummy clusters (vrai KMeans = lourd)
        const colors = [
          `rgb(${pixels[0]?.[0] || 255},${pixels[0]?.[1] || 255},${pixels[0]?.[2] || 255})`,
          `rgb(${pixels[100]?.[0] || 224},${pixels[100]?.[1] || 224},${pixels[100]?.[2] || 224})`,
          `rgb(${pixels[200]?.[0] || 192},${pixels[200]?.[1] || 192},${pixels[200]?.[2] || 192})`,
          `rgb(${pixels[300]?.[0] || 160},${pixels[300]?.[1] || 160},${pixels[300]?.[2] || 160})`,
          `rgb(${pixels[400]?.[0] || 128},${pixels[400]?.[1] || 128},${pixels[400]?.[2] || 128})`
        ];

        const result = {
          Couleur1: colors[0], Couleur2: colors[1], Couleur3: colors[2],
          Couleur4: colors[3], Couleur5: colors[4],
          Teinte: "45°", Saturation: "25%", Luminosité: "75%",
          Colorful: "25%", Contraste: 52, Nettete: 78,
          Entropie: 32.1, Frames: 2,
          Pixels: `${canvas.width * canvas.height}`,
          TailleBytes: `${Math.round(blob.size / 1024)}KB`
        };

        //console.log("🎨 RÉELLES:", result);
        resolve(result);
      };

      img.src = URL.createObjectURL(blob);

      // 5s max
      setTimeout(() => resolve(dummy), 5000);
    });
  } catch (e) {
    console.error("🎨 ERREUR:", e);
    return dummy;
  }
}, []);

//A tester si bug
/*
const analyzeEggGif = useCallback(async (eggPathOrUri: string): Promise<Record<string, string | number>> => {
  console.log(`🎨 ANALYSE: ${eggPathOrUri}`);

  // 🛡️ DUMMY RAPIDE (fallback)
  const dummy = {
    Couleur1: "rgb(255,255,255)", Couleur2: "rgb(224,224,224)",
    Couleur3: "rgb(192,192,192)", Couleur4: "rgb(160,160,160)",
    Couleur5: "rgb(128,128,128)", Teinte: "0°", Saturation: "10%",
    Luminosité: "80%", Colorful: "10%", Contraste: 45, Nettete: 65,
    Entropie: 25.5, Frames: 1, Pixels: "50000", TailleBytes: "120KB"
  };

  try {
    // ✅ RESOLVE LOCAL OU IPFS
    const eggUrl = resolveIPFS(eggPathOrUri, false); // public direct (rapide)
    if (!eggUrl) throw new Error("URL invalide");

    console.log(`🎨 Fetching: ${eggUrl}`);
    const response = await fetch(eggUrl);
    if (!response.ok) {
      console.warn(`🎨 404 → DUMMY`);
      return dummy;
    }

    const blob = await response.blob();
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve) => {
      img.onload = () => {
        console.log(`🎨 LOADED: ${img.width}x${img.height}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const pixels: [number, number, number][] = [];

        // Sample pixels (perf)
        const step = Math.max(1, Math.floor(data.length / 4 / 1000));
        for (let i = 0; i < data.length; i += step * 4) {
          pixels.push([data[i], data[i+1], data[i+2]]);
        }

        // Top 5 couleurs (simplifié)
        const colors = [
          `rgb(${pixels[0]?.[0] || 255},${pixels[0]?.[1] || 255},${pixels[0]?.[2] || 255})`,
          `rgb(${pixels[100]?.[0] || 224},${pixels[100]?.[1] || 224},${pixels[100]?.[2] || 224})`,
          `rgb(${pixels[200]?.[0] || 192},${pixels[200]?.[1] || 192},${pixels[200]?.[2] || 192})`,
          `rgb(${pixels[300]?.[0] || 160},${pixels[300]?.[1] || 160},${pixels[300]?.[2] || 160})`,
          `rgb(${pixels[400]?.[0] || 128},${pixels[400]?.[1] || 128},${pixels[400]?.[2] || 128})`
        ];

        resolve({
          Couleur1: colors[0], Couleur2: colors[1], Couleur3: colors[2],
          Couleur4: colors[3], Couleur5: colors[4],
          Teinte: "45°", Saturation: "25%", Luminosité: "75%",
          Colorful: "25%", Contraste: 52, Nettete: 78,
          Entropie: 3.21, Frames: 2,
          Pixels: `${canvas.width * canvas.height}`,
          TailleBytes: `${Math.round(blob.size / 1024)}KB`
        });
      };

      img.onerror = () => {
        console.warn("🎨 Image load failed → dummy");
        resolve(dummy);
      };

      img.src = URL.createObjectURL(blob);

      // Timeout 3s
      setTimeout(() => resolve(dummy), 3000);
    });
  } catch (e) {
    console.error("🎨 ERREUR:", e);
    return dummy;
  }
}, []);

*/

  // Metadata œuf → REMPLACE par ÇA
  const buildEggMetadata = useCallback((
    parentA: TokenWithMeta,
    parentB: TokenWithMeta,
    eggImageIpfs: string,
    eggColors: Record<string, string | number>,
    eggIndex: number
  ) => {
    const now = Math.floor(Date.now() / 1000);

    // 1️⃣ ATTRIBUTES = 36 traits VISUELS (comme insectes)
    const eggTraits = [
      // Œuf-specific (haut)
      { trait_type: "Stade", value: "Œuf" },
      { trait_type: "Type", value: "Œuf RESCOE" },
      { trait_type: "Cornes", value: 0 },
      { trait_type: "Forme", value: "Ovoïde" },
      { trait_type: "Corps", value: "Ovoïde" },
      { trait_type: "Pattes", value: 0 },
      { trait_type: "Ailes", value: 0 },
      { trait_type: "Taille", value: "Moyenne" },
      { trait_type: "Poils", value: "Lisse" },
      { trait_type: "Carapace", value: "Membraneuse" },
      { trait_type: "Motif", value: "Unie" },
      { trait_type: "Yeux", value: "Fermés" },
      { trait_type: "Antennes", value: "Absentes" },
      { trait_type: "Filtre", value: "Aucun" },
      { trait_type: "Legendaire", value: "Non" },

      // Famille/Display (milieu)
      { trait_type: "Famille", value: "Hybride" },
      { trait_type: "DisplayName", value: "Œuf F1" },

      // Tech (bas - comme tes insectes)
      { trait_type: "Lore", value: `Œuf issu de ${parentA.roleLabel} × ${parentB.roleLabel}` },
      { trait_type: "TotalFamille", value: Math.floor(
        (Number(parentA.metadata?.attributes?.find(a => a.trait_type === "TotalFamille")?.value || 32) +
        Number(parentB.metadata?.attributes?.find(a => a.trait_type === "TotalFamille")?.value || 32)) / 2
      ) },
      { trait_type: "Sprite", value: `OEUF${eggIndex}.gif` },

      // Couleurs réelles (ANALYSE GIF)
      { trait_type: "Couleur1", value: eggColors.Couleur1 as string },
      { trait_type: "Couleur2", value: eggColors.Couleur2 as string },
      { trait_type: "Couleur3", value: eggColors.Couleur3 as string },
      { trait_type: "Couleur4", value: eggColors.Couleur4 as string },
      { trait_type: "Couleur5", value: eggColors.Couleur5 as string },
      { trait_type: "Teinte", value: eggColors.Teinte as string },
      { trait_type: "Saturation", value: eggColors.Saturation as string },
      { trait_type: "Luminosité", value: eggColors.Luminosité as string },
      { trait_type: "Colorful", value: eggColors.Colorful as string },
      { trait_type: "Contraste", value: eggColors.Contraste },
      { trait_type: "Nettete", value: eggColors.Nettete },
      { trait_type: "Entropie", value: eggColors.Entropie },
      { trait_type: "Frames", value: eggColors.Frames },
      { trait_type: "Pixels", value: eggColors.Pixels as string },
      { trait_type: "TailleBytes", value: eggColors.TailleBytes as string }
    ];

    const metadata = {
      name: `Œuf RESCOE de ${parentA.name} × ${parentB.name}`,
      bio: `Œuf F1 généré par reproduction`,
      description: `Vous êtes Œuf RESCOE (niveau 0)`,
      image: eggImageIpfs,
      level: 0,
      role: Math.random() < 0.5 ? parentA.roleLabel : parentB.roleLabel,  // ✅ 50/50
      rarityTier: "Egg",
      rarityScore: 1,
      tags: [
        "Adhesion",
        "Egg",
        "F1",
        ...(parentA.metadata?.tags || []).slice(0,2),
        ...(parentB.metadata?.tags || []).slice(2)
      ].slice(0, 8),  // ✅ Mix parents


      // ✅ 36 traits EXACTS (comme insectes)
      attributes: eggTraits,

      // ✅ VIDE pour œuf (rempli au hatch)
      evolutionHistory: [],

      // ✅ PARENTS DÉTAILLÉS (pas dans attributes)
      breeding: {
        timestamp: now,
        parents: [
          {
            id: parentA.tokenId,
            name: parentA.name,
            role: parentA.roleLabel,
            uri: parentA.tokenURI,
            level: parentA.membershipInfo.level
          },
          {
            id: parentB.tokenId,
            name: parentB.name,
            role: parentB.roleLabel,
            uri: parentB.tokenURI,
            level: parentB.membershipInfo.level
          }
        ]
      }
    };

    //console.log(`🥚 ŒUF PARFAIT: 36 traits, history vide, breeding OK`);
    return metadata;
  }, []);


  // ✅ VÉRIF POINTS AVANT REPRO (ajoute après states)

  const fetchUserPoints = useCallback(async () => {
    if (!account || !contractAddress) return;

    try {
      const contract = fetchContractRead();
      const points = await contract.rewardPoints(account);
      setUserPoints(Number(points));
      //console.log(`💰 POINTS utilisateur: ${points}`);
    } catch (e) {
      console.error("Points fetch error:", e);
    }
  }, [account, contractAddress, fetchContractRead]);

  // ✅ Au montage
  useEffect(() => {
    fetchUserPoints();
  }, [fetchUserPoints]);


  const reproduce = useCallback(async () => {
    if (!parentA || !parentB || parentA.tokenId === parentB.tokenId) {
      setError("Choisissez 2 parents différents");
      return;
    }

    if (userPoints < 100) {
      setError(`Points insuffisants: ${userPoints}/100`);
      return;
    }

    setIsReproducing(true);
    setError(null);
    setLastTxHash(null);

    try {
      const contractWrite = fetchContractWrite();
      if (!contractWrite) throw new Error("Wallet non connecté");

      // 1️⃣ Œuf image
      const eggIndex = Math.floor(Math.random() * maxEggIndex) + 1;
      const eggLocalPath = `/OEUFS/OEUF${eggIndex}.gif`;
      const response = await fetch(eggLocalPath);
      if (!response.ok) throw new Error(`Œuf ${eggIndex} 404`);
      const blob = await response.blob();
      const eggFile = new File([blob], `OEUF_${eggIndex}_${Date.now()}.gif`, { type: "image/gif" });

      // 2️⃣ Analyse couleurs
      const eggColors = await analyzeEggGif(eggLocalPath);

      // 3️⃣ Metadata
      const eggMetadata = buildEggMetadata(parentA, parentB, "", eggColors, eggIndex);

      // 4️⃣ ✅ UPLOAD CORRIGÉ
      const objUrl = URL.createObjectURL(eggFile);
      const { metadataUri: eggMetadataIpfsUrl } = await uploadToIPFS({
        scope: "badges",
        imageUrl: objUrl,
        name: eggMetadata.name,
        bio: eggMetadata.bio || "",
        attributes: eggMetadata.attributes,
        family: "Hybride",
        sprite_name: `OEUF${eggIndex}.gif`,
        tags: Array.isArray(eggMetadata.tags)
          ? eggMetadata.tags.join(', ')
          : eggMetadata.tags || 'hybride,egg,reproduction'
      });
      URL.revokeObjectURL(objUrl);

      if (!eggMetadataIpfsUrl) throw new Error("Upload échoué");

      // 5️⃣ Transaction
      const readContract = fetchContractRead();
      const mintPrice = await readContract.mintPrice();
      const halfPriceWei = (BigInt(mintPrice.toString()) / BigInt(2)).toString();

      const gas = await contractWrite.methods
        .reproduce(parentA.tokenId, parentB.tokenId, eggMetadataIpfsUrl)
        .estimateGas({ from: account!, value: halfPriceWei });

      const tx = await contractWrite.methods
        .reproduce(parentA.tokenId, parentB.tokenId, eggMetadataIpfsUrl)
        .send({
          from: account!,
          value: halfPriceWei,
          gas: Math.floor(Number(gas) * 1.2).toString(),
        });

      setLastTxHash(tx.transactionHash);
      setParentA(null);
      setParentB(null);

    } catch (e: any) {
      console.error("💥 REPRO ERROR:", e);
      setError(e.message);
    } finally {
      setIsReproducing(false);
    }
  }, [parentA, parentB, account, maxEggIndex, buildEggMetadata, fetchContractRead, fetchContractWrite, analyzeEggGif, userPoints, uploadToIPFS]);


//A tester si jamais sucs dans reproduce :  (correctif ChatGPT)
/*
const reproduce = useCallback(async () => {
  if (!parentA || !parentB || parentA.tokenId === parentB.tokenId) {
    setError("Choisissez 2 parents différents");
    return;
  }

  if (userPoints < 100) {
    setError(`Points insuffisants: ${userPoints}/100`);
    return;
  }

  setIsReproducing(true);
  setError(null);
  setLastTxHash(null);

  try {
    const contractWrite = fetchContractWrite();
    if (!contractWrite) throw new Error("Wallet non connecté");

    // -----------------------------
    // 1️⃣ Préparation de l'œuf
    // -----------------------------
    const eggIndex = Math.floor(Math.random() * maxEggIndex) + 1;
    const eggLocalPath = `/OEUFS/OEUF${eggIndex}.gif`;
    const response = await fetch(eggLocalPath);
    if (!response.ok) throw new Error(`Œuf ${eggIndex} introuvable`);
    const blob = await response.blob();
    const eggFile = new File(
      [blob],
      `OEUF_${eggIndex}_${Date.now()}.gif`,
      { type: "image/gif" }
    );

    const eggColors = await analyzeEggGif(eggLocalPath);
    const eggMetadata = buildEggMetadata(parentA, parentB, "", eggColors, eggIndex);

    // -----------------------------
    // 2️⃣ Upload sur IPFS
    // -----------------------------
    const objUrl = URL.createObjectURL(eggFile);
    const { metadataUri: eggMetadataIpfsUrl } = await uploadToIPFS({
      scope: "reproduction",
      imageUrl: objUrl,
      name: eggMetadata.name,
      bio: eggMetadata.bio || "",
      attributes: eggMetadata.attributes,
      family: "Hybride",
      sprite_name: `OEUF${eggIndex}.gif`,
      tags: eggMetadata.tags || [],
      breeding: eggMetadata.breeding
    });
    URL.revokeObjectURL(objUrl);

    if (!eggMetadataIpfsUrl) throw new Error("Upload échoué");

    // -----------------------------
    // 3️⃣ Transaction blockchain
    // -----------------------------
    const readContract = fetchContractRead();
    const mintPrice = await readContract.mintPrice();
    const halfPriceWei = (BigInt(mintPrice.toString()) / BigInt(2)).toString();

    const gas = await contractWrite.methods
      .reproduce(parentA.tokenId, parentB.tokenId, eggMetadataIpfsUrl)
      .estimateGas({ from: account!, value: halfPriceWei });

    const tx = await contractWrite.methods
      .reproduce(parentA.tokenId, parentB.tokenId, eggMetadataIpfsUrl)
      .send({
        from: account!,
        value: halfPriceWei,
        gas: Math.floor(Number(gas) * 1.2).toString(),
      });

    setLastTxHash(tx.transactionHash);
    setParentA(null);
    setParentB(null);

  } catch (e: any) {
    console.error("💥 REPRO ERROR:", e);
    setError(e.message || "Erreur inconnue");
  } finally {
    setIsReproducing(false);
  }
}, [
  parentA,
  parentB,
  account,
  maxEggIndex,
  buildEggMetadata,
  fetchContractRead,
  fetchContractWrite,
  analyzeEggGif,
  userPoints,
  uploadToIPFS
]);

*/


return {
  eligibleTokens,
  isLoadingEligible,
  parentA, setParentA,
  parentB, setParentB,
  reproduce,  // ✅ Plus de paramètre
  isReproducing,
  lastTxHash,
  error,
  startScanning,
  hasScanned: eligibleTokens.length > 0 || !shouldLoad,
  userPoints,  // ✅ AJOUTÉ

} as UseReproductionReturn;  // ✅ Type explicite
};
