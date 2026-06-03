// hooks/useReproduction.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import { resolveIPFS } from "@/utils/resolveIPFS";

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

const STORAGE_ABI_MINIMAL = [
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "hasInsectImage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

export const useReproduction = ({
  contractAddress,
  roleLabelResolver = (role: number) => `Role #${role}`,
  maxEggIndex = 9,
  refreshKey = "default",
}: UseReproductionParams & { refreshKey?: string }) => {
  const { address: account, web3 } = useAuth();

  const [eligibleTokens, setEligibleTokens] = useState<TokenWithMeta[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);
  const [parentA, setParentA] = useState<TokenWithMeta | null>(null);
  const [parentB, setParentB] = useState<TokenWithMeta | null>(null);
  const [isReproducing, setIsReproducing] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [hasScannedExplicitly, setHasScannedExplicitly] = useState(false);

  const cacheRef = useRef<Record<number, TokenWithMeta>>({});
  const providerRef = useRef<JsonRpcProvider | null>(null);
  const web3Ref = useRef<Web3 | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pointsLastFetchRef = useRef<number>(0);

  const CACHE_DURATION = 5 * 60 * 1000;
  const POINTS_DEBOUNCE = 30 * 1000;
  const MAX_PARENTS = 10;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_URL_SERVER_MORALIS) {
      providerRef.current = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
    }
    if ((window as any).ethereum) {
      web3Ref.current = new Web3((window as any).ethereum);
    }
  }, []);

  const getRoleLabel = useCallback(
    (role: number): string => {
      const roles = { 0: "Artiste", 1: "Poète", 2: "Contributeur", 3: "Formateur" } as Record<number, string>;
      return roleLabelResolver?.(role) ?? roles[role] ?? `Role #${role}`;
    },
    [roleLabelResolver]
  );

  const getReadContract = useCallback(
    () => (providerRef.current ? new EthersContract(contractAddress, ABI, providerRef.current) : null),
    [contractAddress]
  );

  const getWriteContract = useCallback(() => {
    const w3 = (window as any).ethereum ? new Web3((window as any).ethereum) : null;
    return w3 ? new w3.eth.Contract(ABI as any, contractAddress) : null;
  }, [contractAddress]);

  const fetchTokenMetadata = useCallback(
    async (tokenId: number): Promise<TokenWithMeta | null> => {
      const cached = cacheRef.current[tokenId];
      if (cached && Date.now() - (cached._cachedAt || 0) < CACHE_DURATION) return cached;

      try {
        const provider = providerRef.current;
        if (!provider) return null;

        const contract = new EthersContract(contractAddress, ABI, provider);

        const [tokenDetailsRaw, membershipRaw, uri] = await Promise.all([
          contract.getTokenDetails(BigInt(tokenId)),
          contract.membershipInfo(BigInt(tokenId)),
          contract.tokenURI(BigInt(tokenId)),
        ]);

        const tokenDetails = Array.isArray(tokenDetailsRaw) ? tokenDetailsRaw : [];
        const [owner, role] = tokenDetails;

        const resolvedUri = resolveIPFS(uri, true);
        if (!resolvedUri) return null;

        const res = await fetch(resolvedUri);
        if (!res.ok) return null;

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
          name:
            typeof metadata.name === "string" && metadata.name.trim() ? metadata.name : "Unknown",
          roleLabel: getRoleLabel(Number(role)),
        };

        cacheRef.current[tokenId] = { ...token, _cachedAt: Date.now() };
        return cacheRef.current[tokenId];
      } catch (e: any) {
        console.error(`❌ #${tokenId}:`, e);
        return null;
      }
    },
    [contractAddress, getRoleLabel]
  );

  const scanEligibleTokens = useCallback(async () => {
    if (!contractAddress || !account || !providerRef.current) {
      setError("Compte ou contrat non disponible");
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoadingEligible(true);
    setError(null);

    try {
      const contract = new EthersContract(contractAddress, ABI, providerRef.current);
      const userTokensRaw = await contract.getTokensByOwner(account);
      const userTokens: number[] = userTokensRaw.map((id: any) => Number(id));

      const tokenPromises = userTokens.slice(0, 50).map(async (tokenId) => {
        const token = await fetchTokenMetadata(tokenId);
        if (!token) return null;
        const isEligible =
          token.membershipInfo.level === 3 &&
          token.membershipInfo.totalYears >= 1 &&
          !token.membershipInfo.isEgg;
        return isEligible ? token : null;
      });

      const results = await Promise.allSettled(tokenPromises);
      const eligible: TokenWithMeta[] = [];

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          eligible.push(result.value);
          if (eligible.length >= MAX_PARENTS) break;
        }
      }

      setEligibleTokens(eligible);
      setHasScannedExplicitly(true);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Erreur scan");
      }
    } finally {
      setIsLoadingEligible(false);
    }
  }, [contractAddress, account, fetchTokenMetadata]);

  useEffect(() => {
    const now = Date.now();
    if (now - pointsLastFetchRef.current < POINTS_DEBOUNCE) return;

    const fetchPoints = async () => {
      try {
        const contract = getReadContract();
        if (!contract) return;
        const points = await contract.rewardPoints(account || "");
        setUserPoints(Number(points));
        pointsLastFetchRef.current = Date.now();
      } catch (e) {
        console.error("Points fetch error:", e);
      }
    };

    if (account && contractAddress) fetchPoints();
  }, [account, contractAddress, getReadContract]);

  useEffect(() => {
    setEligibleTokens([]);
    setParentA(null);
    setParentB(null);
    setError(null);
    setHasScannedExplicitly(false);
    cacheRef.current = {};
  }, [refreshKey]);

  const startScanning = useCallback(() => {
    cacheRef.current = {};
    scanEligibleTokens();
  }, [scanEligibleTokens]);

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

      // 1. Sélection aléatoire d'un œuf (OEUF1-OEUF9)
      const eggIndex = Math.floor(Math.random() * maxEggIndex) + 1;
      const eggKey = `OEUF${eggIndex}`;

      // 2. Vérifier si le GIF de l'œuf est déjà on-chain, uploader si absent
      const insectStorageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE;
      if (insectStorageAddress && providerRef.current) {
        const storageContract = new EthersContract(
          insectStorageAddress,
          STORAGE_ABI_MINIMAL,
          providerRef.current
        );
        const exists = (await storageContract.hasInsectImage(eggKey)) as boolean;
        if (!exists) {
          const uploadRes = await fetch("/api/token/upload-egg-relayer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eggIndex }),
          });
          if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            throw new Error(errData.error || "Erreur upload œuf");
          }
        }
      }

      // 3. Lire mintPrice et préparer la transaction
      const readContract = getReadContract();
      const mintPrice = await readContract!.mintPrice();
      const halfPriceWei = (BigInt(mintPrice.toString()) / BigInt(2)).toString();

      // 4. Estimer le gas avec encodeFunctionData
      const iface = new EthersContract(contractAddress, ABI, providerRef.current!).interface;
      const txData = iface.encodeFunctionData("reproduce", [
        BigInt(parentA.tokenId),
        BigInt(parentB.tokenId),
        eggIndex,
      ]);

      let gasEstimate: bigint;
      try {
        gasEstimate = await providerRef.current!.estimateGas({
          from: account!,
          to: contractAddress,
          value: BigInt(halfPriceWei),
          data: txData,
        });
      } catch (gasErr: any) {
        throw new Error(
          gasErr?.reason ||
          gasErr?.message ||
          gasErr?.info?.error?.message ||
          "estimateGas échoué"
        );
      }

      if (!web3) throw new Error("Web3 non disponible");

      const gasPrice = await web3.eth.getGasPrice();
      const safeGas = ((gasEstimate * 120n) / 100n).toString();

      // 5. Envoyer la transaction reproduce(parentA, parentB, eggIndex)
      const tx = await contractWrite.methods
        .reproduce(BigInt(parentA.tokenId), BigInt(parentB.tokenId), eggIndex)
        .send({
          from: account!,
          value: halfPriceWei,
          gas: safeGas,
          gasPrice: gasPrice.toString(),
        });

      setLastTxHash(tx?.transactionHash ?? null);
      setParentA(null);
      setParentB(null);
      startScanning();
    } catch (e: any) {
      console.error("💥 REPRO ERROR:", e);
      setError(e.message || "Erreur reproduction");
    } finally {
      setIsReproducing(false);
    }
  }, [parentA, parentB, account, userPoints, maxEggIndex, contractAddress, getReadContract, getWriteContract, startScanning, web3]);

  const hasScanned = useMemo(
    () => hasScannedExplicitly || eligibleTokens.length > 0,
    [hasScannedExplicitly, eligibleTokens.length]
  );

  return {
    eligibleTokens,
    isLoadingEligible,
    parentA,
    setParentA,
    parentB,
    setParentB,
    reproduce,
    isReproducing,
    lastTxHash,
    error,
    startScanning,
    hasScanned,
    userPoints,
  } as UseReproductionReturn;
};
