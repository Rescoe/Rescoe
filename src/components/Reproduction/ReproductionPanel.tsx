// src/components/Reproduction/ReproductionPanel.tsx
import React, { useState } from "react";
import {
  Box, Button, Center, HStack, SimpleGrid, Spinner, Text, VStack, Image
} from "@chakra-ui/react";
import { AddIcon, RepeatIcon } from "@chakra-ui/icons";
import { ParentSelector } from "./ParentSelector";


// ✅ Remplace la ligne 7
import type { UseReproductionReturn } from "@/hooks/useReproduction";

interface ReproductionPanelProps {
  reproduction: UseReproductionReturn;  // ✅ Type correct
  renewPriceEth: string | null;
}

export const ReproductionPanel: React.FC<ReproductionPanelProps> = ({
  reproduction,
  renewPriceEth
}) => {
  const [eggImageUrl, setEggImageUrl] = useState<string>('');

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Text fontWeight="bold" fontSize="xl">🐛 Reproduction</Text>
        <Button
          size="sm"
          leftIcon={<AddIcon />}
          colorScheme="purple"
          onClick={reproduction.startScanning}
          isDisabled={reproduction.isLoadingEligible}
          isLoading={reproduction.isLoadingEligible}
        >
          {reproduction.hasScanned ? "🔄 Rescan" : "Scanner parents"}
        </Button>
      </HStack>

      {/* Statut */}
      {!reproduction.hasScanned ? (
        <Center p={12} flexDirection="column">
          <Text fontSize="lg" color="gray.400" mb={4}>
            Cliquez pour scanner vos créatures lvl 3 éligibles
          </Text>
          <Text fontSize="sm" color="gray.500">
            (Niveau 3 + 1+ an d'ancienneté)
          </Text>
        </Center>
      ) : reproduction.isLoadingEligible ? (
        <Center p={12}>
          <Spinner size="lg" />
          <Text ml={4}>Scan en cours... ({reproduction.eligibleTokens.length} trouvés)</Text>
        </Center>
      ) : reproduction.eligibleTokens.length === 0 ? (
        <Center p={12} color="orange.400" flexDirection="column">
          <Text fontSize="lg" mb={2}>Aucune créature éligible</Text>
          <Text fontSize="sm">Besoin de 2 créatures niveau 3 avec 1+ an</Text>
        </Center>
      ) : (
        <VStack spacing={6}>
          {/* Stats */}
          <Box p={4} bg="rgba(0,0,0,0.3)" borderRadius="xl" border="1px solid" borderColor="purple.700">
            <Text fontWeight="bold" mb={2}>Prérequis vérifiés</Text>
            <HStack spacing={4}>
              <Text color={reproduction.eligibleTokens.length >= 2 ? "green.400" : "orange.400"}>
                🐛 {reproduction.eligibleTokens.length} parents lvl 3
              </Text>
            </HStack>
          </Box>

          {/* Sélecteurs SI ≥2 */}
          {reproduction.eligibleTokens.length >= 2 && (
            <>
              <Box>
                <Text fontWeight="bold" mb={4}>Choisir les parents</Text>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                  <ParentSelector
                    label="Parent A"
                    tokens={reproduction.eligibleTokens}
                    selected={reproduction.parentA}
                    onSelect={reproduction.setParentA}
                    disabled={reproduction.isReproducing}
                    forbiddenId={reproduction.parentB?.tokenId}
                  />
                  <ParentSelector
                    label="Parent B"
                    tokens={reproduction.eligibleTokens}
                    selected={reproduction.parentB}
                    onSelect={reproduction.setParentB}
                    disabled={reproduction.isReproducing}
                    forbiddenId={reproduction.parentA?.tokenId}
                  />
                </SimpleGrid>
              </Box>

              {reproduction.parentA && reproduction.parentB && (
                <Box p={6} bg="rgba(17,25,40,0.6)" borderRadius="2xl" border="2px solid" borderColor="brand.gold">
                  <Text fontWeight="bold" mb={4} textAlign="center">
                    🥚 Aperçu : {reproduction.parentA.name} × {reproduction.parentB.name}
                  </Text>
                  <Image
                    src={`/OEUFS/OEUF${Math.floor(Math.random() * 9) + 1}.gif`}
                    fallbackSrc="/OEUFS/OEUF1.gif"
                    alt="Œuf preview"
                    maxW="200px" mx="auto" borderRadius="xl"
                    onLoad={() => {
                      const url = `/OEUFS/OEUF${Math.floor(Math.random() * 9) + 1}.gif`;
                      console.log('🥚 ŒUF PRÉVIEW CHARGÉ:', url);
                      setEggImageUrl(url);
                    }}
                    onError={(e) => {
                      console.log('❌ Œuf preview ERROR:', e);
                      setEggImageUrl('/OEUFS/OEUF1.gif');
                      (e.target as HTMLImageElement).src = '/OEUFS/OEUF1.gif';
                    }}
                  />
                </Box>
              )}

              <Button
                colorScheme="purple"
                size="lg"
                onClick={() => reproduction.reproduce()}  // ✅ SUPPRIME eggImageUrl
                isDisabled={!reproduction.parentA || !reproduction.parentB || reproduction.isReproducing}
                isLoading={reproduction.isReproducing}
                loadingText="Génération de l'œuf..."
              >
                🥚 Générer œuf – {renewPriceEth ? `${(Number(renewPriceEth)/2).toFixed(4)} ETH` : "..."}
              </Button>

            </>
          )}
        </VStack>
      )}

      {/* Feedback */}
      {reproduction.error && (
        <Text color="red.400" textAlign="center">{reproduction.error}</Text>
      )}
      {reproduction.lastTxHash && (
        <HStack justify="center">
          <Text color="green.400" fontSize="sm">✅ Œuf créé ! Tx:</Text>
          <Text fontSize="xs" fontFamily="mono" bg="gray.800" px={2} py={1} borderRadius="md">
            {reproduction.lastTxHash.slice(0,10)}...
          </Text>
        </HStack>
      )}
    </VStack>
  );
};
