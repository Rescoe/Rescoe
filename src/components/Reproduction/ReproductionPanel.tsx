// src/components/Reproduction/ReproductionPanel.tsx - ✅ RAPIDE + NO RPC ERROR
import React, { useState, useCallback } from "react";
import {
  Box, Button, Center, HStack, SimpleGrid, Spinner, Text, VStack, Image, Alert, AlertIcon
} from "@chakra-ui/react";
import { AddIcon, RepeatIcon } from "@chakra-ui/icons";
import { ParentSelector } from "./ParentSelector";
import type { UseReproductionReturn } from "@/hooks/useReproduction";

interface ReproductionPanelProps {
  reproduction: UseReproductionReturn;
  renewPriceEth: string | null;
}

export const ReproductionPanel: React.FC<ReproductionPanelProps> = ({
  reproduction,
  renewPriceEth
}) => {
  const [eggPreviewNum, setEggPreviewNum] = useState(1);

  const refreshEggPreview = useCallback(() => {
    setEggPreviewNum(Math.floor(Math.random() * 3) + 1);  // ✅ 3 œufs seulement
  }, []);

  const eggPrice = renewPriceEth ? (Number(renewPriceEth) / 2).toFixed(4) : "0.0025";

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

      {/* Statut Scan */}
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
        /* ✅ FORMULAIRE PARENTS */
        <VStack spacing={6}>
          {/* Stats */}
          <Box p={4} bg="rgba(0,0,0,0.3)" borderRadius="xl" border="1px solid" borderColor="purple.700">
            <Text fontWeight="bold" mb={2}>Prérequis vérifiés</Text>
            <HStack spacing={4} mb={2}>
              <Text color={reproduction.eligibleTokens.length >= 2 ? "green.400" : "orange.400"}>
                🐛 {reproduction.eligibleTokens.length} parents lvl 3
              </Text>
              <Text color="green.400">💰 {eggPrice} ETH</Text>
            </HStack>
            {/* ✅ UNIQUEMENT ÇA → reproduction.userPoints */}
            <Text color={reproduction.userPoints >= 100 ? "green.400" : "orange.400"}>
              💰 Points: {reproduction.userPoints}/100
            </Text>
            {reproduction.userPoints < 100 && (
              <Alert status="warning" mt={1} fontSize="sm">
                <AlertIcon /> Points insuffisants pour reproduction
              </Alert>
            )}
          </Box>


          {/* Sélecteurs Parents */}
          <Box w="full">
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

          {/* ✅ ŒUF PREVIEW OPTIMISÉ */}
          {reproduction.parentA && reproduction.parentB && (
            <Box p={6} bg="rgba(17,25,40,0.6)" borderRadius="2xl" border="2px solid" borderColor="brand.gold">
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="bold">
                  🥚 Aperçu : {reproduction.parentA.name} × {reproduction.parentB.name}
                </Text>
                <Button
                  size="xs"
                  leftIcon={<RepeatIcon />}
                  onClick={refreshEggPreview}
                  variant="ghost"
                  colorScheme="purple"
                >
                  Nouvel œuf
                </Button>
              </HStack>
              <Image
                src={`/OEUFS/OEUF${eggPreviewNum}.gif`}
                fallbackSrc="/OEUFS/OEUF1.gif"
                alt="Œuf preview"
                maxW="200px" mx="auto"
                borderRadius="xl"
                loading="lazy"
                transition="opacity 0.2s"
              />
            </Box>
          )}

          {/* ✅ BOUTON REPRO OPTIMISÉ */}
          {reproduction.parentA && reproduction.parentB && (
            <Button
              colorScheme="purple"
              size="lg"
              h={16}
              fontSize="lg"
              onClick={() => reproduction.reproduce()}
              isDisabled={reproduction.isReproducing}
              isLoading={reproduction.isReproducing}
              loadingText="Génération œuf..."
              boxShadow="lg"
            >
              🥚 Créer œuf – {eggPrice} ETH + 100 points
            </Button>
          )}
        </VStack>
      )}

      {/* Erreurs */}
      {reproduction.error && (
        <Alert status="error" borderRadius="lg">
          <AlertIcon />
          <Box flex={1}>
            <Text fontWeight="bold">{reproduction.error}</Text>
            {reproduction.error.includes('RPC') && (
              <Text fontSize="sm" mt={1}>Vérifiez MetaMask + réseau Sepolia</Text>
            )}
          </Box>
          <Button
            ml={4}
            size="sm"
            onClick={() => reproduction.reproduce()}
            colorScheme="purple"
            variant="outline"
          >
            Réessayer
          </Button>
        </Alert>
      )}

      {/* Succès */}
      {reproduction.lastTxHash && (
        <Alert status="success" borderRadius="lg">
          <AlertIcon />
          <HStack w="full" justify="space-between">
            <Text fontWeight="bold">✅ Œuf créé avec succès !</Text>
            <HStack>
              <Text fontSize="sm" fontFamily="mono" bg="green.100" px={2} py={1} borderRadius="md">
                Tx: {reproduction.lastTxHash.slice(2,10)}...
              </Text>
              <Button
                as="a"
                href={`https://sepolia.etherscan.io/tx/${reproduction.lastTxHash}`}
                target="_blank"
                size="sm"
                colorScheme="green"
              >
                Explorer
              </Button>
            </HStack>
          </HStack>
        </Alert>
      )}
    </VStack>
  );
};
