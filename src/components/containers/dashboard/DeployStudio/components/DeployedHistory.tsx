// components/DeployedHistory.tsx
import React, { useState, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Tooltip,
  Link,
  Spinner,
  Collapse,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import type { DeployedContract } from "../hooks/useDeployStudio";

interface Props {
  contracts: DeployedContract[];
  onRemove: (id: string) => void;
  onRefresh: () => void;
  onPurgeAll?: () => Promise<void>;
}

const NETWORK_EXPLORER: Record<string, string> = {
  hardhat: "",
  baseSepolia: "https://sepolia.basescan.org/address/",
  base: "https://basescan.org/address/",
};

const NETWORK_COLORS: Record<string, string> = {
  hardhat: "green",
  baseSepolia: "blue",
  base: "orange",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Télécharge l'ABI d'un contrat compilé */
async function downloadAbi(contractName: string) {
  const res = await fetch(
    `/api/admin/deploy/contracts/abi?name=${encodeURIComponent(contractName)}`
  );
  const data = await res.json();
  if (!data.abi) throw new Error(data.error ?? "ABI introuvable");

  const blob = new Blob([JSON.stringify(data.abi, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${contractName}.abi.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DeployedHistory({ contracts, onRemove, onRefresh, onPurgeAll }: Props) {
  // confirmations individuelles (id → "confirm" | null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // purge : 0 = idle, 1 = première confirmation, 2 = deuxième confirmation, "loading"
  const [purgeStep, setPurgeStep] = useState<0 | 1 | 2 | "loading">(0);

  // export ABI states
  const [exportingAbi, setExportingAbi] = useState<Record<string, boolean>>({});
  const [exportError, setExportError] = useState<Record<string, string>>({});

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  const handleExportAbi = useCallback(async (name: string) => {
    setExportingAbi((p) => ({ ...p, [name]: true }));
    setExportError((p) => ({ ...p, [name]: "" }));
    try {
      await downloadAbi(name);
    } catch (e: unknown) {
      setExportError((p) => ({
        ...p,
        [name]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setExportingAbi((p) => ({ ...p, [name]: false }));
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirmDelete === id) {
        onRemove(id);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(id);
      }
    },
    [confirmDelete, onRemove]
  );

  const handlePurge = useCallback(async () => {
    if (purgeStep === 0) { setPurgeStep(1); return; }
    if (purgeStep === 1) { setPurgeStep(2); return; }
    if (purgeStep === 2 && onPurgeAll) {
      setPurgeStep("loading");
      try {
        await onPurgeAll();
      } finally {
        setPurgeStep(0);
      }
    }
  }, [purgeStep, onPurgeAll]);

  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      p={4}
    >
      <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Text
          fontSize="xs"
          color="whiteAlpha.500"
          fontFamily="mono"
          letterSpacing="wider"
        >
          CONTRATS DÉPLOYÉS ({contracts.length})
        </Text>

        <HStack spacing={2}>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={onRefresh}
            fontFamily="mono"
          >
            ↺ Actualiser
          </Button>

          {onPurgeAll && contracts.length > 0 && (
            <>
              {purgeStep === 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  fontFamily="mono"
                  fontSize="10px"
                  onClick={handlePurge}
                >
                  🗑️ Purger tout
                </Button>
              )}
              {purgeStep === 1 && (
                <HStack spacing={1}>
                  <Text fontSize="10px" color="orange.300" fontFamily="mono">
                    Supprimer {contracts.length} contrats ?
                  </Text>
                  <Button size="xs" colorScheme="orange" variant="outline" fontFamily="mono" fontSize="10px" onClick={handlePurge}>
                    Continuer
                  </Button>
                  <Button size="xs" variant="ghost" colorScheme="whiteAlpha" fontFamily="mono" fontSize="10px" onClick={() => setPurgeStep(0)}>
                    Annuler
                  </Button>
                </HStack>
              )}
              {purgeStep === 2 && (
                <HStack spacing={1}>
                  <Text fontSize="10px" color="red.300" fontFamily="mono" fontWeight="bold">
                    ⚠️ IRRÉVERSIBLE — confirmer ?
                  </Text>
                  <Button size="xs" colorScheme="red" variant="solid" fontFamily="mono" fontSize="10px" onClick={handlePurge}>
                    Purger définitivement
                  </Button>
                  <Button size="xs" variant="ghost" colorScheme="whiteAlpha" fontFamily="mono" fontSize="10px" onClick={() => setPurgeStep(0)}>
                    Annuler
                  </Button>
                </HStack>
              )}
              {purgeStep === "loading" && (
                <HStack>
                  <Spinner size="xs" color="red.300" />
                  <Text fontSize="10px" color="red.300" fontFamily="mono">Purge...</Text>
                </HStack>
              )}
            </>
          )}
        </HStack>
      </HStack>

      {contracts.length === 0 ? (
        <Box
          p={5}
          textAlign="center"
          border="1px dashed"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
        >
          <Text color="whiteAlpha.300" fontSize="xs" fontFamily="mono">
            Aucun contrat déployé pour l&apos;instant.
          </Text>
        </Box>
      ) : (
        <VStack spacing={2} align="stretch">
          {[...contracts].reverse().map((c) => {
            const explorerBase = NETWORK_EXPLORER[c.network] ?? "";
            const explorerUrl = explorerBase ? `${explorerBase}${c.address}` : null;
            const isConfirming = confirmDelete === c.id;

            return (
              <Box
                key={c.id}
                bg="blackAlpha.400"
                border="1px solid"
                borderColor={isConfirming ? "red.700" : "whiteAlpha.100"}
                borderRadius="lg"
                px={3}
                py={2.5}
                transition="border-color 0.2s"
              >
                {/* Ligne 1 : nom + réseau + date */}
                <HStack justify="space-between">
                  <HStack spacing={2} flex={1} minW={0}>
                    <Badge
                      colorScheme={NETWORK_COLORS[c.network] ?? "gray"}
                      variant="subtle"
                      fontSize="9px"
                      fontFamily="mono"
                      flexShrink={0}
                    >
                      {c.network}
                    </Badge>
                    <Text
                      fontFamily="mono"
                      fontWeight="bold"
                      fontSize="xs"
                      color="white"
                      flexShrink={0}
                    >
                      {c.name}
                    </Text>
                  </HStack>
                  <Text
                    fontSize="10px"
                    color="whiteAlpha.400"
                    fontFamily="mono"
                    flexShrink={0}
                  >
                    {formatDate(c.timestamp)}
                  </Text>
                </HStack>

                {/* Ligne 2 : adresse + actions */}
                <HStack mt={1.5} spacing={1} flexWrap="wrap">
                  <Text
                    fontSize="10px"
                    fontFamily="mono"
                    color="whiteAlpha.600"
                    flex={1}
                    isTruncated
                    minW={0}
                  >
                    {c.address}
                  </Text>

                  {/* Copier adresse */}
                  <Tooltip label="Copier l'adresse">
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="whiteAlpha"
                      onClick={() => copyToClipboard(c.address)}
                      fontFamily="mono"
                      fontSize="10px"
                      p={1}
                      minW={0}
                    >
                      📋
                    </Button>
                  </Tooltip>

                  {/* Explorer */}
                  {explorerUrl && (
                    <Tooltip label="Voir sur BaseScan">
                      <Link
                        href={explorerUrl}
                        isExternal
                        fontSize="10px"
                        p={1}
                        display="flex"
                        alignItems="center"
                        color="blue.300"
                      >
                        🔗
                      </Link>
                    </Tooltip>
                  )}

                  {/* Export ABI */}
                  <Tooltip label={`Télécharger ${c.name}.abi.json`}>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="yellow"
                      onClick={() => handleExportAbi(c.name)}
                      isLoading={exportingAbi[c.name]}
                      fontFamily="mono"
                      fontSize="10px"
                      p={1}
                      minW={0}
                    >
                      {exportError[c.name] ? "❌" : "⬇ ABI"}
                    </Button>
                  </Tooltip>

                  {/* Supprimer — avec confirmation inline */}
                  {!isConfirming ? (
                    <Tooltip label="Supprimer de l'historique">
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => setConfirmDelete(c.id)}
                        fontFamily="mono"
                        fontSize="10px"
                        p={1}
                        minW={0}
                      >
                        ✕
                      </Button>
                    </Tooltip>
                  ) : (
                    <HStack spacing={1}>
                      <Text fontSize="10px" color="red.300" fontFamily="mono">
                        Supprimer ?
                      </Text>
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="solid"
                        onClick={() => handleDelete(c.id)}
                        fontFamily="mono"
                        fontSize="10px"
                        px={2}
                      >
                        Oui
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="whiteAlpha"
                        onClick={() => setConfirmDelete(null)}
                        fontFamily="mono"
                        fontSize="10px"
                        px={1}
                      >
                        Non
                      </Button>
                    </HStack>
                  )}
                </HStack>

                {/* Erreur export ABI */}
                {exportError[c.name] && (
                  <Text fontSize="9px" color="red.300" fontFamily="mono" mt={1}>
                    {exportError[c.name]}
                  </Text>
                )}
              </Box>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}
