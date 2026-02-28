// src/components/dashboard/UserNFTFeed.tsx - VERSION DEFINITIVE + PAGINATION INFINIE
// ✅ Floor supprimé + Type on-chain + Poèmes parfaits + Refresh fixe + Load More

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Flex, Text, Spinner, SimpleGrid, Image, Select, Button, HStack,
  VStack, Badge, Skeleton, Alert, AlertIcon
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { ethers, BrowserProvider, ZeroAddress } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";
import { RepeatIcon } from "@chakra-ui/icons";
import { resolveIPFS } from "@/utils/resolveIPFS";
import { useRouter } from "next/router";

type RawNFT = {
  token_id: string;
  token_address: string;
  metadata: string | null;
  name: string | null;
  symbol: string | null;
};

type NFTItem = RawNFT & {
  parsedMetadata?: any;
  image?: string | null;
  collectionName?: string | null;
  collectionType?: string;
  isPoem?: boolean;
  artist?: string;
};

const MotionBox = motion(Box);
const MAX_PER_LOAD = 20;
const MAX_TOTAL = 100;
const CHAIN_MORALIS = process.env.NEXT_PUBLIC_CHAIN_MORALIS || "base";
const ERC721_ABI = ["function tokenURI(uint256 tokenId) view returns (string)"] as const;

