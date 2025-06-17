import React, { useState, useEffect } from "react";
import { Box, Image, Text, VStack, HStack } from "@chakra-ui/react";
import { useRouter } from "next/router";

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
  poemText: any; // Modifié pour accepter tout type (pour gérer le Proxy)
  poet?: string;
}

interface HeroSectionProps {
  nfts: Nft[];
  haikus: Haiku[];
}

const HeroSection: React.FC<HeroSectionProps> = ({ nfts, haikus }) => {
  const [selectedNft, setSelectedNft] = useState<Nft | null>(null);
  const [selectedHaiku, setSelectedHaiku] = useState<Haiku | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (nfts.length > 0 && haikus.length > 0) {
      const randomNft = nfts[Math.floor(Math.random() * nfts.length)];
      const randomHaiku = haikus[Math.floor(Math.random() * haikus.length)];
      setSelectedNft(randomNft);
      setSelectedHaiku(randomHaiku);
    } else {
      console.warn(`Haiku manquant`);
    }
  }, [nfts, haikus]);

  const formatAddress = (address?: string) => {
    if (!address) return "Adresse inconnue";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleClick = (item: Nft) => {
    const nftId = item.content.tokenId;
    const collectionAddress = item.content.mintContractAddress;
    router.push(`/tokenId/${collectionAddress}/${nftId}`);
  };

  // Fonction pour extraire le poème du Proxy
  const getPoemText = (poemText: any) => {
    // Assurez-vous que poemText est accessible et contient le bon texte
    if (Array.isArray(poemText) && poemText.length > 6) {
      return poemText[6]; // Accéder directement à la chaîne de caractères
    } else if (typeof poemText === "string") {
      return poemText; // Si c'est déjà une chaîne de caractères
    } else {
      return "Texte introuvable"; // Gestion de l'erreur
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      w="50vw"
      h="100vh"
      bg="transparent"
      color="white"
      pb={100}
      mx="auto" // ✅ centrage horizontal

    >
      {selectedNft && selectedHaiku && (
        <>
          <Box
            position="relative"
            w="100%"
            h="100%"
            borderRadius="md"
            cursor="pointer"
            onClick={() => handleClick(selectedNft)}
          >
            <Image
              src={selectedNft.image}
              alt={selectedNft.name || "NFT"}
              objectFit="cover"
              w="100%"
              h="100%"
              borderRadius="md"
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
            <VStack
              spacing={2}
              textAlign="center"
              color="white"
              maxW="80%"
              mx="auto"
              px={2}
            >
              {getPoemText(selectedHaiku.poemText)
                ?.split("\n")
                .map((line: string, i: number) => (
                  <Text
                    key={i}
                    fontStyle="italic"
                    fontSize={{ base: "md", md: "lg" }}
                    lineHeight="1.6"
                    fontWeight="medium"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                  >
                    {line}
                  </Text>
                ))}
            </VStack>

            </Box>
          </Box>
          <HStack spacing={4} mt={4} align="start" flexDirection="column">
            <Box>
              <Text fontWeight="bold" fontSize="md">
                Œuvre : <Text as="span" fontWeight="normal">{selectedNft.name || "Sans nom"}</Text>
              </Text>
              <Text fontStyle="italic" fontSize="sm">
                {formatAddress(selectedNft.artist)}
              </Text>
            </Box>
            <Box>
              <Text fontWeight="bold" fontSize="md">
                Poème : <Text as="span" fontWeight="normal">{selectedHaiku.poet || "Poète inconnu"}</Text>
              </Text>
            </Box>
          </HStack>
        </>
      )}
    </Box>
  );
};

export default HeroSection;
