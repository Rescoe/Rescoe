import React, { useState, useEffect } from "react";
import { Box, Image, Text, useMediaQuery } from "@chakra-ui/react";
import { useRouter } from "next/router";

interface Nft {
  id: string;
  image: string;
  name?: string;
  artist?: string;
  content: {
    tokenId: string;
    mintContractAddress: string;
  };
}

interface Haiku {
  poemText: string;
  poet?: string;
}

interface AlternatingItem {
  type: "haiku" | "nft";
  content: Haiku | Nft;
  associatedNft?: Nft;
  associatedHaiku?: string;
}

interface GridLayoutProps {
  nfts: Nft[];
  haikus: Haiku[];
  delay?: number;
  maxNfts?: number;
  maxHaikus?: number;
}

const GridLayout: React.FC<GridLayoutProps> = ({ nfts, haikus, delay = 2, maxNfts = 5, maxHaikus = 5 }) => {
  const [items, setItems] = useState<AlternatingItem[]>([]);
  const [index, setIndex] = useState(0);
  const [hoveredItem, setHoveredItem] = useState<AlternatingItem | null>(null);
  const [isMobile] = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

  useEffect(() => {
    const shuffledNfts = [...nfts].sort(() => Math.random() - 0.5).slice(0, maxNfts);
    const shuffledHaikus = [...haikus].sort(() => Math.random() - 0.5).slice(0, maxHaikus);

    const combined: AlternatingItem[] = [];
    shuffledNfts.forEach((nft, i) => {
      const haiku = shuffledHaikus[i];
      if (haiku) {
        combined.push({ type: "nft", content: nft, associatedHaiku: haiku.poemText[6] });
        combined.push({ type: "haiku", content: haiku, associatedNft: nft });
        //console.log(haiku.poemText[6]);
      }
    });

    setItems(combined);
  }, [nfts, haikus, maxNfts, maxHaikus]);

  const moveToIndex = (offset: number) => {
    setIndex((prev) => (prev + offset + items.length) % items.length);
  };

  const formatAddress = (addr?: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const handleClick = (item: AlternatingItem) => {
    if (item.type === "nft") {
      const { tokenId, mintContractAddress } = (item.content as Nft).content;
      router.push(`/nfts/${mintContractAddress}/${tokenId}`);
    }
  };
  const renderContent = (item: AlternatingItem) => {
    if (item.type === "haiku") {

      const haikuContent = item.content as Haiku; // Assertion de type
      return (
        <Box
          position="relative"
          w="100%"
          h="100%"
          borderRadius="md"
          cursor="pointer"
          onMouseEnter={() => setHoveredItem(item)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Box
            bg="rgba(0, 0, 0, 0.5)"
            color="white"
            p={4}
            borderRadius="md"
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100%"
          >


            <Text fontStyle="italic" textAlign="center">
            {typeof haikuContent.poemText ? haikuContent.poemText[6] : "Contenu du haiku introuvable"}
            </Text>
          </Box>
          {hoveredItem?.type === "haiku" && hoveredItem.content === item.content && (
            <Box
              position="absolute"
              top="0"
              left="0"
              w="100%"
              h="100%"
              display="flex"
              justifyContent="center"
              alignItems="center"
              zIndex="2"
            >
              <Image
                src={item.associatedNft?.image || '/fallback-image.png'}
                alt={item.associatedNft?.name || "NFT"}
                objectFit="cover"
                w="100%"
                h="100%"
                borderRadius="md"
                opacity={0.3}
              />
            </Box>
          )}
        </Box>
      );
    } else if (item.type === "nft") {
      // Vérification que item.content est un NFT avant d'accéder à ses propriétés
      const nftContent = item.content as Nft; // Assertion de type

      return (
        <Box
          position="relative"
          w="100%"
          h="100%"
          borderRadius="md"
          cursor="pointer"
          onMouseEnter={() => setHoveredItem(item)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Image
            src={nftContent.image} // Accède directement à l'image du NFT
            alt={nftContent.name || "NFT"}
            objectFit="cover"
            w="100%"
            h="100%"
            borderRadius="md"
            opacity={hoveredItem?.type === "nft" && hoveredItem.content === item.content ? 0.7 : 1}
          />
          {hoveredItem?.type === "nft" && hoveredItem.content === item.content && (
            <Box
              position="absolute"
              top="0"
              left="0"
              w="100%"
              h="100%"
              bg="rgba(0, 0, 0, 0.5)"
              display="flex"
              justifyContent="center"
              alignItems="center"
              zIndex="2"
            >
              <Text
                fontStyle="italic"
                fontSize="lg"
                textAlign="center"
                color="white"
                maxWidth="80%"
              >
                {item.associatedHaiku || "Pas de haiku associé à ce NFT."}
              </Text>
            </Box>
          )}
        </Box>
      );
    }
    return null; // Retourner null si aucun type ne correspond
  };



  return (
      <Box position="relative" p={4} w="100%" h="600px">
        <Box
          display="grid"
          gridTemplateColumns={isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)'}
          gridTemplateRows="repeat(3, 1fr)"
          gap={4}
          h="100%"
        >
          {[{
            column: "1 / span 3", row: "1", offset: -1
          },
          {
            column: "4 / span 1", row: "1", offset: 1
          },
          {
            column: "1 / span 1", row: "2 / span 2", offset: -2
          },
          {
            column: "2 / span 2", row: "2", offset: 0
          },
          {
            column: "2 / span 3", row: "3", offset: 2
          }].map(({ column, row, offset }, i) => {
            // Si mobile, enlever la dernière colonne
            if (isMobile && column === "4 / span 1") return null;

            // Enlever le rendu pour la colonne 2 ligne 2
            if (isMobile && column === "2 / span 2" && row === "2") return null;

            return (
              <Box
                key={i}
                gridColumn={column}
                gridRow={row}
                p={2}
                alignItems="left"
                cursor="pointer"
                minWidth="150px"
                minHeight="150px"
                width="100%"
                height="100%"
                position="relative"
                onClick={() => {
                  moveToIndex((index + offset + items.length) % items.length);
                  if (column === "2 / span 2" && row === "2") {
                    handleClick(items[(index + offset + items.length) % items.length]);
                  }
                }}
              >
                {items.length > 0 && renderContent(items[(index + offset + items.length) % items.length])}
              </Box>
            );
          })}

          {items.length > 0 && items[index] && (
            <Box
              gridColumn={isMobile ? "2 / span 2" : "4 / span 1"}
              gridRow="2"
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              p={2}
              borderRadius="md"
              boxShadow="md"
              bg="rgba(0, 0, 0, 0.7)"
              color="white"
            >
              {items[index].type === "haiku" ? (
                <>
                  <Text fontWeight="bold" mb={2}>
                    {"Poète inconnu"}
                  </Text>
                  <Text fontStyle="italic">
                    {"Titre du haiku"}
                  </Text>
                </>
              ) : items[index].type === "nft" ? (
                <>
                  <Text fontWeight="bold" mb={2}>
                    {(items[index].content as Nft).name || "Oeuvre sans nom"}
                  </Text>
                  <Text>
                    {formatAddress((items[index].content as Nft).artist ?? "") || "Artiste inconnu"}
                  </Text>
                </>
              ) : (
                <Text>{"Un poème, une œuvre."}</Text>
              )}
            </Box>
          )}

        </Box>
      </Box>
    );
};

export default GridLayout;
