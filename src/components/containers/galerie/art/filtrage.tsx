import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo
} from "react";
import {
  Box,
  Flex,
  Heading,
  IconButton,
  Skeleton,
  SkeletonCircle,
  Stack,
  Text,
  useColorModeValue,
  useBreakpointValue,
  useDisclosure,
  Center,
  Button,
  useToast,
  Spinner
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import NextLink from "next/link";
import { motion } from "framer-motion";
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import CollectionCard from "../CollectionCard";
const MotionBox = motion(Box);


type CollectionOnChain = {
  id: string;
  name: string;
  collectionType: string;
  creator: string;
  mintContractAddress: string;
  imageUrl?: string;
  uri: string;
};

type HorizontalCarouselProps = {
  type: string;
  items: CollectionOnChain[];
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
};

// Composant de carte skeleton pour le chargement
const CollectionCardSkeleton = () => (
  <Box
    p={3}
    borderRadius="xl"
    bg="bg-surface"
    _hover={{ transform: "translateY(-4px)", shadow: "lg" }}
    transition="all 0.2s"
  >
    <Skeleton height="180px" borderRadius="lg" mb={3} />
    <Flex align="center">
      <SkeletonCircle size="10" mr={3} />
      <Box w="full">
        <Skeleton height="20px" mb={2} />
        <Skeleton height="16px" width="70%" />
      </Box>
    </Flex>
  </Box>
);

const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  type,
  items,
  onLoadMore,
  isLoading,
  hasMore
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showNav, setShowNav] = useState(false);
  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");
  const toast = useToast();
  const [hovered, setHovered] = useState(false);


  // Détection des breakpoints avec useBreakpointValue
  const itemsPerView = useBreakpointValue({
    base: 1.2,
    sm: 1.5,
    md: 2.5,
    lg: 3.2,
    xl: 4.2
  }) || 3;

  // Calculer les largeurs dynamiques pour les items
  const itemWidth = useMemo(() => {
    const spacing = [4, 5, 6]; // [base, md, xl]
    const baseWidth = `calc((100% / ${itemsPerView}) - ${spacing}px)`;
    const mdWidth = `calc((100% / ${itemsPerView}) - ${spacing[1]}px)`;
    const xlWidth = `calc((100% / ${itemsPerView}) - ${spacing[2]}px)`;

    return [baseWidth, mdWidth, xlWidth];
  }, [itemsPerView]);

  // Gestion du scroll pour le chargement infini
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoading || !hasMore) return;

    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    const scrollPosition = scrollWidth - scrollLeft - clientWidth;

    // Déclencher le chargement lorsque l'utilisateur est à 200px de la fin
    if (scrollPosition < 200) {
      onLoadMore();
    }
  }, [isLoading, hasMore, onLoadMore]);

  // Ajout de l'écouteur de scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Effet pour la navigation au survol
  const handleMouseEnter = () => {
    setShowNav(true);
    if (containerRef.current) {
      containerRef.current.style.scrollBehavior = 'smooth';
    }
  };

  const handleMouseLeave = () => {
    setShowNav(false);
    if (containerRef.current) {
      containerRef.current.style.scrollBehavior = 'auto';
    }
  };

  // Navigation manuelle
  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;

    const scrollAmount = containerRef.current.clientWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Détection de la fin du chargement
  useEffect(() => {
    if (!hasMore && items.length > 0) {
      toast({
        title: "Toutes les collections sont chargées",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
    }
  }, [hasMore, items.length, toast]);

  return (
    <Box mb={8} position="relative">
    <Flex justify="space-between" align="center" mb={4}>
      <Heading size={{ base: "sm", md: "md" }}>{type}</Heading>
      {items.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          rightIcon={<ChevronRightIcon />}
          onClick={() => scroll('right')}
        >
          Voir plus
        </Button>
      )}
    </Flex>

    <Box
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      position="relative"
      overflowX="auto"
      pb={2}
      className="hide-scrollbar"
      sx={{
        '&.hide-scrollbar::-webkit-scrollbar': {
          display: 'none'
        },
        msOverflowStyle: 'none',
        scrollbarWidth: 'none'
      }}
    >
      {/* Overlay gradient gauche */}
      <Box
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width="60px"
        pointerEvents="none"
        bg="linear-gradient(to right, var(--chakra-colors-bg) 0%, transparent 100%)"
        zIndex="1"
        opacity={showNav ? 1 : 0}
        transition="opacity 0.3s"
      />

      {/* Overlay gradient droit */}
      <Box
        position="absolute"
        right={0}
        top={0}
        bottom={0}
        width="60px"
        pointerEvents="none"
        bg="linear-gradient(to left, var(--chakra-colors-bg) 0%, transparent 100%)"
        zIndex="1"
        opacity={showNav ? 1 : 0}
        transition="opacity 0.3s"
      />

      <Flex gap={4} p={2} minW="100%">
        {items.map((collection) => (
          <MotionBox
            key={collection.id}
            flex="0 0"
            width={itemWidth}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            whileHover={{ y: -4 }}
          >
            <NextLink
              href={`/galerie/${collection.collectionType.toLowerCase()}?search=${encodeURIComponent(collection.name)}`}
              passHref
              legacyBehavior
            >
              <Box
                as="a"
                cursor="pointer"
                _hover={{ textDecoration: "none" }}
              >
                <CollectionCard
                  collection={{ ...collection, imageUrl: collection.imageUrl || "" }}
                  type={type}
                />
              </Box>
            </NextLink>
          </MotionBox>
        ))}

        {isLoading && items.length > 0 && (
          <Box flex="0 0" width={itemWidth}>
            <CollectionCardSkeleton />
          </Box>
        )}

        {!hasMore && items.length > 0 && !isLoading && (
          <Center
            flex="0 0"
            width={itemWidth}
            bg="bg-subtle"
            borderRadius="xl"
            p={4}
          >
            <Text fontSize="sm" textAlign="center" color="gray.500">
              Fin des collections
            </Text>
          </Center>
        )}
      </Flex>
    </Box>

      {/* Boutons de navigation */}
      {showNav && items.length > 0 && (
        <>
          <IconButton
            aria-label="Précédent"
            icon={<ChevronLeftIcon boxSize={5} />}
            onClick={() => scroll('left')}
            bg={btnBg}
            _hover={{ bg: btnHoverBg }}
            boxShadow="lg"
            borderRadius="full"
            size="md"
            position="absolute"
            left={2}
            top="50%"
            transform="translateY(-50%)"
            zIndex={2}
            _active={{ transform: "translateY(-50%) scale(0.95)" }}
          />
          <IconButton
            aria-label="Suivant"
            icon={<ChevronRightIcon boxSize={5} />}
            onClick={() => scroll('right')}
            bg={btnBg}
            _hover={{ bg: btnHoverBg }}
            boxShadow="lg"
            borderRadius="full"
            size="md"
            position="absolute"
            right={2}
            top="50%"
            transform="translateY(-50%)"
            zIndex={2}
            _active={{ transform: "translateY(-50%) scale(0.95)" }}
          />
        </>
      )}
    </Box>
  );
};

