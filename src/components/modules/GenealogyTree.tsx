/**
 * GenealogyTree
 *
 * Arbre généalogique d'un token Rescoe.
 * Lit la généalogie 100 % on-chain : hatchedFromEgg + reproductionParents.
 *
 * Cas possibles :
 *   1. Adhésion directe (pas d'œuf) → nœud racine unique
 *   2. Né d'un œuf → parents A & B → œuf → token actuel
 *
 * En cliquant sur un parent, l'utilisateur est redirigé vers sa page.
 *
 * Évolution future : récursion sur les parents (N générations).
 * Pour l'instant la profondeur est limitée à 1 niveau de parents.
 */

import React from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  Button,
  VStack,
  HStack,
  Spinner,
  Divider,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { GenealogyInfo } from "@/hooks/useEvolutionHistory";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const shortId = (id: number) => `#${id}`;

// ─── Nœud générique ──────────────────────────────────────────────────────────

interface NodeProps {
  label: string;
  sublabel?: string;
  isHighlighted?: boolean;
  onClick?: () => void;
  badge?: string;
  badgeColor?: string;
}

const TreeNode = ({ label, sublabel, isHighlighted, onClick, badge, badgeColor = "gray" }: NodeProps) => (
  <Box
    border="2px solid"
    borderColor={isHighlighted ? "brand.gold" : "whiteAlpha.300"}
    borderRadius="xl"
    px={4}
    py={3}
    bg={isHighlighted ? "whiteAlpha.100" : "transparent"}
    minW="120px"
    textAlign="center"
    cursor={onClick ? "pointer" : "default"}
    onClick={onClick}
    _hover={onClick ? { borderColor: "brand.gold", transform: "scale(1.03)" } : {}}
    transition="all 0.2s"
    position="relative"
  >
    {badge && (
      <Badge
        colorScheme={badgeColor}
        position="absolute"
        top={1}
        right={1}
        fontSize="8px"
        borderRadius="full"
      >
        {badge}
      </Badge>
    )}
    <Text fontSize="sm" fontWeight="bold" color={isHighlighted ? "brand.gold" : "whiteAlpha.900"}>
      {label}
    </Text>
    {sublabel && (
      <Text fontSize="10px" color="whiteAlpha.500" mt={1}>
        {sublabel}
      </Text>
    )}
    {isHighlighted && (
      <Text fontSize="9px" color="brand.gold" mt={1} fontWeight="bold">
        ● Token actuel
      </Text>
    )}
  </Box>
);

// ─── Connecteur vertical ──────────────────────────────────────────────────────

const VConnector = ({ label }: { label?: string }) => (
  <VStack spacing={0} my={1}>
    <Divider orientation="vertical" h="20px" borderColor="whiteAlpha.300" />
    {label && (
      <Text fontSize="9px" color="whiteAlpha.400" px={1}>
        {label}
      </Text>
    )}
    <Text fontSize="sm" color="whiteAlpha.400" lineHeight={1}>↓</Text>
  </VStack>
);

// ─── Composant principal ──────────────────────────────────────────────────────

interface GenealogyTreeProps {
  tokenId: number | string;
  genealogy: GenealogyInfo | null;
  isLoading: boolean;
  contractAddress: string;
}

const GenealogyTree = ({ tokenId, genealogy, isLoading, contractAddress }: GenealogyTreeProps) => {
  const router = useRouter();

  const goToToken = (id: number) =>
    router.push(`/AdhesionId/${contractAddress}/${id}`);

  if (isLoading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner size="md" color="brand.gold" />
      </Flex>
    );
  }

  if (!genealogy) {
    return (
      <Text fontSize="sm" color="whiteAlpha.500" textAlign="center" py={6}>
        Généalogie non disponible.
      </Text>
    );
  }

  // ── Cas 1 : adhésion directe ──────────────────────────────────────────────
  if (!genealogy.isFromEgg) {
    return (
      <VStack spacing={3} py={4} align="center">
        <Text fontSize="xs" color="whiteAlpha.400" textAlign="center">
          Ce token est issu d'une <strong>adhésion directe</strong> — pas de parents géniteurs.
        </Text>
        <Box
          border="2px dashed"
          borderColor="whiteAlpha.200"
          borderRadius="xl"
          px={6}
          py={4}
          textAlign="center"
        >
          <Text fontSize="2xl" mb={1}>🌱</Text>
          <Text fontSize="sm" color="whiteAlpha.700" fontWeight="bold">
            Token {shortId(Number(tokenId))}
          </Text>
          <Text fontSize="10px" color="whiteAlpha.400">Adhésion originelle</Text>
        </Box>
        <Text fontSize="xs" color="whiteAlpha.300" textAlign="center" maxW="280px">
          Les arbres généalogiques se construisent à partir de la reproduction (LVL 3 requis).
        </Text>
      </VStack>
    );
  }

  // ── Cas 2 : né d'un œuf ───────────────────────────────────────────────────
  const { eggId, parentA, parentB } = genealogy;

  return (
    <VStack spacing={0} align="center" py={4}>
      <Text fontSize="xs" color="whiteAlpha.400" mb={4} textAlign="center">
        Cet insecte est né de l'œuf {shortId(eggId!)} — issu de deux parents LVL 3.
      </Text>

      {/* Ligne des parents */}
      <HStack spacing={6} align="center" mb={0}>
        <TreeNode
          label={`Token ${shortId(parentA!)}`}
          sublabel="Parent A · LVL 3"
          badge="LVL 3"
          badgeColor="purple"
          onClick={() => goToToken(parentA!)}
        />
        <Text fontSize="xs" color="whiteAlpha.300">✕</Text>
        <TreeNode
          label={`Token ${shortId(parentB!)}`}
          sublabel="Parent B · LVL 3"
          badge="LVL 3"
          badgeColor="purple"
          onClick={() => goToToken(parentB!)}
        />
      </HStack>

      {/* Connecteur parents → œuf */}
      <Box position="relative" w="220px" h="30px">
        {/* Ligne horizontale reliant les deux parents */}
        <Box
          position="absolute"
          top="0"
          left="25%"
          right="25%"
          h="1px"
          bg="whiteAlpha.300"
        />
        {/* Ligne verticale centrale */}
        <Box
          position="absolute"
          top="0"
          left="50%"
          transform="translateX(-50%)"
          w="1px"
          h="full"
          bg="whiteAlpha.300"
        />
        <Text
          position="absolute"
          bottom="0"
          left="50%"
          transform="translateX(-50%)"
          fontSize="xs"
          color="whiteAlpha.400"
        >
          ↓
        </Text>
      </Box>

      {/* Œuf */}
      <TreeNode
        label={`Œuf ${shortId(eggId!)}`}
        sublabel="Artefact immuable"
        badge="Œuf"
        badgeColor="orange"
        onClick={() => goToToken(eggId!)}
      />

      <VConnector label="éclosion" />

      {/* Token actuel */}
      <TreeNode
        label={`Token ${shortId(Number(tokenId))}`}
        sublabel="Insecte éclos"
        isHighlighted
      />

      <Text fontSize="10px" color="whiteAlpha.300" mt={4} textAlign="center">
        Cliquez sur un nœud pour accéder à sa page.
      </Text>
    </VStack>
  );
};

export default GenealogyTree;
