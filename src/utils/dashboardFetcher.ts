import { ethers } from "ethers";
import ABI_ADHESION_MANAGEMENT from "@/components/ABI/ABI_ADHESION_MANAGEMENT.json";
import ABI from "@/components/ABI/ABIAdhesion.json";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";

const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const providerUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // localStorage quota atteint — on ignore silencieusement
  }
}

/**
 * Récupère le nom ENS de l’utilisateur
 */
export const fetchENS = async (address: string) => {
  const cacheKey = `ens_${address}`;
  const cached = readCache<string | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const ensName = await provider.lookupAddress(address);
    writeCache(cacheKey, ensName);
    return ensName;
  } catch (e) {
    console.warn("fetchENS error", e);
    return null;
  }
};

// Stub conservé pour compatibilité des imports existants — l'endpoint /api/getNFTs n'existe pas.
// Les appelants ignorent déjà le résultat retourné.
export const fetchNFTs = async (_address: string): Promise<any[]> => [];

// Recursively convert BigInt to string & unwrap Proxy by cloning props
function deepClean(obj: any): any {
  if (typeof obj === 'bigint') {
    // Convertir BigInt en string
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(deepClean);
  }
  if (obj && typeof obj === 'object') {
    // Si Proxy, unproxy en copiant les propriétés
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = deepClean(obj[key]);
    }
    return res;
  }
  return obj; // pour string, number, boolean, null, undefined
}


interface StatsCollection {
  collections: any[];
  userCollections: number;
  remainingCollections: number;
}

export const fetchStatsCollection = async (address: string): Promise<StatsCollection> => {
  const cacheKey = `statsCollection_${address}`;
  const cached = readCache<StatsCollection>(cacheKey);
  if (cached) return cached;

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    const userCollectionsCount = await contract.getNumberOfCollectionsByUser(address);
    const remainingCollections = await contract.getRemainingCollections(address);

    const rawCollections = await contract.getCollectionsByUser(address);
    const collections = deepClean(rawCollections);

    const stats: StatsCollection = {
      collections,
      userCollections: Number(userCollectionsCount),
      remainingCollections: Number(remainingCollections),
    };

    writeCache(cacheKey, stats);
    return stats;
  } catch (err) {
    console.error("fetchStatsCollection error:", err);
    return { collections: [], userCollections: 0, remainingCollections: 0 };
  }
};

/**
 * Récupère les points d’adhésion RESCOE de l’utilisateur
 */
export const fetchAdhesionPoints = async (address: string): Promise<number> => {
  const cacheKey = `adhesionPoints_${address}`;
  const cached = readCache<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(contractAdhesion, ABI, provider);
    const points = await contract.rewardPoints(address);
    const pointsNumber = Number(points);
    writeCache(cacheKey, pointsNumber);
    return pointsNumber;
  } catch (e) {
    console.warn("fetchAdhesionPoints error", e);
    return 0;
  }
};
