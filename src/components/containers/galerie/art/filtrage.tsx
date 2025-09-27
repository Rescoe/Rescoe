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
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
};

const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({ type, items, currentPage, setCurrentPage }) => {
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    loop: false,
    slides: { perView: 1, spacing: 12 },
    breakpoints: {
      "(max-width: 639px)": { slides: { perView: 1, spacing: 10 } },
      "(min-width: 640px) and (max-width: 1023px)": { slides: { perView: 2, spacing: 12 } },
      "(min-width: 1024px)": { slides: { perView: 3, spacing: 16 } },
      "(min-width: 1400px)": { slides: { perView: 4, spacing: 18 } },
    },
  });

  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");




  let slidesPerView = 1;

  if (slider?.current?.options?.slides) {
    const s = slider.current.options.slides;
    // si c'est un objet avec perView, on l'utilise
    if (typeof s === "object" && "perView" in s && typeof s.perView === "number") {
      slidesPerView = s.perView;
    }
  }

  const totalPages = Math.ceil(items.length / slidesPerView);
  const isAtStart = currentPage <= 0;
  const isAtEnd = currentPage >= totalPages - 1;


  const handlePrevClick = () => {
    if (!isAtStart) setCurrentPage(currentPage - 1);
  };

  const handleNextClick = () => {
    if (!isAtEnd) setCurrentPage(currentPage + 1);
  };

  return (
    <Box display="flex" flexDirection="column" alignItems="center" w="100%" mb={8} position="relative">
      <Heading size="md" mb={3}>
        {type}
      </Heading>

      <Box position="relative" w="100%">
        {/* gradients latéraux */}
        <Box
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width="48px"
          pointerEvents="none"
          bg="linear-gradient(to right, rgba(0,0,0,0.25), transparent)"
        />
        <Box
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          width="48px"
          pointerEvents="none"
          bg="linear-gradient(to left, rgba(0,0,0,0.25), transparent)"
        />

        <Box ref={sliderRef} className="keen-slider" overflow="hidden" borderRadius="md" bg="transparent">
          {items.map((collection) => (
            <NextLink
              key={collection.id}
              href={`/galerie/${collection.collectionType.toLowerCase()}?search=${encodeURIComponent(
                collection.name
              )}`}
              passHref
              legacyBehavior
            >
              <Box className="keen-slider__slide" role="group">
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
              onClick={handlePrevClick}
              bg={btnBg}
              _hover={{ bg: btnHoverBg }}
              boxShadow="md"
              borderRadius="full"
              size="sm"
              position="absolute"
              left="6px"
              top="50%"
              transform="translateY(-50%)"
              disabled={isAtStart}
            />
            <IconButton
              aria-label="Suivant"
              icon={<ChevronRightIcon />}
              onClick={handleNextClick}
              bg={btnBg}
              _hover={{ bg: btnHoverBg }}
              boxShadow="md"
              borderRadius="full"
              size="sm"
              position="absolute"
              right="6px"
              top="50%"
              transform="translateY(-50%)"
              disabled={isAtEnd}
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
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 5;
  const [totalCollectionsByType, setTotalCollectionsByType] = useState<Record<string, number>>({});

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

  const fetchUserCollections = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const userCollectionsOnChain: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
      const sortedCollections = [...userCollectionsOnChain].reverse();

      const totalCollectionsByTypeTemp: Record<string, number> = {};
      sortedCollections.forEach((col) => {
        if (!totalCollectionsByTypeTemp[col.collectionType]) totalCollectionsByTypeTemp[col.collectionType] = 0;
        totalCollectionsByTypeTemp[col.collectionType]++;
      });
      setTotalCollectionsByType(totalCollectionsByTypeTemp);

      const collectionsData: CollectionOnChain[] = [];
      for (const [type] of Object.entries(totalCollectionsByTypeTemp)) {
        const start = currentPage * pageSize;
        const end = start + pageSize;
        const paginatedCollections = sortedCollections
          .filter((col) => col.collectionType === type)
          .slice(start, end);
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

      setCollections(collectionsWithMetadata);
    } catch (err) {
      console.error("Erreur fetchUserCollections", err);
      setError("Impossible de charger les collections.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (creator) fetchUserCollections();
  }, [creator, currentPage]);

  const collectionsGroupedByType = useMemo(() => {
    return collections.reduce<Record<string, CollectionOnChain[]>>((acc, col) => {
      if (!acc[col.collectionType]) acc[col.collectionType] = [];
      acc[col.collectionType].push(col);
      return acc;
    }, {});
  }, [collections]);

  return (
    <Box>
      {isLoading && (
        <Flex justify="center" align="center" minH="40px">
          <Spinner />
        </Flex>
      )}
      {error && <Text color="red.500">{error}</Text>}
      {collections.length === 0 && !isLoading && <Text>Aucune collection trouvée.</Text>}

      {Object.entries(collectionsGroupedByType).map(([type, typeCollections]) => (
        <HorizontalCarousel
          key={type}
          type={type}
          items={typeCollections}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
        />
      ))}
    </Box>
  );
};

export default CollectionsByType;
