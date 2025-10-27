import { ethers } from "ethers";
import ABI_ADHESION_MANAGEMENT from "@/components/ABI/ABI_ADHESION_MANAGEMENT.json";
import ABI from "@/components/ABI/ABIAdhesion.json";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";

const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const providerUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

/**
 * Récupère le nom ENS de l’utilisateur
 */
export const fetchENS = async (address: string) => {
  const cacheKey = `ens_${address}`;
  const cachedENS = localStorage.getItem(cacheKey);
  if (cachedENS) return JSON.parse(cachedENS); // Retourner les données du cache

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const ensName = await provider.lookupAddress(address);
    localStorage.setItem(cacheKey, JSON.stringify(ensName)); // Cacher les résultats
    return ensName;
  } catch (e) {
    console.warn("fetchENS error", e);
    return null;
  }
};

/**
 * Récupère la liste des NFTs de l’utilisateur (NFTs RESCOE ou œuvres)
 */
export const fetchNFTs = async (address: string) => {
  const cacheKey = `nfts_${address}`;
  const cachedNFTs = localStorage.getItem(cacheKey);
  if (cachedNFTs) return JSON.parse(cachedNFTs); // Retourner les données du cache

  try {
    const response = await fetch(`/api/getNFTs?address=${address}`);
    if (!response.ok) throw new Error("Erreur fetchNFTs");
    const data = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify(data)); // Cacher les résultats
    return data;
  } catch (e) {
    console.warn("fetchNFTs error", e);
    return [];
  }
};


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


export const fetchStatsCollection = async (address: string) => {
  const cacheKey = `statsCollection_${address}`;
  const cachedStats = localStorage.getItem(cacheKey);
  if (cachedStats) return JSON.parse(cachedStats);

  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    const userCollectionsCount = await contract.getNumberOfCollectionsByUser(address);
    const remainingCollections = await contract.getRemainingCollections(address);

    // Nettoyer chaque élément des collections
    const rawCollections = await contract.getCollectionsByUser(address);
    const collections = deepClean(rawCollections);

    const stats = {
      collections,
      userCollections: userCollectionsCount.toString(),
      remainingCollections: remainingCollections.toString(),
    };

    localStorage.setItem(cacheKey, JSON.stringify(stats));
    return stats;
  } catch (err) {
    console.error("fetchStatsCollection error:", err);
    return {
      collections: [],
      userCollections: "0",
      remainingCollections: "0",
    };
  }
};


/**
 * Récupère les points d’adhésion RESCOE de l’utilisateur
 */
 export const fetchAdhesionPoints = async (address: string) => {
   const cacheKey = `adhesionPoints_${address}`;
   const cachedPoints = localStorage.getItem(cacheKey);
   if (cachedPoints) return JSON.parse(cachedPoints); // Retourner les données du cache

   try {
     const provider = new ethers.JsonRpcProvider(providerUrl);
     const contract = new ethers.Contract(contractAdhesion, ABI, provider);
     const points = await contract.rewardPoints(address);
     const pointsNumber = Number(points); // S'assurer que c'est un nombre
     localStorage.setItem(cacheKey, JSON.stringify(pointsNumber)); // Cacher les résultats
     return pointsNumber;
   } catch (e) {
     console.warn("fetchAdhesionPoints error", e);
     return 0;
   }
 };
