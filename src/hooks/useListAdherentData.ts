// src/hooks/useAdherentFullData.ts
import { useEffect, useState } from "react";
import { JsonRpcProvider, Contract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import ABI_ADHESION_MANAGEMENT from "@/components/ABI/ABI_ADHESION_MANAGEMENT.json";
import { fetchENS, fetchAdhesionPoints, fetchNFTs, fetchStatsCollection } from "@/utils/dashboardFetcher";

const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const providerUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

export interface AdherentNFT {
  tokenId: number;
  role: string;
  image: string;
  finAdhesion: string;
}

export interface AdherentFullData {
  address: string;
  name: string;
  biography: string;
  roles: string[];
  finAdhesion: string;
  nfts: AdherentNFT[];

  // Données "dashboard"
  ensName?: string | null;
  rewardPoints?: number;
  userCollections?: number;
  remainingCollections?: number;
  collections?: any[];
}

export const useAdherentFullData = (addresses?: string[]) => {
  const [data, setData] = useState<Record<string, AdherentFullData | null>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!addresses || addresses.length === 0) return;

    const fetchAll = async () => {
      setLoading(true);
      const provider = new JsonRpcProvider(providerUrl);
      const contract = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
      const contractAdhesionInstance = new Contract(contractAdhesion, ABI, provider);

      try {
        const results = await Promise.all(
          addresses.map(async (addr) => {
            try {
              // 🧱 Étape 1 : récupère les tokens d’adhésion
              const tokenIds: number[] = await contract.getTokensByOwnerPaginated(addr, 0, 100);

              if (!tokenIds || tokenIds.length === 0) {
                return [addr, null];
              }

              // 🧱 Étape 2 : infos utilisateur (on-chain)
              const userInfos = await contractAdhesionInstance.getUserInfo(addr);

              const fetchedRolesAndImages = await Promise.all(
                tokenIds.map(async (tokenId: number) => {
                  const fullDatas = await contractAdhesionInstance.getTokenDetails(tokenId);
                  const mintTimestamp = Number(fullDatas[2]);
                  const finAdhesion = new Date(
                    (mintTimestamp + 365 * 24 * 60 * 60) * 1000
                  ).toLocaleDateString("fr-FR");

                  const tokenURI = await contractAdhesionInstance.tokenURI(tokenId);
                  const response = await fetch(tokenURI);
                  const metadata = await response.json();

                  return {
                    role: metadata.role,
                    image: metadata.image,
                    tokenId: Number(tokenId),
                    finAdhesion,
                  };
                })
              );

              // 🧱 Étape 3 : en parallèle -> dashboard data
              const [ensName, rewardPoints, nfts, stats] = await Promise.all([
                fetchENS(addr),
                fetchAdhesionPoints(addr),
                fetchNFTs(addr),
                fetchStatsCollection(addr),
              ]);

              // 🧱 Étape 4 : fusion des données
              const adherentFull: AdherentFullData = {
                address: addr,
                name: userInfos.name,
                biography: userInfos.bio,
                roles: fetchedRolesAndImages.map((r) => r.role),
                finAdhesion: fetchedRolesAndImages[0]?.finAdhesion || "",
                nfts: fetchedRolesAndImages,
                ensName,
                rewardPoints,
                userCollections: stats.userCollections,
                remainingCollections: stats.remainingCollections,
                collections: stats.collections,
              };

              return [addr, adherentFull];
            } catch (err) {
              console.warn(`Erreur pour ${addr} :`, err);
              return [addr, null];
            }
          })
        );

        setData(Object.fromEntries(results));
      } catch (err: any) {
        console.error("Erreur fetchAll:", err);
        setError(err.message || "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [addresses]);

  return { data, loading, error };
};
