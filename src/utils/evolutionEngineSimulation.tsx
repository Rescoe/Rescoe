import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Box, Button, Image, Text, SimpleGrid, Progress, VStack, HStack, Badge,
  Card, CardBody, CardHeader, Flex, Spacer, Tag, TagLabel, Center, Modal,
  ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  ScaleFade, Collapse
} from "@chakra-ui/react";
import metadataJson from "@/data/nft_metadata_clean.json";

// [TOUS LES TYPES ET FONCTIONS IDENTIQUES - inchangés]
type HsvMean = [number, number, number];
type ColorProfile = {
  family: string; filename: string; imagePath: string; lvl: number;
  hsv: { mean: HsvMean }; rgb: { mean: [number, number, number] };
  metrics: { colorfulness: number; contrast: number };
};
type DNAProfile = { dominantHues: number[]; saturation: number; brightness: number; profile?: ColorProfile };
type FamilyScore = {
  score: number; attrsScore: number; colorScore: number;
  familyBonus: number; lineageBonus: number; diversityBonus: number;
  bestProfile: ColorProfile; isLegendary: boolean;
};
type EvolutionResult = {
  familyCandidatesByLevel: Record<number, Record<string, FamilyScore>>;
  currentLineage: string[]; lineageDNAHistory: DNAProfile[];
};

interface SimulatedState {
  level: number; family: string; spriteName: string; folderName: string;
  displayName: string; lore: string; dna: DNAProfile;
  lineage: string[]; imageUrl: string; tree: EvolutionResult | null;
  lineageDisplay: string[]; lineageImages: string[]; lineageProbas: number[];
}

interface EvolutionSimulatorProps {
  insect: SimulatedState;
}

// [CONSTANTES ET FONCTIONS IDENTIQUES - inchangées]
const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  Taille: 0.142, Type: 0.113, Stade: 0.094, Pattes: 0.094, Ailes: 0.094,
  Forme: 0.075, Motif: 0.075, Poils: 0.057, Carapace: 0.057, Corps: 0.047,
  Legendaire: 0.047, Cornes: 0.028, Yeux: 0.028, Antennes: 0.028, Filtre: 0.019
};

const PRIORITY_WEIGHTS = {
  familyBonus: 0.40, attrsScore: 0.35, colorScore: 0.15, lineageBonus: 0.10
};

const getAttributes = (family: string): Record<string, any> => {
  const data: any = metadataJson[family as keyof typeof metadataJson];
  const out: Record<string, any> = {};
  (data.attributes || []).forEach((a: any) => (out[a.trait_type] = a.value));
  return out;
};

const spriteSelector = (familyFolder: string, total: number): string => {
  const idx = Math.floor(Math.random() * total) + 1;
  return `${idx.toString().padStart(3, "0")}_${familyFolder}.gif`;
};

const pickSprite = (family: string, lvl: number) => {
  const meta: any = metadataJson[family as keyof typeof metadataJson];
  const folder = meta.new_folder || family;
  const total = meta.total_in_family || 10;
  const path = meta.new_path ? meta.new_path.replace("lvl0", `lvl${lvl}`) : `lvl${lvl}/${folder}/`;
  return `/insects/${path}${spriteSelector(folder, total)}`;
};

const attributeSimilarity = (a1: Record<string, any>, a2: Record<string, any>): number => {
  let s = 0, w = 0;
  ["Taille", "Stade", "Type", "Pattes", "Ailes"].forEach((k) => {
    const wt = ATTRIBUTE_WEIGHTS[k];
    if (!wt) return;
    w += wt;
    if (a1[k] === a2[k]) s += wt;
    else if (k === "Pattes" || k === "Ailes") {
      s += wt * Math.max(0, 1 - Math.abs(Number(a1[k]) - Number(a2[k])) / 4);
    }
  });
  return s / Math.max(1, w);
};

