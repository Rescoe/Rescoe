// hooks/useReproduction.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import { usePinataUpload } from "@/hooks/usePinataUpload";
import { resolveIPFS } from "@/utils/resolveIPFS";
import { ethers } from 'ethers';  // Pour formatEther


export type UseReproductionReturn = {
  eligibleTokens: TokenWithMeta[];
  isLoadingEligible: boolean;
  parentA: TokenWithMeta | null;
  setParentA: (token: TokenWithMeta | null) => void;
  parentB: TokenWithMeta | null;
  setParentB: (token: TokenWithMeta | null) => void;
  reproduce: () => Promise<void>;
  isReproducing: boolean;
  lastTxHash: string | null;
  error: string | null;
  startScanning: () => void;
  hasScanned: boolean;
  userPoints: number;
};


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
  tags?: string | string[];
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
  bio?: string;
  _cachedAt?: number;
}

interface UseReproductionParams {
  contractAddress: string;
  roleLabelResolver?: (role: number) => string;
  maxEggIndex?: number;
}


export const useReproduction = ({
  contractAddress,
  roleLabelResolver = (role: number) => `Role #${role}`, // ✅ DEFAULT INTERNE STABLE
  maxEggIndex = 9,
  refreshKey = 'default'
}: UseReproductionParams & { refreshKey?: string }) => {
  const { address: account, web3} = useAuth();

  const { uploadToIPFS, isUploading } = usePinataUpload();

  // 🔥 STATES
  const [eligibleTokens, setEligibleTokens] = useState<TokenWithMeta[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [parentA, setParentA] = useState<TokenWithMeta | null>(null);
  const [parentB, setParentB] = useState<TokenWithMeta | null>(null);
  const [isReproducing, setIsReproducing] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [hasScannedExplicitly, setHasScannedExplicitly] = useState(false); // ✅ NOUVEAU

  // 🔥 REFS STABLES + PERSISTANT CACHE
  const cacheRef = useRef<Record<number, TokenWithMeta>>({});
  const providerRef = useRef<JsonRpcProvider | null>(null);
  const web3Ref = useRef<Web3 | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastScanRef = useRef<number>(0);
  const pointsLastFetchRef = useRef<number>(0);

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const POINTS_DEBOUNCE = 30 * 1000; // 30s
  const MAX_PARENTS = 10;

  // 🔥 1. PROVIDERS (UNE SEULE FOIS)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_URL_SERVER_MORALIS) {
      providerRef.current = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
    }
    if ((window as any).ethereum) {
      web3Ref.current = new Web3((window as any).ethereum);
    }
  }, []);

  // 🔥 2. ROLE LABEL RESOLVER STABLE INTERNE (supprime la dépendance externe)
  const getRoleLabel = useCallback((role: number): string => {
    const roles = {
      0: 'Artiste', 1: 'Poète', 2: 'Contributeur', 3: 'Formateur'
    } as Record<number, string>;
    return roleLabelResolver?.(role) ?? roles[role] ?? `Role #${role}`;
  }, [roleLabelResolver]);

  // 🔥 3. CONTRACT HELPERS STABLES
  const getReadContract = useCallback(() => {
    if (!providerRef.current) return null;
    return new EthersContract(contractAddress, ABI, providerRef.current);
  }, [contractAddress]);

  const getWriteContract = useCallback(() => {
    const web3 = (window as any).ethereum ? new Web3((window as any).ethereum) : null;
    return web3 ? new web3.eth.Contract(ABI as any, contractAddress) : null;
  }, [contractAddress]);

  // 🔥 4. FETCH METADATA STABLE (dépendances internes uniquement)
  const fetchTokenMetadata = useCallback(async (
    tokenId: number
  ): Promise<TokenWithMeta | null> => {
    // ✅ CACHE PERSISTANT + TEMPORAL
    const cached = cacheRef.current[tokenId];
    if (cached && (Date.now() - (cached._cachedAt || 0)) < CACHE_DURATION) {
      return cached;
    }

    try {
      const provider = providerRef.current;
      if (!provider) return null;

      const contract = new EthersContract(contractAddress, ABI, provider);

      // RPC calls
      const [tokenDetailsRaw, membershipRaw, uri] = await Promise.all([
        contract.getTokenDetails(BigInt(tokenId)),
        contract.getMembershipInfo(BigInt(tokenId)),
        contract.tokenURI(BigInt(tokenId))
      ]);

      const tokenDetails = Array.isArray(tokenDetailsRaw) ? tokenDetailsRaw : [];
      const [owner, role] = tokenDetails;

      // Metadata fetch
      const resolvedUri = resolveIPFS(uri, true);
      if (!resolvedUri) return null;

      const res = await fetch(resolvedUri);
      if (!res.ok) {
        console.warn(`❌ Metadata failed #${tokenId}: ${res.status}`);
        return null;
      }

      const metadata: EvolutionMetadata = await res.json();

      const membershipInfo: MembershipInfo = {
        level: Number(membershipRaw.level || 0),
        autoEvolve: Boolean(membershipRaw.autoEvolve),
        startTimestamp: Number(membershipRaw.startTimestamp),
        expirationTimestamp: Number(membershipRaw.expirationTimestamp),
        totalYears: Number(membershipRaw.totalYears),
        locked: Boolean(membershipRaw.locked),
        isEgg: Boolean(membershipRaw.isEgg ?? false),
      };

      const token: TokenWithMeta = {
        tokenId,
        owner: owner.toString(),
        membershipInfo,
        metadata,
        tokenURI: resolvedUri,
        image: metadata.image ? resolveIPFS(metadata.image, true) : undefined,
        name: typeof metadata.name === "string" && metadata.name.trim() ? metadata.name : "Unknown",
        roleLabel: getRoleLabel(Number(role)),
      };

      // ✅ MARQUER AVEC TIMESTAMP CACHE
      cacheRef.current[tokenId] = { ...token, _cachedAt: Date.now() };
      return cacheRef.current[tokenId];
    } catch (e: any) {
      console.error(`❌ #${tokenId}:`, e);
      return null;
    }
  }, [contractAddress, getRoleLabel]); // ✅ DÉPENDANCES STABLES

  // 🔥 5. SCAN ÉLIGIBLES (séparé + explicite)
  const scanEligibleTokens = useCallback(async () => {
    if (!contractAddress || !account || !providerRef.current) {
      setError('Compte ou contrat non disponible');
      return;
    }

    // ✅ ABORT PREVIOUS
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoadingEligible(true);
    setError(null);
    lastScanRef.current = Date.now();

    try {
      const contract = new EthersContract(contractAddress, ABI, providerRef.current);
      const userTokensRaw = await contract.getTokensByOwner(account);
      const userTokens: number[] = userTokensRaw.map((id: any) => Number(id));

      const eligibleTokensList: TokenWithMeta[] = [];
      let eligibleCount = 0;

      // ✅ PARALLÈLE MAIS LIMITÉ (évite rate limits)
      const tokenPromises = userTokens.slice(0, 50).map(async (tokenId) => {
        const token = await fetchTokenMetadata(tokenId);
        if (!token) return null;

        const isEligible = token.membershipInfo.level === 3 &&
                          token.membershipInfo.totalYears >= 1 &&
                          !token.membershipInfo.isEgg;

        return isEligible ? token : null;
      });

      const results = await Promise.allSettled(tokenPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          eligibleTokensList.push(result.value);
          eligibleCount++;
          if (eligibleCount >= MAX_PARENTS) break;
        }
      }

      setEligibleTokens(eligibleTokensList.slice(0, MAX_PARENTS));
      setHasScannedExplicitly(true);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('💥 SCAN ERROR:', e);
        setError(e.message || 'Erreur scan');
      }
    } finally {
      setIsLoadingEligible(false);
    }
  }, [contractAddress, account, fetchTokenMetadata]);

  // 🔥 6. POINTS DÉBOUNCÉS (corrigé)
  useEffect(() => {
    const now = Date.now();
    if (now - pointsLastFetchRef.current < POINTS_DEBOUNCE) return;

    const fetchPoints = async () => {
      try {
        const contract = getReadContract();
        if (!contract) return;

        const points = await contract.rewardPoints(account || '');
        setUserPoints(Number(points));
        pointsLastFetchRef.current = Date.now();
      } catch (e) {
        console.error("Points fetch error:", e);
      }
    };

    if (account && contractAddress) {
      fetchPoints();
    }
  }, [account, contractAddress, getReadContract]);

  // 🔥 7. RESET SUR REFRESHKEY (léger)
  useEffect(() => {
    setEligibleTokens([]);
    setParentA(null);
    setParentB(null);
    setError(null);
    setHasScannedExplicitly(false);
    cacheRef.current = {};
  }, [refreshKey]);

  // 🔥 8. START SCANNING (simple reset + trigger)
  const startScanning = useCallback(() => {
    cacheRef.current = {}; // Reset cache seulement
    scanEligibleTokens();
  }, [scanEligibleTokens]);

  // 🔥 9. REPRODUCE (stable)
  const analyzeEggGif = useCallback(async (eggLocalPath: string): Promise<Record<string, string | number>> => {
    const dummy = {
      Couleur1: "rgb(255,255,255)", Couleur2: "rgb(224,224,224)",
      Couleur3: "rgb(192,192,192)", Couleur4: "rgb(160,160,160)",
      Couleur5: "rgb(128,128,128)", Teinte: "0°", Saturation: "10%",
      Luminosité: "80%", Colorful: "10%", Contraste: 45, Nettete: 65,
      Entropie: 25.5, Frames: 1, Pixels: "50000", TailleBytes: "120KB"
    };

    try {
      const response = await fetch(eggLocalPath);
      if (!response.ok) {
        console.warn(`🎨 GIF 404 → DUMMY`);
        return dummy;
      }

      const blob = await response.blob();
      const img = new Image();
      img.crossOrigin = 'anonymous';

      return new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          const pixels: [number, number, number][] = [];

          const step = Math.max(1, Math.floor(data.length / 4 / 1000));
          for (let i = 0; i < data.length; i += step * 4) {
            pixels.push([data[i], data[i+1], data[i+2]]);
          }

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

          resolve(result);
        };

        img.src = URL.createObjectURL(blob);
        setTimeout(() => resolve(dummy), 5000);
      });
    } catch (e) {
      console.error("🎨 ERREUR:", e);
      return dummy;
    }
  }, []);

  // 🔥 Ajoute cette fonction COMPLÈTE (copiée de l'ancienne)
  const buildEggMetadata = useCallback((
    parentA: TokenWithMeta,
    parentB: TokenWithMeta,
    eggImageIpfs: string,
    eggColors: Record<string, string | number>,
    eggIndex: number
  ) => {
    const now = Math.floor(Date.now() / 1000);

    const eggTraits = [
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
      { trait_type: "Famille", value: "Hybride" },
      { trait_type: "DisplayName", value: "Œuf F1" },
      { trait_type: "Lore", value: `Œuf issu de ${parentA.name} × ${parentB.name}, qui étaient respectivement ${parentA.roleLabel} × ${parentB.roleLabel}` },
      { trait_type: "TotalFamille", value: Math.floor(
        (Number(parentA.metadata?.attributes?.find(a => a.trait_type === "TotalFamille")?.value || 32) +
        Number(parentB.metadata?.attributes?.find(a => a.trait_type === "TotalFamille")?.value || 32)) / 2
      ) },
      { trait_type: "Sprite", value: `OEUF${eggIndex}.gif` },
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

    const chosenParent = Math.random() < 0.5 ? parentA : parentB;

    return {
      name: `Œuf RESCOE de ${chosenParent.name}`,
      bio: chosenParent.bio,
      description: `Vous êtes Œuf RESCOE (niveau 0) — ${chosenParent.bio}\n\nGénéré par la reproduction de ${parentA.name} × ${parentB.name}`,
      image: eggImageIpfs,
      level: 0,
      role: Math.random() < 0.5 ? parentA.roleLabel : parentB.roleLabel,
      rarityTier: "Egg",
      rarityScore: 1,
      tags: [
        "Adhesion", "Egg", "Oeuf",
        ...(parentA.metadata?.tags || []).slice(0,2),
        ...(parentB.metadata?.tags || []).slice(2)
      ].slice(0, 8),
      attributes: eggTraits,
      // ✅ AJOUT : Historique complet avec tokenURI des parents
      evolutionHistory: [
        {
          stage: "Birth",
          timestamp: now,
          parents: [
            {
              tokenId: parentA.tokenId,
              name: parentA.name,
              role: parentA.roleLabel,
              tokenURI: parentA.tokenURI,  // ← CRITIQUE : URI persistant
              level: parentA.membershipInfo.level
            },
            {
              tokenId: parentB.tokenId,
              name: parentB.name,
              role: parentB.roleLabel,
              tokenURI: parentB.tokenURI,  // ← CRITIQUE : URI persistant
              level: parentB.membershipInfo.level
            }
          ]
        }
      ],

      // Garde aussi breeding pour compatibilité
      breeding: {
        timestamp: now,
        parents: [
          { id: parentA.tokenId, name: parentA.name, role: parentA.roleLabel, uri: parentA.tokenURI, level: parentA.membershipInfo.level },
          { id: parentB.tokenId, name: parentB.name, role: parentB.roleLabel, uri: parentB.tokenURI, level: parentB.membershipInfo.level }
        ]
      }
    };
  }, []);

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
      const contractWrite = getWriteContract();
      if (!contractWrite) throw new Error("Wallet non connecté");

      const eggIndex = Math.floor(Math.random() * maxEggIndex) + 1;
      const eggLocalPath = `/OEUFS/OEUF${eggIndex}.gif`;

      const eggColors = await analyzeEggGif(eggLocalPath);
      const eggMetadata = buildEggMetadata(parentA, parentB, "", eggColors, eggIndex);

      // Upload IPFS (inchangé)
      const response = await fetch(eggLocalPath);
      const blob = await response.blob();
      const eggFile = new File([blob], `OEUF_${eggIndex}_${Date.now()}.gif`, { type: "image/gif" });

      const objUrl = URL.createObjectURL(eggFile);
      const uploadResult = await uploadToIPFS({
        scope: "badges",
        imageUrl: objUrl,
        name: eggMetadata.name,
        bio: eggMetadata.bio || "",
        attributes: eggMetadata.attributes,
        family: "Hybride",
        sprite_name: `OEUF${eggIndex}.gif`,
        tags: Array.isArray(eggMetadata.tags) ? eggMetadata.tags.join(', ') : eggMetadata.tags || 'hybride,egg,reproduction'
      });
      URL.revokeObjectURL(objUrl);

      const eggMetadataIpfsUrl = uploadResult.metadataUri;
      console.log(eggMetadataIpfsUrl);
      if (!eggMetadataIpfsUrl) throw new Error("Upload échoué");

      // Transaction
      const readContract = getReadContract();
      const mintPrice = await readContract!.mintPrice();
      const halfPriceWei = (BigInt(mintPrice.toString()) / BigInt(2)).toString();
      console.log("mintPrice", mintPrice);
      console.log("halfPriceWei", halfPriceWei);

/*
      // Ajoute ces lectures
      const reproduceCost = await readContract!.REPRODUCE_POINTS_COST();
      const currentYear = Math.floor(Date.now() / 1000 / (365 * 24 * 3600));
      const mintsThisYear = await readContract!.mintsPerYear(account!, currentYear);
      const maxLevel = await readContract!.MAX_LEVEL();
      const ownerA = await readContract!.ownerOf(parentA.tokenId);
      const ownerB = await readContract!.ownerOf(parentB.tokenId);
      const pointsOnChain = await readContract!.rewardPoints(account!);

      console.log({
        reproduceCost: Number(reproduceCost),
        mintsThisYear: Number(mintsThisYear),
        maxLevel: Number(maxLevel),
        ownerA: ownerA,
        ownerB: ownerB,
        pointsOnChain: Number(pointsOnChain),
        account,
      });



          //const priceInWei = web3.utils.toWei(requiredPriceEth.toString(), "ether");
          //const gasPrice = await web3.eth.getGasPrice();

          const gasEstimate = await contractWrite.methods.reproduce(BigInt(parentA.tokenId), BigInt(parentB.tokenId), eggMetadataIpfsUrl)
          .estimateGas({
            from: account,
            value: halfPriceWei,
          });


      const gas = await contractWrite.methods
        .reproduce(BigInt(parentA.tokenId), BigInt(parentB.tokenId), eggMetadataIpfsUrl)
        .estimateGas({ from: account!, value: halfPriceWei });
*/

      console.log("REPRO PARAMS", {
        account,
        parentA: parentA.tokenId,
        parentB: parentB.tokenId,
        eggMetadataIpfsUrl,
        halfPriceWei,
      });

      const iface = new EthersContract(contractAddress, ABI, providerRef.current!).interface;
      const txData = iface.encodeFunctionData("reproduce", [
        BigInt(parentA.tokenId),
        BigInt(parentB.tokenId),
        eggMetadataIpfsUrl
      ]);

      let gasEstimate: bigint;
      try {
        gasEstimate = await providerRef.current!.estimateGas({
          from: account!,
          to: contractAddress,
          value: BigInt(halfPriceWei),
          data: txData,
        });
        console.log("✅ provider estimateGas", gasEstimate.toString());
      } catch (gasErr: any) {
        console.error("❌ provider estimateGas ERROR", gasErr);
        throw new Error(
          gasErr?.reason ||
          gasErr?.message ||
          gasErr?.info?.error?.message ||
          gasErr?.data?.message ||
          "estimateGas provider échoué"
        );
      }

      if (!web3) throw new Error("Web3 non disponible");

      const gasPrice = await web3.eth.getGasPrice();
      const safeGas = ((gasEstimate * 120n) / 100n).toString();

      console.log("gasPrice", gasPrice);
      console.log("safeGas", safeGas);

      const tx = await contractWrite.methods
        .reproduce(BigInt(parentA.tokenId), BigInt(parentB.tokenId), eggMetadataIpfsUrl)
        .send({
          from: account!,
          value: halfPriceWei,
          gas: safeGas,
          gasPrice: gasPrice.toString()
        });


/*
//fonctionne sur chrome :
const readContract = getReadContract();
const mintPrice = await readContract!.mintPrice();
const halfPriceWei = (BigInt(mintPrice.toString()) / BigInt(2)).toString();
console.log("mintPrice", mintPrice);
console.log("halfPriceWei", halfPriceWei);

const method = contractWrite.methods.reproduce(
BigInt(parentA.tokenId),
BigInt(parentB.tokenId),
eggMetadataIpfsUrl
);

console.log("REPRO PARAMS", {
account,
parentA: parentA.tokenId,
parentB: parentB.tokenId,
eggMetadataIpfsUrl,
halfPriceWei,
});

try {
const callResult = await method.call({
from: account!,
value: halfPriceWei,
});
console.log("✅ reproduce.call OK", callResult);
} catch (callErr: any) {
console.error("❌ reproduce.call ERROR", callErr);
throw new Error(
callErr?.reason ||
callErr?.message ||
callErr?.data?.message ||
callErr?.data?.originalError?.message ||
"Simulation reproduce.call échouée"
);
}

let gasEstimate: bigint;
try {
gasEstimate = await method.estimateGas({
from: account!,
value: halfPriceWei,
});
console.log("✅ gasEstimate", gasEstimate.toString());
} catch (gasErr: any) {
console.error("❌ estimateGas ERROR", gasErr);
console.error("❌ estimateGas data", gasErr?.data);
throw new Error(
gasErr?.reason ||
gasErr?.message ||
gasErr?.data?.message ||
gasErr?.data?.originalError?.message ||
"estimateGas échoué"
);
}

const gasPrice = await web3.eth.getGasPrice();
console.log("gasPrice", gasPrice);

const tx = await contractWrite.methods
  .reproduce(BigInt(parentA.tokenId), BigInt(parentB.tokenId), eggMetadataIpfsUrl)
  .send({
    from: account!,
    value: halfPriceWei,
    gas: Math.floor(Number(gasEstimate) * 1).toString(),
    gasPrice: gasPrice.toString()
  });
  */



  //    setLastTxHash(tx.transactionHash);
      setParentA(null);
      setParentB(null);
      startScanning(); // Refresh
    } catch (e: any) {
      console.error("💥 REPRO ERROR:", e);
      setError(e.message || "Erreur reproduction");
    } finally {
      setIsReproducing(false);
    }
  }, [parentA, parentB, account, maxEggIndex, userPoints, getReadContract, getWriteContract,
      uploadToIPFS, analyzeEggGif, buildEggMetadata, startScanning]);

  // ✅ LOGIQUE hasScanned CORRIGÉE
  const hasScanned = useMemo(() => {
    return hasScannedExplicitly || eligibleTokens.length > 0;
  }, [hasScannedExplicitly, eligibleTokens.length]);

  return {
    eligibleTokens,
    isLoadingEligible,
    parentA, setParentA,
    parentB, setParentB,
    reproduce,
    isReproducing,
    lastTxHash,
    error,
    startScanning,
    hasScanned,
    userPoints,
  } as UseReproductionReturn;
};
