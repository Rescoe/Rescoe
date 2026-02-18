import React from "react";
import { useAuth } from '../../../utils/authContext';
import { resolveIPFS } from "@/utils/resolveIPFS";
import {
  Box,
  Badge,
  Text,
  Button,
  useColorModeValue,
  useColorMode,
  HStack
} from '@chakra-ui/react';
import theme from '@/styles/theme'; // ✅ Import complet

interface NFT {
  owner: string;
  tokenId: string;
  image: string;
  name: string;
  description: string;
  forSale: boolean;
  priceInWei: string;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

interface NFTCardProps {
  nft: NFT;
  buyNFT?: (nft: NFT) => void;
  isForSale: boolean;
  proprietaire: string;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft, buyNFT }) => {
  const { address: authAddress, connectWallet } = useAuth();
  const { colorMode } = useColorMode();

  // ✅ Accès correct au theme
  const brand = theme.colors.brand;
  const isForSaleLocal = nft.forSale;
  const isOwner = authAddress && authAddress.toLowerCase() === nft.owner.toLowerCase();
  const canPurchase = !isOwner && isForSaleLocal;
  const imageSrc = resolveIPFS(nft.image, true) || '/fallback-nft.png';

  return (
    <Box
      as="article"
      h="full"
      display="flex"
      flexDir="column"
      borderWidth="1px"
      borderColor={useColorModeValue("#e2e8f0", `rgba(${brand.gold}, 0.3)`)}
      borderRadius="3xl"
      overflow="hidden"
      boxShadow={useColorModeValue(
        "0 8px 32px rgba(0,0,0,0.12)",
        "0 8px 32px rgba(0,0,0,0.4)"
      )}
      backdropFilter="blur(12px)"
      bg={useColorModeValue(
        `rgba(${brand.cream}, 0.3)`,  // ✅ Transparent cream
        `rgba(${brand.navy}, 0.4)`   // ✅ Transparent navy
      )}
      transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
      cursor="pointer"
      _hover={{
        transform: "translateY(-8px)",
        boxShadow: useColorModeValue(
          `0 20px 40px rgba(0,65,106,0.2)`,
          `0 20px 40px rgba(0,0,0,0.5)`
        ),
        borderColor: useColorModeValue(brand.blue, brand.gold),
      }}
    >
      {/* Image Hero - TRANSPARENTE */}
      <Box flex={1} minH="280px" position="relative" overflow="hidden" bg="transparent">
        <Box
          as="img"
          src={imageSrc}
          alt={nft.name}
          w="100%" h="100%" objectFit="cover"
          transition="all 0.5s ease"
          filter="brightness(1.05) contrast(1.1)"
          _hover={{ transform: "scale(1.08)" }}
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            (e.currentTarget as HTMLImageElement).src = '/fallback-nft.png';
          }}        />

        <Badge
          position="absolute"
          top={4} right={4}
          px={4} py={1.5} fontSize="xs" fontWeight="bold"
          borderRadius="full" boxShadow="lg"
          backdropFilter="blur(20px)"
          bgGradient={canPurchase
            ? `linear(to-r, ${brand.blue}, ${brand.mauve})`
            : isOwner
            ? `linear(to-r, ${brand.gold}, orange.400)`
            : "gray.500"}
          color="white"
        >
          {canPurchase ? "À vendre" : isOwner ? "Propriétaire" : "Vendu"}
        </Badge>
      </Box>

      <Box p={6} flexShrink={0} pb={4}>
        <Box mb={4}>
          <Text
            fontSize={["lg", "xl"]}
            fontWeight="extrabold"
            bgGradient={useColorModeValue(
              `linear(to-r, ${brand.navy}, ${brand.blue})`,
              `linear(to-r, ${brand.gold}, ${brand.mauve})`
            )}
            bgClip="text"
            lineHeight={1.2}
            noOfLines={1}
            mb={1}
          >
            {nft.name}
          </Text>

          <Text
            fontSize="xs" fontWeight="medium"
            color={useColorModeValue(brand.textDark, brand.textLight)}
            opacity={0.8}
            textTransform="uppercase"
            letterSpacing="wider"
          >
            #{nft.tokenId.padStart(4, '0')}
          </Text>
        </Box>

        <Text
          fontSize="sm"
          color={useColorModeValue("#475569", "#94a3b8")}
          lineHeight={1.5}
          noOfLines={2}
          mb={4}
          opacity={0.9}
        >
          {nft.description || "Œuvre unique de la collection."}
        </Text>

        <HStack justify="space-between" align="center" mb={4} spacing={4}>
          {canPurchase ? (
            <>
              <Box>
                <Text
                  fontSize={["lg", "2xl"]}
                  fontWeight="black"
                  color={useColorModeValue(brand.blue, brand.gold)}
                  lineHeight={1}
                  mb={-1}
                >
                  {nft.price.toFixed(4)}
                </Text>
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  ETH
                </Text>
              </Box>

              <Button
                size="md"
                minW="auto"
                px={6}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!authAddress) connectWallet();
                  else buyNFT?.(nft);
                }}
                bgGradient={`linear(to-r, ${brand.blue}, ${brand.mauve})`}
                color="white"
                fontWeight="bold"
                borderRadius="xl"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: `0 15px 35px rgba(0,65,106,0.6)`,
                }}
              >
                Acheter
              </Button>
            </>
          ) : (
            <Box w="full" textAlign="center" p={4} borderRadius="xl">
              {isOwner ? (
                <Badge colorScheme="orange" fontSize="sm" fontWeight="bold" px={4} py={2}>
                  🎨 Votre œuvre
                </Badge>
              ) : (
                <Badge colorScheme="gray" variant="subtle" fontSize="sm" fontWeight="bold" px={4} py={2}>
                  Indisponible
                </Badge>
              )}
            </Box>
          )}
        </HStack>

        {nft.tags?.length > 0 && (
          <HStack spacing={2} wrap="wrap">
            {nft.tags.slice(0, 4).map((tag, i) => (
              <Badge
                key={i}
                size="xs"
                fontWeight="medium"
                bg={useColorModeValue(
                  `rgba(${brand.cream}, 0.6)`,
                  `rgba(${brand.gold}, 0.2)`
                )}
                color={useColorModeValue(brand.navy, brand.gold)}
                borderRadius="full"
                boxShadow="sm"
              >
                {tag}
              </Badge>
            ))}
          </HStack>
        )}
      </Box>
    </Box>
  );
};

export default NFTCard;
