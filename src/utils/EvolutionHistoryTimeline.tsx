import { useState, useCallback, useEffect } from "react";
import {
  Box, Text, VStack, HStack, Image, Modal,
  ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Badge, SimpleGrid, Spinner, Center, Tooltip
} from "@chakra-ui/react";
import { EvolutionStep, enrichHistoryWithRealMetadata, FullNFTMetadata } from "@/utils/evolutionHistory";
import { resolveIPFS } from "@/utils/resolveIPFS";

export default function EvolutionHistoryTimeline({
  evolutionHistory: rawHistory
}: {
  evolutionHistory: EvolutionStep[]
}) {
  const [historyWithMetadata, setHistoryWithMetadata] = useState<EvolutionStep[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllAttributes, setShowAllAttributes] = useState(false);

  const getFamilyName = (metadata: FullNFTMetadata | null) => {
    // 👈 SAFE : any seulement sur props incertaines
    const meta = metadata as any;
    return meta?.family ||
           meta?.family_name ||
           meta?.Famille ||
           metadata?.attributes?.find((a: any) => a.trait_type === "Famille")?.value ||
           metadata?.attributes?.find((a: any) => a.trait_type === "family")?.value ||
           'Inconnu';
  };

  const getLore = (metadata: FullNFTMetadata | null) => {
    const meta = metadata as any;
    return meta?.custom_data?.lore ||
           meta?.lore ||
           meta?.Lore ||
           metadata?.attributes?.find((a: any) => a.trait_type === "Lore")?.value ||
           '';
  };


  const getAllAttributes = useCallback((metadata: FullNFTMetadata | null, step: EvolutionStep | null) => {
    /*console.log('🔧 getAllAttributes appelé avec:', {
      metadata: !!metadata,
      metaAttrs: metadata?.attributes?.length || 0,
      step: !!step,
      stepMetaAttrs: step?.fullMetadata?.attributes?.length || 0
    });
*/
    // 1. Priorité : metadata.attributes (lvl 1+)
    if (metadata?.attributes && metadata.attributes.length > 0) {
      //console.log('✅ Retournant metadata.attributes:', metadata.attributes.length);
      return metadata.attributes;
    }

    // 2. Fallback lvl0 : step.fullMetadata.attributes
    if (step?.fullMetadata?.attributes && step.fullMetadata.attributes.length > 0) {
      //console.log('✅ Retournant step.fullMetadata.attributes:', step.fullMetadata.attributes.length);
      return step.fullMetadata.attributes;
    }

    //console.log('⚠️ Aucun attribut trouvé');
    return [];
  }, []);

  useEffect(() => {
    const loadMetadata = async () => {
      setIsLoading(true);
      try {
        const enriched = await enrichHistoryWithRealMetadata(rawHistory);
        //console.log('✅ Enriched:', enriched);
        setHistoryWithMetadata(enriched);
      } catch (e) {
        console.error('❌ Load failed:', e);
        setHistoryWithMetadata(rawHistory);
      } finally {
        setIsLoading(false);
      }
    };

    if (rawHistory.length > 0) {
      loadMetadata();
    } else {
      setHistoryWithMetadata([]);
      setIsLoading(false);
    }
  }, [rawHistory]);

  const handleStepClick = useCallback((index: number) => {
    //console.log('🔥 Clique:', index, historyWithMetadata[index]);
    if (index >= 0 && index < historyWithMetadata.length) {
      setSelectedStepIndex(index);
      setShowAllAttributes(false);
    }
  }, [historyWithMetadata]);

  // ✅ CALCUL DANS LE RENDU PRINCIPAL
  const selectedStep = selectedStepIndex !== null ? historyWithMetadata[selectedStepIndex] : null;
  const selectedMetadata = selectedStep?.fullMetadata as FullNFTMetadata | null;
  const allAttributes = getAllAttributes(selectedMetadata, selectedStep);
  const visibleAttributes = allAttributes.slice(0, 8);
  const hasMoreAttributes = allAttributes.length > 8;

/*
  //console.log('🔍 RENDU PRINCIPAL lvl:', selectedStep?.lvlPrevious, {
    metadata: !!selectedMetadata,
    stepFullMeta: !!selectedStep?.fullMetadata,
    metaAttrs: selectedMetadata?.attributes?.length || 0,
    stepAttrs: selectedStep?.fullMetadata?.attributes?.length || 0,
    allAttrs: allAttributes.length
  });
*/
  if (rawHistory.length === 0) return null;

  return (
    <>
      <Box mt={6}>
        <Text fontWeight="bold" mb={3} fontSize="lg">
          Historique des évolutions ({historyWithMetadata.length})
        </Text>

        {isLoading ? (
          <Center p={8}>
            <Spinner size="lg" />
            <Text ml={4}>Chargement metadata...</Text>
          </Center>
        ) : (
          <>
            <Box display={{ base: "block", md: "none" }}>
              <VStack align="stretch" spacing={4} position="relative" pl={4}
                _before={{
                  content: '""',
                  position: "absolute",
                  left: "16px",
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  bgGradient: "linear(to-b, brand.gold, brand.mauve)",
                  opacity: 0.6
                }}>
                {historyWithMetadata.map((step, idx) => (
                  <HStack
                    key={`mobile-${idx}-${step.lvlPrevious || 'egg'}`}
                    align="center"
                    spacing={3}
                    position="relative"
                    onClick={() => handleStepClick(idx)}
                    cursor="pointer"
                    _hover={{ opacity: 0.8, transform: "translateX(4px)" }}
                    transition="all 0.2s"
                  >
                    <Box
                      position="absolute"
                      left="-2px"
                      w="10px"
                      h="10px"
                      borderRadius="full"
                      bg={selectedStepIndex === idx ? "brand.gold" : "brand.mauve"}
                      boxShadow="0 0 8px rgba(238,212,132,0.8)"
                    />
                    <Box
                      ml={4}
                      p={2}
                      borderRadius="lg"
                      bg="rgba(0,0,0,0.15)"
                      border="1px solid"
                      borderColor={selectedStepIndex === idx ? "brand.gold" : "rgba(238,212,132,0.5)"}
                      w="full"
                    >
                      <HStack spacing={3}>
                        <Image
                          src={step.image || "/fallback-image.png"}
                          boxSize="90px"
                          objectFit="cover"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="rgba(180,166,213,0.7)"
                        />
                        <VStack align="flex-start" spacing={1}>
                          <Text fontSize="xs" textTransform="uppercase" color="brand.cream">
                            Niveau {idx + 1}
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold">
                            {step.lvlPrevious !== undefined ? `Niv. ${step.lvlPrevious}` : "🥚 Œuf"}
                          </Text>
                          <Text fontSize="xs" color="gray.300" fontWeight="medium">
                            {step.fullMetadata?.name || 'Œuf'}
                          </Text>
                        </VStack>
                      </HStack>
                    </Box>
                  </HStack>
                ))}
              </VStack>
            </Box>

            <Box display={{ base: "none", md: "block" }}>
              <Box overflowX="auto" py={4} px={2} sx={{ "&::-webkit-scrollbar": { display: "none" } }}>
                <HStack spacing={6} align="center" minW="max-content">
                  {historyWithMetadata.map((step, idx) => (
                    <>
                      <Box
                        key={`desktop-${idx}-${step.lvlPrevious || 'egg'}`}
                        minW="140px"
                        maxW="160px"
                        borderRadius="2xl"
                        overflow="hidden"
                        bg="rgba(17,25,40,0.6)"
                        border="2px solid"
                        borderColor="rgba(238,212,132,0.5)"
                        boxShadow="0 10px 24px rgba(0,0,0,0.35)"
                        _hover={{
                          transform: "translateY(-4px)",
                          boxShadow: "0 16px 40px rgba(0,0,0,0.6)"
                        }}
                        transition="all 0.3s"
                        onClick={() => handleStepClick(idx)}
                        cursor="pointer"
                      >
                        <Image src={step.image || "/fallback-image.png"}
                               w="100%" h="120px" objectFit="cover" />
                        <Box p={3}>
                          <Text fontSize="xs" textTransform="uppercase" color="brand.cream">
                            Niveau {idx + 1}
                          </Text>
                          <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                            {step.fullMetadata?.name || (step.lvlPrevious === 0 ? '🥚 Œuf' : 'Unknown')}
                          </Text>
                        </Box>
                      </Box>
                      {idx < historyWithMetadata.length - 1 && (
                        <Box minW="36px">
                          <Box
                            w="32px"
                            h="2px"
                            bg="rgba(238,212,132,0.7)"
                            position="relative"
                            _after={{
                              content: '""',
                              position: "absolute",
                              right: "-6px",
                              top: "-3px",
                              borderTop: "5px solid transparent",
                              borderBottom: "5px solid transparent",
                              borderLeft: "8px solid rgba(238,212,132,0.9)"
                            }}
                          />
                        </Box>
                      )}
                    </>
                  ))}
                </HStack>
              </Box>
            </Box>
          </>
        )}

        {/* ========== MODAL ========== */}
        <Modal isOpen={Boolean(selectedStepIndex !== null)} onClose={() => setSelectedStepIndex(null)} size="6xl">
          <ModalOverlay />
          <ModalContent maxH="90vh" overflowY="auto">

          <ModalHeader>
            {selectedMetadata?.name ||
             selectedStep?.fullMetadata?.name ||
             'Étape d\'évolution'}
          </ModalHeader>

            <ModalCloseButton />
            <ModalBody p={8}>
              {selectedStep ? (
                <VStack spacing={8} align="stretch">
                  {/* IMAGE ET INFOS */}
                  <VStack spacing={6} align="center">
                    <Image
                      src={
                        resolveIPFS(selectedMetadata?.image, true) ||
                        selectedStep?.image ||
                        "/fallback-image.png"
                      }
                      boxSize="300px"
                      borderRadius="2xl"
                      objectFit="cover"
                    />

                    <Box textAlign="center">
                    <Text fontSize="2xl" fontWeight="bold">
                      {selectedMetadata?.name || selectedStep?.fullMetadata?.name || 'Insecte'}
                    </Text>

                      <Text fontSize="lg" fontWeight="semibold" color="brand.gold">
                        {getFamilyName(selectedMetadata)}
                      </Text>
                      {getLore(selectedMetadata) && (
                        <Text fontSize="md" fontStyle="italic" color="gray.400" mt={2}>
                          "{getLore(selectedMetadata)}"
                        </Text>
                      )}
                      {selectedMetadata?.description && (
                        <Text fontSize="sm" color="gray.600">{selectedMetadata.description}</Text>
                      )}
                    </Box>
                  </VStack>

                  {/* ATTRIBUTS */}
                  <Box>
                    <HStack justify="space-between" mb={4}>
                      <Text fontWeight="bold" fontSize="lg">
                        Attributs ({allAttributes.length})
                      </Text>
                      {hasMoreAttributes && (
                        <Text
                          fontSize="sm"
                          color="blue.400"
                          cursor="pointer"
                          onClick={() => setShowAllAttributes(!showAllAttributes)}
                          fontWeight="medium"
                        >
                          {showAllAttributes ? 'Moins' : `+${allAttributes.length - 8}`}
                        </Text>
                      )}
                    </HStack>

                    {allAttributes && allAttributes.length > 0 ? (
                      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
                        {(showAllAttributes ? allAttributes : visibleAttributes).map((attr: any, i: number) => (
                          <Tooltip
                            key={`attr-${i}-${attr.trait_type}`}
                            label={`${attr.trait_type}: ${attr.value}`}
                            placement="top"
                          >
                            <Badge
                              colorScheme="purple"
                              p={3}
                              borderRadius="lg"
                              minH="70px"
                              textAlign="center"
                              maxW="100%"
                              whiteSpace="normal"
                              overflow="hidden"
                              display="flex"
                              flexDirection="column"
                              justifyContent="center"
                            >
                              <Text fontSize="xs" fontWeight="bold" noOfLines={1}>
                                {attr.trait_type}
                              </Text>
                              <Text fontSize="sm" noOfLines={2}>
                                {attr.value}
                              </Text>
                            </Badge>
                          </Tooltip>
                        ))}
                      </SimpleGrid>
                    ) : (
                      <Center p={8} color="gray.500">
                        <VStack>
                          <Text>Aucun attribut disponible</Text>
                          <Text fontSize="xs" opacity={0.6}>
                            lvl: {selectedStep?.lvlPrevious}, attrs: {allAttributes.length}
                          </Text>
                        </VStack>
                      </Center>
                    )}
                  </Box>

                </VStack>
              ) : (
                <Center p={12}>
                  <Text>Sélectionnez une étape...</Text>
                </Center>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
}
