// src/components/containers/home/useRescoeData.ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import haikuContractABI from '../../ABI/HaikuEditions.json';
import nftContractABI from '../../ABI/ABI_ART.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

export interface Haiku {
  poemText: string[];
  mintContractAddress: string;
  uniqueIdAssociated: string;
}

export interface Nft {
  id: string;
  image: string;
  name?: string;
  artist?: string;
  content: {
    tokenId: string;
    mintContractAddress: string;
  };
}

export interface Collection {
  id: string;
  name: string;
  collectionType: string;
  artist?: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
}

interface UseRescoeDataReturn {
  isLoading: boolean;
  collections: Collection[];
  allNfts: Nft[];
  allHaikus: Haiku[];
  nftsByCollection: Record<string, Nft[]>;
  haikusByCollection: Record<string, Haiku[]>;
  collectionsWithNfts: (Collection & { nfts: Nft[]; haikus: Haiku[] })[]; // ✅ NOUVEAU
  refetch: () => void;
}


export const useRescoeData = (): UseRescoeDataReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nftsByCollection, setNftsByCollection] = useState<Record<string, Nft[]>>({});
  const [haikusByCollection, setHaikusByCollection] = useState<Record<string, Haiku[]>>({});

  const hasFetchedCollections = useRef(false);
  const fetchedCollections = useRef(new Set());

  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  // ✅ 1. fetchCollections (inchangé - déjà parfait)
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);
    const now = new Date();
    const tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const cachedCollections = localStorage.getItem('featuredCollections');
    const cacheExpiry = localStorage.getItem('collectionsExpiry');
    const isExpired = !cacheExpiry || Number(cacheExpiry) < now.getTime();

    if (cachedCollections && !isExpired) {
      console.log('[COLLECTIONS] ✅ Cache HIT');
      setCollections(JSON.parse(cachedCollections));
      setIsLoading(false);
      return;
    }

    console.log('[COLLECTIONS] 🔄 Cache MISS → REFETCH');
    try {
      const total = await contract.getTotalCollectionsMinted();
      const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

      type CollectionTuple = [number, string, string, string, string[], boolean, boolean];
      const collectionsData = await Promise.all(
        collectionsPaginated.map(async (tuple: CollectionTuple | null) => {
          if (!tuple) return null;
          const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;
          if (!isFeatured) return null;

          const uri = await contract.getCollectionURI(id);
          let metadata = { image: '/default.png' };
          const cachedMetadata = localStorage.getItem(uri);
          if (cachedMetadata) {
            metadata = JSON.parse(cachedMetadata);
          } else {
            try {
              const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
              metadata = await response.json();
              localStorage.setItem(uri, JSON.stringify(metadata));
            } catch (e) {
              console.warn('[METADATA] Fail:', uri);
            }
          }

          return {
            id: id.toString(),
            name,
            collectionType,
            imageUrl: metadata?.image || "",
            mintContractAddress: Array.isArray(associatedAddresses) ? associatedAddresses[0] : associatedAddresses,
            isFeatured,
            creator,
          };
        })
      );

      const featured = collectionsData.filter((col): col is Collection => col !== null);
      localStorage.setItem('featuredCollections', JSON.stringify(featured));
      localStorage.setItem('collectionsExpiry', tomorrowMidnight.getTime().toString());
      console.log('[COLLECTIONS] ✅ SAVED', featured.length);
      setCollections(featured);
    } catch (error) {
      console.error("Erreur collections :", error);
    } finally {
      setIsLoading(false);
    }
  }, [contract]);

  // ✅ 2. fetchPoems (pour UNE collection)
  const fetchPoems = useCallback(async (collectionId: string, associatedAddress: string) => {
    console.log(`[POEMS] ${collectionId}`);
    try {
      const collectionContract = new Contract(associatedAddress, haikuContractABI, provider);
      const uniqueTokenCount = await collectionContract.getLastUniqueHaikusMinted();

      if (Number(uniqueTokenCount) === 0) {
        setHaikusByCollection(prev => ({ ...prev, [collectionId]: [] }));
        return;
      }

      const tokenIds = Array.from({ length: Math.min(10, Number(uniqueTokenCount)) }, (_, i) => i + 1);
      const poemsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const haikuText = await collectionContract.getTokenFullDetails(tokenId);
            if (!Array.isArray(haikuText) || haikuText.length < 7) return null;
            const uniqueIdAssociated = await collectionContract.tokenIdToHaikuId(tokenId);

            return {
              poemText: haikuText.map(text => text.toString()),
              mintContractAddress: associatedAddress,
              uniqueIdAssociated: uniqueIdAssociated.toString(),
            };
          } catch {
            return null;
          }
        })
      ).then(results => results.filter(Boolean) as Haiku[]);

      setHaikusByCollection(prev => ({ ...prev, [collectionId]: poemsData }));
      console.log(`[POEMS] ✅ ${poemsData.length} pour ${collectionId}`);
    } catch (error) {
      console.error('[POEMS] ERROR:', error);
      setHaikusByCollection(prev => ({ ...prev, [collectionId]: [] }));
    }
  }, [provider]);

  // ✅ 3. fetchNFTs (pour UNE collection)
  const fetchNFTs = useCallback(async (collectionId: string, associatedAddress: string) => {
    console.log(`[NFTs] ${collectionId}`);
    try {
      const collectionContract = new Contract(associatedAddress, nftContractABI, provider);
      let max = await collectionContract.getLastMintedTokenId();
      if (max > 9) max = 9;
      const pagination = Number(max) + 1;
      const tokenIds = await collectionContract.getTokenPaginated(0, pagination);

      const nftsPromises = tokenIds.slice(0, 12).map(async (tokenId: string) => {
        try {
          const owner = await collectionContract.ownerOf(tokenId).catch(() => null);
          if (!owner || owner === "0x0000000000000000000000000000000000000000") return null;

          let tokenURI = await collectionContract.tokenURI(tokenId);
          const cachedMetadata = localStorage.getItem(tokenURI);
          const metadata = cachedMetadata
            ? JSON.parse(cachedMetadata)
            : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

          return {
            id: tokenId,
            image: metadata.image,
            name: metadata.name,
            artist: metadata.artist || "her",
            content: { tokenId: tokenId.toString(), mintContractAddress: associatedAddress },
          };
        } catch {
          return null;
        }
      });

      const nftsResults = await Promise.all(nftsPromises);
      const nftsData = nftsResults.filter((nft): nft is Nft => nft !== null);

      setNftsByCollection(prev => ({ ...prev, [collectionId]: nftsData }));
      console.log(`[NFTs] ✅ ${nftsData.length} pour ${collectionId}`);
    } catch (error) {
      console.error('[NFTs] ERROR:', error);
      setNftsByCollection(prev => ({ ...prev, [collectionId]: [] }));
    }
  }, [provider]);

  // ✅ 4. fetchAllData (récupère TOUT d'un coup)
  const fetchAllData = useCallback(async () => {
    console.log('[RESCOE] 🔄 Fetch all data');
    fetchedCollections.current.clear();

    const artCollections = collections.filter(col => col.collectionType === 'Art').slice(0, 4);
    const poetryCollections = collections.filter(col => col.collectionType === 'Poesie').slice(0, 4);

    // NFTs en parallèle
    await Promise.all(
      artCollections.map(col => fetchNFTs(col.id, col.mintContractAddress))
    );

    // Poèmes en parallèle
    await Promise.all(
      poetryCollections.map(col => fetchPoems(col.id, col.mintContractAddress))
    );

    console.log('[RESCOE] ✅ All data fetched');
  }, [collections, fetchNFTs, fetchPoems]);

  // ✅ 5. Effets
  useEffect(() => {
    if (!hasFetchedCollections.current) {
      fetchCollections();
      hasFetchedCollections.current = true;
    }
  }, [fetchCollections]);

  useEffect(() => {
    if (collections.length > 0) {
      fetchAllData();
    }
  }, [collections.length, fetchAllData]);

  // ✅ 6. Computed values
  const allNfts = useMemo(
    () => Object.values(nftsByCollection).flat(),
    [nftsByCollection]
  );

  const allHaikus = useMemo(
    () => Object.values(haikusByCollection).flat(),
    [haikusByCollection]
  );

  // ✅ 7. Refetch manuel
  const refetch = useCallback(() => {
    hasFetchedCollections.current = false;
    fetchedCollections.current.clear();
    fetchCollections();
  }, [fetchCollections]);

  //  collectionsWithNfts (NFT + POÈMES)
  const collectionsWithNfts = useMemo(() =>
    collections.map(col => ({
      ...col,
      nfts: (nftsByCollection[col.id] || []).slice(0, 5),     // ✅ MAX 5 NFTs
      haikus: (haikusByCollection[col.id] || []).slice(0, 5), // ✅ MAX 5 Haikus
    }))
    .filter(col => col.nfts.length > 0 || col.haikus.length > 0) // NFT OU Poème
  , [collections, nftsByCollection, haikusByCollection]);

  console.log('[HOOK] collectionsWithNfts:', collectionsWithNfts.length, 'cols prêtes');


// ✅ EXPORT dans return
return {
  isLoading,
  collections,
  allNfts,
  allHaikus,
  nftsByCollection,
  haikusByCollection,
  collectionsWithNfts,  // ✅ NOUVEAU
  refetch,
};

};
