// ContractBook.tsx — Vue des contrats live et historique des déploiements
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
  useToast,
  Link,
  Spinner,
} from "@chakra-ui/react";

interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: string;
  timestamp: string;
}

interface LiveContract {
  label: string;
  envKey: string;
  address: string;
}

const BASESCAN_URL = "https://basescan.org/address/";

const LIVE_CONTRACTS: LiveContract[] = [
  {
    label: "AdhesionRescoe",
    envKey: "NEXT_PUBLIC_RESCOE_ADHERENTS",
    address: process.env.NEXT_PUBLIC_RESCOE_ADHERENTS ?? "",
  },
  {
    label: "ResCoellectionManager",
    envKey: "NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT",
    address: process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT ?? "",
  },
  {
    label: "AdhesionManagement",
    envKey: "NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER",
    address: process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER ?? "",
  },
];

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ContractBook() {
  const toast = useToast();
  const [history, setHistory] = useState<DeployedContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/admin/deploy/deployed");
      const data = await r.json();
      setHistory(data.contracts ?? []);
    } catch {
      // silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: "Adresse copiée",
          status: "success",
          duration: 1500,
          isClosable: true,
          position: "bottom-right",
        });
      } catch {
        toast({
          title: "Échec copie",
          status: "error",
          duration: 2000,
          isClosable: true,
          position: "bottom-right",
        });
      }
    },
    [toast]
  );

  const downloadSource = useCallback(
    (contractName: string) => {
      const url = `/api/admin/deploy/contracts/source?name=${encodeURIComponent(contractName)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contractName}.sol`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    []
  );

  const panelStyle = {
    bg: "rgba(1,28,57,0.8)",
    border: "1px solid",
    borderColor: "whiteAlpha.100",
    borderRadius: "xl",
    p: 5,
  };

  return (
    <VStack spacing={5} align="stretch">
      {/* Live Contracts */}
      <Box {...panelStyle}>
        <HStack justify="space-between" mb={4}>
          <Text
            fontSize="xs"
            color="whiteAlpha.500"
            fontFamily="mono"
            letterSpacing="wider"
          >
            CONTRATS EN PRODUCTION
          </Text>
          <Badge colorScheme="green" variant="subtle" fontFamily="mono" fontSize="9px">
            Base Mainnet
          </Badge>
        </HStack>

        <VStack spacing={3} align="stretch">
          {LIVE_CONTRACTS.map((c) => (
            <Box
              key={c.envKey}
              bg="blackAlpha.300"
              border="1px solid"
              borderColor="whiteAlpha.100"
              borderRadius="lg"
              p={3}
            >
              <HStack justify="space-between" flexWrap="wrap" gap={2}>
                <VStack align="start" spacing={0}>
                  <Text
                    fontSize="sm"
                    fontFamily="mono"
                    color="white"
                    fontWeight="semibold"
                  >
                    {c.label}
                  </Text>
                  {c.address ? (
                    <Text
                      fontSize="xs"
                      fontFamily="mono"
                      color="whiteAlpha.600"
                    >
                      {c.address}
                    </Text>
                  ) : (
                    <Text fontSize="xs" color="red.400" fontFamily="mono">
                      Non configuré ({c.envKey})
                    </Text>
                  )}
                </VStack>

                {c.address && (
                  <HStack spacing={2}>
                    <Tooltip label="Copier l'adresse" placement="top">
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="whiteAlpha"
                        onClick={() => copyToClipboard(c.address)}
                        fontFamily="mono"
                        fontSize="10px"
                      >
                        📋
                      </Button>
                    </Tooltip>
                    <Tooltip label="Voir sur Basescan" placement="top">
                      <Button
                        as={Link}
                        href={`${BASESCAN_URL}${c.address}`}
                        isExternal
                        size="xs"
                        variant="outline"
                        colorScheme="blue"
                        fontFamily="mono"
                        fontSize="10px"
                        textDecoration="none"
                        _hover={{ textDecoration: "none" }}
                      >
                        🔍 Basescan
                      </Button>
                    </Tooltip>
                  </HStack>
                )}
              </HStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* Deploy History */}
      <Box {...panelStyle}>
        <HStack justify="space-between" mb={4}>
          <Text
            fontSize="xs"
            color="whiteAlpha.500"
            fontFamily="mono"
            letterSpacing="wider"
          >
            HISTORIQUE DES DÉPLOIEMENTS
          </Text>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={fetchHistory}
            fontFamily="mono"
            fontSize="10px"
          >
            ↺ Rafraîchir
          </Button>
        </HStack>

        {isLoading ? (
          <HStack justify="center" py={6}>
            <Spinner size="sm" color="purple.300" />
            <Text fontSize="xs" color="whiteAlpha.400" fontFamily="mono">
              Chargement…
            </Text>
          </HStack>
        ) : history.length === 0 ? (
          <Box
            textAlign="center"
            py={8}
            border="1px dashed"
            borderColor="whiteAlpha.200"
            borderRadius="lg"
          >
            <Text fontSize="xs" color="whiteAlpha.300" fontFamily="mono">
              Aucun déploiement enregistré.
            </Text>
          </Box>
        ) : (
          <Box overflowX="auto">
            <Table size="sm" variant="unstyled">
              <Thead>
                <Tr>
                  {["Date", "Contrat", "Réseau", "Adresse", "Actions"].map((h) => (
                    <Th
                      key={h}
                      fontSize="9px"
                      fontFamily="mono"
                      color="whiteAlpha.400"
                      letterSpacing="wider"
                      pb={2}
                      textTransform="uppercase"
                    >
                      {h}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {history.map((c) => (
                  <Tr
                    key={c.id}
                    borderTop="1px solid"
                    borderColor="whiteAlpha.50"
                    _hover={{ bg: "whiteAlpha.50" }}
                    transition="background 0.15s"
                  >
                    <Td fontSize="10px" fontFamily="mono" color="whiteAlpha.500" py={2}>
                      {formatDate(c.timestamp)}
                    </Td>
                    <Td fontSize="xs" fontFamily="mono" color="white" fontWeight="semibold" py={2}>
                      {c.name}
                    </Td>
                    <Td py={2}>
                      <Badge
                        colorScheme={
                          c.network === "base"
                            ? "blue"
                            : c.network === "baseSepolia"
                            ? "cyan"
                            : "gray"
                        }
                        variant="subtle"
                        fontFamily="mono"
                        fontSize="9px"
                      >
                        {c.network}
                      </Badge>
                    </Td>
                    <Td py={2}>
                      <Tooltip label={c.address} placement="top">
                        <Text
                          fontSize="xs"
                          fontFamily="mono"
                          color="whiteAlpha.700"
                          cursor="default"
                        >
                          {truncateAddress(c.address)}
                        </Text>
                      </Tooltip>
                    </Td>
                    <Td py={2}>
                      <HStack spacing={1}>
                        <Tooltip label="Copier l'adresse" placement="top">
                          <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="whiteAlpha"
                            onClick={() => copyToClipboard(c.address)}
                            fontFamily="mono"
                            fontSize="10px"
                            px={1}
                          >
                            📋
                          </Button>
                        </Tooltip>
                        {c.network !== "hardhat" && (
                          <Tooltip label="Voir sur Basescan" placement="top">
                            <Button
                              as={Link}
                              href={`${BASESCAN_URL}${c.address}`}
                              isExternal
                              size="xs"
                              variant="ghost"
                              colorScheme="blue"
                              fontFamily="mono"
                              fontSize="10px"
                              px={1}
                              textDecoration="none"
                              _hover={{ textDecoration: "none" }}
                            >
                              🔍
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip label="Télécharger le source .sol" placement="top">
                          <Button
                            size="xs"
                            variant="ghost"
                            colorScheme="purple"
                            onClick={() => downloadSource(c.name)}
                            fontFamily="mono"
                            fontSize="10px"
                            px={1}
                          >
                            ⬇
                          </Button>
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>
    </VStack>
  );
}
