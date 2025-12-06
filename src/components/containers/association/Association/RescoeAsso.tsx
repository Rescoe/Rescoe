import React from 'react';
import { keyframes } from "@emotion/react";

import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Grid,
  GridItem,
  Button,
  Icon,
  Flex,
  SimpleGrid,
  useColorModeValue,
  useColorMode,
  Center,
  Stack,
  Divider,
  Link,
  HStack,
  Wrap,
  WrapItem,
  chakra,
  SlideFade,
  ScaleFade,
  Fade,
  Skeleton,
  SkeletonCircle,
  SkeletonText,
  useBreakpointValue,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Tag,
  TagLabel,
  TagLeftIcon,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  StatGroup,
  BoxProps,
} from '@chakra-ui/react';
import {
  FaPaintBrush,
  FaNetworkWired,
  FaCode,
  FaUsers,
  FaBookOpen,
  FaHandshake,
  FaWallet,
  FaLayerGroup,
  FaCube,
  FaGlobe,
  FaChalkboardTeacher,
  FaStore,
  FaCalendarAlt,
  FaLightbulb,
  FaRocket,
  FaGithub,
  FaEthereum,
  FaNodeJs,
  FaReact,
  FaDatabase,
  FaServer,
  FaMobileAlt,
  FaDesktop,
  FaMobile,
  FaCloudUploadAlt,
  FaPencilAlt,
  FaPalette,
  FaPenFancy,
  FaTools,
  FaSyncAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaArrowRight,
  FaArrowLeft,
  FaChevronRight,
  FaChevronLeft,
  FaChevronDown,
  FaChevronUp,
  FaPlus,
  FaMinus,
  FaStar,
  FaRegStar,
  FaRegLightbulb,
  FaRegHandshake,
  FaRegGem,
  FaRegCalendarAlt,
  FaRegChartBar,
  FaRegCommentDots,
  FaRegPaperPlane,
  FaRegThumbsUp,
  FaRegThumbsDown,
  FaRegHeart,
  FaRegSmile,
  FaRegFrown,
  FaRegMeh,
  FaRegBell,
  FaRegEnvelope,
  FaRegUser,
  FaRegFile,
  FaRegFolder,
  FaRegFolderOpen,
  FaRegTrashAlt,
  FaRegCopy,
  FaRegSave,
  FaRegEdit,
  FaRegTimesCircle,
  FaRegCheckCircle,
  FaRegQuestionCircle,
  FaRegPlayCircle,
  FaRegPauseCircle,
  FaRegStopCircle,
} from 'react-icons/fa';
import {
  pulse,
  borderAnimation,
  animations,
  gradients,
  effects,
  hoverStyles
} from '@/styles/theme';

import { motion, HTMLMotionProps, MotionProps, AnimatePresence, Transition } from "framer-motion";

import { FC,ReactNode  } from "react";
// Typing pour accepter children et toutes les props motion/Box

// Custom components with theme integration
const AnimatedCard = chakra(motion.div, {
  baseStyle: () => {
    const { colorMode } = useColorMode(); // Récupération du colorMode

    return {
      bg: colorMode === 'light'
        ? 'rgba(255, 255, 255, 0.85)'
        : 'rgba(17, 25, 40, 0.85)',
      borderRadius: '2xl',
      boxShadow: colorMode === 'light'
        ? '0 8px 32px rgba(0, 0, 0, 0.15)'
        : '0 8px 32px rgba(0, 0, 0, 0.35)',
      backdropFilter: 'blur(12px)',
      border: '2px solid transparent',
      bgClip: 'padding-box, border-box',
      bgOrigin: 'padding-box, border-box',
      animation: `${animations.borderGlow}`,
      transition: { duration: 0.4 }, // Modification ici pour un objet de transition

    };
  },
});

type TechCardProps = {
  icon: React.ElementType; // Définir le type correct pour l'icône
  title: string;
  description: string;
  delay?: number;
  children?: React.ReactNode; // ← ajoute ça

};

const TechCard = ({ icon, title, description, delay = 0 }: TechCardProps) => (
    <ScaleFade in={true} initialScale={0.9} delay={delay}>
    <AnimatedCard
      p={6}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 300 } as any} // ← ça passe
    >
      <VStack spacing={4} align="start">
        <Icon
          as={icon}
          boxSize={10}
          color="brand.mauve"
          textShadow="0 0 15px rgba(180, 166, 213, 0.5)"
        />
        <Heading as="h3" size="md" color="brand.gold">
          {title}
        </Heading>
        <Text color="brand.cream" fontSize="md" lineHeight="tall">
          {description}
        </Text>
      </VStack>
    </AnimatedCard>
  </ScaleFade>
);


type ContractCardProps = {
  title: string;
  description: string;
  features: string[];
  delay?: number;
};


