import React, { useMemo } from "react";
import {
  Box,
  Button,
  Center,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  Alert,
  AlertIcon,
  Divider,
  Badge,
  Stack,
  useBreakpointValue,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { ParentSelector } from "./ParentSelector";
import type { UseReproductionReturn } from "@/hooks/useReproduction";

interface ReproductionPanelProps {
  reproduction: UseReproductionReturn;
  renewPriceEth: string | null;
}

export const ReproductionPanel: React.FC<ReproductionPanelProps> = ({
  reproduction,
  renewPriceEth,
}) => {
  const eggPrice = useMemo(
    () => (renewPriceEth ? (Number(renewPriceEth) / 2).toFixed(4) : "0.0025"),
    [renewPriceEth]
  );

  const canReproduce =
    !!reproduction.parentA &&
    !!reproduction.parentB &&
    !reproduction.isReproducing &&
    reproduction.userPoints >= 100;

  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <VStack spacing={{ base: 4, md: 6 }} align="stretch" w="full">
      <Box
        borderRadius="2xl"
        border="1px solid"
        borderColor="whiteAlpha.200"
        bg="blackAlpha.300"
        px={{ base: 4, md: 6 }}
        py={{ base: 4, md: 5 }}
      >
        <Stack
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
          spacing={4}
        >
          <Box>
            <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold">
              🥚 Reproduction
            </Text>
            <Text mt={1} fontSize="sm" color="whiteAlpha.700">
              Sélectionnez deux créatures éligibles pour générer un œuf hybride.
            </Text>
          </Box>

          <Button
            size={{ base: "md", md: "sm" }}
            leftIcon={<AddIcon />}
            onClick={reproduction.startScanning}
            isDisabled={reproduction.isLoadingEligible}
            isLoading={reproduction.isLoadingEligible}
            borderRadius="xl"
            w={{ base: "full", md: "auto" }}
          >
            {reproduction.hasScanned ? "Rescanner" : "Scanner les parents"}
          </Button>
        </Stack>
      </Box>

      {!reproduction.hasScanned ? (
        <Center
          p={{ base: 6, md: 10 }}
          flexDirection="column"
          borderRadius="2xl"
          border="1px dashed"
          borderColor="whiteAlpha.300"
          bg="blackAlpha.200"
          textAlign="center"
        >
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" mb={2}>
            Lancez un scan pour trouver vos parents compatibles
          </Text>
          <Text fontSize="sm" color="whiteAlpha.700">
            Conditions : niveau 3, au moins 1 an d’ancienneté, et 100 points.
          </Text>
        </Center>
      ) : reproduction.isLoadingEligible ? (
        <Center
          p={{ base: 6, md: 10 }}
          borderRadius="2xl"
          bg="blackAlpha.200"
          flexDirection={{ base: "column", md: "row" }}
        >
          <Spinner size="lg" />
          <Text mt={{ base: 3, md: 0 }} ml={{ base: 0, md: 4 }}>
            Scan en cours... ({reproduction.eligibleTokens.length} trouvés)
          </Text>
        </Center>
      ) : reproduction.eligibleTokens.length === 0 ? (
        <Center
          p={{ base: 6, md: 10 }}
          borderRadius="2xl"
          bg="orange.500"
          color="white"
          flexDirection="column"
          textAlign="center"
        >
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" mb={1}>
            Aucune créature éligible
          </Text>
          <Text fontSize="sm">
            Il faut 2 créatures niveau 3 avec au moins 1 an d’ancienneté.
          </Text>
        </Center>
      ) : (
        <VStack spacing={{ base: 4, md: 6 }} align="stretch">
          <Box
            borderRadius="2xl"
            border="1px solid"
            borderColor="whiteAlpha.200"
            bg="blackAlpha.300"
            px={{ base: 4, md: 5 }}
            py={{ base: 4, md: 5 }}
          >
            <Text fontWeight="bold" mb={4}>
              Prérequis
            </Text>

            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
              <Box borderRadius="xl" bg="whiteAlpha.100" p={3}>
                <Text fontSize="xs" color="whiteAlpha.700" mb={1}>
                  Parents disponibles
                </Text>
                <Text fontWeight="bold">
                  {reproduction.eligibleTokens.length} / 2 minimum
                </Text>
              </Box>

              <Box borderRadius="xl" bg="whiteAlpha.100" p={3}>
                <Text fontSize="xs" color="whiteAlpha.700" mb={1}>
                  Coût ETH
                </Text>
                <Text fontWeight="bold">{eggPrice} ETH</Text>
              </Box>

              <Box borderRadius="xl" bg="whiteAlpha.100" p={3}>
                <Text fontSize="xs" color="whiteAlpha.700" mb={1}>
                  Points
                </Text>
                <Text fontWeight="bold">{reproduction.userPoints}/100</Text>
              </Box>
            </SimpleGrid>

            {reproduction.userPoints < 100 && (
              <Alert status="warning" mt={4} borderRadius="xl">
                <AlertIcon />
                Points insuffisants pour lancer une reproduction.
              </Alert>
            )}
          </Box>

          <Box
            borderRadius="2xl"
            border="1px solid"
            borderColor="whiteAlpha.200"
            bg="blackAlpha.300"
            p={{ base: 4, md: 5 }}
          >
            <Text fontWeight="bold" mb={4}>
              Choisir les parents
            </Text>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
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
            <Box
              borderRadius="2xl"
              border="1px solid"
              borderColor="whiteAlpha.200"
              bg="blackAlpha.400"
              p={{ base: 4, md: 5 }}
            >
              <Text fontWeight="bold" mb={4}>
                Union sélectionnée
              </Text>

              <Stack
                direction={{ base: "column", md: "row" }}
                spacing={4}
                align={{ base: "stretch", md: "center" }}
                justify="space-between"
              >
                <Box flex="1">
                  <HStack wrap="wrap" spacing={2} mb={2}>
                    <Badge borderRadius="full" px={3} py={1}>
                      {reproduction.parentA.name}
                    </Badge>
                    <Text fontWeight="bold">×</Text>
                    <Badge borderRadius="full" px={3} py={1}>
                      {reproduction.parentB.name}
                    </Badge>
                  </HStack>

                  <Text fontSize="sm" color="whiteAlpha.700">
                    L’œuf héritera de la lignée des deux parents et sera minté en badge niveau 0.
                  </Text>
                </Box>

                <Box
                  minW={{ base: "full", md: "220px" }}
                  borderRadius="xl"
                  bg="whiteAlpha.100"
                  p={4}
                >
                  <Text fontSize="xs" color="whiteAlpha.700" mb={1}>
                    Coût final
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    {eggPrice} ETH + 100 points
                  </Text>
                </Box>
              </Stack>
            </Box>
          )}
        </VStack>
      )}

      {reproduction.error && (
        <Alert status="error" borderRadius="xl">
          <AlertIcon />
          <Box flex="1">
            <Text fontWeight="bold">{reproduction.error}</Text>
            {reproduction.error.includes("RPC") && (
              <Text fontSize="sm" mt={1}>
                Vérifiez MetaMask et le réseau Sepolia.
              </Text>
            )}
          </Box>
        </Alert>
      )}

      {reproduction.lastTxHash && (
        <Alert status="success" borderRadius="xl">
          <AlertIcon />
          <Stack
            direction={{ base: "column", md: "row" }}
            w="full"
            justify="space-between"
            align={{ base: "flex-start", md: "center" }}
            spacing={3}
          >
            <Text fontWeight="bold">Œuf créé avec succès</Text>
            <HStack spacing={3} flexWrap="wrap">
              <Text
                fontSize="sm"
                fontFamily="mono"
                bg="whiteAlpha.200"
                px={2}
                py={1}
                borderRadius="md"
              >
                Tx: {reproduction.lastTxHash.slice(2, 10)}...
              </Text>
              <Button
                as="a"
                href={`https://sepolia.etherscan.io/tx/${reproduction.lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="outline"
              >
                Explorer
              </Button>
            </HStack>
          </Stack>
        </Alert>
      )}

      {reproduction.parentA && reproduction.parentB && (
        <Box
          position={{ base: "sticky", md: "static" }}
          bottom={{ base: 3, md: "auto" }}
          zIndex={20}
          pt={2}
        >
          <Box
            borderRadius="2xl"
            bg={{ base: "rgba(10,10,10,0.92)", md: "transparent" }}
            backdropFilter={{ base: "blur(10px)", md: "none" }}
            p={{ base: 3, md: 0 }}
            border={{ base: "1px solid", md: "none" }}
            borderColor={{ base: "whiteAlpha.200", md: "transparent" }}
          >
            <Button
              w="full"
              size="lg"
              h={{ base: 14, md: 16 }}
              fontSize={{ base: "md", md: "lg" }}
              onClick={() => reproduction.reproduce()}
              isDisabled={!canReproduce}
              isLoading={reproduction.isReproducing}
              loadingText="Génération œuf..."
              borderRadius="xl"
              boxShadow="lg"
            >
              🥚 Créer l’œuf — {eggPrice} ETH + 100 points
            </Button>
          </Box>
        </Box>
      )}
    </VStack>
  );
};
