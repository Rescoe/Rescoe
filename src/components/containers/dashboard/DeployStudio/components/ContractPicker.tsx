// components/ContractPicker.tsx
import React, { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";

interface Props {
  contracts: string[];
  onAdd: (name: string) => void;
  onCompile: () => void;
  onRefresh: () => void;
  isCompiling: boolean;
}

// Contrats retirés de l'UI (remplacés par des versions plus récentes)
const HIDDEN_CONTRACTS = new Set([
  "InsectImageStorage",    // V1 - remplacé par V3
  "InsectImageStorageV2",  // V2 - remplacé par V3
]);

// Catégorisation automatique par nom
function getCategory(name: string): string {
  if (name.toLowerCase().includes("insectimage")) return "Storage";
  if (name.toLowerCase().includes("adhesion"))    return "Adhésion";
  if (name.toLowerCase().includes("art"))         return "Art";
  if (name.toLowerCase().includes("poetry") || name.toLowerCase().includes("haiku"))
    return "Poésie";
  if (name.toLowerCase().includes("factory"))     return "Factory";
  if (name.toLowerCase().includes("manager") || name.toLowerCase().includes("collection"))
    return "Collections";
  return "Autre";
}

const CATEGORY_COLORS: Record<string, string> = {
  Storage:    "green",
  Adhésion:   "purple",
  Art:        "pink",
  Poésie:     "cyan",
  Factory:    "orange",
  Collections:"blue",
  Autre:      "gray",
};

export function ContractPicker({
  contracts,
  onAdd,
  onCompile,
  onRefresh,
  isCompiling,
}: Props) {
  const [filter, setFilter] = useState("");
  const [manualName, setManualName] = useState("");

  const filtered = contracts.filter(
    (c) =>
      !HIDDEN_CONTRACTS.has(c) &&
      c.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p={4}
    >
      <HStack justify="space-between" mb={3}>
        <Text
          fontSize="xs"
          color="whiteAlpha.500"
          fontFamily="mono"
          letterSpacing="wider"
        >
          CONTRATS DISPONIBLES ({contracts.length})
        </Text>
        <HStack spacing={2}>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={onRefresh}
            fontFamily="mono"
          >
            ↺
          </Button>
          <Button
            size="xs"
            colorScheme="purple"
            variant="outline"
            onClick={onCompile}
            isLoading={isCompiling}
            loadingText="Compilation..."
            fontFamily="mono"
          >
            🔨 Compiler
          </Button>
        </HStack>
      </HStack>

      {contracts.length === 0 ? (
        <Box
          p={6}
          textAlign="center"
          bg="whiteAlpha.50"
          borderRadius="lg"
          border="1px dashed"
          borderColor="whiteAlpha.200"
        >
          <Text color="whiteAlpha.400" fontSize="sm" fontFamily="mono">
            Aucun contrat compilé.
          </Text>
          <Text color="whiteAlpha.300" fontSize="xs" mt={1}>
            Lance une compilation Hardhat pour voir les contrats.
          </Text>
        </Box>
      ) : (
        <>
          <Input
            placeholder="Filtrer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            size="sm"
            fontFamily="mono"
            fontSize="xs"
            bg="blackAlpha.300"
            border="1px solid"
            borderColor="whiteAlpha.100"
            color="white"
            _placeholder={{ color: "whiteAlpha.300" }}
            mb={3}
            _focus={{ borderColor: "purple.400", boxShadow: "none" }}
          />

          <SimpleGrid columns={2} spacing={2}>
            {filtered.map((name) => {
              const cat = getCategory(name);
              return (
                <Button
                  key={name}
                  size="sm"
                  variant="ghost"
                  justifyContent="space-between"
                  onClick={() => onAdd(name)}
                  fontFamily="mono"
                  fontSize="xs"
                  bg="blackAlpha.300"
                  _hover={{ bg: "purple.900", borderColor: "purple.400" }}
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  pr={2}
                  h="auto"
                  py={2}
                >
                  <Text noOfLines={1} flex={1} textAlign="left">
                    {name}
                  </Text>
                  <Badge
                    colorScheme={CATEGORY_COLORS[cat] ?? "gray"}
                    variant="subtle"
                    fontSize="9px"
                    ml={1}
                    flexShrink={0}
                  >
                    {cat}
                  </Badge>
                </Button>
              );
            })}
          </SimpleGrid>
        </>
      )}

      {/* Ajout manuel */}
      <Box mt={4} pt={3} borderTop="1px solid" borderColor="whiteAlpha.100">
        <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono" mb={2}>
          Ajouter par nom exact
        </Text>
        <HStack>
          <Input
            placeholder="NomDuContrat"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            size="sm"
            fontFamily="mono"
            fontSize="xs"
            bg="blackAlpha.300"
            border="1px solid"
            borderColor="whiteAlpha.100"
            color="white"
            _placeholder={{ color: "whiteAlpha.300" }}
            _focus={{ borderColor: "purple.400", boxShadow: "none" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualName.trim()) {
                onAdd(manualName.trim());
                setManualName("");
              }
            }}
          />
          <Button
            size="sm"
            colorScheme="purple"
            variant="solid"
            onClick={() => {
              if (manualName.trim()) {
                onAdd(manualName.trim());
                setManualName("");
              }
            }}
            fontFamily="mono"
            fontSize="xs"
            flexShrink={0}
          >
            + Ajouter
          </Button>
        </HStack>
      </Box>
    </Box>
  );
}
