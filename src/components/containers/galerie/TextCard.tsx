import React from "react";
import { VStack, Text, Button, Box, Badge, Divider } from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import { useRouter } from 'next/router';
import { FramedText } from '../../../utils/Cadre';
import useEthToEur from "../../../hooks/useEuro";



interface TextCardProps {
  nft: {
    tokenId: string;
    poemText: string;
    creatorAddress: string;
    totalEditions: string;
    price: string;
    priceEur: string;   // prix en EUR
    mintContractAddress: string;
    totalMinted: string;
    availableEditions: string;
    isForSale: boolean;
    tokenIdsForSale?: number[]; // Optionnel
  };
  showBuyButton?: boolean;
  onBuy: (tokenId: string) => void;
}

const TextCard: React.FC<TextCardProps> = ({
  nft,
  showBuyButton = false,
  onBuy,
}) => {
  const { address: authAddress, connectWallet } = useAuth();

  if (!nft) {
    return <Text>Chargement du NFT...</Text>;
  }

  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();

  const priceInEth = nft.price ? parseFloat(nft.price) / 1e18 : 0;

  const priceEur = convertEthToEur(priceInEth);

  const isOwner = authAddress?.toLowerCase() === nft.creatorAddress.toLowerCase();
  const router = useRouter();



  const handleBuy = async (tokenId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authAddress) {
      await connectWallet();
    }
    if (authAddress) {
      onBuy(tokenId);
    }
  };


  console.log({
    availableEditions: nft.availableEditions,
    parsed: parseInt(nft.availableEditions || "0"),
    tokenIdsForSale: nft.tokenIdsForSale,
    showBuyButton
  });
  
  return (
    <Box
      textAlign="center"
      borderWidth="2px"  // ✅ Même épaisseur
      borderColor="brand.gold"
      borderRadius="2xl"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      maxWidth={{ base: "100%", md: "340px" }}
      mx="auto"
      my={6}
      p={{ base: 6, md: 8 }}
      boxShadow="0 12px 48px rgba(238, 212, 132, 0.25)"
      backdropFilter="blur(16px)"
      transition="all 0.3s ease"
      _hover={{
        transform: "translateY(-6px)",
        boxShadow: "0 20px 64px rgba(238, 212, 132, 0.35)"
      }}
    >
      {/* Poème gold massif */}
      <Box mb={2} p={2}>
        <VStack spacing={4} textAlign="center">
          {nft.poemText
            ? nft.poemText.split("\n").map((line, i) => (
                <Text
                  key={i}
                  fontStyle="italic"
                  fontSize={{ base: "md", md: "lg" }}
                  lineHeight={1.8}
                  fontWeight="600"
                  color="brand.gold"  // ✅ Gold comme page
                  letterSpacing="0.3px"
                >
                  {line}
                </Text>
              ))
            : <Text fontSize="lg" fontWeight="500" color="brand.gold.500">Pas de poème</Text>
          }
        </VStack>
      </Box>

      <Divider my={4} borderColor="brand.gold" />

      {/* Infos prix/dispo */}
      <VStack spacing={3} mb={6} w="100%">
        <Text
          fontSize={{ base: "md", md: "lg" }}
          fontWeight="bold"
        >
          Prix : <span color="brand.gold">{priceInEth}</span> ETH
          {priceEur !== null && priceEur !== undefined && ` (~${priceEur} €)`}
        </Text>

        <Text
          fontSize="sm"
          color="brand.navy.600"
        >
          <strong>Disponibilité :</strong>{' '}
          {nft.availableEditions !== undefined
            ? `${nft.availableEditions} / ${nft.totalEditions}`
            : "loading..."}
        </Text>
      </VStack>

      {/* Actions */}
      <VStack spacing={3} w="100%">
        {/* Bouton achat */}
        {showBuyButton && nft.tokenIdsForSale && nft.tokenIdsForSale.length > 0 ? (
          <Button
            w="full"
            size="md"
            colorScheme="brand.gold"
            bgGradient="linear(to-r, brand.gold, brand.gold)"
            color="brand.navy"
            fontWeight="bold"
            borderRadius="xl"
            boxShadow="0 8px 24px rgba(238, 212, 132, 0.3)"
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: "0 12px 32px rgba(238, 212, 132, 0.5)"
            }}
            onClick={(e) => handleBuy(nft.tokenIdsForSale![0].toString(), e)}
          >
            Acheter
          </Button>
        ) : showBuyButton && nft.availableEditions && nft.tokenIdsForSale?.length === 0 ? (
          <Badge w="full" py={4} colorScheme="gray" borderRadius="xl" fontSize="sm">
            Épuisé
          </Badge>
        ) : null}

        {/* Statut proprio */}
        {isOwner && (
          <Badge px={4} py={2} colorScheme="orange" borderRadius="full" fontSize="xs">
            Créateur
          </Badge>
        )}

        {/* Bouton détails */}
        <Button
          w="full"
          size="sm"
          variant="outline"
          colorScheme="brand.navy"
          borderColor="brand.gold"
          _hover={{ bg: "brand.gold", color: "brand.navy" }}
          onClick={() => router.push(`/poemsId/${nft.mintContractAddress}/${nft.tokenId}`)}
        >
          Voir le poème →
        </Button>
      </VStack>
    </Box>
  );


};

export default TextCard;
