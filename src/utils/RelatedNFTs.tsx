import { useMemo } from "react";
import { Box, Image, Text, SimpleGrid } from "@chakra-ui/react";

export interface Nft {
  artist: string;
  description: string;
  image: string;
  mintContractAddress: string;
  name: string;
  price: string;
  tags: string[];
  tokenId: string;
}

interface RelatedNFTsProps {
  nft: Nft;
  allNFTs: Nft[];
}

export default function RelatedNFTs({ nft, allNFTs }: RelatedNFTsProps) {
  // On filtre une seule fois (useMemo = optimisation)
  const related = useMemo(() => {
    if (!nft || !allNFTs?.length) return [];
    return allNFTs.filter(
      (n) =>
        n.mintContractAddress === nft.mintContractAddress &&
        n.tokenId !== nft.tokenId
    );
  }, [nft, allNFTs]);

  if (!related.length)
    return (
      <Text mt={4} color="gray.500" fontSize="sm">
        Aucun autre NFT dans cette collection.
      </Text>
    );

  return (
    <Box mt={6}>
      <Text fontSize="lg" fontWeight="bold" mb={3}>
        Autres œuvres de la collection
      </Text>

      <SimpleGrid columns={[2, 3, 4]} spacing={4}>
        {related.map((r) => (
          <Box
            key={r.tokenId}
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            _hover={{ transform: "scale(1.03)", transition: "0.2s" }}
          >
            <Image
              src={r.image}
              alt={r.name}
              objectFit="cover"
              w="100%"
              h="150px"
            />
            <Box p={2}>
              <Text fontWeight="semibold" noOfLines={1}>
                {r.name}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {r.artist.slice(0, 6)}...{r.artist.slice(-4)}
              </Text>
            </Box>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