const hueDistance = (h1: number, h2: number) => Math.min(Math.abs(h1 - h2), 1 - Math.abs(h1 - h2));
const dnaDistance = (a: DNAProfile, b: DNAProfile) =>
  0.6 * hueDistance(a.dominantHues[0], b.dominantHues[0]) +
  0.2 * Math.abs(a.saturation - b.saturation) +
  0.15 * Math.abs(a.brightness - b.brightness);

const profileToDNA = (p: ColorProfile): DNAProfile => ({
  dominantHues: [p.hsv.mean[0] / 360],
  saturation: p.hsv.mean[1] / 100,
  brightness: p.hsv.mean[2] / 100,
  profile: p
});

const initSimulation = (): SimulatedState => {
  const lvl0Families = Object.entries(metadataJson).filter(([, d]: any) => d.level === "lvl0");
  const [familyKey, familyData]: any = lvl0Families[Math.floor(Math.random() * lvl0Families.length)];
  const folder = familyData.new_folder || familyKey;
  const total = familyData.total_in_family || 10;
  const path = familyData.new_path || `lvl0/${folder}/`;
  const sprite = spriteSelector(folder, total);
  const imageUrl = `/insects/${path}${sprite}`;

  return {
    level: 0, family: familyKey, folderName: folder, displayName: familyData.display_name || familyKey,
    lore: familyData.lore || "", spriteName: sprite,
    dna: { dominantHues: [Math.random()], saturation: 0.5, brightness: 0.5 },
    lineage: [familyKey], lineageDisplay: [familyKey], lineageImages: [imageUrl], lineageProbas: [100],
    imageUrl, tree: null
  };
};

const computeEvolutionTree = (currentFamily: string, currentLevel: number, currentDNA: DNAProfile, lineage: string[]): EvolutionResult => {
  const res: EvolutionResult = { familyCandidatesByLevel: {}, currentLineage: lineage, lineageDNAHistory: [currentDNA] };

  for (let lvl = currentLevel + 1; lvl <= 3; lvl++) {
    res.familyCandidatesByLevel[lvl] = {};
    Object.entries(metadataJson).forEach(([fam, data]: any) => {
      if (data.level !== `lvl${lvl}`) return;

      const attrsScore = attributeSimilarity(getAttributes(currentFamily), getAttributes(fam));
      const profile: ColorProfile = {
        family: fam, filename: `${fam}_001.gif`, imagePath: `/insects/lvl${lvl}/${fam}/`,
        lvl, hsv: { mean: [currentDNA.dominantHues[0] * 360, 50, 50] },
        rgb: { mean: [128, 128, 128] }, metrics: { colorfulness: 1, contrast: 1 }
      };
      const colorScore = 1 - dnaDistance(currentDNA, profileToDNA(profile));

      const familyBonus = fam === currentFamily ? 0.45 : 0;
      const lineageBonus = Math.min(0.15, lineage.filter((f) => f === fam).length * 0.05);

      const score =
        familyBonus * PRIORITY_WEIGHTS.familyBonus +
        attrsScore * PRIORITY_WEIGHTS.attrsScore +
        colorScore * PRIORITY_WEIGHTS.colorScore +
        lineageBonus * PRIORITY_WEIGHTS.lineageBonus;

      res.familyCandidatesByLevel[lvl][fam] = {
        score: Math.max(0.01, score), attrsScore, colorScore, familyBonus, lineageBonus, diversityBonus: 0,
        bestProfile: profile, isLegendary: getAttributes(fam).Legendaire === "Oui"
      };
    });
  }
  return res;
};