const ContractCard = ({ title, description, features, delay = 0 }: ContractCardProps) => (
  <SlideFade in={true} offsetY={20} delay={delay}>
    <Box
      p={6}
      borderRadius="2xl"
      bg="rgba(1, 28, 57, 0.7)"
      border="1px solid"
      borderColor="brand.mauve"
      boxShadow="0 0 25px rgba(180, 166, 213, 0.2)"
      transition="all 0.3s ease"
      _hover={{
        transform: "translateY(-5px)",
        boxShadow: "0 0 35px rgba(180, 166, 213, 0.4)",
        borderColor: "brand.gold"
      }}
    >
      <VStack align="start" spacing={4}>
        <Heading as="h3" size="lg" bgGradient="linear(to-r, brand.gold, brand.mauve)" bgClip="text">
          {title}
        </Heading>
        <Text color="brand.cream" fontSize="md">
          {description}
        </Text>
        <VStack align="start" spacing={2} mt={2}>
          {features.map((feature, idx) => (
            <HStack key={idx} spacing={2}>
              <Icon as={FaCheckCircle} color="brand.gold" />
              <Text color="brand.cream" fontSize="sm">{feature}</Text>
            </HStack>
          ))}
        </VStack>
      </VStack>
    </Box>
  </SlideFade>
);


type StatCardProps = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  delay?: number;
};


const StatCard = ({ label, value, icon, trend, delay = 0 }: StatCardProps) => (
  <ScaleFade in={true} initialScale={0.9} delay={delay}>
    <Box
      p={5}
      borderRadius="xl"
      bg="rgba(1, 28, 57, 0.6)"
      border="1px solid"
      borderColor="brand.mauve"
      transition={{ duration: 0.3 } as any } // Utilisation d'un objet pour définir la durée
      _hover={{
        transform: "translateY(-3px)",
        boxShadow: "0 0 20px rgba(180, 166, 213, 0.3)",
        borderColor: "brand.gold"
      }}
    >
      <VStack align="start" spacing={3}>
        <HStack justifyContent="space-between" width="100%">
          <Text color="brand.cream" fontSize="sm" fontWeight="medium">
            {label}
          </Text>
          <Icon as={icon} boxSize={5} color="brand.mauve" />
        </HStack>
        <Heading as="h3" size="xl" color="brand.gold">
          {value}
        </Heading>
        {trend && (
          <HStack spacing={1} color={trend.includes('↑') ? 'green.400' : 'red.400'}>
            <Stat>
              <StatArrow type={trend.includes('↑') ? 'increase' : 'decrease'} />
            </Stat>
            <Text fontSize="sm">{trend}</Text>
          </HStack>
        )}
      </VStack>
    </Box>
  </ScaleFade>
);



