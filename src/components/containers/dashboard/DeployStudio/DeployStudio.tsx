/**
 * DeployStudio — Outil d'administration pour déployer les contrats Rescoe
 *
 * Intégration dans l'onglet "Deploy" du dashboard admin.
 * Utilise le projet HardhatRescoe comme backend de compilation/déploiement.
 *
 * ADMIN UNIQUEMENT — local uniquement (Vercel bloque les routes child_process).
 * NOTE: Pas de "use client" — ce composant est chargé via next/dynamic avec ssr: false.
 */

import React, { useState, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Alert,
  AlertIcon,
  AlertDescription,
  SimpleGrid,
  Divider,
  Badge,
  Collapse,
  useDisclosure,
  Input,
  ButtonGroup,
  Spinner,
  FormLabel,
  FormControl,
  Code,
} from "@chakra-ui/react";

import {
  useDeployStudio,
  BUILT_IN_TEMPLATES,
  PipelineTemplate,
  FullPipelineResult,
} from "./hooks/useDeployStudio";
import { NetworkSelector } from "./components/NetworkSelector";
import { HardhatNode } from "./components/HardhatNode";
import { ContractPicker } from "./components/ContractPicker";
import { DeployBlockCard } from "./components/DeployBlock";
import { LiveLogs } from "./components/LiveLogs";
import { DeployedHistory } from "./components/DeployedHistory";
import { WiringChecker } from "./components/WiringChecker";
import { ContractInteractor } from "./components/ContractInteractor";

