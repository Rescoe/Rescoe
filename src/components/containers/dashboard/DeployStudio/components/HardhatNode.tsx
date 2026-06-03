// components/HardhatNode.tsx
import React from "react";
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  Badge,
} from "@chakra-ui/react";

interface Props {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onCheck: () => void;
}

export function HardhatNode({ running, onStart, onStop, onCheck }: Props) {
  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor={running ? "green.500" : "whiteAlpha.100"}
      borderRadius="xl"
      p={4}
      transition="border-color 0.3s"
    >
      <HStack justify="space-between" mb={3}>
        <VStack align="start" spacing={0}>
          <Text
            fontSize="xs"
            color="whiteAlpha.500"
            fontFamily="mono"
            letterSpacing="wider"
          >
            NŒUD HARDHAT LOCAL
          </Text>
          <HStack spacing={2} mt={1}>
            <Box
              w={2.5}
              h={2.5}
              borderRadius="full"
              bg={running ? "green.400" : "red.400"}
              boxShadow={running ? "0 0 8px #68D391" : "none"}
              transition="all 0.3s"
            />
            <Badge
              colorScheme={running ? "green" : "red"}
              variant="subtle"
              fontFamily="mono"
              fontSize="10px"
            >
              {running ? "Actif — localhost:8545" : "Inactif"}
            </Badge>
          </HStack>
        </VStack>

        <HStack spacing={2}>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={onCheck}
            fontFamily="mono"
          >
            ↺ Rafraîchir
          </Button>
          {!running ? (
            <Button
              size="xs"
              colorScheme="green"
              variant="solid"
              onClick={onStart}
              fontFamily="mono"
            >
              ▶ Démarrer
            </Button>
          ) : (
            <Button
              size="xs"
              colorScheme="red"
              variant="ghost"
              onClick={onStop}
              fontFamily="mono"
            >
              ■ Arrêter
            </Button>
          )}
        </HStack>
      </HStack>

      <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono">
        Requis uniquement pour déployer en mode Hardhat (tests locaux).
        <br />
        Pour Base Sepolia / Mainnet, le nœud n&apos;est pas nécessaire.
      </Text>
    </Box>
  );
}
