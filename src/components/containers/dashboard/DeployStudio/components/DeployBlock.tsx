// components/DeployBlock.tsx
import React from "react";
import {
  Box,
  HStack,
  VStack,
  Text,
  Input,
  Button,
  Badge,
  Switch,
  Tooltip,
  IconButton,
} from "@chakra-ui/react";
import type { DeployBlock, DeployArg, ConstructorHint } from "../hooks/useDeployStudio";

interface Props {
  block: DeployBlock;
  index: number;
  allBlocks: DeployBlock[];
  onUpdate: (b: DeployBlock) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

const STATUS_COLORS = {
  idle: "gray",
  deploying: "yellow",
  done: "green",
  error: "red",
} as const;

const STATUS_LABELS = {
  idle: "En attente",
  deploying: "Déploiement...",
  done: "Déployé ✓",
  error: "Erreur",
} as const;

export function DeployBlockCard({
  block,
  index,
  allBlocks,
  onUpdate,
  onRemove,
  onToggle,
}: Props) {
  const updateArg = (argIndex: number, partial: Partial<DeployArg>) => {
    const newArgs = block.args.map((a, i) =>
      i === argIndex ? { ...a, ...partial } : a
    );
    onUpdate({ ...block, args: newArgs });
  };

  const addArg = () => {
    onUpdate({
      ...block,
      args: [...block.args, { type: "static", value: "" }],
    });
  };

  const removeArg = (i: number) => {
    onUpdate({ ...block, args: block.args.filter((_, idx) => idx !== i) });
  };

  const hint = block.constructorHints;
  const doneBlocks = allBlocks.filter((b) => b.status === "done" && b.id !== block.id);

  return (
    <Box
      bg="blackAlpha.400"
      border="1px solid"
      borderColor={
        block.status === "done"
          ? "green.500"
          : block.status === "error"
          ? "red.500"
          : block.status === "deploying"
          ? "yellow.500"
          : "whiteAlpha.100"
      }
      borderRadius="xl"
      p={4}
      opacity={block.enabled ? 1 : 0.5}
      transition="all 0.2s"
      position="relative"
      _before={
        index > 0
          ? {
              content: '""',
              position: "absolute",
              top: "-20px",
              left: "50%",
              transform: "translateX(-50%)",
              w: "1px",
              h: "20px",
              bg: "whiteAlpha.200",
            }
          : {}
      }
    >
      {/* Header */}
      <HStack justify="space-between" mb={3}>
        <HStack spacing={2}>
          <Badge
            fontFamily="mono"
            fontSize="9px"
            colorScheme="purple"
            variant="subtle"
          >
            #{index + 1}
          </Badge>
          <Text fontFamily="mono" fontWeight="bold" fontSize="sm" color="white">
            {block.contractName}
          </Text>
          <Badge
            colorScheme={STATUS_COLORS[block.status]}
            variant={block.status === "done" ? "solid" : "subtle"}
            fontSize="9px"
            fontFamily="mono"
          >
            {STATUS_LABELS[block.status]}
          </Badge>
        </HStack>

        <HStack spacing={1}>
          <Switch
            size="sm"
            isChecked={block.enabled}
            onChange={(e) => onToggle(block.id, e.target.checked)}
            colorScheme="purple"
          />
          <Tooltip label="Supprimer" placement="top">
            <IconButton
              aria-label="Supprimer bloc"
              icon={<Text fontSize="xs">✕</Text>}
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => onRemove(block.id)}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {/* Adresse déployée */}
      {block.deployedAddress && (
        <Box
          bg="green.900"
          border="1px solid"
          borderColor="green.500"
          borderRadius="md"
          px={3}
          py={1.5}
          mb={3}
        >
          <Text fontSize="10px" color="green.300" fontFamily="mono" wordBreak="break-all">
            📍 {block.deployedAddress}
          </Text>
        </Box>
      )}

      {/* Arguments */}
      {block.args.length > 0 && (
        <VStack align="stretch" spacing={2} mb={3}>
          <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono">
            Arguments constructeur
          </Text>
          {block.args.map((arg, i) => {
            const h: ConstructorHint | undefined = hint?.[i];
            // Priorité : hint du template (arg.hint) > hint de l'ABI (h.hint) > name+type générique
            const placeholder =
              arg.hint ||
              h?.hint ||
              (h ? `${h.name} (${h.type})` : `Arg ${i + 1}`);

            return (
              <HStack key={i} spacing={2} align="flex-start">
                <Box flex={1}>
                  {arg.type === "static" ? (
                    <VStack align="stretch" spacing={0.5}>
                      {/* Label descriptif au-dessus du champ */}
                      {(arg.hint || h?.hint) && (
                        <Text
                          fontSize="9px"
                          color="purple.300"
                          fontFamily="mono"
                          noOfLines={2}
                          lineHeight="1.3"
                        >
                          {arg.hint || h?.hint}
                        </Text>
                      )}
                      <Input
                        value={arg.value ?? ""}
                        onChange={(e) => updateArg(i, { value: e.target.value })}
                        placeholder={placeholder}
                        size="xs"
                        fontFamily="mono"
                        bg="blackAlpha.300"
                        border="1px solid"
                        borderColor="whiteAlpha.100"
                        color="white"
                        _placeholder={{ color: "whiteAlpha.200" }}
                        _focus={{ borderColor: "purple.400", boxShadow: "none" }}
                      />
                    </VStack>
                  ) : (
                    <Box
                      bg="purple.900"
                      borderRadius="md"
                      px={2}
                      py={1}
                      border="1px solid"
                      borderColor="purple.500"
                    >
                      <Text fontSize="10px" fontFamily="mono" color="purple.300">
                        ← {allBlocks.find((b) => b.id === arg.sourceBlockId)?.contractName ?? "?"} (adresse auto)
                      </Text>
                    </Box>
                  )}
                </Box>

                {/* Switcher type static/contract */}
                {doneBlocks.length > 0 && arg.type === "static" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="purple"
                    onClick={() =>
                      updateArg(i, {
                        type: "contract",
                        sourceBlockId: doneBlocks[0].id,
                      })
                    }
                    fontFamily="mono"
                    fontSize="9px"
                    flexShrink={0}
                  >
                    ⟵ contrat
                  </Button>
                )}
                {arg.type === "contract" && (
                  <Button
                    size="xs"
                    variant="ghost"
                    colorScheme="whiteAlpha"
                    onClick={() =>
                      updateArg(i, { type: "static", value: "", sourceBlockId: undefined })
                    }
                    fontFamily="mono"
                    fontSize="9px"
                    flexShrink={0}
                  >
                    texte
                  </Button>
                )}

                <IconButton
                  aria-label="Supprimer arg"
                  icon={<Text fontSize="9px">✕</Text>}
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeArg(i)}
                  flexShrink={0}
                />
              </HStack>
            );
          })}
        </VStack>
      )}

      {/* Ajouter arg */}
      <Button
        size="xs"
        variant="ghost"
        colorScheme="whiteAlpha"
        onClick={addArg}
        fontFamily="mono"
        fontSize="10px"
        w="full"
        border="1px dashed"
        borderColor="whiteAlpha.100"
        _hover={{ borderColor: "purple.400", color: "purple.300" }}
      >
        + argument
      </Button>
    </Box>
  );
}
