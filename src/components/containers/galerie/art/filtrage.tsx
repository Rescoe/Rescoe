import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Spinner,
  Text,
  Heading,
  IconButton,
  Flex,
  useColorModeValue,
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import CollectionCard from "../CollectionCard";
import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import NextLink from "next/link";

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
};

const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  type,
  items,
  onLoadMore,
}) => {
  // Keen Slider avec breakpoints responsive
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    loop: false,
    slides: { perView: 1, spacing: 12 },
    breakpoints: {
      "(max-width: 639px)": { slides: { perView: 1, spacing: 10 } },
      "(min-width: 640px) and (max-width: 1023px)": { slides: { perView: 2, spacing: 12 } },
      "(min-width: 1024px)": { slides: { perView: 3, spacing: 16 } },
      "(min-width: 1400px)": { slides: { perView: 4, spacing: 18 } },
    },
    slideChanged: (s) => {
      const details = (s as any).track?.details;
      if (!details) return;

      const currentIndex = Number(details.abs ?? 0);
      const slidesPerView = Number(details.slides.length ?? 1);

      if (currentIndex + slidesPerView >= items.length) {
        onLoadMore();
      }
    },
  });


  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      w="100%"
      maxW="100%"
      mb={8}
      position="relative"
    >
      <Heading size="md" mb={3}>{type}</Heading>

      <Box position="relative" w="100%" display="flex" justifyContent="center" alignItems="center">

        <Box position="absolute" left={0} top={0} bottom={0} width="48px" pointerEvents="none" bg="linear-gradient(to right, rgba(0,0,0,0.25), transparent)" />
        <Box position="absolute" right={0} top={0} bottom={0} width="48px" pointerEvents="none" bg="linear-gradient(to left, rgba(0,0,0,0.25), transparent)" />

        <Box ref={sliderRef} className="keen-slider" overflow="hidden" borderRadius="md" bg="transparent">
          {items.map((collection) => (
            <NextLink
              key={collection.id}
              href={`/galerie/${collection.collectionType.toLowerCase()}?search=${encodeURIComponent(collection.name)}`}
              passHref
              legacyBehavior
            >
            <Box className="keen-slider__slide" role="group" position="relative" w="100%" display="flex" justifyContent="center" alignItems="center">
              <CollectionCard collection={{ ...collection, imageUrl: collection.imageUrl || "" }} type={type} />
            </Box>
            </NextLink>
          ))}
        </Box>

        {slider && (
          <>
            <IconButton
              aria-label="Précédent"
              icon={<ChevronLeftIcon />}
              onClick={() => slider.current?.prev()}
              bg={btnBg}
              _hover={{ bg: btnHoverBg }}
              boxShadow="md"
              borderRadius="full"
              size="sm"
              position="absolute"
              left="6px"
              top="50%"
              transform="translateY(-50%)"
            />
            <IconButton
              aria-label="Suivant"
              icon={<ChevronRightIcon />}
              onClick={() => slider.current?.next()}
              bg={btnBg}
              _hover={{ bg: btnHoverBg }}
              boxShadow="md"
              borderRadius="full"
              size="sm"
              position="absolute"
              right="6px"
              top="50%"
              transform="translateY(-50%)"
            />
          </>
        )}
      </Box>
    </Box>
  );
};

const CollectionsByType: React.FC<{ creator: string }> = ({ creator }) => {
  const [collections, setCollections] = useState<CollectionOnChain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const pageSize = 5;

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

  const fetchCollections = async (type?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const allCollections: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
      const sortedCollections = [...allCollections].reverse();

      const totalCollectionsByType: Record<string, number> = {};
      sortedCollections.forEach((col) => {
        if (!totalCollectionsByType[col.collectionType]) totalCollectionsByType[col.collectionType] = 0;
        totalCollectionsByType[col.collectionType]++;
      });

      const collectionsData: CollectionOnChain[] = [];
      for (const [t] of Object.entries(totalCollectionsByType)) {
        if (type && t !== type) continue; // on charge seulement le type qui déclenche l'infinite scroll

        const start = (currentPage[t] || 0) * pageSize;
        const end = start + pageSize;
        const paginatedCollections = sortedCollections.filter(col => col.collectionType === t).slice(start, end);
        collectionsData.push(...paginatedCollections);
      }

      const collectionsWithMetadata = await Promise.all(
        collectionsData.map(async (col) => {
          const uri = col.uri || (await contract.getCollectionURI(col.id.toString()));
          const ipfsHash = uri?.split("/").pop();
          let metadata: any = {};
          if (ipfsHash) {
            const response = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
            metadata = await response.json();
          }
          return {
            id: col.id.toString(),
            name: col.name,
            collectionType: col.collectionType,
            creator: col.creator,
            mintContractAddress: col.mintContractAddress,
            imageUrl: metadata.image || "",
            uri,
          };
        })
      );

      setCollections(prev => {
        const newCollections = collectionsWithMetadata.filter(
          col => !prev.some(c => c.id === col.id)
        );
        return [...prev, ...newCollections];
      });

    } catch (err) {
      console.error("Erreur fetchUserCollections", err);
      setError("Impossible de charger les collections.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = (type: string) => {
    setCurrentPage(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
  };

  useEffect(() => {
    if (creator) fetchCollections();
  }, [creator, currentPage]);

  const collectionsGroupedByType = useMemo(() => {
    return collections.reduce<Record<string, CollectionOnChain[]>>((acc, col) => {
      if (!acc[col.collectionType]) acc[col.collectionType] = [];
      acc[col.collectionType].push(col);
      return acc;
    }, {});
  }, [collections]);

  const [showSpinner, setShowSpinner] = useState(false);

useEffect(() => {
  let timeout: NodeJS.Timeout;

  if (isLoading) {
    timeout = setTimeout(() => setShowSpinner(true), 1000); // 400ms avant d'afficher
  } else {
    setShowSpinner(false);
  }

  return () => clearTimeout(timeout);
}, [isLoading]);


  return (
    <Box>
    {showSpinner && (
        <Flex justify="center" align="center" minH="40px">
          <Spinner />
        </Flex>
      )}
      {error && <Text color="red.500">{error}</Text>}
      {!isLoading && collections.length === 0 && <Text>Aucune collection trouvée.</Text>}

      {Object.entries(collectionsGroupedByType).map(([type, typeCollections]) => (
        <HorizontalCarousel
          key={type}
          type={type}
          items={typeCollections}
          onLoadMore={() => handleLoadMore(type)}
        />

      ))}
    </Box>
  );
};

export default CollectionsByType;
