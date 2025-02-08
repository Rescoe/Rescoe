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
  const [hovered, setHovered] = useState<"nft" | null>(null); // Typage explicite
  const router = useRouter();

  useEffect(() => {
    const selectedHaikus = haikus.sort(() => 0.5 - Math.random()).slice(0, 5);
    const selectedNfts = nfts.sort(() => 0.5 - Math.random()).slice(0, 5);

    localStorage.setItem("selectedItems", JSON.stringify({ selectedHaikus, selectedNfts }));

    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % selectedNfts.length);
    }, 60000); // 1h (3600000)

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
      px={4} // Moins de padding latéral sur mobile
      py={10}
      pb={100}

    >
      {nfts.length > 0 && haikus.length > 0 && (
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
              src={nfts[index].image}
              alt={nfts[index].name || "NFT"}
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
                {haikus[index]?.poemText
                  ? haikus[index].poemText.split("\n").map((line, i) => (
                      <Text key={i} fontStyle="italic" fontSize="sm"> {/* Texte plus petit */}
                        {line}
                      </Text>
                    ))
                  : "Pas de poème disponible"}
              </VStack>
            </Box>
          </Box>

          <HStack spacing={4} mt={4} align="start" flexDirection="column"> {/* Colonne pour éviter les sauts de ligne inégaux */}
            <Box>
              <Text fontWeight="bold" fontSize="md"> {/* Réduction de la taille */}
                Œuvre : <Text as="span" fontWeight="normal">{nfts[index]?.artist || "Artiste inconnu"}</Text>
              </Text>
              <Text fontStyle="italic" fontSize="sm"> {/* Plus petit */}
                {nfts[index]?.name || "Titre de l'œuvre"}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="bold" fontSize="md">
                Poème : <Text as="span" fontWeight="normal">{haikus[index]?.poet || "Poète inconnu"}</Text>
              </Text>
              <VStack align="start" maxW="100%">
                {haikus[index]?.poemText
                  ? haikus[index].poemText.split("\n").map((line, i) => (
                      <Text key={i} fontStyle="italic" fontSize="sm">
                        {line}
                      </Text>
                    ))
                  : "Texte du poème"}
              </VStack>
            </Box>
          </HStack>
        </>
      )}
    </Box>
  );

};


export default HeroSection;
