// components/ParentSelector.tsx
import { Box, Text, Image, VStack, Badge, Button, SimpleGrid } from "@chakra-ui/react";

import type { TokenWithMeta } from "@/hooks/useReproduction";


interface ParentSelectorProps {
  label: string;
  tokens: TokenWithMeta[];
  selected: TokenWithMeta | null;
  onSelect: (token: TokenWithMeta | null) => void;
  disabled?: boolean;
  forbiddenId?: number;
}

export const ParentSelector: React.FC<ParentSelectorProps> = ({
  label, tokens, selected, onSelect, disabled, forbiddenId
}) => {
  const handleClick = (token: TokenWithMeta) => {
    if (disabled || token.tokenId === forbiddenId) return;
    onSelect(selected?.tokenId === token.tokenId ? null : token);
  };

  return (
    <VStack align="stretch" spacing={3}>
      <Text fontWeight="bold" textAlign="center">{label}</Text>
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={2} maxH="400px" overflowY="auto">
        {tokens.map(token => (
          <Box
            key={token.tokenId}
            p={3}
            borderRadius="xl"
            bg={selected?.tokenId === token.tokenId ? "brand.gold" :
                token.tokenId === forbiddenId ? "gray.700" :
                "rgba(17,25,40,0.6)"}
            border="2px solid"
            borderColor={selected?.tokenId === token.tokenId ? "brand.gold" : "purple.700"}
            cursor={disabled || token.tokenId === forbiddenId ? "not-allowed" : "pointer"}
            opacity={token.tokenId === forbiddenId ? 0.5 : 1}
            onClick={() => handleClick(token)}
            transition="all 0.2s"
            _hover={!disabled && token.tokenId !== forbiddenId ? { transform: "scale(1.02)" } : {}}
          >
            <Image
              src={token.image || "/fallback.png"}
              h="80px" w="full"
              objectFit="cover"
              borderRadius="lg" mb={2}
            />
            <Text fontSize="xs" fontWeight="bold" noOfLines={1}>#{token.tokenId}</Text>
            <Text fontSize="xs" color="gray.400" noOfLines={1}>{token.name}</Text>
            <Badge size="xs" colorScheme="purple" mt={1}>{token.roleLabel}</Badge>
          </Box>
        ))}
      </SimpleGrid>
      {selected && (
        <Box p={3} bg="rgba(238,212,132,0.2)" borderRadius="lg" border="1px solid" borderColor="brand.gold">
          <Text fontSize="sm" fontWeight="bold">Sélectionné : #{selected.tokenId} {selected.name}</Text>
          <Button size="xs" mt={1} variant="ghost" onClick={() => onSelect(null)} isDisabled={disabled}>
            Changer
          </Button>
        </Box>
      )}
    </VStack>
  );
};
