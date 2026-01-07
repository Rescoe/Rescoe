// src/components/modules/RelatedFullPoems.tsx
// ✅ SPÉCIAL POÈMES - Copie parfaite de RelatedFull

import React, { useMemo } from "react";
import { Box, Heading, Text, VStack, Grid } from "@chakra-ui/react";
import { motion } from "framer-motion";

interface Haiku {
  poemText: string[];
  mintContractAddress: string;
  uniqueIdAssociated: string;
}

interface Props {
  haiku: Haiku;
  allHaikus: Haiku[];
  title?: string;
}

const RelatedFullPoems: React.FC<Props> = ({ haiku, allHaikus, title }) => {
  const relatedHaikus = useMemo(() => {
    return allHaikus.filter(
      (h) =>
        h.mintContractAddress === haiku.mintContractAddress &&
        h.uniqueIdAssociated !== haiku.uniqueIdAssociated
    );
  }, [haiku, allHaikus]);

  if (!haiku || relatedHaikus.length === 0) return null;

  return (
    <Box py={10} px={6}>
      <Heading
        size="l"
        mb={6}
        bgGradient="linear(to-r, pink.400, purple.400)"
        bgClip="text"
        textAlign="center"
      >
        {title || "Poèmes associés"}
      </Heading>

      <Grid
        templateColumns="repeat(auto-fit, minmax(140px, 1fr))"
        gap={6}
        justifyItems="center"
        maxW="1200px"
        mx="auto"
      >
        {relatedHaikus.slice(0, 5).map((item, i) => (  // ✅ MAX 5
          <VStack
            key={`${item.mintContractAddress}-${item.uniqueIdAssociated}-${i}`}
            as={motion.div}
            whileHover={{ scale: 1.05 }}
            bg="pinkAlpha.100"
            borderRadius="xl"
            p={3}
            boxShadow="md"
            _hover={{
              boxShadow: "0 0 10px rgba(255, 90, 180, 0.5)",
            }}
            align="start"
            h="140px"
            justify="space-between"
          >
            <Text
              fontStyle="italic"
              fontSize="sm"
              lineHeight="1.3"
              noOfLines={2}
              color="whiteAlpha.900"
            >
              {item.poemText?.[6] || "Poème"}
            </Text>
            <Text
              fontSize="xs"
              color="pink.300"
              noOfLines={1}
            >
              {item.poemText?.[7]?.slice(0, 12)}...
            </Text>
          </VStack>
        ))}
      </Grid>
    </Box>
  );
};

export default RelatedFullPoems;
