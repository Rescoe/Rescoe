// hooks/useUserCollections.ts
import { useState, useEffect } from "react";
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from "../components/ABI/ABI_Collections.json";

interface CollectionData {
  id: string;
  name: string;
  imageUrl: string;
}

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

export function useUserCollections(userAddress?: string) {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!userAddress) return;
    //console.log(userAddress);
    const fetchCollections = async () => {
      setIsLoading(true);
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
      const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

      try {
        const collectionsPaginated = await contract.getCollectionsByUser(userAddress);

        const collectionsData: CollectionData[] = await Promise.all(
          collectionsPaginated.map(async (tuple: any) => {
            const [id, name, , , , , ] = tuple; // tu peux garder les autres champs si besoin
            const uri = await contract.getCollectionURI(id);

            const cachedMetadata = localStorage.getItem(uri);
            if (cachedMetadata) {
              const metadata = JSON.parse(cachedMetadata);
              return { id: id.toString(), name, imageUrl: metadata.image };
            }

            const response = await fetch(`/api/proxyPinata_Oeuvres?ipfsHash=${uri.split("/").pop()}`);
            const metadata = await response.json();
            localStorage.setItem(uri, JSON.stringify(metadata));

            return { id: id.toString(), name, imageUrl: metadata.image };
          })
        );

        setCollections(collectionsData);
      } catch (error) {
        console.error("Erreur lors de la récupération des collections:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, [userAddress]);

  return { collections, isLoading };
}
