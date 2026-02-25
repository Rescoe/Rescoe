// src/components/containers/home/useRescoeData.ts

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import haikuContractABI from '../../ABI/HaikuEditions.json';
import nftContractABI from '../../ABI/ABI_ART.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';

import { resolveIPFS } from '../../../utils/resolveIPFS';  // ← AJOUTE ÇA EN HAUT


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
  /* ------------------------------------------------------------------ */
  /* COLLECTIONS (DÉJÀ OK - mais harmonisé) */
  const fetchCollections = useCallback(async () => {
    setIsLoading(true);

    try {
      const total = await contract.getTotalCollectionsMinted();
      const paginated = await contract.getCollectionsPaginated(0, total);

      const data = await Promise.all(
        paginated.map(async (tuple: any) => {
          if (!tuple || !tuple[6]) return null;

          const uri = await contract.getCollectionURI(tuple[0]);
          const mintContractAddress = Array.isArray(tuple[4]) ? tuple[4][0] : tuple[4];

          // ✅ CACHE localStorage comme galerie
          const cachedMetadata = localStorage.getItem(uri);
          let metadata: any = {};

          if (cachedMetadata) {
            metadata = JSON.parse(cachedMetadata);
          } else {
            // ✅ Nettoyage IPFS + API /api/ipfs/ comme galerie
            const cleanURI = uri.replace("ipfs://", "");
            const cid = cleanURI.split("/")[0];
            const res = await fetch(`/api/ipfs/${cid}`);
            metadata = await res.json();
            localStorage.setItem(uri, JSON.stringify(metadata));
          }

          return {
            id: tuple[0].toString(),
            name: tuple[1],
            collectionType: tuple[2],
            artist: tuple[3],
            imageUrl: resolveIPFS(metadata.image, true),  // ✅ PROXY /api/ipfs/
            mintContractAddress,
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
  /* POEMS (FIXÉ comme galerie) */
  const fetchPoems = useCallback(async (collectionId: string, address: string) => {
    const cacheKey = `haikus_${collectionId}`;

    const cached = loadCacheArray<Haiku>(cacheKey);
    if (cached?.length) {
      setHaikusByCollection(p => ({ ...p, [collectionId]: cached }));
      console.log(`[POEMS ${collectionId}] Cache: ${cached.length}`);
      return;
    }

    try {
      const contract = new Contract(address, haikuContractABI, provider);
      const count = Number(await contract.getLastUniqueHaikusMinted());
      if (!count) {
        console.log(`[POEMS ${collectionId}] No haikus`);
        return;
      }

      const max = Math.min(5, count);
      const tokenIds = Array.from({ length: max }, (_, i) => i);

      const poems = (await Promise.all(
        tokenIds.map(async (id) => {
          try {
            const data = await contract.getTokenFullDetails(id);
            const poemText = data.map((t: any) => t.toString());

            // ✅ MINIMUM 7 lignes pour GridLayout
            while (poemText.length < 8) poemText.push(`Ligne ${poemText.length + 1}`);

            return {
              poemText,
              mintContractAddress: address,
              uniqueIdAssociated: id.toString(),
            };
          } catch (e) {
            console.warn(`[POEM ${id}] Skip:`, e);
            return null;
          }
        })
      )).filter(Boolean) as Haiku[];

      console.log(`[POEMS ${collectionId}] Found ${poems.length}`);
      setHaikusByCollection(p => ({ ...p, [collectionId]: poems }));
      saveCache(cacheKey, poems);
    } catch (e) {
      console.error(`[POEMS ${collectionId}] Error:`, e);
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* NFTS (FIXÉ EXACTEMENT comme ta galerie) */
  const fetchNFTs = useCallback(async (collectionId: string, address: string) => {
    const cacheKey = `nfts_${collectionId}`;

    if (!address || address === "0x0000000000000000000000000000000000000000") {
      console.log(`[NFTS ${collectionId}] Invalid address: ${address}`);
      return;
    }

    const cached = loadCacheArray<Nft>(cacheKey);
    if (cached?.length) {
      setNftsByCollection(p => ({ ...p, [collectionId]: cached }));
      console.log(`[NFTS ${collectionId}] Cache: ${cached.length}`);
      return;
    }

    try {
      const contract = new Contract(address, nftContractABI, provider);

      // ✅ Comme galerie : getTokenPaginated(0, 19)
      const tokenIds: string[] = await contract.getTokenPaginated(0, 19);

      const nfts = (await Promise.all(
        tokenIds.map(async (tokenId: string) => {
          try {
            const tokenURI = await contract.tokenURI(tokenId);

            // ✅ Nettoyage IPFS comme galerie
            const cleanURI = tokenURI.replace("ipfs://", "");
            const cid = cleanURI.split("/")[0];

            if (!cid) {
              console.warn(`[NFT ${tokenId}] No CID`);
              return null;
            }

            // ✅ CACHE localStorage comme galerie
            const cachedMetadata = localStorage.getItem(tokenURI);
            let metadata: any;

            if (cachedMetadata) {
              metadata = JSON.parse(cachedMetadata);
            } else {
              const response = await fetch(`/api/ipfs/${cid}`);  // ✅ /api/ipfs/ comme galerie

              if (!response.ok) {
                console.warn(`[NFT ${tokenId}] API fail ${response.status}`);
                return null;
              }

              const text = await response.text();
              metadata = JSON.parse(text);
              localStorage.setItem(tokenURI, JSON.stringify(metadata));
            }

            return {
              id: tokenId.toString(),
              image: resolveIPFS(metadata.image, true),  // ✅ PROXY /api/ipfs/
              name: metadata.name,
              artist: metadata.artist,
              content: {
                tokenId: tokenId.toString(),
                mintContractAddress: address
              },
            };
          } catch (error) {
            console.warn(`[NFT ${tokenId}] Skip:`, error);
            return null;
          }
        })
      )).filter(Boolean) as Nft[];

      console.log(`[NFTS ${collectionId}] Found ${nfts.length}`);
      setNftsByCollection(p => ({ ...p, [collectionId]: nfts }));
      saveCache(cacheKey, nfts);
    } catch (e) {
      console.error(`[NFTS ${collectionId}] Error:`, e);
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
