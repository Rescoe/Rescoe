import React, { useState, useEffect } from "react";
import { Box, Image, Text, VStack, HStack } from "@chakra-ui/react";
import { useRouter } from "next/router";

// Définition des types pour les props
interface Nft {
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

interface HeroSectionProps {
  nfts: Nft[];
  haikus: Haiku[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ nfts, haikus }) => {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState<"nft" | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Récupérer les éléments du localStorage
    const cachedItems = localStorage.getItem("selectedItems");

    let selectedNfts: Nft[] = [];
    let selectedHaikus: Haiku[] = [];

    // Si le localStorage contient des éléments, les utiliser
    if (cachedItems) {
      const parsedItems = JSON.parse(cachedItems);
      selectedNfts = parsedItems.selectedNfts || [];
      selectedHaikus = parsedItems.selectedHaikus || [];
    } else {
      // Sinon, en sélectionner des nouveaux
      selectedNfts = nfts.sort(() => 0.5 - Math.random()).slice(0, 5);
      selectedHaikus = haikus.sort(() => 0.5 - Math.random()).slice(0, 5);

      // Stoker les nouveaux éléments dans le localStorage
      localStorage.setItem("selectedItems", JSON.stringify({ selectedHaikus, selectedNfts }));
    }

    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % selectedNfts.length);
    }, 43200000); // Changer toutes les 12h

    return () => clearInterval(interval);
  }, [nfts, haikus]);

  const handleClick = (item: Nft | Haiku) => {
    if ("content" in item) {
      const nftId = item.content.tokenId;
      const collectionAddress = item.content.mintContractAddress;
      router.push(`/tokenId/${collectionAddress}/${nftId}`);
    } else {
      alert("Haiku cliqué");
    }
  };

  // Récupération des NFT et Haikus locaux ou par défaut, pour le rendu
  const { selectedNfts, selectedHaikus } = JSON.parse(localStorage.getItem("selectedItems") || '{}') || { selectedNfts: [], selectedHaikus: [] };

  return (
    <Box
      position="relative"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      w="100%"
      h="400px"
      bg="transparent"
      color="white"
      px={4}
      py={10}
      pb={100}
    >
      {selectedNfts.length > 0 && selectedHaikus.length > 0 && (
        <>
          <Box
            position="relative"
            w="100%"
            maxW="600px"
            h="100%"
            borderRadius="md"
            cursor="pointer"
            onMouseEnter={() => setHovered("nft")}
            onMouseLeave={() => setHovered(null)}
          >
            <Image
              src={selectedNfts[index].image}
              alt={selectedNfts[index].name || "NFT"}
              objectFit="cover"
              w="100%"
              h="100%"
              borderRadius="md"
              opacity={hovered === "nft" ? 1 : 0.95}
            />

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
              zIndex={2}
            >
              <VStack textAlign="center" color="white" maxWidth="80%">
                {selectedHaikus[index]?.poemText
                  ? selectedHaikus[index].poemText.split("\n").map((line: string, i: number) => (

                      <Text key={i} fontStyle="italic" fontSize="sm">
                        {line}
                      </Text>
                    ))
                  : "Pas de poème disponible"}
              </VStack>
            </Box>
          </Box>

          <HStack spacing={4} mt={4} align="start" flexDirection="column">
            <Box>
              <Text fontWeight="bold" fontSize="md">
                Œuvre : <Text as="span" fontWeight="normal">{selectedNfts[index]?.artist || "Artiste inconnu"}</Text>
              </Text>
              <Text fontStyle="italic" fontSize="sm">
                {selectedNfts[index]?.name || "Titre de l'œuvre"}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="bold" fontSize="md">
                Poème : <Text as="span" fontWeight="normal">{selectedHaikus[index]?.poet || "Poète inconnu"}</Text>
              </Text>
            </Box>
          </HStack>
        </>
      )}
    </Box>
  );
};

export default HeroSection;
