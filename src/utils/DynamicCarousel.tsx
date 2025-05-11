import React, { useState, useEffect } from "react";
import { Box, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useMediaQuery } from '@chakra-ui/react';


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
  delay?: number; // Délai de chargement en secondes
  maxNfts?: number; // Nombre max de NFTs affichés
  maxHaikus?: number; // Nombre max de haikus affichés
}

const GridLayout: React.FC<GridLayoutProps> = ({ nfts, haikus, delay = 2, maxNfts = 5, maxHaikus = 5 }) => {
  const [isMobile] = useMediaQuery('(max-width: 768px)'); // Ajuster la largeur selon vos besoins

  const [index, setIndex] = useState<number>(0);
  const [items, setItems] = useState<AlternatingItem[]>([]);
  const [hoveredItem, setHoveredItem] = useState<AlternatingItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const selectedNfts = nfts.slice(0, maxNfts);
      const selectedHaikus = haikus.slice(0, maxHaikus);


      const alternateItems: AlternatingItem[] = [];
      const maxLength = Math.max(selectedNfts.length, selectedHaikus.length);

      for (let i = 0; i < maxLength; i++) {
        if (i < selectedHaikus.length) {
          alternateItems.push({
            type: "haiku",
            content: {
              poemText: selectedHaikus[i].poemText.split("\n").map(line => line.trim()).join("\n"), // Créer un objet Haiku
            } as Haiku, // S'assurer que c'est bien de type Haiku
            associatedNft: selectedNfts[i % selectedNfts.length],
          });
        }
        if (i < selectedNfts.length) {
          alternateItems.push({
            type: "nft",
            content: selectedNfts[i],
            associatedHaiku: selectedHaikus[i % selectedHaikus.length]?.poemText.split("\n").map(line => line.trim()).join("\n"), // Vous pourrez faire la même vérification ici si nécessaire
          });
        }
      }



      setItems(alternateItems);
      setLoading(false);
    }, delay * 1000);
  }, [nfts, haikus, delay, maxNfts, maxHaikus]);

  const moveToIndex = (newIndex: number) => {
    setIndex(newIndex % items.length);
  };

  const handleClick = (item: AlternatingItem) => {
    if (item?.type === "nft") {
      const nftId = (item.content as Nft).content.tokenId;
      const Contrat = (item.content as Nft).content.mintContractAddress;

      router.push(`/oeuvresId/${Contrat}/${nftId}`);
    }
  };

  if (loading) {
    return <Text>Chargement des données...</Text>;
  }

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
            {typeof haikuContent.poemText ? haikuContent.poemText : "Contenu du haiku introuvable"}
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
          gridTemplateColumns={isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'}
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

          {items.length > 0 && (
            <Box
              gridColumn={isMobile ? "2 / span 2" : "4 / span 1"} // Ajustement de la colonne pour le cartel
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
                {typeof items[index].content !== "string" && (
                  <>
                    <Text fontWeight="bold" mb={2}>
                      {"Poète inconnu"}
                    </Text>
                    <Text fontStyle="italic">
                      {"Titre du haiku"} {/* Ici, on accède à poemText uniquement pour un haiku */}
                    </Text>
                  </>
                )}
              </>
            ) : items[index].type === "nft" ? (
              <>
                {typeof items[index].content !== "string" && (
                  <>
                    <Text fontWeight="bold" mb={2}>
                      {"Artiste inconnu"}
                    </Text>
                    <Text>{"Nom de l'œuvre"}</Text>
                  </>
                )}
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
