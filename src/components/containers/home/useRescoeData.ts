/**
 * useRescoeData — Hook collections, œuvres, poèmes
 *
 * Avant : fetche directement Moralis (30-80 appels par utilisateur, 12h cache localStorage).
 * Après : fetch /api/data/collections (1 appel HTTP, CDN Vercel 1h partagé entre tous),
 *         puis localStorage 24h par utilisateur.
 *
 * Interface de retour INCHANGÉE — aucun composant consommateur n'est affecté.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invalidatePublicCache } from "@/utils/cacheInvalidation";

// ─── Types (identiques à l'original) ─────────────────────────────────────────

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

interface CollectionWithMedia extends Collection {
  nfts: Nft[];
  haikus: Haiku[];
}

interface UseRescoeDataReturn {
  isLoading: boolean;
  collections: Collection[];
  allNfts: Nft[];
  allHaikus: Haiku[];
  nftsByCollection: Record<string, Nft[]>;
  haikusByCollection: Record<string, Haiku[]>;
  collectionsWithNfts: CollectionWithMedia[];
  refetch: () => void;
}

// ─── Cache localStorage ───────────────────────────────────────────────────────

const LS_KEY = "collections_api_v1";
// 24h — aligné sur stale-while-revalidate CDN
const CACHE_TTL = 24 * 60 * 60 * 1000;

function loadCache(): CollectionWithMedia[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { timestamp, data } = JSON.parse(raw);
    if (!Array.isArray(data) || Date.now() - timestamp > CACHE_TTL) return null;
    return data as CollectionWithMedia[];
  } catch {
    return null;
  }
}

function saveCache(data: CollectionWithMedia[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {}
}

// ─── Mapping réponse API → types locaux ──────────────────────────────────────

function mapApiCollection(raw: Record<string, unknown>): CollectionWithMedia {
  const nfts: Nft[] = ((raw.nfts as unknown[]) ?? []).map((n: unknown) => {
    const nft = n as Record<string, unknown>;
    return {
      id: String(nft.id ?? ""),
      image: String(nft.image ?? ""),
      name: String(nft.name ?? ""),
      artist: String(nft.artist ?? ""),
      content: {
        tokenId: String(nft.id ?? ""),
        mintContractAddress: String(nft.mintContractAddress ?? ""),
      },
    };
  });

  const haikus: Haiku[] = ((raw.haikus as unknown[]) ?? []).map((h: unknown) => {
    const haiku = h as Record<string, unknown>;
    return {
      poemText: (haiku.poemText as string[]) ?? [],
      mintContractAddress: String(haiku.mintContractAddress ?? ""),
      uniqueIdAssociated: String(haiku.uniqueIdAssociated ?? ""),
    };
  });

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    collectionType: String(raw.collectionType ?? ""),
    artist: String(raw.artist ?? ""),
    imageUrl: String(raw.imageUrl ?? ""),
    mintContractAddress: String(raw.mintContractAddress ?? ""),
    isFeatured: Boolean(raw.isFeatured),
    nfts,
    haikus,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useRescoeData = (): UseRescoeDataReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [collectionsWithNfts, setCollectionsWithNfts] = useState<CollectionWithMedia[]>([]);
  const hasFetched = useRef(false);

  const fetchAll = useCallback(async (force = false) => {
    setIsLoading(true);

    // 1. Cache localStorage (24h) — aucun appel réseau si chaud
    if (!force) {
      const cached = loadCache();
      if (cached?.length) {
        setCollectionsWithNfts(cached);
        setIsLoading(false);
        return;
      }
    }

    // 2. Appel unique vers l'API (CDN Vercel 1h partagé entre tous les users)
    try {
      const resp = await fetch("/api/data/collections");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      const mapped = ((json.collections as unknown[]) ?? []).map((c) =>
        mapApiCollection(c as Record<string, unknown>)
      );

      setCollectionsWithNfts(mapped);
      saveCache(mapped);
    } catch (e) {
      console.error("[useRescoeData] Erreur /api/data/collections :", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charge une seule fois au montage
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  // ─── Valeurs dérivées (interface identique à l'original) ─────────────────

  const collections = useMemo(
    () => collectionsWithNfts.map(({ nfts, haikus, ...col }) => col),
    [collectionsWithNfts]
  );

  const nftsByCollection = useMemo(() => {
    const map: Record<string, Nft[]> = {};
    collectionsWithNfts.forEach((c) => { map[c.id] = c.nfts; });
    return map;
  }, [collectionsWithNfts]);

  const haikusByCollection = useMemo(() => {
    const map: Record<string, Haiku[]> = {};
    collectionsWithNfts.forEach((c) => { map[c.id] = c.haikus; });
    return map;
  }, [collectionsWithNfts]);

  const allNfts = useMemo(
    () => collectionsWithNfts.flatMap((c) => c.nfts),
    [collectionsWithNfts]
  );

  const allHaikus = useMemo(
    () => collectionsWithNfts.flatMap((c) => c.haikus),
    [collectionsWithNfts]
  );

  const refetch = useCallback(() => {
    invalidatePublicCache(["collections"]);
    hasFetched.current = false;
    fetchAll(true);
  }, [fetchAll]);

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
