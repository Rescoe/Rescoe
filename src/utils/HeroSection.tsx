import React, { useState, useEffect } from "react";
import { Box, Image, Text, VStack, HStack } from "@chakra-ui/react";
import { useRouter } from "next/router";

const HeroSection = ({ nfts, haikus }) => {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(null);  // Pour gérer le survol
  const router = useRouter();

  useEffect(() => {
    // Sélectionner 5 éléments de chaque type (haikus et nfts) au hasard
    const selectedHaikus = haikus.sort(() => 0.5 - Math.random()).slice(0, 5);
    const selectedNfts = nfts.sort(() => 0.5 - Math.random()).slice(0, 5);

    // Sauvegarder les éléments dans localStorage (optionnel)
    localStorage.setItem("selectedItems", JSON.stringify({ selectedHaikus, selectedNfts }));

    // Faire tourner les éléments toutes les 5 secondes
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % selectedNfts.length);  // Cycle uniquement sur les NFTs
    }, 5000);  // 5000 ms = 5 secondes

    return () => clearInterval(interval);
  }, [nfts, haikus]);

  const handleClick = (item) => {
    if (item.type === "nft") {
      const nftId = item.content.tokenId;  // Utilise le tokenId
      const collectionAddress = item.content.mintContractAddress;  // Récupère l'adresse de la collection
      router.push(`/tokenId/${collectionAddress}/${nftId}`);  // Redirige avec l'adresse et le tokenId
    } else if (item.type === "haiku") {
      alert("Haiku cliqué");  // Action pour un haiku
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
      p={6}
    >
      {nfts.length > 0 && haikus.length > 0 && (
        <>
          {/* Affichage NFT */}
          <Box
            position="relative"
            w="100%"  // L'image prend toute la largeur disponible
            h="100%"  // L'image prend toute la hauteur disponible
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
              opacity={hovered === "nft" ? 0.7 : 1}
            />

            {/* Superposition du Haiku */}
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
                {haikus[index]?.poemText || "Pas de poème disponible"}
              </Text>
            </Box>
          </Box>

          {/* Crédit de l'artiste et du poète */}
          <HStack spacing={4} mt={4} align="start">
            <Box>
              <VStack spacing={2} align="start">
                <Text fontWeight="bold" mt={4}>
                  {"Oeuvre : "}{nfts[index]?.artist || "Artiste inconnu"}
                </Text>
                <Text fontStyle="italic" mt={2}>
                  {nfts[index]?.name || "Titre de l'œuvre"}
                </Text>
              </VStack>
            </Box>

            <Box>
              <Text fontWeight="bold" mt={4}>
                {"Poème : "}{haikus[index]?.poet || "Poète inconnu"}
              </Text>
              <Text fontStyle="italic">
                {haikus[index]?.poemText || "Texte du poème"}
              </Text>
            </Box>
          </HStack>
        </>
      )}
    </Box>
  );
};

export default HeroSection;