export default function DeployStudio() {
  const {
    blocks,
    deployedContracts,
    availableContracts,
    network,
    setNetwork,
    isDeploying,
    isCompiling,
    hardhatRunning,
    logs,
    addLog,
    addBlock,
    updateBlock,
    removeBlock,
    toggleBlock,
    deployPipeline,
    compile,
    startHardhat,
    stopHardhat,
    checkHardhatStatus,
    fetchAvailableContracts,
    fetchDeployedContracts,
    removeDeployedContract,
    purgeAllContracts,
    deployMode,
    setDeployMode,
    savedTemplates,
    loadTemplate,
    saveCurrentPipeline,
    deleteTemplate,
    estimatedCost,
    isEstimating,
    estimatePipelineCost,
    isFullPipelineDeploying,
    fullPipelineResult,
    deployFullPipeline,
  } = useDeployStudio();

  const [localLogs, setLocalLogs] = useState<string[]>([]);
  const allLogs = [...logs, ...localLogs];
  const clearLogs = useCallback(() => setLocalLogs([]), []);

  const [saveTemplateName, setSaveTemplateName] = useState("");

  // One-click relayer pipeline inputs
  const [pipelineOwner, setPipelineOwner] = useState("");
  const [pipelineArtist, setPipelineArtist] = useState("");
  const { isOpen: isPipelineOpen, onToggle: togglePipeline } = useDisclosure({
    defaultIsOpen: true,
  });

  const { isOpen: isHistoryOpen, onToggle: toggleHistory } = useDisclosure({
    defaultIsOpen: true,
  });

  const ETH_RE = /^0x[0-9a-fA-F]{40}$/;
  const pipelineValid = ETH_RE.test(pipelineOwner) && ETH_RE.test(pipelineArtist);

  const handleDeployFullPipeline = useCallback(() => {
    if (!pipelineValid) return;
    deployFullPipeline(pipelineOwner, pipelineArtist);
  }, [pipelineValid, pipelineOwner, pipelineArtist, deployFullPipeline]);

  const isLocalOnly =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const handleLoadTemplate = useCallback(
    (t: PipelineTemplate) => {
      loadTemplate(t);
    },
    [loadTemplate]
  );

  const handleSavePipeline = useCallback(() => {
    const name = saveTemplateName.trim();
    if (!name) return;
    saveCurrentPipeline(name);
    setSaveTemplateName("");
  }, [saveTemplateName, saveCurrentPipeline]);

  return (
    <Box w="full" maxW="full">
      {/* En-tête */}
      <HStack mb={6} justify="space-between" align="start" flexWrap="wrap" gap={3}>
        <VStack align="start" spacing={0}>
          <HStack spacing={3}>
            <Heading
              size="md"
              fontFamily="mono"
              bgGradient="linear(to-r, purple.300, blue.300)"
              bgClip="text"
            >
              Deploy Studio
            </Heading>
            <Badge
              colorScheme="purple"
              variant="subtle"
              fontFamily="mono"
              fontSize="9px"
            >
              ADMIN
            </Badge>
            <Badge
              colorScheme="orange"
              variant="subtle"
              fontFamily="mono"
              fontSize="9px"
            >
              LOCAL ONLY
            </Badge>
          </HStack>
          <Text fontSize="xs" color="whiteAlpha.500" mt={1} fontFamily="mono">
            Compilation et déploiement des contrats Rescoe via Hardhat ou MetaMask
          </Text>
        </VStack>
      </HStack>

      {/* Avertissement si prod */}
      {isLocalOnly && (
        <Alert
          status="warning"
          mb={5}
          borderRadius="xl"
          bg="orange.900"
          border="1px solid"
          borderColor="orange.500"
        >
          <AlertIcon color="orange.300" />
          <AlertDescription fontSize="xs" fontFamily="mono">
            Les routes de déploiement ne sont disponibles qu&apos;en local
            (localhost). Sur Vercel, elles renvoient 503.
          </AlertDescription>
        </Alert>
      )}

      {/* Deploy Mode Toggle */}
      <Box
        mb={5}
        bg="whiteAlpha.50"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="xl"
        p={4}
      >
        <Text
          fontSize="xs"
          color="whiteAlpha.500"
          fontFamily="mono"
          letterSpacing="wider"
          mb={3}
        >
          MODE DE DÉPLOIEMENT
        </Text>
        <ButtonGroup size="sm" isAttached variant="outline" fontFamily="mono">
          <Button
            colorScheme={deployMode === "hardhat" ? "purple" : "whiteAlpha"}
            variant={deployMode === "hardhat" ? "solid" : "outline"}
            onClick={() => setDeployMode("hardhat")}
            fontFamily="mono"
            fontSize="xs"
          >
            Hardhat Script
          </Button>
          <Button
            colorScheme={deployMode === "metamask" ? "orange" : "whiteAlpha"}
            variant={deployMode === "metamask" ? "solid" : "outline"}
            onClick={() => setDeployMode("metamask")}
            fontFamily="mono"
            fontSize="xs"
          >
            🦊 MetaMask Direct
          </Button>
        </ButtonGroup>
        {deployMode === "metamask" && (
          <Text fontSize="xs" color="orange.300" fontFamily="mono" mt={2}>
            Chaque contrat requiert une confirmation MetaMask.
          </Text>
        )}
        {deployMode === "hardhat" && (
          <Text fontSize="xs" color="whiteAlpha.400" fontFamily="mono" mt={2}>
            Déploiement via le relayer Hardhat (clé privée serveur).
          </Text>
        )}
      </Box>

      {/* ── One-Click Full Pipeline (Relayer) ──────────────────────────────── */}
      <Box mb={5}>
        <HStack
          mb={3}
          cursor="pointer"
          onClick={togglePipeline}
          userSelect="none"
        >
          <Text
            fontSize="xs"
            fontFamily="mono"
            letterSpacing="wider"
            color="purple.300"
          >
            {isPipelineOpen ? "▼" : "▶"} ⚡ PIPELINE COMPLÈTE VIA RELAYER
          </Text>
          <Badge
            colorScheme="purple"
            variant="subtle"
            fontFamily="mono"
            fontSize="9px"
          >
            8 CONTRATS
          </Badge>
        </HStack>

        <Collapse in={isPipelineOpen}>
          <Box
            bg="rgba(80,0,160,0.12)"
            border="1px solid"
            borderColor="purple.800"
            borderRadius="xl"
            p={5}
          >
            <Text fontSize="xs" color="whiteAlpha.500" fontFamily="mono" mb={4}>
              Le relayer déploie les 8 contrats, câble les adresses
              (setInsectStorage, addAdhesionContract, setAuthorizedCallers),
              puis transfère la propriété à l&apos;association. Aucune confirmation
              MetaMask requise — le relayer paie le gas.
            </Text>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
              <FormControl>
                <FormLabel fontSize="xs" fontFamily="mono" color="whiteAlpha.600" mb={1}>
                  Adresse de l&apos;association (owner final)
                </FormLabel>
                <Input
                  placeholder="0x..."
                  value={pipelineOwner}
                  onChange={(e) => setPipelineOwner(e.target.value)}
                  size="sm"
                  fontFamily="mono"
                  fontSize="xs"
                  bg="blackAlpha.400"
                  border="1px solid"
                  borderColor={
                    pipelineOwner && !ETH_RE.test(pipelineOwner)
                      ? "red.500"
                      : "whiteAlpha.200"
                  }
                  color="white"
                  _placeholder={{ color: "whiteAlpha.300" }}
                  _focus={{ borderColor: "purple.400", boxShadow: "none" }}
                />
                {pipelineOwner && !ETH_RE.test(pipelineOwner) && (
                  <Text fontSize="10px" color="red.400" fontFamily="mono" mt={1}>
                    Adresse invalide (0x + 40 hex)
                  </Text>
                )}
              </FormControl>

              <FormControl>
                <FormLabel fontSize="xs" fontFamily="mono" color="whiteAlpha.600" mb={1}>
                  Adresse de l&apos;artiste
                </FormLabel>
                <Input
                  placeholder="0x..."
                  value={pipelineArtist}
                  onChange={(e) => setPipelineArtist(e.target.value)}
                  size="sm"
                  fontFamily="mono"
                  fontSize="xs"
                  bg="blackAlpha.400"
                  border="1px solid"
                  borderColor={
                    pipelineArtist && !ETH_RE.test(pipelineArtist)
                      ? "red.500"
                      : "whiteAlpha.200"
                  }
                  color="white"
                  _placeholder={{ color: "whiteAlpha.300" }}
                  _focus={{ borderColor: "purple.400", boxShadow: "none" }}
                />
                {pipelineArtist && !ETH_RE.test(pipelineArtist) && (
                  <Text fontSize="10px" color="red.400" fontFamily="mono" mt={1}>
                    Adresse invalide (0x + 40 hex)
                  </Text>
                )}
              </FormControl>
            </SimpleGrid>

            <Button
              w="full"
              size="md"
              colorScheme="purple"
              isLoading={isFullPipelineDeploying}
              loadingText="Pipeline en cours… (peut durer jusqu'à 10 min)"
              isDisabled={!pipelineValid || isFullPipelineDeploying}
              onClick={handleDeployFullPipeline}
              fontFamily="mono"
              bgGradient="linear(to-r, purple.700, blue.700)"
              _hover={
                pipelineValid
                  ? {
                      bgGradient: "linear(to-r, purple.500, blue.500)",
                      transform: "translateY(-1px)",
                      boxShadow: "0 0 24px rgba(139,92,246,0.5)",
                    }
                  : {}
              }
              transition="all 0.2s"
              mb={4}
            >
              ⚡ Déployer la pipeline complète via Relayer — {network}
            </Button>

            {/* Result panel */}
            {fullPipelineResult && (
              <Box
                bg={
                  fullPipelineResult.success
                    ? "rgba(0,180,80,0.08)"
                    : "rgba(200,0,0,0.1)"
                }
                border="1px solid"
                borderColor={
                  fullPipelineResult.success ? "green.700" : "red.700"
                }
                borderRadius="lg"
                p={4}
              >
                {fullPipelineResult.success ? (
                  <VStack align="stretch" spacing={3}>
                    <HStack spacing={2}>
                      <Text fontSize="sm" color="green.300" fontFamily="mono" fontWeight="bold">
                        ✅ Pipeline déployée avec succès
                      </Text>
                      <Badge colorScheme="green" variant="subtle" fontFamily="mono" fontSize="9px">
                        {fullPipelineResult.network ?? network}
                      </Badge>
                    </HStack>

                    <Divider borderColor="whiteAlpha.100" />

                    {/* Contract addresses table */}
                    <VStack align="stretch" spacing={1}>
                      {Object.entries(fullPipelineResult.contracts ?? {}).map(
                        ([name, addr]) => (
                          <HStack
                            key={name}
                            justify="space-between"
                            bg="blackAlpha.300"
                            px={3}
                            py={1}
                            borderRadius="md"
                          >
                            <Text
                              fontSize="xs"
                              fontFamily="mono"
                              color="whiteAlpha.700"
                              minW="200px"
                            >
                              {name}
                            </Text>
                            <Code
                              fontSize="10px"
                              fontFamily="mono"
                              colorScheme="purple"
                              bg="transparent"
                              color="purple.200"
                              cursor="pointer"
                              onClick={() =>
                                navigator.clipboard.writeText(addr)
                              }
                              title="Cliquer pour copier"
                            >
                              {addr}
                            </Code>
                          </HStack>
                        )
                      )}
                    </VStack>

                    <HStack spacing={4} pt={1}>
                      <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono">
                        Relayer : {fullPipelineResult.relayer ?? "—"}
                      </Text>
                      <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono">
                        Owner : {fullPipelineResult.owner ?? pipelineOwner}
                      </Text>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack align="start" spacing={2}>
                    <Text fontSize="sm" color="red.300" fontFamily="mono" fontWeight="bold">
                      ❌ Pipeline échouée
                    </Text>
                    <Text fontSize="xs" color="red.200" fontFamily="mono">
                      {fullPipelineResult.error}
                    </Text>
                    <Text fontSize="10px" color="whiteAlpha.400" fontFamily="mono">
                      Vérifiez les logs ci-dessous pour plus de détails.
                    </Text>
                  </VStack>
                )}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} mb={5}>
        {/* Colonne gauche — config */}
        <VStack spacing={4} align="stretch">
          {/* Réseau */}
          <NetworkSelector
            value={network}
            onChange={setNetwork}
            hardhatRunning={hardhatRunning}
          />

          {/* Nœud Hardhat (masqué si pas hardhat) */}
          {network === "hardhat" && (
            <HardhatNode
              running={hardhatRunning}
              onStart={startHardhat}
              onStop={stopHardhat}
              onCheck={checkHardhatStatus}
            />
          )}

          {/* Templates Pipeline */}
          <Box
            bg="whiteAlpha.50"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="xl"
            p={4}
          >
            <Text
              fontSize="xs"
              color="whiteAlpha.500"
              fontFamily="mono"
              letterSpacing="wider"
              mb={3}
            >
              TEMPLATES PIPELINE
            </Text>

            {/* Built-in templates */}
            <VStack spacing={2} align="stretch" mb={3}>
              {BUILT_IN_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  size="xs"
                  colorScheme="purple"
                  variant="outline"
                  justifyContent="space-between"
                  onClick={() => handleLoadTemplate(t)}
                  fontFamily="mono"
                  fontSize="10px"
                  h="auto"
                  py={2}
                  px={3}
                >
                  <HStack spacing={2} flex={1} justify="space-between">
                    <Text noOfLines={1} flex={1} textAlign="left">
                      ▶ {t.name}
                    </Text>
                    <Text color="whiteAlpha.400" fontSize="9px" flexShrink={0}>
                      {t.blocks.length} contrats
                    </Text>
                  </HStack>
                </Button>
              ))}
            </VStack>

            {/* Saved templates */}
            {savedTemplates.length > 0 && (
              <>
                <Divider my={2} borderColor="whiteAlpha.100" />
                <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono" mb={2}>
                  SAUVEGARDÉES
                </Text>
                <VStack spacing={2} align="stretch" mb={3}>
                  {savedTemplates.map((t) => (
                    <HStack key={t.id} spacing={1}>
                      <Button
                        size="xs"
                        colorScheme="blue"
                        variant="outline"
                        onClick={() => handleLoadTemplate(t)}
                        fontFamily="mono"
                        fontSize="10px"
                        flex={1}
                        justifyContent="flex-start"
                      >
                        ▶ {t.name}
                      </Button>
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => deleteTemplate(t.id)}
                        fontFamily="mono"
                        fontSize="10px"
                        px={2}
                        flexShrink={0}
                      >
                        ✕
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </>
            )}

            {/* Save current pipeline */}
            {blocks.length > 0 && (
              <>
                <Divider my={2} borderColor="whiteAlpha.100" />
                <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono" mb={2}>
                  SAUVEGARDER LA PIPELINE ACTUELLE
                </Text>
                <HStack spacing={2}>
                  <Input
                    placeholder="Nom du template..."
                    value={saveTemplateName}
                    onChange={(e) => setSaveTemplateName(e.target.value)}
                    size="xs"
                    fontFamily="mono"
                    fontSize="10px"
                    bg="blackAlpha.300"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    color="white"
                    _placeholder={{ color: "whiteAlpha.300" }}
                    _focus={{ borderColor: "purple.400", boxShadow: "none" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePipeline();
                    }}
                  />
                  <Button
                    size="xs"
                    colorScheme="purple"
                    variant="solid"
                    onClick={handleSavePipeline}
                    fontFamily="mono"
                    fontSize="10px"
                    isDisabled={!saveTemplateName.trim()}
                    flexShrink={0}
                  >
                    💾
                  </Button>
                </HStack>
              </>
            )}
          </Box>

          {/* Sélecteur de contrats */}
          <ContractPicker
            contracts={availableContracts}
            onAdd={addBlock}
            onCompile={compile}
            onRefresh={fetchAvailableContracts}
            isCompiling={isCompiling}
          />
        </VStack>

        {/* Colonne droite — pipeline */}
        <Box>
          <Box
            bg="whiteAlpha.50"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="xl"
            p={4}
            minH="320px"
          >
            <HStack justify="space-between" mb={4}>
              <Text
                fontSize="xs"
                color="whiteAlpha.500"
                fontFamily="mono"
                letterSpacing="wider"
              >
                PIPELINE DE DÉPLOIEMENT
              </Text>

              {blocks.length > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  fontFamily="mono"
                  fontSize="10px"
                  onClick={() => blocks.forEach((b) => removeBlock(b.id))}
                >
                  Vider
                </Button>
              )}
            </HStack>

            {blocks.length === 0 ? (
              <Box
                h="200px"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                border="1px dashed"
                borderColor="whiteAlpha.200"
                borderRadius="xl"
              >
                <Text fontSize="2xl" mb={2} opacity={0.3}>
                  ⬡
                </Text>
                <Text
                  color="whiteAlpha.300"
                  fontSize="xs"
                  fontFamily="mono"
                  textAlign="center"
                >
                  Sélectionne des contrats à gauche
                  <br />
                  pour construire la pipeline
                </Text>
              </Box>
            ) : (
              <VStack spacing={6} align="stretch" mb={4}>
                {blocks.map((block, index) => (
                  <DeployBlockCard
                    key={block.id}
                    block={block}
                    index={index}
                    allBlocks={blocks}
                    onUpdate={updateBlock}
                    onRemove={removeBlock}
                    onToggle={toggleBlock}
                  />
                ))}
              </VStack>
            )}

            {blocks.length > 0 && (
              <>
                <Divider my={4} borderColor="whiteAlpha.100" />

                {/* Cost Estimation */}
                <Box mb={4}>
                  <HStack spacing={3} align="center" mb={2}>
                    <Button
                      size="xs"
                      colorScheme="yellow"
                      variant="outline"
                      onClick={estimatePipelineCost}
                      isLoading={isEstimating}
                      loadingText="Estimation..."
                      fontFamily="mono"
                      fontSize="10px"
                    >
                      💰 Estimer le coût
                    </Button>
                    {isEstimating && (
                      <Spinner size="xs" color="yellow.300" />
                    )}
                  </HStack>

                  {estimatedCost && (
                    <Box
                      bg="blackAlpha.400"
                      border="1px solid"
                      borderColor="yellow.900"
                      borderRadius="lg"
                      p={3}
                    >
                      <VStack spacing={1} align="start">
                        <Text fontSize="xs" fontFamily="mono" color="yellow.200">
                          ≈ {estimatedCost.gasTotal.toString()} gas
                        </Text>
                        <Text fontSize="xs" fontFamily="mono" color="yellow.300">
                          ≈ {estimatedCost.ethCost.toFixed(6)} ETH
                        </Text>
                        {estimatedCost.eurCost !== null && (
                          <Text fontSize="xs" fontFamily="mono" color="yellow.400">
                            ≈ €{estimatedCost.eurCost.toFixed(2)}
                          </Text>
                        )}
                        <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono" mt={1}>
                          Estimation approximative. Le coût réel dépend du gas au
                          moment du déploiement.
                        </Text>
                      </VStack>
                    </Box>
                  )}
                </Box>

                <Button
                  w="full"
                  size="md"
                  colorScheme="purple"
                  variant="solid"
                  isLoading={isDeploying}
                  loadingText="Déploiement en cours..."
                  onClick={deployPipeline}
                  fontFamily="mono"
                  bgGradient="linear(to-r, purple.600, blue.600)"
                  _hover={{
                    bgGradient: "linear(to-r, purple.500, blue.500)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 0 20px rgba(139, 92, 246, 0.4)",
                  }}
                  transition="all 0.2s"
                  isDisabled={network === "hardhat" && !hardhatRunning && deployMode === "hardhat"}
                >
                  {network === "hardhat" && !hardhatRunning && deployMode === "hardhat"
                    ? "⚠️ Démarre le nœud Hardhat d'abord"
                    : deployMode === "metamask"
                    ? `🦊 Déployer sur ${network} via MetaMask`
                    : `🚀 Déployer sur ${network}`}
                </Button>

                {network === "base" && (
                  <Alert
                    status="error"
                    mt={2}
                    size="sm"
                    borderRadius="lg"
                    bg="red.900"
                    border="1px solid"
                    borderColor="red.500"
                  >
                    <AlertIcon color="red.300" boxSize={3} />
                    <AlertDescription fontSize="xs" fontFamily="mono">
                      ⚠️ Mainnet Base — utilise de l&apos;ETH réel. Confirme
                      dans MetaMask.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </Box>
        </Box>
      </SimpleGrid>

      {/* Logs */}
      <Box mb={5}>
        <LiveLogs logs={allLogs} onClear={clearLogs} />
      </Box>

      {/* Vérificateur de câblage post-déploiement */}
      <Box mb={5}>
        <WiringChecker deployedContracts={deployedContracts} network={network} />
      </Box>

      {/* Interacteur de contrats (Remix-like) */}
      <Box mb={5}>
        <ContractInteractor deployedContracts={deployedContracts} />
      </Box>

      {/* Historique */}
      <Box>
        <HStack
          mb={3}
          cursor="pointer"
          onClick={toggleHistory}
          userSelect="none"
        >
          <Text
            fontSize="xs"
            color="whiteAlpha.400"
            fontFamily="mono"
            letterSpacing="wider"
          >
            {isHistoryOpen ? "▼" : "▶"} HISTORIQUE
          </Text>
          <Badge
            colorScheme="whiteAlpha"
            variant="subtle"
            fontFamily="mono"
            fontSize="9px"
          >
            {deployedContracts.length}
          </Badge>
        </HStack>
        <Collapse in={isHistoryOpen}>
          <DeployedHistory
            contracts={deployedContracts}
            onRemove={removeDeployedContract}
            onRefresh={fetchDeployedContracts}
            onPurgeAll={purgeAllContracts}
          />
        </Collapse>
      </Box>
    </Box>
  );
}
