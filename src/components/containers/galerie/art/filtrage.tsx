import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Spinner,
  Text,
  Heading,
  IconButton,
  Flex,
  useColorModeValue,
  useMediaQuery,
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

// HorizontalCarousel: rendu carousel par type
type HorizontalCarouselProps = {
  type: string;
  items: CollectionOnChain[];
};

const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({ type, items }) => {
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
      <Heading size="md" mb={3}>
        {type}
      </Heading>

      <Box position="relative" w="100%">
        {/* gradients latéraux indiquant qu'il y a d'autres items */}
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
            <Box
              className="keen-slider__slide"
              role="group"
            >
            <CollectionCard
              collection={{ ...collection, imageUrl: collection.imageUrl || "" }}
              type={type}
            />
            </Box>

            </NextLink>
          ))}
        </Box>

        {/* chevrons de navigation */}
        {slider && (
          <>
            <IconButton
              aria-label="Précédent"
              icon={<ChevronLeftIcon />}
              onClick={() => slider?.current?.prev()}
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
              onClick={() => slider?.current?.next()}
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
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");

  // fetch des collections de l'utilisateur
  const fetchUserCollections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userCollectionsOnChain: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
      const nbOfCollection = await contract.getNumberOfCollectionsByUser(creator);
      // on peut s'en servir si on veut affichage restreint ou pagination local
      const limit = Number(nbOfCollection);

      const collectionsData = await Promise.all(
        userCollectionsOnChain.map(async (col) => {
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
            imageUrl: metadata.image,
            uri,
          };
        })
      );

      // Mapping éventuel et normalisation des props si besoin
      const collectionsDataFormatted: CollectionOnChain[] = collectionsData.map((c) => ({
        ...c,
        // si besoin normalisations ici
        imageUrl: c.imageUrl ?? "",
      }));

      // on peut limter ici ou laisser le type géré par le slider
      setCollections(collectionsDataFormatted.slice(0, limit > 0 ? limit : undefined));
    } catch (error) {
      console.error("Erreur fetchUserCollections", error);
      setError("Impossible de charger les collections.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (creator) {
      fetchUserCollections();
    }
  }, [creator]);

  // Groupe les collections par type pour les afficher dans un carousel distinct
  const collectionsGroupedByType = useMemo(() => {
    return collections.reduce<Record<string, CollectionOnChain[]>>((acc, col) => {
      if (!acc[col.collectionType]) acc[col.collectionType] = [];
      acc[col.collectionType].push(col);
      return acc;
    }, {});
  }, [collections]);

  return (
    <Box>
      {isLoading ? (
        <Flex justify="center" align="center" minH="40px">
          <Spinner />
        </Flex>
      ) : error ? (
        <Text color="red.500">{error}</Text>
      ) : collections.length === 0 ? (
        <Text>Aucune collection trouvée.</Text>
      ) : (
        // on affiche un carousel par type
        Object.entries(collectionsGroupedByType).map(([type, typeCollections]) => (
          <HorizontalCarousel key={type} type={type} items={typeCollections} />
        ))
      )}
    </Box>
  );
};

export default CollectionsByType;
