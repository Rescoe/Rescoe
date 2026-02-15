import { useState, useCallback, useEffect } from "react";
import {
  Box, Text, VStack, HStack, Image, Modal,
  ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  Badge, SimpleGrid, Spinner, Center
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

  useEffect(() => {
    const loadMetadata = async () => {
      //console.log('🔍 Loading metadata for:', rawHistory.length, 'steps');
      setIsLoading(true);
      try {
        const enriched = await enrichHistoryWithRealMetadata(rawHistory);
        //console.log('✅ Enriched history:', enriched.length);
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
    //console.log('🔥 CLICK lvl0 index:', index, 'total:', historyWithMetadata.length);
    if (index >= 0 && index < historyWithMetadata.length) {
      const step = historyWithMetadata[index];
      //console.log('✅ SELECT:', step.lvlPrevious, step.fullMetadata?.name);
      setSelectedStepIndex(index);
    } else {
      console.error('❌ Index invalide:', index);
    }
  }, [historyWithMetadata]);

  const selectedStep = selectedStepIndex !== null ? historyWithMetadata[selectedStepIndex] : null;
  const selectedMetadata = selectedStep?.fullMetadata as FullNFTMetadata | null;

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
            {/* MOBILE */}
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
                            Étape {idx + 1}
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

            {/* DESKTOP */}
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
                        <Image   src={step.image || "/fallback-image.png"}
                                  w="100%" h="120px" objectFit="cover" />
                        <Box p={3}>
                          <Text fontSize="xs" textTransform="uppercase" color="brand.cream">
                            Étape {idx + 1}
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

        {/* MODAL */}
        <Modal isOpen={Boolean(selectedStepIndex)} onClose={() => setSelectedStepIndex(null)} size="5xl">
          <ModalOverlay />
          <ModalContent maxH="90vh" overflowY="auto">
            <ModalHeader>{selectedMetadata?.name || 'Insecte'}</ModalHeader>
            <ModalCloseButton />
            <ModalBody p={8}>
              {selectedMetadata ? (
                <VStack spacing={8} align="stretch">
                  <VStack spacing={6} align="center">
                  <Image
                    src={
                      resolveIPFS(selectedMetadata?.image, true) ||
                      selectedStep?.image ||
                      "/fallback-image.png"
                    }
                    boxSize="300px"
                    borderRadius="2xl"
                    />

                    <Box textAlign="center">
                      <Text fontSize="2xl" fontWeight="bold">{selectedMetadata.name}</Text>
                      <Text fontSize="lg" fontWeight="semibold">
                        {selectedMetadata.famille || selectedStep?.lvlPrevious === 0 ? 'Œuf' : 'Inconnu'}
                      </Text>
                      {selectedMetadata.description && (
                        <Text fontStyle="italic" color="gray.600">{selectedMetadata.description}</Text>
                      )}
                    </Box>
                  </VStack>

                  <Box>
                    <Text fontWeight="bold" fontSize="lg" mb={6}>
                      Attributs ({selectedMetadata.attributes?.length || 0})
                    </Text>
                    <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3}>
                      {selectedMetadata.attributes?.map((attr: any, i: number) => (
                        <Badge key={i} colorScheme="purple" p={3} borderRadius="lg" minH="70px" textAlign="center">
                          <Text fontSize="xs" fontWeight="bold">{attr.trait_type}</Text>
                          <Text fontSize="sm">{attr.value}</Text>
                        </Badge>
                      )) || <Text>Aucun attribut</Text>}
                    </SimpleGrid>
                  </Box>
                </VStack>
              ) : (
                <Center p={12}>
                  <Text>Détails en chargement... {selectedStep?.lvlPrevious || 'N/A'}</Text>
                </Center>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
}
