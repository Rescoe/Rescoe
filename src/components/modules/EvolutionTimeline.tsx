/**
 * EvolutionTimeline — Frise chronologique des évolutions d'un insecte.
 *
 * Reçoit :
 *   - pastSteps   : snapshots archivés on-chain (useEvolutionHistory)
 *   - currentStep : état actuel construit depuis nftData (buildCurrentStep)
 *
 * Affichage : cartes horizontales scrollables (LVL0 → … → LVL actuel)
 * Clic sur une carte → modal avec tous les attributs de l'insecte.
 */

import React, { useState } from "react";
import {
  Box,
  Flex,
  Image,
  Text,
  Badge,
  Skeleton,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  SimpleGrid,
  useDisclosure,
} from "@chakra-ui/react";
import { EvolutionStep } from "@/hooks/useEvolutionHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const LEVEL_COLORS: Record<number, string> = {
  0: "gray",
  1: "green",
  2: "blue",
  3: "purple",
};

// ─── Modal attributs ──────────────────────────────────────────────────────────

const AttributesModal = ({
  step,
  isOpen,
  onClose,
}: {
  step: EvolutionStep | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!step) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="85vh">
        <ModalHeader fontSize="md" pb={1}>
          <Flex align="center" gap={2}>
            <Badge colorScheme={LEVEL_COLORS[step.level] ?? "gray"} borderRadius="full" px={2}>
              LVL {step.level}
            </Badge>
            <Text noOfLines={1}>{step.displayName}</Text>
            {step.isCurrent && (
              <Badge colorScheme="yellow" borderRadius="full" px={2} fontSize="9px">
                ● Actuel
              </Badge>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {/* Image */}
          {step.imageUrl && (
            <Image
              src={step.imageUrl}
              alt={step.displayName}
              borderRadius="md"
              maxH="180px"
              mx="auto"
              mb={4}
              objectFit="contain"
            />
          )}

          {/* Date */}
          {step.timestamp > 0 && (
            <Text fontSize="xs" color="whiteAlpha.500" textAlign="center" mb={4}>
              Évolution le {formatDate(step.timestamp)}
            </Text>
          )}

          {/* Attributs */}
          {step.attributes.length > 0 ? (
            <SimpleGrid columns={2} spacing={2}>
              {step.attributes.map((attr, i) => (
                <Box
                  key={i}
                  bg="whiteAlpha.50"
                  border="1px solid"
                  borderColor="whiteAlpha.100"
                  borderRadius="lg"
                  px={3}
                  py={2}
                >
                  <Text fontSize="9px" color="whiteAlpha.500" textTransform="uppercase" letterSpacing="wider">
                    {String(attr.trait_type)}
                  </Text>
                  <Text fontSize="sm" fontWeight="semibold" color="whiteAlpha.900" noOfLines={1}>
                    {String(attr.value)}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Text fontSize="sm" color="whiteAlpha.400" textAlign="center">
              Aucun attribut disponible pour ce stade.
            </Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

// ─── Carte d'une étape ────────────────────────────────────────────────────────

const StepCard = ({
  step,
  onClick,
}: {
  step: EvolutionStep;
  onClick: () => void;
}) => {
  const color = LEVEL_COLORS[step.level] ?? "gray";

  return (
    <Box
      minW="130px"
      maxW="160px"
      border="2px solid"
      borderColor={step.isCurrent ? "brand.gold" : "whiteAlpha.200"}
      borderRadius="xl"
      p={3}
      bg={step.isCurrent ? "whiteAlpha.100" : "transparent"}
      position="relative"
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{ borderColor: "brand.gold", transform: "translateY(-2px)" }}
      flexShrink={0}
    >
      {/* Badge niveau */}
      <Badge
        colorScheme={color}
        position="absolute"
        top={2}
        left={2}
        fontSize="9px"
        borderRadius="full"
        px={2}
      >
        LVL {step.level}
      </Badge>

      {/* Point "actuel" */}
      {step.isCurrent && (
        <Box
          position="absolute"
          top={2}
          right={2}
          w={2}
          h={2}
          borderRadius="full"
          bg="brand.gold"
          boxShadow="0 0 6px gold"
        />
      )}

      {/* Image */}
      <Box mt={4} mb={2} borderRadius="md" overflow="hidden" h="90px" bg="blackAlpha.300">
        {step.imageUrl ? (
          <Image
            src={step.imageUrl}
            alt={step.displayName}
            w="full"
            h="full"
            objectFit="cover"
          />
        ) : (
          <Flex w="full" h="full" align="center" justify="center">
            <Text fontSize="9px" color="whiteAlpha.300" textAlign="center" px={1}>
              Image non disponible
            </Text>
          </Flex>
        )}
      </Box>

      {/* Nom */}
      <Tooltip label={`${step.displayName} — cliquer pour voir les attributs`} placement="top" openDelay={400}>
        <Text
          fontSize="10px"
          fontWeight="bold"
          color="whiteAlpha.900"
          noOfLines={2}
          lineHeight="1.3"
          mb={1}
          textAlign="center"
        >
          {step.displayName}
        </Text>
      </Tooltip>

      {/* Date / label */}
      <Text
        fontSize="9px"
        color={step.isCurrent ? "brand.gold" : "whiteAlpha.500"}
        textAlign="center"
        fontWeight={step.isCurrent ? "bold" : "normal"}
      >
        {step.isCurrent ? "● Actuel" : formatDate(step.timestamp)}
      </Text>

      {/* Hint attributs */}
      <Text fontSize="8px" color="whiteAlpha.300" textAlign="center" mt={1}>
        cliquer pour les attributs
      </Text>
    </Box>
  );
};

// ─── Flèche entre cartes ──────────────────────────────────────────────────────

const Arrow = () => (
  <Flex alignItems="center" flexShrink={0} px={1}>
    <Text fontSize="lg" color="whiteAlpha.400">→</Text>
  </Flex>
);

// ─── Composant principal ──────────────────────────────────────────────────────

interface EvolutionTimelineProps {
  pastSteps: EvolutionStep[];
  currentStep: EvolutionStep | null;
  isLoading: boolean;
}

const EvolutionTimeline = ({ pastSteps, currentStep, isLoading }: EvolutionTimelineProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selected, setSelected] = useState<EvolutionStep | null>(null);

  const allSteps = currentStep ? [...pastSteps, currentStep] : pastSteps;

  const handleClick = (step: EvolutionStep) => {
    setSelected(step);
    onOpen();
  };

  if (isLoading) {
    return (
      <Flex gap={3} py={4} overflowX="auto">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} minW="130px" h="170px" borderRadius="xl" />
        ))}
      </Flex>
    );
  }

  if (allSteps.length === 0) {
    return (
      <Text fontSize="sm" color="whiteAlpha.500" py={4} textAlign="center">
        Aucune donnée d'évolution disponible.
      </Text>
    );
  }

  return (
    <>
      <Box>
        <Text fontSize="xs" color="whiteAlpha.400" mb={3} textAlign="center">
          {pastSteps.length === 0
            ? "Première forme — l'insecte n'a pas encore évolué."
            : `${pastSteps.length} évolution${pastSteps.length > 1 ? "s" : ""} archivée${pastSteps.length > 1 ? "s" : ""} on-chain`}
        </Text>

        <Box
          overflowX="auto"
          pb={3}
          sx={{
            "::-webkit-scrollbar": { height: "4px" },
            "::-webkit-scrollbar-thumb": { bg: "whiteAlpha.200" },
          }}
        >
          <Flex align="center" gap={1} minW="max-content" px={2}>
            {allSteps.map((step, i) => (
              <React.Fragment key={i}>
                <StepCard step={step} onClick={() => handleClick(step)} />
                {i < allSteps.length - 1 && <Arrow />}
              </React.Fragment>
            ))}
          </Flex>
        </Box>
      </Box>

      <AttributesModal step={selected} isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default EvolutionTimeline;