// NOUVEAU COMPOSANT MOBILE-OPTIMISÉ
export default function EvolutionSimulator({ insect }: EvolutionSimulatorProps) {
  const [state, setState] = useState<SimulatedState | null>(insect || null);

  const [selectedLineageInsect, setSelectedLineageInsect] = useState<number | null>(null);

  const nextCandidates = useMemo(() => {
    if (!state?.tree?.familyCandidatesByLevel[state.level + 1]) return [];

    const candidates = state.tree.familyCandidatesByLevel[state.level + 1];
    const totalScore = Object.values(candidates).reduce((sum, c) => sum + c.score, 0);

    return Object.entries(candidates)
      .map(([family, score]: [string, FamilyScore]) => ({
        family, score,
        probability: totalScore > 0 ? score.score / totalScore : 0,
        imageUrl: pickSprite(family, state.level + 1)
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 12);
  }, [state]);

  const handleChooseEvolution = useCallback((family: string, score: FamilyScore) => {
    if (!state) return;

    const nextLevel = state.level + 1;
    const nextImage = pickSprite(family, nextLevel);
    const nextMeta: any = metadataJson[family as keyof typeof metadataJson];
    const nextProba = nextCandidates.find((c: any) => c.family === family)?.probability || 0;

    const nextTree = computeEvolutionTree(family, nextLevel, profileToDNA(score.bestProfile), [...state.lineage, family]);

    setState({
      ...state, level: nextLevel, family, folderName: nextMeta.new_folder || family,
      displayName: nextMeta.display_name || family, lore: nextMeta.lore || "",
      spriteName: score.bestProfile.filename, dna: profileToDNA(score.bestProfile),
      lineage: [...state.lineage, family], lineageDisplay: [...state.lineageDisplay, family],
      lineageImages: [...state.lineageImages, nextImage], lineageProbas: [...state.lineageProbas, nextProba * 100],
      imageUrl: nextImage, tree: nextTree
    });
  }, [state, nextCandidates]);

  const handleLineageClick = useCallback((index: number) => {
    setSelectedLineageInsect(index);
  }, []);

  const selectedLineageData = state && selectedLineageInsect !== null
    ? {
        imageUrl: state.lineageImages[selectedLineageInsect],
        family: state.lineageDisplay[selectedLineageInsect],
        proba: state.lineageProbas[selectedLineageInsect],
        meta: metadataJson[state.lineageDisplay[selectedLineageInsect] as keyof typeof metadataJson]
      } : null;

  if (!state) {
    return (
      <Flex direction="column" align="center" p={{ base: 6, md: 12 }} w="full">
        <Text fontSize={{ base: "md", md: "lg" }} color="gray.600" textAlign="center" mb={8}>
          Simulez l'évolution de vos insectes Rescoe
        </Text>
        <Button size="lg" colorScheme="teal" onClick={() => setState(initSimulation())} w="full" maxW="300px" h="14">
          Commencer LVL 0
        </Button>
      </Flex>
    );
  }

  return (
    <>
      {/* MODAL DÉTAIL LIGNÉE - IDENTIQUE */}
      <Modal isOpen={selectedLineageInsect !== null} onClose={() => setSelectedLineageInsect(null)} size={{ base: "full", md: "xl" }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedLineageData?.family} - Détails</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={8}>
            {selectedLineageData && (
              <VStack spacing={6} align="center">
                <Image src={selectedLineageData.imageUrl} boxSize={{ base: "160px", md: "200px" }} borderRadius="xl" />
                <Badge colorScheme="green" fontSize="lg">
                  {Math.round(selectedLineageData.proba)}% chance
                </Badge>
                <Text fontWeight="bold" fontSize="xl">{selectedLineageData.meta?.display_name}</Text>
                {selectedLineageData.meta?.lore && (
                  <Text fontStyle="italic" textAlign="center" color="gray.600">
                    "{selectedLineageData.meta.lore}"
                  </Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* LAYOUT PRINCIPAL HORIZONTAL SUR MOBILE */}
  <Box w="full" maxW="1400px" mx="auto" px={{ base: 4, md: 8 }}>
    <VStack
      spacing={{ base: 6, md: 12, lg: 16 }}
      w="full"
      align="stretch"
    >
      {/* 1. CARTE CENTRALE COMPACTE */}
      <ScaleFade in key={state.level} initialScale={0.92}>
        <Box flex={{ base: 1, lg: "0 0 420px" }} w="full">
          <Card boxShadow="2xl" borderRadius="2xl" overflow="hidden">
            <CardHeader bg="teal.500" py={{ base: 4, md: 8 }}>
              <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold" textAlign="center">
                Niveau {state.level} • {state.displayName}
              </Text>
              <Progress
                value={(state.level / 3) * 100}
                mt={{ base: 2, md: 4 }}
                mx={{ base: 4, md: 8 }}
                h="6px"
                borderRadius="full"
                bg="teal.300"
              />
            </CardHeader>

            <CardBody p={{ base: 4, md: 8 }} textAlign="center">
              <Image
                src={state.imageUrl}
                boxSize={{ base: "200px", md: "280px" }}
                mx="auto"
                borderRadius="xl"
                boxShadow="xl"
              />

              <HStack justify="center" mt={{ base: 3, md: 6 }} spacing={2} flexWrap="wrap">
                <Badge colorScheme="purple" fontSize={{ base: "sm", md: "md" }} px={3}>
                  {state.spriteName}
                </Badge>
                <Badge colorScheme="blue" fontSize={{ base: "sm", md: "md" }} px={3}>
                  {state.folderName}
                </Badge>
              </HStack>

              {state.lore && (
                <Text
                  fontSize={{ base: "xs", md: "sm" }}
                  fontStyle="italic"
                  mt={4}
                  color="gray.600"
                  px={2}
                  noOfLines={2}
                >
                  "{state.lore}"
                </Text>
              )}
            </CardBody>
          </Card>
        </Box>
      </ScaleFade>

      {/* 2. COLONNE ACTIONS + CANDIDATS (mobile: pleine largeur, PC: vertical) */}
      <Box flex={1} minW={0} w="full" maxW={{ lg: "700px" }}>
        {/* ACTIONS */}
        <Flex
          direction="column"
          gap={{ base: 3, md: 6 }}
          mb={{ base: 6, md: 10 }}
          w="full"
        >
          {!state.tree && state.level < 3 && (
            <Button
              size={{ base: "md", md: "lg" }}
              colorScheme="blue"
              h="12"
              w="full"
              onClick={() =>
                setState({
                  ...state,
                  tree: computeEvolutionTree(state.family, state.level, state.dna, state.lineage)
                })
              }
            >
              Calculer LVL {state.level + 1}
            </Button>
          )}

          <Button
            size={{ base: "md", md: "lg" }}
            variant="outline"
            colorScheme="gray"
            h="12"
            w="full"
            onClick={() => setState(null)}
          >
            Nouvelle simulation
          </Button>
        </Flex>

        {/* CANDIDATS - GRILLE 1 COL MOBILE + SCROLL HORIZ */}
        <Collapse in={nextCandidates.length > 0} animateOpacity>
          <Box w="full">
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              fontWeight="bold"
              textAlign="center"
              mb={{ base: 6, md: 10 }}
            >
              Évolutions LVL {state.level + 1}
            </Text>

            <SimpleGrid
              columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
              spacing={{ base: 3, md: 6 }}
              w="full"
            >
              {nextCandidates.map(({ family, score, probability, imageUrl }) => (
                <Card
                  key={family}
                  p={{ base: 3, md: 6 }}
                  borderWidth={2}
                  borderRadius="xl"
                  cursor="pointer"
                  borderColor="gray.200"
                  _hover={{
                    boxShadow: "2xl",
                    transform: "translateY(-4px)",
                    borderColor: "teal.400"
                  }}
                  transition="all 0.3s"
                  onClick={() => handleChooseEvolution(family, score)}
                  minH="140px"
                >
                  <Center mb={{ base: 2, md: 4 }}>
                    <Image src={imageUrl} boxSize={{ base: "70px", md: "100px" }} borderRadius="lg" />
                  </Center>

                  <Flex align="center" mb={2}>
                    <Text fontWeight="bold" fontSize={{ base: "sm", md: "lg" }} flex={1} noOfLines={1}>
                      {family}
                    </Text>
                    {score.isLegendary && (
                      <Badge colorScheme="orange" fontSize="xs" px={2}>
                        Légendaire
                      </Badge>
                    )}
                  </Flex>

                  <Center mb={3}>
                    <Badge
                      fontSize={{ base: "lg", md: "xl" }}
                      fontWeight="extrabold"
                      px={{ base: 4, md: 6 }}
                      py={{ base: 2, md: 3 }}
                      colorScheme={
                        probability > 0.15 ? "green" : probability > 0.08 ? "yellow" : "gray"
                      }
                    >
                      {Math.round(probability * 100)}%
                    </Badge>
                  </Center>

                  <HStack justify="space-between" fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                    <Text>Morpho {Math.round(score.attrsScore * 100)}%</Text>
                    <Text>Couleur {Math.round(score.colorScore * 100)}%</Text>
                  </HStack>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        </Collapse>
      </Box>
    </VStack>


        {/* 3. LIGNÉE HORIZONTALE SCROLLABLE COMPACTE */}
        <Card mt={{ base: 6, md: 12 }} w="full" boxShadow="lg" borderRadius="2xl" p={{ base: 4, md: 8 }}>
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" textAlign="center" mb={6}>
            Lignée ({state.lineageDisplay.length}/4)
          </Text>

          <HStack
            w="full"
            overflowX="auto"
            spacing={{ base: 2, md: 4 }}
            pb={2}
            sx={{
              "&::-webkit-scrollbar": {
                height: "4px",
              },
              "&::-webkit-scrollbar-track": {
                bg: "gray.100",
              },
              "&::-webkit-scrollbar-thumb": {
                bg: "teal.400",
                borderRadius: "full",
              },
            }}
          >
            {state.lineageImages.map((img, idx) => {
              const familyMeta: any = metadataJson[state.lineageDisplay[idx] as keyof typeof metadataJson];
              const proba = state.lineageProbas[idx];
              const isCurrent = idx === state.level;

              return (
                <ScaleFade key={idx} in initialScale={0.85} transition={{ enter: { duration: 0.25, delay: idx * 0.08 } }}>
                  <VStack
                    minW={{ base: "72px", md: "100px" }}
                    p={{ base: 2, md: 4 }}
                    borderWidth={2}
                    borderRadius="lg"
                    cursor="pointer"
                    textAlign="center"
                    borderColor={isCurrent ? "teal.400" : "gray.200"}
                    _hover={{
                      boxShadow: "lg",
                      transform: "translateY(-2px)"
                    }}
                    transition="all 0.2s"
                    spacing={1}
                    onClick={() => handleLineageClick(idx)}
                  >
                    <Image src={img} boxSize={{ base: "48px", md: "70px" }} borderRadius="md" />
                    <Text fontSize={{ base: "2xs", md: "xs" }} fontWeight="bold" noOfLines={1}>
                      {state.lineageDisplay[idx]}
                    </Text>
                    <Badge colorScheme={proba > 15 ? "green" : "yellow"} fontSize="xs">
                      {Math.round(proba)}%
                    </Badge>
                  </VStack>
                </ScaleFade>
              );
            })}
          </HStack>
        </Card>

        {/* 4. FIN */}
        <ScaleFade in={state.level === 3} initialScale={0.9}>
          {state.level === 3 && (
            <Card
              mt={8}
              bg="green.50"
              borderWidth={3}
              borderColor="green.300"
              borderRadius="2xl"
              p={{ base: 6, md: 12 }}
            >
              <Text fontSize={{ base: "2xl", md: "3xl" }} fontWeight="bold" color="green.700" textAlign="center">
                Évolution complète !
              </Text>
              <Text fontSize={{ base: "lg", md: "xl" }} textAlign="center" mt={3}>
                {state.displayName} — Niveau final
              </Text>
            </Card>
          )}
        </ScaleFade>
      </Box>
    </>
  );
}
