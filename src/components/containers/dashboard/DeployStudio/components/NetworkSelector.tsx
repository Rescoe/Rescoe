// components/NetworkSelector.tsx
import React from "react";
import { HStack, Button, Badge, Text, Box } from "@chakra-ui/react";

type Network = "hardhat" | "baseSepolia" | "base";

interface Props {
  value: Network;
  onChange: (n: Network) => void;
  hardhatRunning: boolean;
}

const NETWORKS: { id: Network; label: string; color: string; chainId: string }[] = [
  { id: "hardhat", label: "Hardhat Local", color: "green", chainId: "31337" },
  { id: "baseSepolia", label: "Base Sepolia", color: "blue", chainId: "84532" },
  { id: "base", label: "Base Mainnet", color: "orange", chainId: "8453" },
];

export function NetworkSelector({ value, onChange, hardhatRunning }: Props) {
  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p={4}
    >
      <Text fontSize="xs" color="whiteAlpha.500" mb={3} fontFamily="mono" letterSpacing="wider">
        RÉSEAU CIBLE
      </Text>
      <HStack spacing={2} flexWrap="wrap">
        {NETWORKS.map((n) => (
          <Button
            key={n.id}
            size="sm"
            variant={value === n.id ? "solid" : "ghost"}
            colorScheme={value === n.id ? n.color : "whiteAlpha"}
            fontFamily="mono"
            fontSize="xs"
            onClick={() => onChange(n.id)}
            position="relative"
            pr={n.id === "hardhat" ? 8 : 4}
          >
            {n.label}
            {n.id === "hardhat" && (
              <Box
                as="span"
                display="inline-block"
                w={2}
                h={2}
                borderRadius="full"
                bg={hardhatRunning ? "green.400" : "red.400"}
                position="absolute"
                right={2}
                top="50%"
                transform="translateY(-50%)"
                boxShadow={hardhatRunning ? "0 0 6px #68D391" : "none"}
              />
            )}
          </Button>
        ))}
      </HStack>
      <Text fontSize="10px" color="whiteAlpha.400" mt={2} fontFamily="mono">
        Chain ID : {NETWORKS.find((n) => n.id === value)?.chainId}
        {value === "base" && (
          <Text as="span" color="orange.300" ml={2}>
            ⚠️ Mainnet — fonds réels
          </Text>
        )}
      </Text>
    </Box>
  );
}
