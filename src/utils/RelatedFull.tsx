import React, { useMemo } from "react";
import { Box, Heading, Image, Text, VStack, Grid } from "@chakra-ui/react";
import { motion } from "framer-motion";

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

interface Props {
  nft: Nft;
  allNFTs: Nft[];
  title?: string;
}

const RelatedFull: React.FC<Props> = ({ nft, allNFTs, title }) => {

  const relatedNFTs = useMemo(() => {
    return allNFTs.filter(
      (n) =>
        n.content.mintContractAddress === nft.content.mintContractAddress &&
        n.content.tokenId !== nft.content.tokenId
    );
  }, [nft, allNFTs]);



  if (relatedNFTs.length === 0) return null;

  return (
    <Box py={10} px={6}>
      <Heading
        size="l"
        mb={6}
        bgGradient="linear(to-r, purple.400, pink.400)"
        bgClip="text"
        textAlign="center"
      >
        {title || "Œuvres associées"}
      </Heading>

      <Grid
        templateColumns="repeat(auto-fit, minmax(140px, 1fr))"
        gap={6}
        justifyItems="center"
        maxW="1200px"
        mx="auto"
      > 
        {relatedNFTs.map((item, i) => (
          <VStack
          key={`${item.content.mintContractAddress}-${item.content.tokenId}-${i}`}
            as={motion.div}
            whileHover={{ scale: 1.05 }}
            bg="whiteAlpha.100"
            borderRadius="xl"
            p={3}
            boxShadow="md"
            _hover={{
              boxShadow: "0 0 10px rgba(180, 90, 255, 0.5)",
            }}
          >
            <Image
              src={item.image}
              alt={item.name}
              borderRadius="xl"
              objectFit="cover"
              boxSize="140px"
            />
            <Text
              fontSize="sm"
              color="gray.300"
              noOfLines={1}
              maxW="140px"
              textAlign="center"
            >
            {item.name || `#${item.content.tokenId}`}
            </Text>
          </VStack>
        ))}
      </Grid>
    </Box>
  );
};

export default RelatedFull;
