// src/components/dashboard/UserNFTFeed.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Spinner,
  SimpleGrid,
  Image,
  Select,
  Input,
  Button,
  HStack,
  VStack,
  Badge,
  IconButton,
  Switch,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { ethers } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json"; // tel que fourni
import { ChevronDownIcon, RepeatIcon } from "@chakra-ui/icons";

type RawNFT = {
  token_id: string;
  token_address: string;
  metadata: string | null;
  name: string | null;
  symbol: string | null;
  last_metadata_sync?: string | null;
  // ... autres champs Moralis
};

type NFTItem = RawNFT & {
  parsedMetadata?: any;
  image?: string | null;
  collectionName?: string | null; // si resolvable
  floor_price?: number | null; // en crypto (ex : ETH) si fetché
  floor_price_usd?: number | null;
  collectionType?: string; // <- ajouté

};

type PaginationState = {
  cursor: string | null;
  hasMore: boolean;
};

const MotionBox = motion(Box);

const USER_NFT_PAGE_SIZE = 20;
const CONTRACT_BATCH_PAUSE_MS = 250; // pause entre requêtes pour éviter 429
const FLOORPRICE_PARALLELISM = 3; // nb max de requêtes parallèles pour floor price

export default function UserNFTFeed({ walletAddress }: { walletAddress: string }) {
  const managerAddress = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
  const provider = useMemo(() => new ethers.BrowserProvider((window as any).ethereum), []);
  const managerAbi = ABIRESCOLLECTION;

  // Contracts list from manager
  const [contracts, setContracts] = useState<string[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);

  // feed of NFTs (flattened)
  const [feed, setFeed] = useState<NFTItem[]>([]);
  // per-contract pagination state
  const [pagination, setPagination] = useState<Record<string, PaginationState>>({});
  // pointer to which contract we are currently consuming for feed
  const [contractCursorIndex, setContractCursorIndex] = useState<number>(0);

  const [loadingPage, setLoadingPage] = useState(false);
  const bottomObserverRef = useRef<HTMLDivElement | null>(null);

  // Sorting / filtering state
  const [sortBy, setSortBy] = useState<
    | "latest" // as returned order
    | "collection"
    | "token_id_asc"
    | "token_id_desc"
    | "name_asc"
    | "name_desc"
    | "floor_asc"
    | "floor_desc"
    | "last_metadata_sync"
  >("latest");
  const [groupByCollection, setGroupByCollection] = useState(false);
  const [filterCollection, setFilterCollection] = useState<string | "all">("all");
  const [minFloor, setMinFloor] = useState<string>(""); // user string then parsed
  const [maxFloor, setMaxFloor] = useState<string>("");

  // cache floor prices to avoid repeated calls
  const floorCacheRef = useRef<Record<string, { floor_price: number | null; floor_price_usd?: number | null }>>({});

  // control reload
  const [forceReloadKey, setForceReloadKey] = useState(0);

  // --------- Helpers (proxy) ---------
  const proxyFetch = async (url: string, opts?: RequestInit) => {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, opts);
    if (!res.ok) throw new Error(`Proxy fetch error ${res.status}`);
    return res.json();
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // --------- 1) Read contracts from manager (on mount) ----------
  const fetchManagerContracts = useCallback(async () => {
    setLoadingContracts(true);
    try {
      const signer = await provider.getSigner();
      const manager = new ethers.Contract(managerAddress, managerAbi, signer);
      // try to read total collections (function name in contract: getTotalCollectionsMinted)
      const totalCollections: number = Number(await manager.getTotalCollectionsMinted?.());
      const arr: string[] = [];
      for (let i = 0; i < totalCollections; i++) {
        try {
          const col = await manager.collections(i);
          // collection has field collectionAddress (as in your contract)
          if (col?.collectionAddress && col.collectionAddress !== ethers.ZeroAddress) {
            arr.push(col.collectionAddress);
          } else if (Array.isArray(col) && col.length >= 5) {
            // fallback: if returned as tuple: (id, name, collectionType, creator, collectionAddress, ...)
            const addr =
              (typeof col === "object" &&
                !Array.isArray(col) &&
                "collectionAddress" in col &&
                (col as any).collectionAddress) ||
              col[4];
            if (addr && addr !== ethers.ZeroAddress) arr.push(addr);
          }
        } catch (err) {
          // ignore per-index errors
          console.warn("read collection index error", i, err);
        }
      }
      // unique & set
      setContracts(Array.from(new Set(arr)));
    } catch (err) {
      console.error("fetchManagerContracts", err);
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, [managerAddress, managerAbi, provider]);

  useEffect(() => {
    fetchManagerContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceReloadKey]);

  // --------- 2) Fetch NFTs for given contract with Moralis (via proxy) ----------
  const fetchNFTsForContract = async (contractAddress: string, cursor: string | null = null) => {
    const base = `https://deep-index.moralis.io/api/v2.2/${walletAddress}/nft`;
    const url = new URL(base);
    url.searchParams.set("chain", "sepolia"); // adapt if needed or read from ENV
    url.searchParams.set("format", "decimal");
    url.searchParams.set("limit", String(USER_NFT_PAGE_SIZE));
    url.searchParams.append("token_addresses[]", contractAddress);
    if (cursor) url.searchParams.set("cursor", cursor);
    const data = await proxyFetch(url.toString());
    return data;
  };

  // parse metadata safely
  const safeParseMetadata = (raw: any) => {
    if (!raw) return null;
    try {
      const md = typeof raw === "string" ? JSON.parse(raw) : raw;
      // handle ipfs image
      if (md?.image && typeof md.image === "string" && md.image.startsWith("ipfs://")) {
        md.image = md.image.replace("ipfs://", "https://ipfs.io/ipfs/");
      }
      return md;
    } catch {
      return null;
    }
  };

  // add items to feed
  const appendNFTsToFeed = (items: RawNFT[]) => {
    const normalized: NFTItem[] = items.map((r) => {
      const parsedMetadata = safeParseMetadata(r.metadata);
      return {
        ...r,
        parsedMetadata,
        image: parsedMetadata?.image ?? null,
        collectionName: parsedMetadata?.collection?.name ?? null,
      };
    });
    setFeed((prev) => [...prev, ...normalized]);
  };

  // get current contract index
  const getCurrentContract = () => {
    if (!contracts || contracts.length === 0) return null;
    if (contractCursorIndex >= contracts.length) return null;
    return contracts[contractCursorIndex];
  };

  // --------- 3) Load next page for the feed (consumes contracts sequentially) ----------
  const loadNextFeedPage = useCallback(
    async (targetCount = USER_NFT_PAGE_SIZE) => {
      if (loadingPage) return;
      if (!contracts || contracts.length === 0) return;
      setLoadingPage(true);

      try {
        let added = 0;
        let idx = contractCursorIndex;

        while (added < targetCount && idx < contracts.length) {
          const contract = contracts[idx];
          const pag = pagination[contract] || { cursor: null, hasMore: true };

          if (!pag.hasMore) {
            idx++;
            continue;
          }

          // fetch
          try {
            const data = await fetchNFTsForContract(contract, pag.cursor);
            const results: RawNFT[] = data.result ?? [];

            // append
            if (results.length > 0) {
              appendNFTsToFeed(results);
              added += results.length;
            }

            // update pagination
            setPagination((prev) => ({
              ...prev,
              [contract]: { cursor: data.cursor ?? null, hasMore: data.cursor !== null },
            }));

            // if contract exhausted, move to next
            if (!data.cursor) {
              idx++;
            }

            // pause slightly to be nice with Moralis free tier
            await wait(CONTRACT_BATCH_PAUSE_MS);
          } catch (err) {
            console.error("Error fetching contract batch", contract, err);
            // on error, skip this contract to avoid infinite loop
            idx++;
            await wait(CONTRACT_BATCH_PAUSE_MS);
          }
        }

        setContractCursorIndex(idx);
      } finally {
        setLoadingPage(false);
      }
    },
    [contracts, contractCursorIndex, loadingPage, pagination]
  );

  // initial load when contracts ready
  useEffect(() => {
    if (!loadingContracts && contracts.length > 0) {
      // reset feed & state
      setFeed([]);
      setPagination({});
      setContractCursorIndex(0);
      // load first page
      loadNextFeedPage(USER_NFT_PAGE_SIZE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingContracts, contracts, forceReloadKey]);

  // --------- 4) Infinite scroll (IntersectionObserver) ----------
  useEffect(() => {
    const el = bottomObserverRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingPage) {
            // load more when bottom visible
            loadNextFeedPage(USER_NFT_PAGE_SIZE);
          }
        });
      },
      { root: null, rootMargin: "400px", threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [loadNextFeedPage, loadingPage]);

  // --------- 5) Floor price fetching (lazy, batched, cached) ----------
  const fetchFloorForToken = async (contractAddr: string, tokenId: string) => {
    const key = `${contractAddr.toLowerCase()}_${tokenId}`;
    const cache = floorCacheRef.current[key];
    if (cache) return cache;

    try {
      const url = `https://deep-index.moralis.io/api/v2.2/nft/${contractAddr}/${tokenId}/floor-price?chain=sepolia`;
      const data = await proxyFetch(url);
      const v = {
        floor_price: data?.floor_price ? Number(data.floor_price) : null,
        floor_price_usd: data?.floor_price_usd ? Number(data.floor_price_usd) : null,
      };
      floorCacheRef.current[key] = v;
      return v;
    } catch (err) {
      console.warn("floor fetch error", contractAddr, tokenId, err);
      floorCacheRef.current[key] = { floor_price: null };
      return { floor_price: null };
    }
  };

  // helper to fetch floor prices for a list of items with limited parallelism
  const batchFetchFloors = async (items: NFTItem[]) => {
    const toFetch = items.filter((it) => {
      const k = `${it.token_address.toLowerCase()}_${it.token_id}`;
      return !floorCacheRef.current[k];
    });

    if (toFetch.length === 0) return;

    // simple concurrency limiter
    const queue = [...toFetch];
    const promises: Promise<void>[] = [];
    const worker = async () => {
      while (queue.length > 0) {
        const it = queue.shift();
        if (!it) break;
        const res = await fetchFloorForToken(it.token_address, it.token_id);
        // update feed with floor if present
        setFeed((prev) =>
          prev.map((p) =>
            p.token_address === it.token_address && p.token_id === it.token_id
              ? { ...p, floor_price: res.floor_price, floor_price_usd: res.floor_price_usd }
              : p
          )
        );
      }
    };

    for (let i = 0; i < FLOORPRICE_PARALLELISM; i++) {
      promises.push(worker());
    }
    await Promise.all(promises);
  };

  // fetch floor prices for visible feed when sorting/filter requires them
  useEffect(() => {
    // if sortBy requires floor or filters by min/max floor -> fetch floors for current feed (limited)
    if (sortBy.includes("floor") || minFloor !== "" || maxFloor !== "") {
      // fetch floors for current feed (but limit to first 80 to avoid huge calls)
      const slice = feed.slice(0, 80);
      batchFetchFloors(slice).catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, minFloor, maxFloor, feed.length]);

  // --------- 6) Filtering & sorting client-side (applied to loaded feed) ----------
  const normalizedFeed = useMemo(() => {
    // apply collection filter first
    let arr = [...feed];


    if (filterCollection !== "all") {
      arr = arr.filter((it) => {
        const type = it.collectionType ?? it.parsedMetadata?.collection?.type ?? null;
        return type === filterCollection;
      });
    }


    // floor filters
    const minF = minFloor.trim() === "" ? null : Number(minFloor);
    const maxF = maxFloor.trim() === "" ? null : Number(maxFloor);

    if (minF !== null || maxF !== null) {
      arr = arr.filter((it) => {
        const f = it.floor_price ?? floorCacheRef.current[`${it.token_address.toLowerCase()}_${it.token_id}`]?.floor_price ?? null;
        if (f === null) return false; // exclude unknown floors if filtering by floor
        if (minF !== null && f < minF) return false;
        if (maxF !== null && f > maxF) return false;
        return true;
      });
    }

    // sort
    switch (sortBy) {
      case "collection":
        arr.sort((a, b) => {
          const ca = a.parsedMetadata?.collection?.name ?? a.collectionName ?? a.token_address;
          const cb = b.parsedMetadata?.collection?.name ?? b.collectionName ?? b.token_address;
          return String(ca).localeCompare(String(cb));
        });
        break;
      case "token_id_asc":
        arr.sort((a, b) => Number(a.token_id) - Number(b.token_id));
        break;
      case "token_id_desc":
        arr.sort((a, b) => Number(b.token_id) - Number(a.token_id));
        break;
      case "name_asc":
        arr.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
        break;
      case "name_desc":
        arr.sort((a, b) => String(b.name ?? "").localeCompare(String(a.name ?? "")));
        break;
      case "floor_asc":
        arr.sort((a, b) => {
          const fa = a.floor_price ?? floorCacheRef.current[`${a.token_address.toLowerCase()}_${a.token_id}`]?.floor_price ?? Infinity;
          const fb = b.floor_price ?? floorCacheRef.current[`${b.token_address.toLowerCase()}_${b.token_id}`]?.floor_price ?? Infinity;
          return (fa ?? Infinity) - (fb ?? Infinity);
        });
        break;
      case "floor_desc":
        arr.sort((a, b) => {
          const fa = a.floor_price ?? floorCacheRef.current[`${a.token_address.toLowerCase()}_${a.token_id}`]?.floor_price ?? -Infinity;
          const fb = b.floor_price ?? floorCacheRef.current[`${b.token_address.toLowerCase()}_${b.token_id}`]?.floor_price ?? -Infinity;
          return (fb ?? -Infinity) - (fa ?? -Infinity);
        });
        break;
      case "last_metadata_sync":
        arr.sort((a, b) => {
          const ta = a.last_metadata_sync ? new Date(a.last_metadata_sync).getTime() : 0;
          const tb = b.last_metadata_sync ? new Date(b.last_metadata_sync).getTime() : 0;
          return tb - ta;
        });
        break;
      default:
        // latest: keep load order
        break;
    }

    return arr;
  }, [feed, sortBy, filterCollection, minFloor, maxFloor]);

  const TYPE_ORDER = [
    "EDITIONS",
    "POESIE",
    "GALERIE",
    "SÉRIES",
    "OPEN EDITION",
    "PHYGITAL"
  ];

  const collectionOptions = useMemo(() => {
    const s = new Set<string>();

    feed.forEach((it) => {
      // récupère le type du feed
      const type = it.collectionType ?? it.parsedMetadata?.collection?.type ?? null;
      if (type) s.add(type.toUpperCase().trim()); // normalize
    });

    return Array.from(s).sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a);
      const ib = TYPE_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [feed]);


  // reload whole feed
  const reloadAll = async () => {
    setFeed([]);
    setPagination({});
    setContractCursorIndex(0);
    setForceReloadKey((k) => k + 1);
  };

  // UI render
  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="700">
          Flux NFT — Tous les NFTs
        </Text>

        <HStack spacing={3}>
          <Button leftIcon={<RepeatIcon />} size="sm" onClick={reloadAll}>
            Reload
          </Button>
        </HStack>
      </Flex>

      {/* Controls */}
      <Box mb={4}>
        <Flex gap={3} wrap="wrap" align="center">
          <Select
            width="220px"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            size="sm"
          >
            <option value="latest">Ordre de chargement (latest)</option>
            <option value="collection">Trier par collection</option>
            <option value="token_id_asc">Token ID ↑</option>
            <option value="token_id_desc">Token ID ↓</option>
            <option value="name_asc">Nom A→Z</option>
            <option value="name_desc">Nom Z→A</option>
            <option value="floor_asc">Floor price ↑</option>
            <option value="floor_desc">Floor price ↓</option>
            <option value="last_metadata_sync">Dernière sync metadata</option>
          </Select>

          <Select
            width="220px"
            value={filterCollection}
            onChange={(e) => setFilterCollection(e.target.value)}
            size="sm"
          >
            <option value="all">Tous les types</option>
            {collectionOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>


          <Input
            placeholder="Min floor (ex: 0.1)"
            size="sm"
            width="160px"
            value={minFloor}
            onChange={(e) => setMinFloor(e.target.value)}
          />
          <Input
            placeholder="Max floor (ex: 1.0)"
            size="sm"
            width="160px"
            value={maxFloor}
            onChange={(e) => setMaxFloor(e.target.value)}
          />

          <HStack spacing={2}>
            <Text fontSize="sm">Group by collection</Text>
            <Switch isChecked={groupByCollection} onChange={(e) => setGroupByCollection(e.target.checked)} />
          </HStack>
        </Flex>
      </Box>

      {/* Feed */}
      <Box>
        {feed.length === 0 && loadingPage && (
          <Flex justify="center" align="center" py={8}>
            <Spinner />
          </Flex>
        )}

        {/* grouped view */}
        {groupByCollection ? (
          // group feed by collectionName
          (() => {
            const grouped = normalizedFeed.reduce<Record<string, NFTItem[]>>((acc, it) => {
              const key = it.parsedMetadata?.collection?.name ?? it.collectionName ?? it.token_address;
              acc[key] = acc[key] || [];
              acc[key].push(it);
              return acc;
            }, {});
            const keys = Object.keys(grouped);
            return (
              <VStack align="stretch" spacing={8}>
                {keys.map((k) => (
                  <Box key={k}>
                    <Flex align="center" justify="space-between" mb={3}>
                      <Text fontWeight="700">{k}</Text>
                      <Badge>{grouped[k].length} items</Badge>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} spacing={4}>
                      {grouped[k].map((it) => (
                        <MotionBox
                          key={`${it.token_address}_${it.token_id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.03 }}
                          p={3}
                          borderRadius="md"
                          border="1px solid #e6e6e6"
                        >
                          {it.image ? (
                            <Image src={it.image} alt={it.name ?? it.token_id} w="100%" h="180px" objectFit="cover" mb={3} />
                          ) : (
                            <Box h="180px" mb={3} />
                          )}
                          <Text fontWeight="600">{it.name ?? "NFT"}</Text>
                          <Text fontSize="xs" >
                            #{it.token_id}
                          </Text>
                          <Text fontSize="xs">
                            {it.symbol}
                          </Text>
                          <Text fontSize="sm" mt={2}>
                            {it.floor_price !== undefined && it.floor_price !== null ? `${it.floor_price} (≈ $${it.floor_price_usd ?? "?"})` : ""}
                          </Text>
                        </MotionBox>
                      ))}
                    </SimpleGrid>
                  </Box>
                ))}
              </VStack>
            );
          })()
        ) : (
          // single feed
          <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} spacing={4}>
            {normalizedFeed.map((it) => (
              <MotionBox
                key={`${it.token_address}_${it.token_id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                p={3}
                borderRadius="md"
                border="1px solid #e6e6e6"
              >
                {it.image ? (
                  <Image src={it.image} alt={it.name ?? it.token_id} w="100%" h="180px" objectFit="cover" mb={3} />
                ) : (
                  <Box h="180px" bg="gray.100" mb={3} />
                )}

                <Flex justify="space-between" align="baseline">
                  <Text fontWeight="600">{it.name ?? "NFT"}</Text>
                  <Badge>{it.parsedMetadata?.collection?.name ?? it.collectionName ?? ""}</Badge>
                </Flex>

                <Text fontSize="xs" color="gray.600">
                  #{it.token_id} — {it.symbol}
                </Text>

                <HStack justify="space-between" mt={3}>
                  <Text fontSize="sm" fontWeight="700">
                    {it.floor_price !== undefined && it.floor_price !== null ? `${it.floor_price} ETH` : "—"}
                  </Text>
                  <Button size="sm" onClick={() => {
                    // on click: optionally fetch detailed metadata or open modal (you can implement)
                    const k = `${it.token_address}_${it.token_id}`;
                    const cached = floorCacheRef.current[k];
                    if (!cached?.floor_price) {
                      // trigger a fetch for this token
                      fetchFloorForToken(it.token_address, it.token_id).then((r) => {
                        setFeed((prev) =>
                          prev.map((p) =>
                            p.token_address === it.token_address && p.token_id === it.token_id
                              ? { ...p, floor_price: r.floor_price, floor_price_usd: r.floor_price_usd }
                              : p
                          )
                        );
                      });
                    }
                  }}>
                    Prix
                  </Button>
                </HStack>
              </MotionBox>
            ))}
          </SimpleGrid>
        )}

        {/* sentinel for infinite scroll */}
        <Box ref={bottomObserverRef} height="1px" />

        {loadingPage && (
          <Flex justify="center" mt={6}>
            <Spinner />
          </Flex>
        )}

        {/* When end reached */}
        {contractCursorIndex >= contracts.length && !loadingPage && (
          <Flex justify="center" mt={6}>
            <Text color="gray.500">Fin du flux (tous les contrats scannés)</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
