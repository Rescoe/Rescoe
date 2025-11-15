// src/hooks/useAdherentDataOnce.ts
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
  ensName?: string | null;
  rewardPoints?: number;
  userCollections?: number;
  remainingCollections?: number;
  collections?: any[];
}

export const useAdherentDataOnce = (address?: string) => {
  const [data, setData] = useState<AdherentFullData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      const provider = new JsonRpcProvider(providerUrl);
      const contractManager = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
      const contractAdhesionInstance = new Contract(contractAdhesion, ABI, provider);

      try {
        // 🧱 Étape 1 : tokens d’adhésion
        const tokenIds: number[] = await contractManager.getTokensByOwnerPaginated(address, 0, 100);

        if (!tokenIds || tokenIds.length === 0) {
          if (isMounted) setData(null);
          return;
        }

        // 🧱 Étape 2 : infos utilisateur on-chain
        const userInfos = await contractAdhesionInstance.getUserInfo(address);

        // 🧱 Étape 3 : détails des tokens
        const nfts: AdherentNFT[] = await Promise.all(
          tokenIds.map(async (tokenId) => {
            const tokenDetails = await contractAdhesionInstance.getTokenDetails(tokenId);
            const mintTimestamp = Number(tokenDetails[2]); // secondes
            const remainingTime = Number(await contractAdhesionInstance.getRemainingMembershipTime(tokenId)); // secondes
            const finAdhesionDate = new Date((mintTimestamp + remainingTime) * 1000);
            /*
//console.log(
  "Mint :", new Date(mintTimestamp*1000).toLocaleString("fr-FR"),
  "Fin :", finAdhesionDate.toLocaleString("fr-FR")
);
*/
            const tokenURI = await contractAdhesionInstance.tokenURI(tokenId);
            const metadata = await (await fetch(tokenURI)).json();

            return {
              tokenId,
              role: metadata.role,
              image: metadata.image,
              finAdhesion: finAdhesionDate.toLocaleDateString("fr-FR"),
            };
          })
        );

        // 🧱 Étape 4 : dashboard data en parallèle
        const [ensName, rewardPoints, fetchedNFTs, stats] = await Promise.all([
          fetchENS(address),
          fetchAdhesionPoints(address),
          fetchNFTs(address),
          fetchStatsCollection(address),
        ]);

        const fullData: AdherentFullData = {
          address,
          name: userInfos.name,
          biography: userInfos.bio,
          roles: nfts.map((t) => t.role),
          finAdhesion: nfts[0]?.finAdhesion || "",
          nfts,
          ensName,
          rewardPoints,
          userCollections: stats.userCollections,
          remainingCollections: stats.remainingCollections,
          collections: stats.collections,
        };

        if (isMounted) setData(fullData);
      } catch (err: any) {
        console.error("Erreur useAdherentDataOnce:", err);
        if (isMounted) setError(err.message || "Erreur inconnue");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [address]);

  return { data, loading, error };
};
