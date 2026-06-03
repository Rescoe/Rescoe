/**
 * ContractInteractor — Interface Remix-like pour interagir avec les contrats déployés
 *
 * - Sélection d'un contrat dans la liste deployed.json
 * - Chargement automatique de l'ABI via /api/admin/deploy/contracts/abi?name=...
 * - Fonctions en lecture (view/pure) : appel automatique (0 args) ou via bouton
 * - Fonctions en écriture : champs de saisie + exécution via MetaMask
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  Box, VStack, HStack, Text, Badge, Button, Input, Spinner,
  Select, Code, Divider, Tooltip, Collapse, useDisclosure,
  SimpleGrid, Textarea, Alert, AlertIcon,
} from "@chakra-ui/react";
import { ethers } from "ethers";
import type { DeployedContract } from "../hooks/useDeployStudio";

// ── RPC fallback par réseau (utilisé seulement si MetaMask absent) ────────────
const RPC_URLS: Record<string, string> = {
  baseSepolia: "https://sepolia.base.org",
  base: "https://mainnet.base.org",
  hardhat: "http://127.0.0.1:8545",
  localhost: "http://127.0.0.1:8545",
};

/** Préférer MetaMask pour les lectures — évite "JsonRpcProvider failed to detect network" */
function getReadProvider(rpcUrl: string): ethers.Provider {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(
      window.ethereum as ethers.Eip1193Provider
    );
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ── Types internes ─────────────────────────────────────────────────────────────
interface AbiItem {
  name: string;
  type: string;
  stateMutability?: string;
  inputs: { name: string; type: string; internalType?: string }[];
  outputs?: { name: string; type: string }[];
}

function isReadFn(item: AbiItem): boolean {
  return item.type === "function" &&
    (item.stateMutability === "view" || item.stateMutability === "pure");
}

function isWriteFn(item: AbiItem): boolean {
  return item.type === "function" &&
    item.stateMutability !== "view" &&
    item.stateMutability !== "pure";
}

function formatResult(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.map(formatResult).join(", ")}]`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ── Composant principal ────────────────────────────────────────────────────────

interface Props {
  deployedContracts: DeployedContract[];
}

export function ContractInteractor({ deployedContracts }: Props) {
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: false });

  const [selectedId, setSelectedId] = useState<string>("");
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [loadingAbi, setLoadingAbi] = useState(false);
  const [abiError, setAbiError] = useState<string>("");

  // Résultats des appels read
  const [readResults, setReadResults] = useState<Record<string, string>>({});
  const [readErrors, setReadErrors] = useState<Record<string, string>>({});
  const [readLoading, setReadLoading] = useState<Record<string, boolean>>({});

  // Inputs pour les fonctions
  const [fnInputs, setFnInputs] = useState<Record<string, string[]>>({});

  // Statuts des transactions write
  const [txStatus, setTxStatus] = useState<Record<string, string>>({});

  const selectedContract = deployedContracts.find((c) => c.id === selectedId);

  // ── Chargement de l'ABI ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedContract) { setAbi([]); return; }

    setLoadingAbi(true);
    setAbiError("");
    setReadResults({});
    setReadErrors({});
    setFnInputs({});
    setTxStatus({});

    fetch(`/api/admin/deploy/contracts/abi?name=${encodeURIComponent(selectedContract.name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const items: AbiItem[] = (data.abi ?? []).filter(
          (i: AbiItem) => i.type === "function"
        );
        setAbi(items);

        // Initialiser les inputs vides
        const inputs: Record<string, string[]> = {};
        for (const fn of items) {
          inputs[fn.name] = fn.inputs.map(() => "");
        }
        setFnInputs(inputs);
      })
      .catch((e: Error) => setAbiError(e.message))
      .finally(() => setLoadingAbi(false));
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement groupé des fonctions view sans arguments ───────────────────
  // (manuel via bouton — pas d'auto-call pour éviter JsonRpcProvider errors)
  const [isLoadingAllReads, setIsLoadingAllReads] = useState(false);

  const loadAllZeroArgReads = useCallback(async () => {
    if (!selectedContract || abi.length === 0) return;

    const zeroArgReads = abi.filter((fn) => isReadFn(fn) && fn.inputs.length === 0);
    if (zeroArgReads.length === 0) return;

    const rpcUrl = RPC_URLS[selectedContract.network] ?? "https://sepolia.base.org";
    setIsLoadingAllReads(true);

    try {
      const provider = getReadProvider(rpcUrl);
      const contract = new ethers.Contract(selectedContract.address, abi as ethers.InterfaceAbi, provider);

      for (const fn of zeroArgReads) {
        try {
          setReadLoading((p) => ({ ...p, [fn.name]: true }));
          const result = await (contract[fn.name] as () => Promise<unknown>)();
          setReadResults((p) => ({ ...p, [fn.name]: formatResult(result) }));
          setReadErrors((p) => ({ ...p, [fn.name]: "" }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setReadErrors((p) => ({ ...p, [fn.name]: msg.slice(0, 100) }));
        } finally {
          setReadLoading((p) => ({ ...p, [fn.name]: false }));
        }
      }
    } finally {
      setIsLoadingAllReads(false);
    }
  }, [abi, selectedContract]);

  // ── Appel manuel d'une fonction read ────────────────────────────────────────
  const callRead = useCallback(async (fn: AbiItem) => {
    if (!selectedContract) return;

    const rpcUrl = RPC_URLS[selectedContract.network] ?? "https://sepolia.base.org";
    const args = fnInputs[fn.name] ?? [];

    setReadLoading((p) => ({ ...p, [fn.name]: true }));
    setReadErrors((p) => ({ ...p, [fn.name]: "" }));

    try {
      const provider = getReadProvider(rpcUrl);
      const contract = new ethers.Contract(selectedContract.address, abi as ethers.InterfaceAbi, provider);
      const result = await (contract[fn.name] as (...a: unknown[]) => Promise<unknown>)(...args);
      setReadResults((p) => ({ ...p, [fn.name]: formatResult(result) }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setReadErrors((p) => ({ ...p, [fn.name]: msg.slice(0, 200) }));
    } finally {
      setReadLoading((p) => ({ ...p, [fn.name]: false }));
    }
  }, [selectedContract, abi, fnInputs]);

  // ── Exécution d'une fonction write via MetaMask ───────────────────────────
  const executeFn = useCallback(async (fn: AbiItem) => {
    if (!selectedContract) return;
    if (!window.ethereum) {
      setTxStatus((p) => ({ ...p, [fn.name]: "❌ MetaMask non disponible" }));
      return;
    }

    const args = fnInputs[fn.name] ?? [];
    setTxStatus((p) => ({ ...p, [fn.name]: "⏳ Envoi MetaMask..." }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(selectedContract.address, abi as ethers.InterfaceAbi, signer);

      const tx = await (contract[fn.name] as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(...args);
      setTxStatus((p) => ({ ...p, [fn.name]: `⏳ Confirming... ${tx.hash.slice(0, 12)}…` }));

      const receipt = await tx.wait();
      setTxStatus((p) => ({
        ...p,
        [fn.name]: `✅ Bloc ${receipt?.blockNumber ?? "?"} — ${tx.hash.slice(0, 16)}…`,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTxStatus((p) => ({ ...p, [fn.name]: `❌ ${msg.slice(0, 120)}` }));
    }
  }, [selectedContract, abi, fnInputs]);

  const readFns = abi.filter(isReadFn);
  const writeFns = abi.filter(isWriteFn);
  const hasFns = readFns.length > 0 || writeFns.length > 0;

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      overflow="hidden"
    >
      {/* Header */}
      <HStack
        px={4} py={3}
        bg="blackAlpha.300"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        cursor="pointer"
        onClick={onToggle}
      >
        <HStack spacing={2}>
          <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.700" letterSpacing="wider">
            🔬 INTERACTION CONTRATS
          </Text>
          <Badge fontSize="9px" fontFamily="mono" colorScheme="blue" variant="subtle">
            REMIX-LIKE
          </Badge>
        </HStack>
        <Text fontSize="xs" color="whiteAlpha.400">{isOpen ? "▲" : "▼"}</Text>
      </HStack>

      <Collapse in={isOpen}>
        <Box p={4}>
          {deployedContracts.length === 0 ? (
            <Text fontSize="xs" color="whiteAlpha.400" fontFamily="mono">
              Aucun contrat déployé. Lancez d&apos;abord la pipeline.
            </Text>
          ) : (
            <VStack align="stretch" spacing={4}>
              {/* Sélecteur de contrat */}
              <Box>
                <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.600" mb={1}>
                  Sélectionner un contrat déployé
                </Text>
                <Select
                  size="sm"
                  fontFamily="mono"
                  fontSize="12px"
                  bg="blackAlpha.400"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  _focus={{ borderColor: "brand.gold" }}
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  placeholder="— choisir —"
                >
                  {deployedContracts.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: "#0F314F" }}>
                      {c.name} — {c.address.slice(0, 10)}… ({c.network})
                    </option>
                  ))}
                </Select>
              </Box>

              {/* Chargement ABI */}
              {loadingAbi && (
                <HStack>
                  <Spinner size="xs" color="brand.gold" />
                  <Text fontSize="xs" fontFamily="mono" color="whiteAlpha.500">
                    Chargement ABI...
                  </Text>
                </HStack>
              )}

              {abiError && (
                <Alert status="error" bg="red.900" borderRadius="lg" fontSize="xs" fontFamily="mono">
                  <AlertIcon boxSize={3} />
                  {abiError}
                </Alert>
              )}

              {/* Fonctions READ */}
              {!loadingAbi && readFns.length > 0 && (
                <Box>
                  <HStack mb={2} justify="space-between">
                    <HStack>
                      <Box w={2} h={2} borderRadius="full" bg="green.400" />
                      <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="green.300">
                        LECTURE ({readFns.length} fonctions view/pure)
                      </Text>
                    </HStack>
                    <Button
                      size="xs"
                      fontFamily="mono"
                      fontSize="10px"
                      colorScheme="green"
                      variant="outline"
                      onClick={loadAllZeroArgReads}
                      isLoading={isLoadingAllReads}
                      loadingText="Lecture..."
                    >
                      ⟳ Charger toutes les valeurs
                    </Button>
                  </HStack>

                  <VStack align="stretch" spacing={2}>
                    {readFns.map((fn) => (
                      <Box
                        key={fn.name}
                        p={3}
                        bg="rgba(72,187,120,0.05)"
                        border="1px solid"
                        borderColor="rgba(72,187,120,0.15)"
                        borderRadius="lg"
                      >
                        <HStack justify="space-between" align="flex-start">
                          <VStack align="flex-start" spacing={1} flex={1}>
                            <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="green.300">
                              {fn.name}
                              <Text as="span" color="whiteAlpha.400" fontWeight="normal">
                                ({fn.inputs.map((i) => `${i.type} ${i.name || "_"}`).join(", ")})
                              </Text>
                            </Text>

                            {/* Inputs si la fonction en a */}
                            {fn.inputs.length > 0 && (
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} w="full" mt={1}>
                                {fn.inputs.map((inp, idx) => (
                                  <VStack key={idx} align="flex-start" spacing={0}>
                                    <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono">
                                      {inp.type} {inp.name || `arg${idx}`}
                                    </Text>
                                    <Input
                                      size="xs"
                                      fontFamily="mono"
                                      placeholder={inp.type.includes("address") ? "0x..." : inp.type.includes("uint") ? "0" : ""}
                                      value={fnInputs[fn.name]?.[idx] ?? ""}
                                      onChange={(e) =>
                                        setFnInputs((p) => ({
                                          ...p,
                                          [fn.name]: p[fn.name]?.map((v, i) => i === idx ? e.target.value : v) ?? [],
                                        }))
                                      }
                                      bg="blackAlpha.400"
                                      border="1px solid"
                                      borderColor="whiteAlpha.200"
                                      _focus={{ borderColor: "green.400" }}
                                    />
                                  </VStack>
                                ))}
                              </SimpleGrid>
                            )}

                            {/* Résultat */}
                            {readLoading[fn.name] && (
                              <HStack>
                                <Spinner size="xs" color="green.400" />
                                <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono">Appel en cours...</Text>
                              </HStack>
                            )}
                            {readResults[fn.name] !== undefined && (
                              <Box
                                mt={1} p={2}
                                bg="blackAlpha.400"
                                borderRadius="md"
                                border="1px solid"
                                borderColor="rgba(72,187,120,0.2)"
                                w="full"
                              >
                                <Text fontSize="xs" fontFamily="mono" color="green.200" wordBreak="break-all">
                                  → {readResults[fn.name]}
                                </Text>
                              </Box>
                            )}
                            {readErrors[fn.name] && (
                              <Text fontSize="9px" color="red.300" fontFamily="mono">
                                ❌ {readErrors[fn.name]}
                              </Text>
                            )}
                          </VStack>

                          {fn.inputs.length > 0 && (
                            <Button
                              size="xs"
                              fontFamily="mono"
                              fontSize="10px"
                              colorScheme="green"
                              variant="outline"
                              onClick={() => callRead(fn)}
                              isLoading={readLoading[fn.name]}
                              flexShrink={0}
                              ml={2}
                            >
                              Call
                            </Button>
                          )}
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Séparateur */}
              {!loadingAbi && readFns.length > 0 && writeFns.length > 0 && (
                <Divider borderColor="whiteAlpha.100" />
              )}

              {/* Fonctions WRITE */}
              {!loadingAbi && writeFns.length > 0 && (
                <Box>
                  <HStack mb={2}>
                    <Box w={2} h={2} borderRadius="full" bg="orange.400" />
                    <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="orange.300">
                      ÉCRITURE ({writeFns.length} fonctions — MetaMask requis)
                    </Text>
                  </HStack>

                  <VStack align="stretch" spacing={2}>
                    {writeFns.map((fn) => {
                      const isPayable = fn.stateMutability === "payable";
                      return (
                        <Box
                          key={fn.name}
                          p={3}
                          bg="rgba(246,173,85,0.04)"
                          border="1px solid"
                          borderColor="rgba(246,173,85,0.15)"
                          borderRadius="lg"
                        >
                          <VStack align="flex-start" spacing={2}>
                            <HStack justify="space-between" w="full">
                              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="orange.300">
                                {fn.name}
                                {isPayable && (
                                  <Badge ml={2} fontSize="8px" colorScheme="yellow" variant="subtle">
                                    payable
                                  </Badge>
                                )}
                              </Text>
                            </HStack>

                            {/* Inputs */}
                            {fn.inputs.length > 0 && (
                              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} w="full">
                                {fn.inputs.map((inp, idx) => (
                                  <VStack key={idx} align="flex-start" spacing={0}>
                                    <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono">
                                      {inp.type} {inp.name || `arg${idx}`}
                                    </Text>
                                    <Input
                                      size="xs"
                                      fontFamily="mono"
                                      placeholder={
                                        inp.type.includes("address") ? "0x..." :
                                        inp.type.includes("uint") ? "0" :
                                        inp.type.includes("bool") ? "true / false" :
                                        inp.type.includes("string") ? "texte..." : ""
                                      }
                                      value={fnInputs[fn.name]?.[idx] ?? ""}
                                      onChange={(e) =>
                                        setFnInputs((p) => ({
                                          ...p,
                                          [fn.name]: (p[fn.name] ?? fn.inputs.map(() => "")).map(
                                            (v, i) => i === idx ? e.target.value : v
                                          ),
                                        }))
                                      }
                                      bg="blackAlpha.400"
                                      border="1px solid"
                                      borderColor="whiteAlpha.200"
                                      _focus={{ borderColor: "orange.400" }}
                                    />
                                  </VStack>
                                ))}
                              </SimpleGrid>
                            )}

                            {/* ETH value si payable */}
                            {isPayable && (
                              <VStack align="flex-start" spacing={0} w="full">
                                <Text fontSize="9px" color="yellow.300" fontFamily="mono">
                                  Value (ETH)
                                </Text>
                                <Input
                                  size="xs"
                                  fontFamily="mono"
                                  placeholder="0.0"
                                  value={fnInputs[`${fn.name}_value`]?.[0] ?? ""}
                                  onChange={(e) =>
                                    setFnInputs((p) => ({
                                      ...p,
                                      [`${fn.name}_value`]: [e.target.value],
                                    }))
                                  }
                                  bg="rgba(255,237,166,0.05)"
                                  border="1px solid"
                                  borderColor="rgba(255,237,166,0.2)"
                                  _focus={{ borderColor: "yellow.400" }}
                                  maxW="200px"
                                />
                              </VStack>
                            )}

                            <HStack justify="space-between" w="full" align="center">
                              <Button
                                size="sm"
                                fontFamily="mono"
                                fontSize="11px"
                                bg="rgba(246,173,85,0.15)"
                                color="orange.200"
                                border="1px solid"
                                borderColor="rgba(246,173,85,0.3)"
                                _hover={{ bg: "rgba(246,173,85,0.25)" }}
                                onClick={() => executeFn(fn)}
                                isLoading={txStatus[fn.name]?.startsWith("⏳")}
                              >
                                🦊 Exécuter via MetaMask
                              </Button>

                              {txStatus[fn.name] && (
                                <Text
                                  fontSize="xs"
                                  fontFamily="mono"
                                  color={
                                    txStatus[fn.name].startsWith("✅") ? "green.300" :
                                    txStatus[fn.name].startsWith("❌") ? "red.300" :
                                    "orange.300"
                                  }
                                  maxW="300px"
                                  wordBreak="break-all"
                                >
                                  {txStatus[fn.name]}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                        </Box>
                      );
                    })}
                  </VStack>
                </Box>
              )}

              {selectedId && !loadingAbi && !hasFns && !abiError && (
                <Text fontSize="xs" color="whiteAlpha.400" fontFamily="mono">
                  Aucune fonction trouvée dans l&apos;ABI. Le contrat est-il compilé ?
                </Text>
              )}
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