export default function UserNFTFeed({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const managerAddress = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const providerRef = useRef<BrowserProvider>();

  const [contracts, setContracts] = useState<string[]>([]);
  const [collectionTypesMap, setCollectionTypesMap] = useState<Record<string, string>>({});
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [feed, setFeed] = useState<NFTItem[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [forceReloadKey, setForceReloadKey] = useState(0);
  const [loadedNFTs, setLoadedNFTs] = useState(0); // ✅ Pagination

  const [sortBy, setSortBy] = useState<"latest" | "collection" | "token_id_asc" | "token_id_desc">("latest");
  const [filterCollection, setFilterCollection] = useState<string | "all">("all");

  const getNFTLink = (nft: NFTItem) => {
    return nft.isPoem ?
      `/poemsId/${nft.token_address}/${nft.token_id}` :
      `/oeuvresId/${nft.token_address}/${nft.token_id}`;
  };

  useEffect(() => {
    providerRef.current = new BrowserProvider((window as any).ethereum);
  }, []);

  const proxyFetch = async (url: string) => {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    return res.json();
  };

  const fetchManagerContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const signer = await providerRef.current!.getSigner();
      const manager = new ethers.Contract(managerAddress, ABIRESCOLLECTION, signer);
      const total = Number(await manager.getTotalCollectionsMinted());

      const addresses: string[] = [];
      const typesMap: Record<string, string> = {};

      for (let i = 0; i < total; i++) {
        try {
          const col = await manager.collections(i);

          const addr = col.collectionAddress || (Array.isArray(col) ? col[4] : null);
          const type = col.collectionType || (Array.isArray(col) ? col[2] : null);

          if (addr && addr !== ZeroAddress) {
            const normalized = addr.toLowerCase();
            addresses.push(addr);
            typesMap[normalized] = type || "Art";
          }
        } catch {}
      }

      console.log("Contracts:", addresses);
      console.log("TypesMap:", typesMap);
      setContracts(addresses);
      setCollectionTypesMap(typesMap);
    } catch (e) {
      console.error("Contracts:", e);
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  const fetchMetadata = useCallback(async (nft: RawNFT) => {
    if (nft.metadata) {
      try {
        const md = JSON.parse(nft.metadata);
        if (md.image) {
          if (md.image?.startsWith("ipfs://")) {
            md.image = await resolveIPFS(md.image, true);
          }
          return md;
        }
      } catch {}
    }

    try {
      console.log(`🔍 tokenURI ${nft.token_address}/${nft.token_id}`);
      const contract = new ethers.Contract(nft.token_address, ERC721_ABI, providerRef.current!);
      const tokenURI = await contract.tokenURI(nft.token_id);

      const uri = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
      const res = await fetch(uri);
      const md = await res.json();

      if (md.image?.startsWith("ipfs://")) {
        md.image = await resolveIPFS(md.image, true);
      }
      console.log(`✅ Metadata ${nft.token_id}: artist=${md?.artist}`);
      return md;
    } catch (e) {
      console.warn(`Metadata fail ${nft.token_id}:`, e);
      return null;
    }
  }, []);

  // ✅ loadNFTs avec pagination infinie
  const loadNFTs = useCallback(async () => {
    if (loadingPage || loadedNFTs >= MAX_TOTAL) return;
    setLoadingPage(true);

    try {
      let totalAdded = 0;
      for (let i = 0; i < contracts.length && totalAdded < MAX_PER_LOAD; i++) {
        const contract = contracts[i];
        const url = new URL(`https://deep-index.moralis.io/api/v2.2/${walletAddress}/nft`);
        url.searchParams.set("chain", CHAIN_MORALIS);
        url.searchParams.set("limit", "10");
        url.searchParams.append("token_addresses[]", contract);

        const data = await proxyFetch(url.toString());
        const nfts = data.result || [];

        for (const nft of nfts) {
          if (totalAdded >= MAX_PER_LOAD) break;

          const metadata = await fetchMetadata(nft);

          const contractType = collectionTypesMap[nft.token_address.toLowerCase()] || "Art";
          const isPoem = contractType.toLowerCase() === "poesie";

          const item: NFTItem = {
            ...nft,
            parsedMetadata: metadata,
            image: metadata?.image || null,
            collectionName: metadata?.name || nft.name || "NFT",
            collectionType: contractType,
            isPoem,
            artist: metadata?.artist || metadata?.creator || "Anonyme",
          };

          setFeed(prev => {
            if (!prev.find(p => p.token_id === nft.token_id && p.token_address === nft.token_address)) {
              totalAdded++;
              return [...prev, item];
            }
            return prev;
          });

          await new Promise(r => setTimeout(r, 150));
        }
      }
      setLoadedNFTs(prev => prev + totalAdded);
      console.log(`✅ Chargé ${totalAdded} NFTs (total: ${loadedNFTs + totalAdded}/${MAX_TOTAL})`);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoadingPage(false);
    }
  }, [contracts, walletAddress, loadedNFTs, loadingPage, collectionTypesMap]);

  // ✅ loadMore
  const loadMore = () => loadNFTs();

  // ✅ reload CORRIGÉ
  const reload = () => {
    setFeed([]);
    setLoadedNFTs(0);
    setForceReloadKey(k => k + 1);
  };

  useEffect(() => { fetchManagerContracts(); }, [forceReloadKey]);

  useEffect(() => {
    if (providerRef.current && contracts.length > 0 && feed.length === 0) {
      loadNFTs();
    }
  }, [contracts.length, forceReloadKey]); // ✅ Dépend de forceReloadKey

  // + NOUVEAU : Auto-load après refresh
  useEffect(() => {
    if (feed.length === 0 && contracts.length > 0 && !loadingPage) {
      loadNFTs();
    }
  }, [forceReloadKey]); // ✅ Se déclenche à chaque refresh

  const normalizedFeed = useMemo(() => {
    let arr = [...feed];
    if (filterCollection !== "all") arr = arr.filter(it => it.collectionType === filterCollection);
    switch (sortBy) {
      case "collection": arr.sort((a, b) => (a.collectionName ?? "").localeCompare(b.collectionName ?? "")); break;
      case "token_id_asc": arr.sort((a, b) => Number(a.token_id) - Number(b.token_id)); break;
      case "token_id_desc": arr.sort((a, b) => Number(b.token_id) - Number(a.token_id)); break;
    }
    return arr;
  }, [feed, sortBy, filterCollection]);

  const collectionTypes = useMemo(() => Array.from(new Set(normalizedFeed.map(n => n.collectionType).filter(Boolean))), [normalizedFeed]);

  return (
    <Box p={{ base: 4, md: 6 }} maxW="1400px" mx="auto">
      <Flex justify="space-between" align="center" mb={8}>
        <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold">
          Mes NFTs ({feed.length}/{MAX_TOTAL})
        </Text>
        <Button leftIcon={<RepeatIcon />} onClick={reload} size="sm">
          🔄 Refresh
        </Button>
      </Flex>

      <Flex gap={4} mb={8} flexWrap="wrap">
        <Select value={sortBy} onChange={e => setSortBy(e.target.value as any)} w="220px">
          <option value="latest">Récents</option>
          <option value="collection">Collection</option>
          <option value="token_id_asc">ID croissant</option>
          <option value="token_id_desc">ID décroissant</option>
        </Select>
        <Select value={filterCollection} onChange={e => setFilterCollection(e.target.value)} w="200px">
          <option value="all">Toutes</option>
          {collectionTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Flex>

      {loadingContracts ? (
        <Flex justify="center" py={16}><Spinner size="xl" /></Flex>
      ) : contracts.length === 0 ? (
        <Alert status="info"><AlertIcon />Aucune collection</Alert>
      ) : feed.length === 0 && !loadingPage ? (
        <Alert status="warning"><AlertIcon />Aucun NFT dans ces collections</Alert>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }} spacing={4}>
            {normalizedFeed.map(nft => (
              <MotionBox
                key={`${nft.token_address}-${nft.token_id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => router.push(getNFTLink(nft))}
                cursor="pointer"
                title={`Voir ${nft.isPoem ? 'poème' : 'œuvre'} → ${getNFTLink(nft)}`}
                p={4}
                bg="whiteAlpha.100"
                borderRadius="2xl"
                borderWidth="1px"
                borderColor="whiteAlpha.300"
                shadow="md"
                minH="380px"
                transition={{ duration: 0.3 }}
              >
                {nft.isPoem ? (
                  <Box
                    h="240px"
                    bg="linear-gradient(135deg, brand.mauve 0%, brand.gold 50%, brand.gold 100%)"
                    borderRadius="2xl"
                    p={5}
                    display="flex"
                    flexDirection="column"     
                    justifyContent="space-between"
                    alignItems="center"
                    color="white"
                    fontFamily="'EB Garamond', serif"
                    textAlign="center"
                    mb={3}
                    boxShadow="2xl"
                    overflow="hidden"
                  >

                    <Text fontSize={["md", "lg"]} fontWeight="600" letterSpacing="wider" mb={2}>
                      {nft.name}
                    </Text>
                    <Box flex={1} px={2} whiteSpace="pre-wrap">
                      {nft.parsedMetadata?.description
                        ?.replace(/\\r\\n/g, "\\\\n")
                        .split("\\\\n")
                        .map((line: string, i: number) => (
                          <Text key={i} fontSize={["sm", "md"]} lineHeight={1.8} opacity={0.95} fontStyle="italic">
                            {line}
                          </Text>
                        ))
                      }
                    </Box>
                    <Box fontSize="3xl" opacity={0.8}>✒️</Box>
                  </Box>
                ) : nft.image ? (
                  <Image src={nft.image} fallbackSrc="/placeholder.png" w="100%" h="240px" objectFit="cover" borderRadius="2xl" mb={3} />
                ) : (
                  <Skeleton h="240px" borderRadius="2xl" mb={3} />
                )}

                <VStack align="start" spacing={1.5} flex={1}>
                  <HStack justify="space-between" w="full">
                    <Text fontWeight="bold" fontSize="lg" noOfLines={1}>
                      {nft.name || nft.collectionName || "NFT"}
                    </Text>
                    <Badge colorScheme={nft.isPoem ? "purple" : "blue"} px={2}>
                      {nft.isPoem ? "📜" : `#${nft.token_id}`}
                    </Badge>
                  </HStack>

                  {nft.collectionType && (
                    <Badge colorScheme="teal" size="xs" variant="subtle">
                      {nft.collectionType}
                    </Badge>
                  )}

                  {nft.artist && nft.artist !== "Anonyme" && (
                    <HStack spacing={1} opacity={0.85}>
                      <Text fontSize="xs">👤</Text>
                      <Text fontSize="xs" fontWeight="medium">
                        {typeof nft.artist === 'string' ? nft.artist.slice(0,8)+'...' : nft.artist}
                      </Text>
                    </HStack>
                  )}

                  {nft.parsedMetadata?.description && !nft.isPoem && (
                    <Text fontSize="xs" color="gray.600" noOfLines={2}>
                      {nft.parsedMetadata.description}
                    </Text>
                  )}
                </VStack>
              </MotionBox>
            ))}
          </SimpleGrid>

          {/* ✅ FOOTER PAGINATION */}
          <Flex justify="center" mt={12} gap={4} align="center" flexWrap="wrap">
            {loadingPage && <Spinner size="md" />}

            {/* Load More */}
            {loadedNFTs >= MAX_PER_LOAD && loadedNFTs < MAX_TOTAL && (
              <Button
                onClick={loadMore}
                colorScheme="blue"
                size="sm"
                leftIcon={<RepeatIcon />}
              >
                +{MAX_PER_LOAD} NFTs
              </Button>
            )}

            {/* Refresh */}
            <Button
              onClick={reload}
              variant="outline"
              size="sm"
              leftIcon={<RepeatIcon />}
            >
              🔄 Refresh
            </Button>

            {/* Compteur */}
            <Text color="gray.500" fontSize="sm">
              {feed.length} / {MAX_TOTAL} NFTs
            </Text>

            {/* Max atteint */}
            {loadedNFTs >= MAX_TOTAL && (
              <Text color="orange.500" fontSize="xs">
                💎 Max {MAX_TOTAL} atteints
              </Text>
            )}
          </Flex>
        </>
      )}
    </Box>
  );
}
