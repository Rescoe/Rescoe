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
    const SIX_HOURS = 6 * 60 * 60 * 1000; // 6 heures en ms
    const now = Date.now();

    const cachedItems = localStorage.getItem("selectedItems");
    let selectedNfts: Nft[] = [];
    let selectedHaikus: Haiku[] = [];

    let shouldUpdate = true;

    if (cachedItems) {
      try {
        const parsedItems = JSON.parse(cachedItems);
        const lastUpdate = parsedItems.timestamp || 0;

        // Si les données ont moins de 6h, on les garde
        if (now - lastUpdate < SIX_HOURS) {
          selectedNfts = Array.isArray(parsedItems.selectedNfts) ? parsedItems.selectedNfts : [];
          selectedHaikus = Array.isArray(parsedItems.selectedHaikus) ? parsedItems.selectedHaikus : [];
          shouldUpdate = false;
        }
      } catch (error) {
        console.error("Erreur de parsing des éléments du localStorage:", error);
      }
    }

    // Mise à jour si nécessaire
    if (shouldUpdate) {
      selectedNfts = nfts.sort(() => 0.5 - Math.random()).slice(0, 5);
      selectedHaikus = haikus.sort(() => 0.5 - Math.random()).slice(0, 5);

      localStorage.setItem("selectedItems", JSON.stringify({
        selectedNfts,
        selectedHaikus,
        timestamp: now
      }));
    }

    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % selectedNfts.length);
    }, 6000); // ceci fait défiler les NFT, à adapter si besoin

    return () => clearInterval(interval);
  }, [nfts, haikus]);


  // Fonction pour raccourcir l'adresse Ethereum
  const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };


  const handleClick = (item: Nft | Haiku) => {
    if ("content" in item) {
      const nftId = item.content.tokenId;
      const collectionAddress = item.content.mintContractAddress;
      router.push(`/tokenId/${collectionAddress}/${nftId}`);
    } else {
      alert("Haiku cliqué");
    }
  };

  // Récupération sécurisée des NFT et Haikus locaux ou par défaut, pour le rendu
  const { selectedNfts = [], selectedHaikus = [] } = JSON.parse(localStorage.getItem("selectedItems") || '{}');

  // Vérification que selectedNfts et selectedHaikus sont valides avant de les utiliser
  const currentNft = selectedNfts.length > 0 ? selectedNfts[index % selectedNfts.length] : null;
  const currentHaiku = selectedHaikus.length > 0 ? selectedHaikus[index % selectedHaikus.length] : null;

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
      {currentNft && currentHaiku && (
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
              src={currentNft.image}
              alt={currentNft.name || "NFT"}
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
                {currentHaiku.poemText
                  ? currentHaiku.poemText.split("\n").map((line: string, i: number) => (
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
                Œuvre : <Text as="span" fontWeight="normal">{currentNft.name || "Artiste"}</Text>
              </Text>
              <Text fontStyle="italic" fontSize="sm">
                {formatAddress(currentNft.artist) || "Oeuvre sans nom"}
              </Text>
            </Box>

            <Box>
              <Text fontWeight="bold" fontSize="md">
                Poème : <Text as="span" fontWeight="normal">{currentHaiku.poet || "Poète inconnu"}</Text>
              </Text>
            </Box>
          </HStack>
        </>
      )}
    </Box>
  );
};

export default HeroSection;