const ArchitectureDiagram = () => {
  const [activeContract, setActiveContract] = React.useState(null);

  const contracts = [
    {
      id: 'adhesion',
      title: 'Contrat d\'Adhésion',
      description: 'Gère les membres de l\'association et leur système de points',
      features: [
        'Membres identifiés par leur adresse Ethereum',
        'Système de points basé sur la participation',
        'Détermination des droits de création de collections',
        'Intégration avec Rescollection Manager'
      ]
    },
    {
      id: 'rescollection',
      title: 'Rescollection Manager',
      description: 'Contrat central de gestion des collections et vérification des droits',
      features: [
        'Interroge le contrat d\'adhésion pour valider les droits',
        'Orchestre la création de collections via MasterFactory',
        'Gestion des métadonnées des collections',
        'Interface avec les contrats spécialisés'
      ]
    },
    {
      id: 'masterfactory',
      title: 'MasterFactory',
      description: 'Usine centrale de déploiement des collections spécialisées',
      features: [
        'Déploiement dynamique de collections selon leur type',
        'Utilisation de sous-usines spécialisées (ArtFactory, PoetryFactory)',
        'Implémentation de l\'interface ICollectionFactory',
        'Gestion des adresses des œuvres via collections dynamiques'
      ]
    }
  ];

  return (
    <Box position="relative" p={6} borderRadius="2xl" bg="rgba(1, 28, 57, 0.7)" border="1px solid" borderColor="brand.mauve">
      <Heading as="h3" size="lg" mb={6} textAlign="center" bgGradient="linear(to-r, brand.gold, brand.mauve)" bgClip="text">
        Architecture Technique Web3
      </Heading>

      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={6} mb={8}>
        {contracts.map((contract, index) => (
          <ContractCard
            key={contract.id}
            title={contract.title}
            description={contract.description}
            features={contract.features}
            delay={index * 0.1}
          />
        ))}
      </Grid>

      <Box position="relative" mt={8} p={6} borderRadius="xl" bg="rgba(1, 28, 57, 0.5)">
        <Heading as="h4" size="md" mb={4} color="brand.gold">
          Flux de création d'une collection
        </Heading>

        <Flex direction="column" align="center" position="relative">
          <Box position="relative" width="100%">
            <Flex
              justify="space-between"
              align="center"
              width="100%"
              position="relative"
              _before={{
                content: '""',
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: "2px",
                bgGradient: "linear(to-r, brand.mauve, brand.gold)",
                transform: "translateY(-50%)"
              }}
            >
              {['Utilisateur', 'Rescollection Manager', 'MasterFactory', 'Collection'].map((step, index) => (
                <Box
                  key={index}
                  position="relative"
                  zIndex={1}
                  textAlign="center"
                  p={3}
                  borderRadius="full"
                  bg="brand.navy"
                  border="2px solid"
                  borderColor={index === 0 || index === 3 ? "brand.gold" : "brand.mauve"}
                  width="120px"
                  _hover={{
                    transform: "scale(1.1)",
                    boxShadow: "0 0 15px rgba(180, 166, 213, 0.5)"
                  }}
                  transition="all 0.3s ease"
                >
                  <Text fontWeight="bold" color={index === 0 || index === 3 ? "brand.gold" : "brand.cream"}>
                    {step}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Box>

          <Flex mt={8} justify="space-between" width="100%">
            <Box width="23%">
              <Text fontSize="sm" color="brand.cream" textAlign="center">
                L'utilisateur demande à créer une collection via son adresse Ethereum
              </Text>
            </Box>
            <Box width="23%">
              <Text fontSize="sm" color="brand.cream" textAlign="center">
                Vérification des droits via le contrat d'adhésion et gestion des métadonnées
              </Text>
            </Box>
            <Box width="23%">
              <Text fontSize="sm" color="brand.cream" textAlign="center">
                Déploiement de la collection spécialisée via les sous-usines
              </Text>
            </Box>
            <Box width="23%">
              <Text fontSize="sm" color="brand.cream" textAlign="center">
                Collection opérationnelle avec ses propres contrats et interfaces
              </Text>
            </Box>
          </Flex>
        </Flex>
      </Box>

      <Box mt={8} p={4} borderRadius="xl" bg="rgba(1, 28, 57, 0.5)" borderLeft="4px solid" borderColor="brand.gold">
        <Text color="brand.cream" fontSize="md" lineHeight="tall">
          <Text as="span" fontWeight="bold" color="brand.gold">Note technique:</Text> L'architecture utilise une approche modulaire avec des contrats interconnectés permettant une grande flexibilité.
          Le système de points déterminé par le contrat d'adhésion influence directement les capacités créatives des membres, créant un écosystème dynamique où
          la participation active est récompensée par des droits étendus dans l'écosystème RESCOE.
        </Text>
      </Box>
    </Box>
  );
};

const AssociationPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Stats data
  const stats = [
    { label: "Artistes soutenus", value: "47+", icon: FaUsers, trend: "↑ 12% ce trimestre" },
    { label: "Collections créées", value: "128", icon: FaCube, trend: "↑ 24% ce trimestre" },
    { label: "Heures de formation", value: "500+", icon: FaChalkboardTeacher, trend: "↑ 35% ce trimestre" },
    { label: "Contrats Solidity", value: "12", icon: FaCode, trend: "Projet complet" }
  ];

  // Tech stack data
  const techStack = [
    {
      category: "Frontend",
      items: [
        { name: "React", icon: FaReact, description: "Application principale en TypeScript" },
        { name: "Chakra UI", icon: FaTools, description: "Framework UI personnalisé" },
        { name: "Framer Motion", icon: FaSyncAlt, description: "Animations fluides" }
      ]
    },
    {
      category: "Blockchain",
      items: [
        { name: "Solidity", icon: FaCode, description: "Contrats intelligents" },
        { name: "Ethereum", icon: FaEthereum, description: "Base des opérations" },
        { name: "Base", icon: FaNetworkWired, description: "Réseau de déploiement prévu" }
      ]
    },
    {
      category: "Backend",
      items: [
        { name: "Moralis", icon: FaServer, description: "Interactions blockchain" },
        { name: "Pinata", icon: FaCloudUploadAlt, description: "Stockage IPFS" },
        { name: "Sepolia", icon: FaDatabase, description: "Testnet de développement" }
      ]
    }
  ];

  // Activities data
  const activities = [
    {
      title: "Ateliers de Formation",
      description: "Sessions pratiques pour artistes sur la blockchain, la création NFT et l'art génératif",
      icon: FaChalkboardTeacher,
      details: [
        "Initiation à Web3 pour artistes",
        "Création d'art génératif avec p5.js",
        "Compréhension des contrats intelligents",
        "Ateliers de création de collections NFT"
      ]
    },
    {
      title: "Galerie Physique & Événements",
      description: "Espace hybride à Bordeaux pour exposer et vendre des œuvres numériques",
      icon: FaStore,
      details: [
        "Expositions physiques d'œuvres numériques",
        "Vente de nourriture et boissons",
        "Événements networking artistique",
        "Projection d'œuvres génératives en temps réel"
      ]
    },
    {
      title: "Réseau Artistique",
      description: "Plateforme de mise en relation entre artistes traditionnels et numériques",
      icon: FaUsers,
      details: [
        "Création de collaborations interdisciplinaires",
        "Partage de ressources et compétences",
        "Mentorat entre artistes émergents et confirmés",
        "Publication de fanzines hybrides (physique/digital)"
      ]
    }
  ];

  return (
    <Box
      minH="100vh"
      bgGradient="linear(to-b, brand.navy, brand.navy)"
      color="brand.cream"
      position="relative"
      overflowX="hidden"
    >
      {/* Animated background elements */}
      <Box
        position="absolute"
        top="-100px"
        right="-100px"
        width="300px"
        height="300px"
        borderRadius="full"
        bgGradient="radial(brand.mauve 0%, transparent 70%)"
        opacity="0.1"
        zIndex={0}
      />
      <Box
        position="absolute"
        bottom="-150px"
        left="-100px"
        width="400px"
        height="400px"
        borderRadius="full"
        bgGradient="radial(brand.gold 0%, transparent 70%)"
        opacity="0.07"
        zIndex={0}
      />

      <Container maxW="container.xl" py={{ base: 8, md: 16 }} position="relative" zIndex={1}>
        {/* Hero Section */}
        <SlideFade in={true} offsetY={-20}>
          <Box textAlign="center" mb={16}>
            <Heading
              as="h1"
              size={{ base: "2xl", md: "4xl" }}
              mb={6}
              lineHeight="1.2"
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
              textShadow="0 0 15px rgba(238, 212, 132, 0.3)"
            >
              Réseau Expérimental Solidaire de Crypto Œuvres Émergentes
            </Heading>

            <Text
              fontSize={{ base: "lg", md: "xl" }}
              maxW="3xl"
              mx="auto"
              mb={10}
              color="brand.cream"
              lineHeight="tall"
            >
              RESCOE est une association innovante qui crée des passerelles entre l'art traditionnel et les nouvelles technologies
              blockchain. Nous accompagnons les artistes dans leur transition vers le Web3 tout en développant un écosystème
              solidaire et expérimental où l'humain reste au centre de la technologie.
            </Text>

            <Flex
              justify="center"
              gap={4}
              direction={{ base: "column", sm: "row" }}
              maxW="md"
              mx="auto"
            >
              <Button
                size="lg"
                bgGradient="linear(to-r, brand.mauve, brand.blue)"
                color="white"
                fontWeight="bold"
                px={8}
                py={6}
                borderRadius="full"
                _hover={{
                  transform: "scale(1.05)",
                  boxShadow: effects.glowDark,
                }}
                animation={`${pulse('#B4A6D5')} 4s infinite`}
                onClick={onOpen}
              >
                Découvrir notre écosystème
              </Button>

              <Button
                size="lg"
                variant="outline"
                borderColor="brand.mauve"
                color="brand.cream"
                fontWeight="medium"
                px={8}
                py={6}
                borderRadius="full"
                _hover={{
                  bg: "rgba(180, 166, 213, 0.1)",
                  borderColor: "brand.gold",
                  transform: "scale(1.03)"
                }}
              >
                Devenir membre
              </Button>
            </Flex>
          </Box>
        </SlideFade>

        {/* Stats Section */}
        <SlideFade in={true} offsetY={20} delay={0.2}>
          <StatGroup
            mb={16}
            gap={6}
            flexWrap="wrap"
            justifyContent="center"
          >
            {stats.map((stat, index) => (
              <StatCard
                key={index}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                trend={stat.trend}
                delay={index * 0.1}
              />
            ))}
          </StatGroup>
        </SlideFade>

        {/* Mission & Vision */}
        <SlideFade in={true} offsetY={20} delay={0.3}>
          <Box mb={20}>
            <Heading
              as="h2"
              size="2xl"
              textAlign="center"
              mb={12}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Notre Mission & Vision
            </Heading>

            <Grid
              templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
              gap={10}
              alignItems="center"
            >
              <GridItem>
                <VStack align="start" spacing={6}>
                  <Heading as="h3" size="lg" color="brand.gold">
                    Une passerelle entre art et technologie
                  </Heading>

                  <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                    RESCOE a été fondée pour répondre à un constat simple : les artistes ont besoin d'outils accessibles
                    pour explorer les nouvelles frontières créatives que propose le Web3, sans se perdre dans la complexité
                    technique. Nous croyons qu'une véritable innovation artistique émerge lorsque la technologie sert la créativité,
                    et non l'inverse.
                  </Text>

                  <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                    Notre vision est de créer un écosystème hybride où les œuvres numériques coexistent avec des
                    expériences physiques, où les artistes traditionnels et numériques collaborent, et où la blockchain
                    devient un outil de création et de partage plutôt qu'une barrière technique.
                  </Text>
                </VStack>
              </GridItem>

              <GridItem>
                <Box
                  borderRadius="2xl"
                  overflow="hidden"
                  boxShadow="0 20px 50px rgba(0, 0, 0, 0.5)"
                  border="1px solid"
                  borderColor="brand.mauve"
                  position="relative"
                  height="100%"
                >
                  <Box
                    bgGradient="linear(to-br, brand.navy, rgba(1, 28, 57, 0.8))"
                    p={6}
                    height="100%"
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                  >
                    <VStack align="start" spacing={4}>
                      <Tag size="lg" variant="solid" bg="brand.mauve" color="brand.navy" borderRadius="full" px={4} py={2}>
                        <TagLeftIcon as={FaRegLightbulb} />
                        <TagLabel>Notre Philosophie</TagLabel>
                      </Tag>

                      <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                        <Text as="span" fontWeight="bold" color="brand.gold">Art avant technologie :</Text> La blockchain est un outil au service de la créativité, pas une fin en soi.
                      </Text>

                      <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                        <Text as="span" fontWeight="bold" color="brand.gold">Expérimentation responsable :</Text> Nous testons de nouvelles formes d'art sans oublier l'impact humain.
                      </Text>

                      <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                        <Text as="span" fontWeight="bold" color="brand.gold">Solidarité créative :</Text> Chaque artiste soutenu renforce l'ensemble de notre écosystème.
                      </Text>

                      <Divider my={4} borderColor="brand.mauve" />

                      <Text fontSize="md" color="brand.cream" fontStyle="italic">
                        "Nous ne construisons pas simplement une plateforme technique, nous cultivons un jardin où l'art et la technologie
                        peuvent pousser ensemble, nourris par la collaboration et l'expérimentation."
                      </Text>
                      <Text fontSize="sm" color="brand.mauve" textAlign="right" width="100%">
                        — Thibault, Fondateur & Développeur Principal
                      </Text>
                    </VStack>
                  </Box>
                </Box>
              </GridItem>
            </Grid>
          </Box>
        </SlideFade>

        {/* Technical Architecture */}
        <SlideFade in={true} offsetY={20} delay={0.4}>
          <Box mb={20}>
            <Heading
              as="h2"
              size="2xl"
              textAlign="center"
              mb={12}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Architecture Technique Web3
            </Heading>

            <ArchitectureDiagram />
          </Box>
        </SlideFade>

        {/* Activities Section */}
        <SlideFade in={true} offsetY={20} delay={0.5}>
          <Box mb={20}>
            <Heading
              as="h2"
              size="2xl"
              textAlign="center"
              mb={12}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Nos Activités
            </Heading>

            <Grid
              templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
              gap={8}
            >
              {activities.map((activity, index) => (
                <TechCard
                  key={index}
                  icon={activity.icon}
                  title={activity.title}
                  description={activity.description}
                  delay={index * 0.1}
                >
                  <VStack align="start" spacing={2} mt={4} pl={4}>
                    {activity.details.map((detail, idx) => (
                      <HStack key={idx} spacing={2}>
                        <Icon as={FaChevronRight} color="brand.mauve" boxSize={3} />
                        <Text color="brand.cream" fontSize="sm">{detail}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </TechCard>
              ))}
            </Grid>
          </Box>
        </SlideFade>

        {/* Tech Stack Section */}
        <SlideFade in={true} offsetY={20} delay={0.6}>
          <Box mb={20}>
            <Heading
              as="h2"
              size="2xl"
              textAlign="center"
              mb={12}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Stack Technique
            </Heading>

            <Grid
              templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
              gap={8}
            >
              {techStack.map((category, index) => (
                <Box
                  key={index}
                  p={6}
                  borderRadius="2xl"
                  bg="rgba(1, 28, 57, 0.7)"
                  border="1px solid"
                  borderColor="brand.mauve"
                  transition="all 0.3s ease"
                  _hover={{
                    transform: "translateY(-5px)",
                    boxShadow: "0 0 25px rgba(180, 166, 213, 0.3)",
                    borderColor: "brand.gold"
                  }}
                >
                  <Heading as="h3" size="lg" mb={6} color="brand.gold">
                    {category.category}
                  </Heading>

                  <VStack align="start" spacing={4}>
                    {category.items.map((item, idx) => (
                      <HStack key={idx} spacing={4} width="100%">
                        <Icon as={item.icon} boxSize={6} color="brand.mauve" />
                        <VStack align="start" spacing={0}>
                          <Text fontWeight="bold" color="brand.cream">{item.name}</Text>
                          <Text fontSize="sm" color="brand.cream" opacity={0.8}>{item.description}</Text>
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              ))}
            </Grid>
          </Box>
        </SlideFade>

        {/* How to Join Section */}
        <SlideFade in={true} offsetY={20} delay={0.7}>
          <Box
            mb={20}
            borderRadius="3xl"
            overflow="hidden"
            border="1px solid"
            borderColor="brand.mauve"
            bg="rgba(1, 28, 57, 0.7)"
          >
            <Grid
              templateColumns={{ base: "1fr", md: "1fr 1fr" }}
              gap={0}
            >
              <GridItem
                p={10}
                bgGradient="linear(to-br, brand.navy, rgba(1, 28, 57, 0.9))"
              >
                <VStack align="start" spacing={6}>
                  <Tag size="lg" variant="solid" bg="brand.mauve" color="brand.navy" borderRadius="full" px={4} py={2}>
                    <TagLeftIcon as={FaRegHandshake} />
                    <TagLabel>Devenir Membre</TagLabel>
                  </Tag>

                  <Heading as="h2" size="2xl" color="brand.gold">
                    Rejoignez notre écosystème créatif
                  </Heading>

                  <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                    En devenant membre de RESCOE, vous intégrez une communauté dynamique d'artistes et de créateurs
                    explorant les frontières entre art traditionnel et numérique. Votre adhésion soutient directement
                    nos missions tout en vous donnant accès à des ressources exclusives.
                  </Text>

                  <VStack align="start" spacing={3} mt={4} width="100%">
                    <HStack spacing={3} width="100%">
                      <Icon as={FaCheckCircle} color="brand.gold" boxSize={5} />
                      <Text color="brand.cream">Accès à des formations exclusives sur le Web3 et l'art numérique</Text>
                    </HStack>
                    <HStack spacing={3} width="100%">
                      <Icon as={FaCheckCircle} color="brand.gold" boxSize={5} />
                      <Text color="brand.cream">Possibilité de créer vos propres collections NFT via notre plateforme</Text>
                    </HStack>
                    <HStack spacing={3} width="100%">
                      <Icon as={FaCheckCircle} color="brand.gold" boxSize={5} />
                      <Text color="brand.cream">Participation aux événements et expositions physiques et numériques</Text>
                    </HStack>
                    <HStack spacing={3} width="100%">
                      <Icon as={FaCheckCircle} color="brand.gold" boxSize={5} />
                      <Text color="brand.cream">Mise en relation avec d'autres artistes et professionnels du secteur</Text>
                    </HStack>
                  </VStack>
                </VStack>
              </GridItem>

              <GridItem
                p={10}
                bgGradient="linear(to-tl, rgba(1, 28, 57, 0.9), brand.navy)"
                borderLeft={{ md: "1px solid" }}
                borderColor="brand.mauve"
              >
                <VStack align="start" spacing={6}>
                  <Heading as="h3" size="lg" color="brand.gold">
                    Processus d'adhésion
                  </Heading>

                  <VStack align="start" spacing={5} width="100%">
                    {[
                      {
                        step: "1",
                        title: "Création de compte",
                        description: "Connectez-vous avec votre wallet Ethereum ou créez un compte avec votre email"
                      },
                      {
                        step: "2",
                        title: "Adhésion",
                        description: "Acquérez votre NFT de membre qui représente votre statut dans l'association"
                      },
                      {
                        step: "3",
                        title: "Système de points",
                        description: "Gagnez des points en participant aux activités et débloquez des droits créatifs"
                      },
                      {
                        step: "4",
                        title: "Création",
                        description: "Utilisez vos droits pour créer des collections d'œuvres selon votre niveau"
                      }
                    ].map((step, index) => (
                      <HStack key={index} spacing={4} width="100%">
                        <Box
                          width="36px"
                          height="36px"
                          borderRadius="full"
                          bg="brand.mauve"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="brand.navy"
                          fontWeight="bold"
                          fontSize="lg"
                          boxShadow="0 0 15px rgba(180, 166, 213, 0.4)"
                        >
                          {step.step}
                        </Box>
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold" color="brand.cream">{step.title}</Text>
                          <Text fontSize="sm" color="brand.cream" opacity={0.8}>{step.description}</Text>
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>

                  <Button
                    size="lg"
                    bgGradient="linear(to-r, brand.mauve, brand.blue)"
                    color="white"
                    fontWeight="bold"
                    width="100%"
                    mt={4}
                    borderRadius="full"
                    py={7}
                    _hover={{
                      transform: "scale(1.03)",
                      boxShadow: effects.glowDark,
                    }}
                    animation={`${pulse('#B4A6D5')} 4s infinite`}
                  >
                    Devenir membre dès maintenant
                  </Button>
                </VStack>
              </GridItem>
            </Grid>
          </Box>
        </SlideFade>

        {/* SAS Partnership Section */}
        <SlideFade in={true} offsetY={20} delay={0.8}>
          <Box mb={20}>
            <Heading
              as="h2"
              size="2xl"
              textAlign="center"
              mb={12}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Partenariat avec notre SAS
            </Heading>

            <Box
              borderRadius="2xl"
              overflow="hidden"
              border="1px solid"
              borderColor="brand.mauve"
              bg="rgba(1, 28, 57, 0.7)"
            >
              <Grid
                templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                gap={0}
              >
                <GridItem p={8}>
                  <VStack align="start" spacing={6}>
                    <Tag size="lg" variant="solid" bg="brand.mauve" color="brand.navy" borderRadius="full" px={4} py={2}>
                      <TagLeftIcon as={FaRegGem} />
                      <TagLabel>Modèle Économique</TagLabel>
                    </Tag>

                    <Heading as="h3" size="xl" color="brand.gold">
                      Un écosystème viable et durable
                    </Heading>

                    <Text fontSize="lg" color="brand.cream" lineHeight="tall">
                      RESCOE fonctionne en synergie avec une SAS partenaire qui assure la pérennité économique du projet
                      tout en permettant à l'association de rester fidèle à ses valeurs artistiques et solidaires.
                    </Text>

                    <Accordion allowToggle width="100%">
                      <AccordionItem border="none" mb={4}>
                        <h2>
                          <AccordionButton
                            p={4}
                            borderRadius="lg"
                            bg="rgba(1, 28, 57, 0.5)"
                            _hover={{ bg: "rgba(180, 166, 213, 0.1)" }}
                          >
                            <Box flex="1" textAlign="left" fontWeight="bold" color="brand.cream">
                              Rôle de la SAS
                            </Box>
                            <AccordionIcon color="brand.mauve" />
                          </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4} color="brand.cream">
                          La SAS développe et commercialise les solutions techniques créées pour RESCOE.
                          Chaque brique technique (contrats d'adhésion, gestion de collections, etc.) est
                          vendue à d'autres organisations (associations, clubs sportifs, etc.) qui souhaitent
                          bénéficier de systèmes transparents et décentralisés pour gérer leurs communautés.
                        </AccordionPanel>
                      </AccordionItem>

                      <AccordionItem border="none" mb={4}>
                        <h2>
                          <AccordionButton
                            p={4}
                            borderRadius="lg"
                            bg="rgba(1, 28, 57, 0.5)"
                            _hover={{ bg: "rgba(180, 166, 213, 0.1)" }}
                          >
                            <Box flex="1" textAlign="left" fontWeight="bold" color="brand.cream">
                              Modèle économique
                            </Box>
                            <AccordionIcon color="brand.mauve" />
                          </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4} color="brand.cream">
                          <VStack align="start" spacing={2}>
                            <HStack spacing={2}>
                              <Icon as={FaChevronRight} color="brand.mauve" />
                              <Text>10% de commission sur les ventes et transferts d'œuvres</Text>
                            </HStack>
                            <HStack spacing={2}>
                              <Icon as={FaChevronRight} color="brand.mauve" />
                              <Text>Vente de solutions techniques aux autres organisations</Text>
                            </HStack>
                            <HStack spacing={2}>
                              <Icon as={FaChevronRight} color="brand.mauve" />
                              <Text>Partage des revenus des formations (formateur + association)</Text>
                            </HStack>
                          </VStack>
                        </AccordionPanel>
                      </AccordionItem>

                      <AccordionItem border="none">
                        <h2>
                          <AccordionButton
                            p={4}
                            borderRadius="lg"
                            bg="rgba(1, 28, 57, 0.5)"
                            _hover={{ bg: "rgba(180, 166, 213, 0.1)" }}
                          >
                            <Box flex="1" textAlign="left" fontWeight="bold" color="brand.cream">
                              Impact pour RESCOE
                            </Box>
                            <AccordionIcon color="brand.mauve" />
                          </AccordionButton>
                        </h2>
                        <AccordionPanel pb={4} color="brand.cream">
                          Ce modèle permet à RESCOE de fonctionner sans dépendre de subventions extérieures,
                          tout en réinvestissant une partie des revenus dans des bourses pour les artistes
                          émergents et dans le développement de nouvelles fonctionnalités pour la communauté.
                        </AccordionPanel>
                      </AccordionItem>
                    </Accordion>
                  </VStack>
                </GridItem>

                <GridItem
                  p={8}
                  bgGradient="linear(to-br, rgba(1, 28, 57, 0.5), brand.navy)"
                  borderLeft={{ md: "1px solid" }}
                  borderColor="brand.mauve"
                >
                  <VStack align="start" spacing={6}>
                    <Heading as="h3" size="lg" color="brand.gold">
                      Notre engagement technique
                    </Heading>

                    <Text color="brand.cream" lineHeight="tall">
                      Thibault a consacré plus de 500 heures de développement à construire l'écosystème RESCOE
                      avec une expertise technique solide en React et Solidity. Ce travail, qui aurait coûté
                      plus de 20 000€ s'il avait été externalisé, a été réalisé bénévolement pour l'association.
                    </Text>

                    <Box width="100%" mt={4}>
                      <Text fontWeight="bold" color="brand.cream" mb={2}>Répartition du temps de développement</Text>
                      <VStack align="start" spacing={3} width="100%">
                        {[
                          { label: "Contrats Solidity", value: 45, color: "brand.mauve" },
                          { label: "Interface React", value: 35, color: "brand.gold" },
                          { label: "Intégration Web3", value: 15, color: "brand.blue" },
                          { label: "Tests & Documentation", value: 5, color: "brand.cream" }
                        ].map((item, index) => (
                          <VStack align="start" spacing={1} width="100%" key={index}>
                            <HStack justifyContent="space-between" width="100%">
                              <Text fontSize="sm" color="brand.cream">{item.label}</Text>
                              <Text fontSize="sm" color={item.color}>{item.value}%</Text>
                            </HStack>
                            <Progress
                              value={item.value}
                              size="sm"
                              borderRadius="full"
                              bg="rgba(255, 255, 255, 0.1)"
                              colorScheme={index === 0 ? "purple" : index === 1 ? "yellow" : index === 2 ? "blue" : "white"}
                              width="100%"
                            />
                          </VStack>
                        ))}
                      </VStack>
                    </Box>

                    <Box
                      mt={6}
                      p={5}
                      borderRadius="xl"
                      bg="rgba(1, 28, 57, 0.5)"
                      borderLeft="4px solid"
                      borderColor="brand.gold"
                    >
                      <Text color="brand.cream" lineHeight="tall">
                        <Text as="span" fontWeight="bold" color="brand.gold">Objectif stratégique :</Text> La SAS permettra à Thibault et à son équipe de consacrer plus de temps au développement
                        de RESCOE tout en assurant la viabilité économique du projet. C'est un modèle hybride
                        innovant où l'association reste le cœur créatif, tandis que la SAS assure la pérennité technique et financière.
                      </Text>
                    </Box>
                  </VStack>
                </GridItem>
              </Grid>
            </Box>
          </Box>
        </SlideFade>

        {/* Call to Action */}
        <SlideFade in={true} offsetY={20} delay={0.9}>
          <Box
            textAlign="center"
            p={10}
            borderRadius="3xl"
            bgGradient="linear(to-r, rgba(1, 28, 57, 0.8), brand.navy)"
            border="1px solid"
            borderColor="brand.mauve"
            mb={16}
          >
            <Heading
              as="h2"
              size="2xl"
              mb={6}
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              bgClip="text"
            >
              Prêt à rejoindre l'aventure ?
            </Heading>

            <Text
              fontSize="xl"
              maxW="2xl"
              mx="auto"
              mb={10}
              color="brand.cream"
              lineHeight="tall"
            >
              Que vous soyez artiste, développeur, ou simplement passionné par l'intersection entre art et technologie,
              RESCOE a besoin de votre énergie et de votre créativité pour faire grandir cet écosystème unique.
            </Text>

            <Flex
              justify="center"
              gap={6}
              direction={{ base: "column", sm: "row" }}
              maxW="md"
              mx="auto"
            >
              <Button
                size="lg"
                bgGradient="linear(to-r, brand.mauve, brand.blue)"
                color="white"
                fontWeight="bold"
                px={8}
                py={7}
                borderRadius="full"
                _hover={{
                  transform: "scale(1.05)",
                  boxShadow: effects.glowDark,
                }}
                animation={`${pulse('#B4A6D5')} 4s infinite`}
              >
                Devenir membre
              </Button>

              <Button
                size="lg"
                variant="outline"
                borderColor="brand.mauve"
                color="brand.cream"
                fontWeight="medium"
                px={8}
                py={7}
                borderRadius="full"
                _hover={{
                  bg: "rgba(180, 166, 213, 0.1)",
                  borderColor: "brand.gold",
                  transform: "scale(1.03)"
                }}
              >
                Contactez-nous
              </Button>
            </Flex>
          </Box>
        </SlideFade>
      </Container>

      {/* Modal for ecosystem details */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent
          bg="brand.navy"
          color="brand.cream"
          borderRadius="2xl"
          border="1px solid"
          borderColor="brand.mauve"
        >
          <ModalHeader>
            <Heading as="h3" size="lg" color="brand.gold">
              Découvrez notre écosystème RESCOE
            </Heading>
          </ModalHeader>
          <ModalCloseButton color="brand.cream" />
          <ModalBody>
            <VStack align="start" spacing={4}>
              <Text lineHeight="tall">
                RESCOE est bien plus qu'une simple association : c'est un écosystème complet qui relie
                l'art traditionnel et numérique à travers la technologie blockchain.
              </Text>

              <Box width="100%" p={4} borderRadius="lg" bg="rgba(1, 28, 57, 0.5)">
                <Heading as="h4" size="md" mb={3} color="brand.gold">
                  Pour les artistes
                </Heading>
                <VStack align="start" spacing={2}>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Accès à des outils techniques simplifiés pour créer sur le Web3</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Formation personnalisée selon votre niveau technique</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Plateforme de vente avec commission réduite (10%)</Text>
                  </HStack>
                </VStack>
              </Box>

              <Box width="100%" p={4} borderRadius="lg" bg="rgba(1, 28, 57, 0.5)">
                <Heading as="h4" size="md" mb={3} color="brand.gold">
                  Pour la communauté
                </Heading>
                <VStack align="start" spacing={2}>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Événements réguliers (physiques et numériques)</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Espace de collaboration entre artistes traditionnels et numériques</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Publications hybrides (fanzines physiques + contenus numériques)</Text>
                  </HStack>
                </VStack>
              </Box>

              <Box width="100%" p={4} borderRadius="lg" bg="rgba(1, 28, 57, 0.5)">
                <Heading as="h4" size="md" mb={3} color="brand.gold">
                  Pour l'innovation
                </Heading>
                <VStack align="start" spacing={2}>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Architecture technique open-source partagée avec la communauté</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Expérimentations régulières avec de nouvelles technologies</Text>
                  </HStack>
                  <HStack spacing={2}>
                    <Icon as={FaCheckCircle} color="brand.gold" />
                    <Text>Collaborations avec des institutions culturelles et éducatives</Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="purple"
              mr={3}
              onClick={onClose}
              bgGradient="linear(to-r, brand.mauve, brand.blue)"
            >
              Fermer
            </Button>
            <Button
              variant="ghost"
              color="brand.cream"
              _hover={{ bg: "rgba(180, 166, 213, 0.1)" }}
              onClick={() => {
                onClose();
                // In a real app, this would scroll to the membership section
              }}
            >
              Devenir membre
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AssociationPage;
