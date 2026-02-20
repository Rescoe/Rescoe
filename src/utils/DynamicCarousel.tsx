// src/components/containers/home/GridLayout.tsx
// ✅ VERSION COMPLÈTE - Force 10 NFTs + 10 Haikus (duplication si besoin)

import React, { useState, useEffect } from "react";
import { Box, Image, Text, useMediaQuery, Center } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { JsonRpcProvider } from 'ethers';

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

export interface Haiku {
  poemText: string[];
  mintContractAddress: string;
  uniqueIdAssociated: string;
}

interface AlternatingItem {
  type: "haiku" | "nft";
  content: Haiku | Nft;
  associatedNft?: Nft;
  associatedHaiku?: string;
}

interface GridLayoutProps {
  nfts: Nft[];      // Sera forcé à 10 par le hook
  haikus: Haiku[];  // Sera forcé à 10 par le hook
  delay?: number;
  maxNfts?: number;
  maxHaikus?: number;
}

const GridLayout: React.FC<GridLayoutProps> = ({
  nfts,
  haikus,
  delay = 2,
  maxNfts = 10,  // ✅ FORCE 10
  maxHaikus = 10 // ✅ FORCE 10
}) => {
  const [items, setItems] = useState<AlternatingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<AlternatingItem | null>(null);
  const [isMobile] = useMediaQuery("(max-width: 768px)");
  const router = useRouter();
  const [ensMap, setEnsMap] = useState<Record<string, string>>({});

/*
  // ✅ DEBUG PROPS + CONFIRMATION 10/10
  useEffect(() => {
   //console.log('[GRIDLAYOUT] ✅ Props OK:', {
      nftsCount: nfts.length,
      haikusCount: haikus.length,
      nftsSample: nfts.slice(0, 3).map(n => n.id),
      haikusSample: haikus.slice(0, 3).map(h => h.uniqueIdAssociated?.slice(0, 8))
    });
  }, [nfts.length, haikus.length]);
*/
  // ✅ USEEFFECT PRINCIPAL - Paire NFT/Haiku
  useEffect(() => {
    if (!Array.isArray(nfts) || !Array.isArray(haikus) || nfts.length === 0 || haikus.length === 0) {
      //console.log('[GRID] ⏳ Attente data...');
      return;
    }

    // ✅ DÉDUPLICATION + SHUFFLE (sécurité si hook bug)
    const uniqueNfts = Array.from(new Set(nfts.map(nft =>
      `${nft.content.mintContractAddress}-${nft.content.tokenId}`
    ))).map(idStr =>
      nfts.find(nft =>
        `${nft.content.mintContractAddress}-${nft.content.tokenId}` === idStr
      )!
    ).slice(0, maxNfts);

    const uniqueHaikus = Array.from(new Set(haikus.map(h => h.uniqueIdAssociated)))
      .map(id => haikus.find(h => h.uniqueIdAssociated === id)!)
      .slice(0, maxHaikus);

    //console.log('[GRID] 🔄 Uniques:', uniqueNfts.length, 'NFTs +', uniqueHaikus.length, 'Haikus');

    const combined: AlternatingItem[] = [];
    const addressesToFetch: string[] = [];

    // ✅ PAIRAGE : NFT[i] + Haiku[i] (cycle si moins haikus)
    uniqueNfts.forEach((nft, i) => {
      const haiku = uniqueHaikus[i % uniqueHaikus.length];

      combined.push({
        type: "nft" as const,
        content: nft,
        associatedHaiku: haiku.poemText[6]
      });
      combined.push({
        type: "haiku" as const,
        content: haiku,
        associatedNft: nft
      });

      if (haiku.mintContractAddress) addressesToFetch.push(haiku.mintContractAddress);
      if (nft.artist) addressesToFetch.push(nft.artist);
    });

    //console.log('[GRID] ✅ Items créés:', combined.length);
    setItems(combined);

    if (addressesToFetch.length > 0) {
      fetchENSForAddresses(Array.from(new Set(addressesToFetch)));
    }
  }, [nfts, haikus, maxNfts, maxHaikus]);

  const fetchENSForAddresses = async (addresses: string[]) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const newMap: Record<string, string> = {};

    await Promise.all(addresses.map(async (addr) => {
      try {
        const name = await provider.lookupAddress(addr);
        newMap[addr] = name || formatAddress(addr);
      } catch {
        newMap[addr] = formatAddress(addr);
      }
    }));

    setEnsMap(newMap);
  };

  const moveToIndex = (offset: number) => {
    setIndex((prev) => (prev + offset + items.length) % items.length);
  };

  const formatAddress = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Inconnu";

  const handleClick = (item: AlternatingItem) => {
    if (item.type === "nft") {
      const nftItem = item.content as Nft;
      router.push(`/oeuvresId/${nftItem.content.mintContractAddress}/${nftItem.content.tokenId}`);
    } else {
      const haikuItem = item.content as Haiku;
      router.push(`/poemsId/${haikuItem.mintContractAddress}/${haikuItem.uniqueIdAssociated}`);
    }
  };

  const renderContent = (item: AlternatingItem | undefined) => {
    if (!item) return <Center><Text>Chargement...</Text></Center>;

    if (item.type === "haiku") {
      const haikuContent = item.content as Haiku;
      return (
        <Box position="relative" w="100%" h="100%" borderRadius="md" cursor="pointer"
             onMouseEnter={() => setHoveredItem(item)}
             onMouseLeave={() => setHoveredItem(null)}>
          <Box bg="rgba(0,0,0,0.8)" color="white" p={4} borderRadius="md"
               display="flex" justifyContent="center" alignItems="center" h="100%">
            <Text fontStyle="italic" textAlign="center" fontSize={["sm", "md"]}>
              {haikuContent.poemText?.[6] || "Poème"}
            </Text>
          </Box>
          {hoveredItem === item && item.associatedNft && (
            <Image src={item.associatedNft.image} alt="NFT assoc."
                   objectFit="cover" w="100%" h="100%" borderRadius="md"
                   position="absolute" top={0} left={0} opacity={0.4} zIndex={2} />
          )}
        </Box>
      );
    }

    const nftContent = item.content as Nft;
    return (
      <Box position="relative" w="100%" h="100%" borderRadius="md" cursor="pointer"
           onMouseEnter={() => setHoveredItem(item)}
           onMouseLeave={() => setHoveredItem(null)}>
        <Image src={nftContent.image || '/default.png'} alt={nftContent.name || "NFT"}
               objectFit="cover" w="100%" h="100%" borderRadius="md"
               opacity={hoveredItem === item ? 0.3 : 1} />
        {hoveredItem === item && item.associatedHaiku && (
          <Box position="absolute" top={0} left={0} w="100%" h="100%"
               bg="rgba(0,0,0,0.7)" display="flex" alignItems="center" justifyContent="center"
               zIndex={2}>
            <Text fontStyle="italic" color="white" textAlign="center" px={4} fontSize={["xs", "sm"]}>
              {typeof item.associatedHaiku === 'string' ? item.associatedHaiku : "Haiku"}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  // ✅ LOADING / EMPTY STATE
  if (items.length === 0) {
    return (
      <Center h="600px" p={8}>
        <Box textAlign="center">
          <Text color="gray.500" mb={4}>Chargement des œuvres et poèmes...</Text>
        </Box>
      </Center>
    );
  }

  return (
    <Box position="relative" p={4} w="100%" h="600px" overflow="hidden">
      <Box display="grid"
           gridTemplateColumns={isMobile ? "repeat(3, 1fr)" : "repeat(4, 1fr)"}
           gridTemplateRows="repeat(3, 1fr)" gap={4} h="100%">

        {/* ✅ 5 CASES GRID */}
        {[
          { column: "1 / span 3", row: "1", offset: -1 },
          { column: isMobile ? "1 / span 3" : "4 / span 1", row: "1", offset: 1 },
          { column: "1 / span 1", row: "2 / span 2", offset: -2 },
          { column: "2 / span 2", row: "2", offset: 0 },
          { column: "2 / span 3", row: "3", offset: 2 },
        ].map(({ column, row, offset }, i) => {
          if (isMobile && column === "4 / span 1") return null;

          const currentItem = items[(index + offset + items.length) % items.length];

          return (
            <Box key={i} gridColumn={column} gridRow={row} p={2}
                 display="flex" alignItems="center" justifyContent="center"
                 cursor="pointer" minW="120px" minH="120px" w="100%" h="100%"
                 border="1px solid rgba(255,255,255,0.1)" borderRadius="md" overflow="hidden"
                 _hover={{ borderColor: "pink.400", transform: "scale(1.02)" }}
                 transition="all 0.2s"
                 onClick={() => {
                   moveToIndex(offset);
                   handleClick(currentItem);
                 }}>
              {renderContent(currentItem)}
            </Box>
          );
        })}

        {/* ✅ CENTRE INFO */}
        {items[index] && (
          <Box gridColumn={isMobile ? "2 / span 2" : "4 / span 1"}
               gridRow="2" display="flex" flexDirection="column" alignItems="center"
               justifyContent="center" p={4} borderRadius="lg"
               boxShadow="lg" bg="rgba(0,0,0,0.8)" color="white" h="100%"
               border="2px solid" borderColor="pink.400">
            {items[index].type === "haiku" ? (
              <>
                <Text fontStyle="italic" fontSize="sm" opacity={0.9}>Poème par</Text>
                <Text fontWeight="bold" fontSize={["md", "lg"]}>
                  {formatAddress((items[index].content as Haiku).poemText?.[7]) || "Poète"}
                </Text>
              </>
            ) : (
              <>
                <Text fontWeight="bold" fontSize={["md", "lg"]} mb={1}>
                  {(items[index].content as Nft).name || "Œuvre"}
                </Text>
                <Text fontSize="sm">
                  {ensMap[(items[index].content as Nft).artist || ""] ||
                   formatAddress((items[index].content as Nft).artist) || "Artiste"}
                </Text>
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GridLayout;
