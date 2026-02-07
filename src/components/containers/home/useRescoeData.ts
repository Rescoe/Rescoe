// src/components/containers/home/useRescoeData.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import haikuContractABI from '../../ABI/HaikuEditions.json';
import nftContractABI from '../../ABI/ABI_ART.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';

/* ------------------------------------------------------------------ */
/* CONFIG */
/* ------------------------------------------------------------------ */

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
const CACHE_TTL = 1000 * 60 * 60 * 12;

/* ------------------------------------------------------------------ */
/* CACHE UTILS (SAFE) */
/* ------------------------------------------------------------------ */

const now = () => Date.now();

function loadCacheArray<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.data)) return null;
    if (now() - parsed.timestamp > CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCache<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify({ timestamp: now(), data }));
}

/* ------------------------------------------------------------------ */
/* TYPES */
/* ------------------------------------------------------------------ */

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
  collectionsWithNfts: (Collection & { nfts: Nft[]; haikus: Haiku[] })[];
  refetch: () => void;
}

/* ------------------------------------------------------------------ */
/* HOOK */
/* ------------------------------------------------------------------ */

export const useRescoeData = (): UseRescoeDataReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nftsByCollection, setNftsByCollection] = useState<Record<string, Nft[]>>({});
  const [haikusByCollection, setHaikusByCollection] = useState<Record<string, Haiku[]>>({});

  const hasFetchedCollections = useRef(false);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  /* ------------------------------------------------------------------ */
  /* COLLECTIONS */
  /* ------------------------------------------------------------------ */

  const fetchCollections = useCallback(async () => {
    setIsLoading(true);

    // ✅ 1. hydrate depuis cache si valide
    const cached = loadCacheArray<Collection>('featured_collections');
    if (cached) setCollections(cached);

    try {
      const total = await contract.getTotalCollectionsMinted();
      const paginated = await contract.getCollectionsPaginated(0, total);

      const data = await Promise.all(
        paginated.map(async (tuple: any) => {
          if (!tuple || !tuple[6]) return null;

          const uri = await contract.getCollectionURI(tuple[0]);
          let metadata: any = {};

          try {
            const res = await fetch(`/api/proxyPinata_Oeuvres?ipfsHash=${uri.split('/').pop()}`);
            metadata = await res.json();
          } catch {}

          return {
            id: tuple[0].toString(),
            name: tuple[1],
            collectionType: tuple[2],
            artist: tuple[3],
            imageUrl: metadata.image || '/default.png',
            mintContractAddress: Array.isArray(tuple[4]) ? tuple[4][0] : tuple[4],
            isFeatured: tuple[6],
          };
        })
      );

      const featured = data.filter(Boolean) as Collection[];

      setCollections(featured);
      saveCache('featured_collections', featured);
    } catch (e) {
      console.error('[COLLECTIONS] error', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* POEMS */
  /* ------------------------------------------------------------------ */

  const fetchPoems = useCallback(async (collectionId: string, address: string) => {
    const cacheKey = `haikus_${collectionId}`;

    const cached = loadCacheArray<Haiku>(cacheKey);
    if (cached) {
      setHaikusByCollection(p => ({ ...p, [collectionId]: cached }));
      return;
    }

    try {
      const contract = new Contract(address, haikuContractABI, provider);
      const count = Number(await contract.getLastUniqueHaikusMinted());
      if (!count) return;

      const max = Math.min(5, count);
      const tokenIds = Array.from({ length: max }, (_, i) => i); // ✅ START AT 0

      const poems = (await Promise.all(
        tokenIds.map(async (id) => {
          try {
            const data = await contract.getTokenFullDetails(id);
            return {
              poemText: data.map((t: any) => t.toString()),
              mintContractAddress: address,
              uniqueIdAssociated: id.toString(),
            };
          } catch {
            return null;
          }
        })
      )).filter(Boolean) as Haiku[];

      setHaikusByCollection(p => ({ ...p, [collectionId]: poems }));
      saveCache(cacheKey, poems);
    } catch (e) {
      console.error('[POEMS] error', e);
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* NFTS */
  /* ------------------------------------------------------------------ */

  const fetchNFTs = useCallback(async (collectionId: string, address: string) => {
    const cacheKey = `nfts_${collectionId}`;

    const cached = loadCacheArray<Nft>(cacheKey);
    if (cached) {
      setNftsByCollection(p => ({ ...p, [collectionId]: cached }));
      return;
    }

    try {
      const contract = new Contract(address, nftContractABI, provider);
      let max = Number(await contract.getLastMintedTokenId());
      max = Math.min(max, 9);

      const tokenIds = Array.from({ length: max + 1 }, (_, i) => i);

      const nfts = (await Promise.all(
        tokenIds.map(async (id) => {
          try {
            const uri = await contract.tokenURI(id);
            const meta = await fetch(`/api/proxyPinata_Oeuvres?ipfsHash=${uri.split('/').pop()}`).then(r => r.json());
            return {
              id: id.toString(),
              image: meta.image,
              name: meta.name,
              artist: meta.artist,
              content: { tokenId: id.toString(), mintContractAddress: address },
            };
          } catch {
            return null;
          }
        })
      )).filter(Boolean) as Nft[];

      setNftsByCollection(p => ({ ...p, [collectionId]: nfts }));
      saveCache(cacheKey, nfts);
    } catch (e) {
      console.error('[NFTS] error', e);
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* ORCHESTRATION */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!hasFetchedCollections.current) {
      hasFetchedCollections.current = true;
      fetchCollections();
    }
  }, []);

  useEffect(() => {
    collections.forEach(col => {
      if (col.collectionType === 'Art') fetchNFTs(col.id, col.mintContractAddress);
      if (col.collectionType === 'Poesie') fetchPoems(col.id, col.mintContractAddress);
    });
  }, [collections]);

  /* ------------------------------------------------------------------ */
  /* COMPUTED (SAFE) */
  /* ------------------------------------------------------------------ */

  const allNfts = useMemo(() => Object.values(nftsByCollection).flat(), [nftsByCollection]);
  const allHaikus = useMemo(() => Object.values(haikusByCollection).flat(), [haikusByCollection]);

  const collectionsWithNfts = useMemo(
    () =>
      Array.isArray(collections)
        ? collections.map(col => ({
            ...col,
            nfts: nftsByCollection[col.id] || [],
            haikus: haikusByCollection[col.id] || [],
          }))
        : [],
    [collections, nftsByCollection, haikusByCollection]
  );

  const refetch = useCallback(() => {
    setCollections([]);
    setNftsByCollection({});
    setHaikusByCollection({});
    fetchCollections();
  }, [fetchCollections]);

  return {
    isLoading,
    collections,
    allNfts,
    allHaikus,
    nftsByCollection,
    haikusByCollection,
    collectionsWithNfts,
    refetch,
  };
};
