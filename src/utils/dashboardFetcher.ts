// src/utils/dashboardFetchers.ts
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
  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    return await provider.lookupAddress(address);
  } catch (e) {
    console.warn("fetchENS error", e);
    return null;
  }
};


/**
 * Récupère la liste des NFTs de l’utilisateur (NFTs RESCOE ou œuvres)
 */
export const fetchNFTs = async (address: string) => {
  try {
    const response = await fetch(`/api/getNFTs?address=${address}`);
    if (!response.ok) throw new Error("Erreur fetchNFTs");
    return await response.json();
  } catch (e) {
    console.warn("fetchNFTs error", e);
    return [];
  }
};

/**
 * Récupère les statistiques de collections (nombre, restantes, etc.)
 */
 export const fetchStatsCollection = async (address: string) => {
   try {
     const provider = new ethers.JsonRpcProvider(providerUrl);
     const contract = new ethers.Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

     // Nombre total de collections de l'utilisateur
     const userCollectionsCount = await contract.getNumberOfCollectionsByUser(address);
     // Nombre de collections restantes à créer
     const remainingCollections = await contract.getRemainingCollections(address);
     // Récupération des collections elles-mêmes
     const collections: any[] = await contract.getCollectionsByUser(address);

     return {
       collections,
       userCollections: Number(userCollectionsCount),
       remainingCollections: Number(remainingCollections),
     };
   } catch (err) {
     console.error("fetchStatsCollection error:", err);
     return {
       collections: [],
       userCollections: 0,
       remainingCollections: 0,
     };
   }
 };


/**
 * Récupère les points d’adhésion RESCOE de l’utilisateur
 */
export const fetchAdhesionPoints = async (address: string) => {
  try {
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const contract = new ethers.Contract(contractAdhesion, ABI, provider);
    const points = await contract.rewardPoints(address);
    return Number(points);
  } catch (e) {
    console.warn("fetchAdhesionPoints error", e);
    return 0;
  }
};
