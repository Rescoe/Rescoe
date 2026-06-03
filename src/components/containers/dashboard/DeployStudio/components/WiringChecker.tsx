/**
 * WiringChecker — Vérification post-déploiement du câblage des contrats Rescoe
 *
 * Pour chaque contrat déployé, vérifie que les adresses critiques sont correctement
 * configurées (ex. ResCoellectionManager dans AdhesionRescoe, etc.).
 * Affiche ✅/❌ et propose des boutons "Fix" qui appellent la fonction setter via MetaMask.
 */
import React, { useState, useCallback } from "react";
import {
  Box, VStack, HStack, Text, Badge, Button, Spinner,
  Input, Tooltip, Divider, Code, Alert, AlertIcon, SimpleGrid,
  Collapse, useDisclosure,
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

/**
 * Préférer MetaMask (BrowserProvider) pour les lectures.
 * Évite les erreurs "JsonRpcProvider failed to detect network" et les CORS.
 * Fallback : JsonRpcProvider avec l'URL du réseau.
 */
function getReadProvider(rpcUrl: string): ethers.Provider {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(
      window.ethereum as ethers.Eip1193Provider
    );
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ── ABIs minimaux pour chaque check ──────────────────────────────────────────
const ABI_FRAGMENTS: Record<string, string[]> = {
  AdhesionRescoe: [
    "function rescoeManager() view returns (address)",
    "function relayer() view returns (address)",
    "function mintRelayer() view returns (address)",
    "function artist() view returns (address)",
    "function owner() view returns (address)",
    "function setRescoeManager(address _rescoeManager) external",
    "function setRelayer(address _relayer) external",
    "function setMintRelayer(address _mintRelayer) external",
  ],
  ArtFactory: [
    "function resCollectionsAuthorized() view returns (address)",
    "function masterFactoryAuthorized() view returns (address)",
    "function adhesionContractAddress() view returns (address)",
    "function associationAddr() view returns (address)",
    "function owner() view returns (address)",
    "function setAuthorizedCallers(address _resCollections, address _masterFactory) external",
  ],
  PoetryFactory: [
    "function resCollectionsAuthorized() view returns (address)",
    "function masterFactoryAuthorized() view returns (address)",
    "function adhesionContractAddress() view returns (address)",
    "function associationAddr() view returns (address)",
    "function owner() view returns (address)",
    "function setAuthorizedCallers(address _resCollections, address _masterFactory) external",
  ],
  ResCoellectionManager: [
    "function factoryContractAddress() view returns (address)",
    "function adhesionContracts(uint256) view returns (address)",
    "function rewardRelayer() view returns (address)",
    "function activeAdhesionIndex() view returns (uint256)",
    "function owner() view returns (address)",
    "function addAdhesionContract(address _adhesionContract) external",
    "function updateFactoryAddress(address newFactoryAddress) external",
    "function setRewardRelayer(address _relayer) external",
  ],
  MasterFactory: [
    "function artFactory() view returns (address)",
    "function poetryFactory() view returns (address)",
    "function messageFactory() view returns (address)",
    "function owner() view returns (address)",
  ],
  MessageFactory: [
    "function adhesionContractAddress() view returns (address)",
    "function owner() view returns (address)",
  ],
  TokenManagement: [
    "function adhesionContractAddress() view returns (address)",
    "function owner() view returns (address)",
  ],
};

// ── Définition des checks ─────────────────────────────────────────────────────
interface WiringCheck {
  id: string;
  contract: string;
  label: string;
  description: string;
  readFn: string;
  readArgs?: unknown[];
  expectedContract?: string; // nom d'un autre contrat déployé
  isZeroOk: boolean;         // true = juste vérifier non-zero
  setter?: string;
  setterMode?: "fromContract" | "manualAddress" | "twoContracts";
  setterContractA?: string;  // pour twoContracts (ex. ResCoellectionManager + MasterFactory)
  setterContractB?: string;
  critical: boolean;
  doneByRelayer: boolean;    // câblé automatiquement par le script relayer
}

const WIRING_CHECKS: WiringCheck[] = [
  // ── AdhesionRescoe ───────────────────────────────────────────────────────
  {
    id: "adhesion_rescoe_manager",
    contract: "AdhesionRescoe",
    label: "RescoeManager (points)",
    description: "AdhesionRescoe doit connaître ResCoellectionManager pour les points de fidélité",
    readFn: "rescoeManager",
    expectedContract: "ResCoellectionManager",
    isZeroOk: false,
    setter: "setRescoeManager",
    setterMode: "fromContract",
    setterContractA: "ResCoellectionManager",
    critical: true,
    doneByRelayer: false,
  },
  {
    id: "adhesion_relayer",
    contract: "AdhesionRescoe",
    label: "Relayer (auto-évolve)",
    description: "Adresse du relayer qui déclenche l'auto-évolution des NFTs",
    readFn: "relayer",
    isZeroOk: false,
    setter: "setRelayer",
    setterMode: "manualAddress",
    critical: false,
    doneByRelayer: false,
  },
  {
    id: "adhesion_mint_relayer",
    contract: "AdhesionRescoe",
    label: "Mint Relayer (mint gratuit)",
    description: "Adresse autorisée à minter gratuitement (post-Stripe, expo IRL)",
    readFn: "mintRelayer",
    isZeroOk: false,
    setter: "setMintRelayer",
    setterMode: "manualAddress",
    critical: false,
    doneByRelayer: false,
  },
  // ── ArtFactory ───────────────────────────────────────────────────────────
  {
    id: "art_res_collections",
    contract: "ArtFactory",
    label: "ResCollections autorisé",
    description: "ArtFactory doit autoriser ResCoellectionManager à appeler createDynamicCollection",
    readFn: "resCollectionsAuthorized",
    expectedContract: "ResCoellectionManager",
    isZeroOk: false,
    setter: "setAuthorizedCallers",
    setterMode: "twoContracts",
    setterContractA: "ResCoellectionManager",
    setterContractB: "MasterFactory",
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "art_master_factory",
    contract: "ArtFactory",
    label: "MasterFactory autorisé",
    description: "ArtFactory doit autoriser MasterFactory à appeler createDynamicCollection",
    readFn: "masterFactoryAuthorized",
    expectedContract: "MasterFactory",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "art_adhesion",
    contract: "ArtFactory",
    label: "Adhesion Contract",
    description: "ArtFactory référence AdhesionRescoe pour vérifier les adhésions",
    readFn: "adhesionContractAddress",
    expectedContract: "AdhesionRescoe",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  // ── PoetryFactory ────────────────────────────────────────────────────────
  {
    id: "poetry_res_collections",
    contract: "PoetryFactory",
    label: "ResCollections autorisé",
    description: "PoetryFactory doit autoriser ResCoellectionManager",
    readFn: "resCollectionsAuthorized",
    expectedContract: "ResCoellectionManager",
    isZeroOk: false,
    setter: "setAuthorizedCallers",
    setterMode: "twoContracts",
    setterContractA: "ResCoellectionManager",
    setterContractB: "MasterFactory",
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "poetry_master_factory",
    contract: "PoetryFactory",
    label: "MasterFactory autorisé",
    description: "PoetryFactory doit autoriser MasterFactory",
    readFn: "masterFactoryAuthorized",
    expectedContract: "MasterFactory",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  // ── ResCoellectionManager ────────────────────────────────────────────────
  {
    id: "resc_factory",
    contract: "ResCoellectionManager",
    label: "Factory (MasterFactory)",
    description: "ResCoellectionManager doit pointer vers MasterFactory pour créer des collections",
    readFn: "factoryContractAddress",
    expectedContract: "MasterFactory",
    isZeroOk: false,
    setter: "updateFactoryAddress",
    setterMode: "fromContract",
    setterContractA: "MasterFactory",
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "resc_adhesion",
    contract: "ResCoellectionManager",
    label: "Adhesion Contract [0]",
    description: "ResCoellectionManager doit avoir AdhesionRescoe dans sa liste d'adhesionContracts",
    readFn: "adhesionContracts",
    readArgs: [0],
    expectedContract: "AdhesionRescoe",
    isZeroOk: false,
    setter: "addAdhesionContract",
    setterMode: "fromContract",
    setterContractA: "AdhesionRescoe",
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "resc_reward_relayer",
    contract: "ResCoellectionManager",
    label: "Reward Relayer",
    description: "Adresse du relayer qui distribue les points de récompense aux adhérents",
    readFn: "rewardRelayer",
    isZeroOk: false,
    setter: "setRewardRelayer",
    setterMode: "manualAddress",
    critical: false,
    doneByRelayer: false,
  },
  // ── MasterFactory ────────────────────────────────────────────────────────
  {
    id: "master_art_factory",
    contract: "MasterFactory",
    label: "ArtFactory",
    description: "MasterFactory doit référencer ArtFactory (fixé au déploiement)",
    readFn: "artFactory",
    expectedContract: "ArtFactory",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "master_poetry_factory",
    contract: "MasterFactory",
    label: "PoetryFactory",
    description: "MasterFactory doit référencer PoetryFactory (fixé au déploiement)",
    readFn: "poetryFactory",
    expectedContract: "PoetryFactory",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  {
    id: "master_message_factory",
    contract: "MasterFactory",
    label: "MessageFactory",
    description: "MasterFactory doit référencer MessageFactory (fixé au déploiement)",
    readFn: "messageFactory",
    expectedContract: "MessageFactory",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  // ── MessageFactory ───────────────────────────────────────────────────────
  {
    id: "message_adhesion",
    contract: "MessageFactory",
    label: "Adhesion Contract",
    description: "MessageFactory référence AdhesionRescoe pour vérifier les adhésions",
    readFn: "adhesionContractAddress",
    expectedContract: "AdhesionRescoe",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
  // ── TokenManagement ──────────────────────────────────────────────────────
  {
    id: "token_adhesion",
    contract: "TokenManagement",
    label: "Adhesion Contract",
    description: "TokenManagement doit pointer vers AdhesionRescoe pour les queries de tokens",
    readFn: "adhesionContractAddress",
    expectedContract: "AdhesionRescoe",
    isZeroOk: false,
    critical: true,
    doneByRelayer: true,
  },
];

// ── Utils ─────────────────────────────────────────────────────────────────────

function buildAddrMap(contracts: DeployedContract[]): Record<string, string> {
  const map: Record<string, string> = {};
  // On trie par date croissante → le dernier écrase (le plus récent gagne)
  const sorted = [...contracts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  for (const c of sorted) {
    map[c.name] = c.address;
  }
  return map;
}

function shortAddr(addr: string): string {
  if (!addr || addr === ethers.ZeroAddress) return "0x000…000";
  return addr.slice(0, 8) + "…" + addr.slice(-6);
}

function isZeroAddr(addr: string): boolean {
  return !addr || addr === ethers.ZeroAddress || addr === "0x0000000000000000000000000000000000000000";
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  deployedContracts: DeployedContract[];
  network: string;
}

export function WiringChecker({ deployedContracts, network }: Props) {
  const addrMap = buildAddrMap(deployedContracts);
  const rpcUrl = RPC_URLS[network] ?? "https://sepolia.base.org";

  const [checkResults, setCheckResults] = useState<Record<string, string | null>>({});
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [fixStatus, setFixStatus] = useState<Record<string, string>>({});
  const [manualAddr, setManualAddr] = useState<Record<string, string>>({});
  const { isOpen, onToggle } = useDisclosure({ defaultIsOpen: true });

  const runChecks = useCallback(async () => {
    setIsRunning(true);
    setCheckResults({});
    setCheckErrors({});

    const provider = getReadProvider(rpcUrl);
    const newResults: Record<string, string | null> = {};
    const newErrors: Record<string, string> = {};

    for (const check of WIRING_CHECKS) {
      const contractAddr = addrMap[check.contract];
      if (!contractAddr) {
        newErrors[check.id] = `${check.contract} non trouvé dans deployed.json`;
        continue;
      }

      const fragments = ABI_FRAGMENTS[check.contract];
      if (!fragments) continue;

      try {
        const contract = new ethers.Contract(contractAddr, fragments, provider);
        const fn = contract[check.readFn];
        if (!fn) {
          newErrors[check.id] = `Fonction ${check.readFn} non trouvée dans l'ABI`;
          continue;
        }

        const args = check.readArgs ?? [];
        let result: string;
        try {
          const raw = await fn(...args);
          result = typeof raw === "string" ? raw : raw?.toString() ?? "";
        } catch (callErr: unknown) {
          // adhesionContracts(0) peut reverter si tableau vide
          const msg = callErr instanceof Error ? callErr.message : String(callErr);
          if (msg.toLowerCase().includes("revert") || msg.toLowerCase().includes("invalid")) {
            result = ethers.ZeroAddress;
          } else {
            throw callErr;
          }
        }

        newResults[check.id] = result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        newErrors[check.id] = msg.slice(0, 120);
      }
    }

    setCheckResults(newResults);
    setCheckErrors(newErrors);
    setIsRunning(false);
  }, [addrMap, rpcUrl]);

  const fixCheck = useCallback(async (check: WiringCheck) => {
    if (!check.setter) return;

    const contractAddr = addrMap[check.contract];
    if (!contractAddr) return;

    setFixStatus((p) => ({ ...p, [check.id]: "pending" }));

    try {
      if (typeof window === "undefined" || !window.ethereum)
        throw new Error("MetaMask non disponible");

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const fragments = ABI_FRAGMENTS[check.contract] ?? [];
      const contract = new ethers.Contract(contractAddr, fragments, signer);

      let tx: ethers.TransactionResponse;

      if (check.setterMode === "fromContract" && check.setterContractA) {
        const argAddr = addrMap[check.setterContractA];
        if (!argAddr) throw new Error(`${check.setterContractA} non déployé`);
        tx = await (contract[check.setter!] as (...args: unknown[]) => Promise<ethers.TransactionResponse>)(argAddr);

      } else if (check.setterMode === "twoContracts" && check.setterContractA && check.setterContractB) {
        const addrA = addrMap[check.setterContractA];
        const addrB = addrMap[check.setterContractB];
        if (!addrA) throw new Error(`${check.setterContractA} non déployé`);
        if (!addrB) throw new Error(`${check.setterContractB} non déployé`);
        tx = await (contract[check.setter!] as (...args: unknown[]) => Promise<ethers.TransactionResponse>)(addrA, addrB);

      } else if (check.setterMode === "manualAddress") {
        const addr = manualAddr[check.id]?.trim();
        if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr))
          throw new Error("Adresse invalide (format 0x...)");
        tx = await (contract[check.setter!] as (...args: unknown[]) => Promise<ethers.TransactionResponse>)(addr);

      } else {
        throw new Error("Mode setter inconnu");
      }

      setFixStatus((p) => ({ ...p, [check.id]: "confirming" }));
      await tx.wait();
      setFixStatus((p) => ({ ...p, [check.id]: "done" }));

      // Re-vérifier ce check uniquement
      const readProvider = getReadProvider(rpcUrl);
      const readContract = new ethers.Contract(contractAddr, ABI_FRAGMENTS[check.contract] ?? [], readProvider);
      const args = check.readArgs ?? [];
      try {
        const newVal = await (readContract[check.readFn] as (...a: unknown[]) => Promise<string>)(...args);
        setCheckResults((p) => ({ ...p, [check.id]: typeof newVal === "string" ? newVal : String(newVal) }));
      } catch {
        // ignore
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFixStatus((p) => ({ ...p, [check.id]: `error: ${msg.slice(0, 80)}` }));
    }
  }, [addrMap, manualAddr, rpcUrl]);

  const deployed = Object.keys(addrMap);
  const hasDeployed = deployed.length > 0;

  // Regrouper par contrat
  const byContract = WIRING_CHECKS.reduce<Record<string, WiringCheck[]>>((acc, c) => {
    if (!acc[c.contract]) acc[c.contract] = [];
    acc[c.contract].push(c);
    return acc;
  }, {});

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
            🔗 VÉRIFICATEUR DE CÂBLAGE
          </Text>
          {!isRunning && Object.keys(checkResults).length > 0 && (
            <Badge
              fontSize="9px"
              fontFamily="mono"
              bg={
                WIRING_CHECKS.filter(c => c.critical).every(c => {
                  const res = checkResults[c.id];
                  if (!res) return false;
                  if (c.expectedContract) {
                    return res.toLowerCase() === addrMap[c.expectedContract]?.toLowerCase();
                  }
                  return !isZeroAddr(res);
                })
                  ? "green.800" : "red.800"
              }
              color={
                WIRING_CHECKS.filter(c => c.critical).every(c => {
                  const res = checkResults[c.id];
                  if (!res) return false;
                  if (c.expectedContract) {
                    return res.toLowerCase() === addrMap[c.expectedContract]?.toLowerCase();
                  }
                  return !isZeroAddr(res);
                })
                  ? "green.200" : "red.200"
              }
              borderRadius="full" px={2}
            >
              {WIRING_CHECKS.filter(c => c.critical && checkResults[c.id]).filter(c => {
                const res = checkResults[c.id];
                if (!res) return false;
                if (c.expectedContract) return res.toLowerCase() === addrMap[c.expectedContract]?.toLowerCase();
                return !isZeroAddr(res);
              }).length}/{WIRING_CHECKS.filter(c => c.critical).length} critiques OK
            </Badge>
          )}
        </HStack>
        <HStack spacing={2}>
          <Button
            size="xs"
            fontFamily="mono"
            fontSize="10px"
            bg="whiteAlpha.100"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={(e) => { e.stopPropagation(); runChecks(); }}
            isLoading={isRunning}
            loadingText="Vérif..."
            isDisabled={!hasDeployed}
          >
            ▶ Vérifier
          </Button>
          <Text fontSize="xs" color="whiteAlpha.400">{isOpen ? "▲" : "▼"}</Text>
        </HStack>
      </HStack>

      <Collapse in={isOpen}>
        <Box p={4}>
          {!hasDeployed ? (
            <Text fontSize="xs" color="whiteAlpha.400" fontFamily="mono">
              Aucun contrat déployé trouvé. Déployez d&apos;abord la pipeline.
            </Text>
          ) : (
            <VStack align="stretch" spacing={4}>
              {Object.entries(byContract).map(([contractName, checks]) => {
                const contractAddr = addrMap[contractName];
                if (!contractAddr) return null;

                return (
                  <Box key={contractName}>
                    <HStack mb={2} spacing={2}>
                      <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="whiteAlpha.700">
                        {contractName}
                      </Text>
                      <Code fontSize="9px" bg="blackAlpha.400" color="whiteAlpha.500" px={1} borderRadius="sm">
                        {shortAddr(contractAddr)}
                      </Code>
                    </HStack>

                    <VStack align="stretch" spacing={2} pl={3} borderLeft="1px solid" borderColor="whiteAlpha.100">
                      {checks.map((check) => {
                        const result = checkResults[check.id] ?? null;
                        const error = checkErrors[check.id] ?? null;
                        const status = fixStatus[check.id] ?? null;

                        let isOk = false;
                        let statusColor = "gray";
                        let statusLabel = "—";

                        if (result !== null) {
                          if (check.expectedContract) {
                            const expected = addrMap[check.expectedContract];
                            isOk = !!expected && result.toLowerCase() === expected.toLowerCase();
                          } else {
                            isOk = !isZeroAddr(result);
                          }
                          statusColor = isOk ? "green" : "red";
                          statusLabel = isOk ? "✅ OK" : "❌ Manquant";
                        }

                        if (error) {
                          statusColor = "orange";
                          statusLabel = "⚠️ Erreur";
                        }

                        const canFix = !isOk && check.setter && !isRunning;
                        const fixLabel =
                          status === "pending" ? "⏳ Envoi..." :
                          status === "confirming" ? "⏳ Confirmation..." :
                          status === "done" ? "✅ Fait !" :
                          status?.startsWith("error:") ? "❌ " + status.slice(6) :
                          check.doneByRelayer ? "Relayer" : "Fixer";

                        return (
                          <Box key={check.id}
                            p={2} borderRadius="lg"
                            bg={isOk ? "rgba(72,187,120,0.05)" : result !== null ? "rgba(252,129,129,0.05)" : "transparent"}
                          >
                            <HStack justify="space-between" align="flex-start">
                              <VStack align="flex-start" spacing={0.5} flex={1}>
                                <HStack spacing={2}>
                                  <Text fontSize="xs" fontFamily="mono" fontWeight="bold">
                                    {check.label}
                                  </Text>
                                  {check.critical && (
                                    <Badge fontSize="8px" colorScheme="orange" variant="subtle">
                                      CRITIQUE
                                    </Badge>
                                  )}
                                  {check.doneByRelayer && (
                                    <Badge fontSize="8px" colorScheme="blue" variant="subtle">
                                      RELAYER
                                    </Badge>
                                  )}
                                </HStack>

                                {result !== null && (
                                  <HStack spacing={1}>
                                    <Text fontSize="9px" color="whiteAlpha.500" fontFamily="mono">
                                      {shortAddr(result)}
                                    </Text>
                                    {check.expectedContract && (
                                      <Text fontSize="9px" color="whiteAlpha.300" fontFamily="mono">
                                        (attendu: {shortAddr(addrMap[check.expectedContract] ?? "")})
                                      </Text>
                                    )}
                                  </HStack>
                                )}

                                {error && (
                                  <Text fontSize="9px" color="orange.300" fontFamily="mono">
                                    {error}
                                  </Text>
                                )}

                                {/* Input pour mode manualAddress */}
                                {canFix && check.setterMode === "manualAddress" && (
                                  <Input
                                    size="xs"
                                    mt={1}
                                    fontFamily="mono"
                                    placeholder="0x... (adresse relayer)"
                                    value={manualAddr[check.id] ?? ""}
                                    onChange={(e) =>
                                      setManualAddr((p) => ({ ...p, [check.id]: e.target.value }))
                                    }
                                    bg="blackAlpha.400"
                                    border="1px solid"
                                    borderColor="whiteAlpha.200"
                                    _focus={{ borderColor: "brand.gold" }}
                                    maxW="300px"
                                  />
                                )}
                              </VStack>

                              <HStack spacing={2} flexShrink={0}>
                                <Badge
                                  fontSize="9px"
                                  fontFamily="mono"
                                  px={2} py={1}
                                  borderRadius="full"
                                  colorScheme={statusColor as "green" | "red" | "orange" | "gray"}
                                  variant="subtle"
                                >
                                  {statusLabel}
                                </Badge>

                                {canFix && check.setter && (
                                  <Tooltip label={check.description} placement="left" fontSize="xs">
                                    <Button
                                      size="xs"
                                      fontFamily="mono"
                                      fontSize="10px"
                                      bg="rgba(238,212,132,0.15)"
                                      color="brand.gold"
                                      border="1px solid"
                                      borderColor="rgba(238,212,132,0.3)"
                                      _hover={{ bg: "rgba(238,212,132,0.25)" }}
                                      onClick={() => fixCheck(check)}
                                      isLoading={status === "pending" || status === "confirming"}
                                      isDisabled={
                                        check.setterMode === "manualAddress" &&
                                        !/^0x[0-9a-fA-F]{40}$/.test(manualAddr[check.id] ?? "")
                                      }
                                    >
                                      {fixLabel}
                                    </Button>
                                  </Tooltip>
                                )}
                              </HStack>
                            </HStack>
                          </Box>
                        );
                      })}
                    </VStack>

                    <Divider mt={3} borderColor="whiteAlpha.100" />
                  </Box>
                );
              })}

              <Alert
                status="info"
                bg="rgba(0,65,106,0.3)"
                border="1px solid"
                borderColor="rgba(0,65,106,0.5)"
                borderRadius="lg"
                fontSize="xs"
                fontFamily="mono"
              >
                <AlertIcon boxSize={3} />
                <Text>
                  Les checks <Badge fontSize="8px" colorScheme="blue" variant="subtle">RELAYER</Badge> sont faits
                  automatiquement par le script relayer. Les autres doivent être
                  faits manuellement via MetaMask.
                </Text>
              </Alert>
            </VStack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