const CollectionsByType: React.FC<{ creator: string }> = ({ creator }) => {
  const [collections, setCollections] = useState<CollectionOnChain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const pageSize = 6;
  const toast = useToast();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");


  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
  const contract = new Contract(
    process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!,
    ABIRESCOLLECTION,
    provider
  );

  const fetchCollections = async (type?: string, isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setError(null);

    try {
      const allCollections: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
      const sortedCollections = [...allCollections].reverse();

      const totalCollectionsByType: Record<string, number> = {};
      sortedCollections.forEach((col) => {
        if (!totalCollectionsByType[col.collectionType]) totalCollectionsByType[col.collectionType] = 0;
        totalCollectionsByType[col.collectionType]++;
      });

      // Initialiser hasMore pour chaque type
      const newHasMore = { ...hasMore };
      for (const t of Object.keys(totalCollectionsByType)) {
        newHasMore[t] = true;
      }
      setHasMore(newHasMore);

      const collectionsData: CollectionOnChain[] = [];
      for (const [t, total] of Object.entries(totalCollectionsByType)) {
        if (type && t !== type) continue;

        const start = (currentPage[t] || 0) * pageSize;
        const end = start + pageSize;

        // Vérifier si on a encore des données à charger
        if (end >= total) {
          newHasMore[t] = false;
        }

        const paginatedCollections = sortedCollections
          .filter(col => col.collectionType === t)
          .slice(start, end);

        collectionsData.push(...paginatedCollections);
      }
      setHasMore(newHasMore);

      const collectionsWithMetadata = await Promise.all(
        collectionsData.map(async (col) => {
          try {
            let uri = col.uri;
            if (!uri) {
              uri = await contract.getCollectionURI(col.id.toString());
            }

            const ipfsHash = uri?.split("/").pop();
            if (!ipfsHash) return null;

            const response = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
            if (!response.ok) return null;

            const metadata = await response.json();
            return {
              id: col.id.toString(),
              name: col.name,
              collectionType: col.collectionType,
              creator: col.creator,
              mintContractAddress: col.mintContractAddress,
              imageUrl: metadata.image || "",
              uri,
            };
          } catch (err) {
            console.error(`Erreur pour collection ${col.id}:`, err);
            return null;
          }
        })
      );

      // Filtrer les collections invalides et les doublons
      /*
      const validCollections = collectionsWithMetadata
        .filter((col): col is CollectionOnChain => col !== null)
        .filter(col => !collections.some(c => c.id === col.id));
*/
//Marchait en dev (bloc précédent)

        const validCollections = collectionsWithMetadata
  .filter((col) => col !== null) as CollectionOnChain[];


      setCollections(prev => [...prev, ...validCollections]);

      if (isInitialLoad && validCollections.length === 0) {
        toast({
          title: "Aucune collection trouvée",
          description: "Cet utilisateur n'a pas encore de collections NFT",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
      }

    } catch (err) {
      console.error("Erreur fetchUserCollections", err);
      setError("Impossible de charger les collections. Veuillez réessayer plus tard.");

      toast({
        title: "Erreur de chargement",
        description: "Impossible de récupérer les collections NFT",
        status: "error",
        duration: 3000,
        isClosable: true,
      });

    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = (type: string) => {
    if (!hasMore[type] || isLoadingMore) return;

    setCurrentPage(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));
  };

  useEffect(() => {
    if (creator) {
      fetchCollections(undefined, true);
    }
  }, [creator]);

  useEffect(() => {
    // Chargement des données supplémentaires quand currentPage change
    const typesToLoad = Object.keys(currentPage).filter(type =>
      currentPage[type] > 0 && hasMore[type]
    );

    if (typesToLoad.length > 0) {
      typesToLoad.forEach(type => fetchCollections(type));
    }
  }, [currentPage]);

  const collectionsGroupedByType = useMemo(() => {
    return collections.reduce<Record<string, CollectionOnChain[]>>((acc, col) => {
      if (!acc[col.collectionType]) acc[col.collectionType] = [];
      acc[col.collectionType].push(col);
      return acc;
    }, {});
  }, [collections]);

  const [showEmpty, setShowEmpty] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading && collections.length === 0 && creator) {
        setShowEmpty(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoading, collections, creator]);

  if (error) {
    return (
      <Box textAlign="center" py={8}>
        <Text color="red.500" mb={4}>{error}</Text>
        <Button
          onClick={() => fetchCollections(undefined, true)}
          colorScheme="blue"
        >
          Réessayer
        </Button>
      </Box>
    );
  }

  if (showEmpty && !isLoading) {
    return (
      <Box textAlign="center" py={12} bg="bg-subtle" borderRadius="xl">
        <MotionBox
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          mb={4}
        >
          <Box
            as="svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            h={16}
            w={16}
            color="gray.400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </Box>
        </MotionBox>
        <Heading size="md" mb={2}>Aucune collection trouvée</Heading>
        <Text color="gray.500" mb={4}>
          Cet utilisateur n'a pas encore créé de collections NFT
        </Text>
        <Button
          leftIcon={<ChevronLeftIcon />}
          variant="outline"
          onClick={() => window.history.back()}
        >
          Retour
        </Button>
      </Box>
    );
  }

  return (
    <Box position="relative">
    {isLoading && collections.length === 0 && (
        <Box position="absolute" top={0} left={0} right={0} zIndex={10}>
          <Skeleton height="2px" />
        </Box>
      )}

      {Object.entries(collectionsGroupedByType).map(([type, typeCollections]) => (
        <HorizontalCarousel
          key={type}
          type={type}
          items={typeCollections}
          onLoadMore={() => handleLoadMore(type)}
          isLoading={isLoadingMore}
          hasMore={hasMore[type] ?? true}
        />
      ))}

      {/* Affichage skeleton pour le premier chargement */}
      {isLoading && collections.length === 0 && (
        <Stack spacing={6}>
          <Skeleton height="24px" width="40%" />
          <Flex gap={4} overflowX="auto" pb={2} className="hide-scrollbar">
            {[...Array(4)].map((_, i) => (
              <Box
                key={i}
                flex="0 0"
                width={{ base: "80vw", md: "30vw", lg: "22vw" }}
              >
                <CollectionCardSkeleton />
              </Box>
            ))}
          </Flex>
        </Stack>
      )}

      {/* Chargement infini global */}
      {isLoadingMore && collections.length > 0 && (
        <Flex justify="center" py={4}>
          <Spinner size="lg" />
        </Flex>
      )}

      {/* Bouton de retour en haut */}
      {collections.length > 0 && (
        <IconButton
          aria-label="Retourner en haut"
          icon={<ChevronLeftIcon transform="rotate(-90deg)" />}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          position="fixed"
          bottom="6"
          right="6"
          size="lg"
          bg={btnBg}
          boxShadow="lg"
          _hover={{ bg: btnHoverBg }}
          display={{ base: "flex", md: "none" }}
        />
      )}
    </Box>
  );
};

export default CollectionsByType;
