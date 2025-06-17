import React, { useState, useEffect } from "react";
import {
  Box,
  Spinner,
  Text,
  Heading,
  IconButton,
  Flex,
  useColorModeValue,
  useBreakpointValue,
  Link,
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import CollectionCard from "../CollectionCard";

import { useKeenSlider } from "keen-slider/react";
import "keen-slider/keen-slider.min.css";

import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";

interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  creator: string;
  collectionType: string;
}

const LIMIT = 4;

const CollectionsByType: React.FC<{ creator: string }> = ({ creator }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startId, setStartId] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [typeRedirection, setTypeRedirection] = useState<string>('');
  const [startIndexes, setStartIndexes] = useState<Record<string, number>>({});


  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(
    process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!,
    ABIRESCOLLECTION,
    provider
  );

  const fetchUserCollections = async () => {
  setIsLoading(true);
  try {
    const userCollectionsOnChain = await contract.getCollectionsByUser(creator);

    // Selon la structure de Collection, récupérer le metadata IPFS si besoin
    const collectionsData = await Promise.all(
      userCollectionsOnChain.map(async (col: any) => {
        const id = col.id.toString(); // ou col.collectionId selon ta struct
        const name = col.name;
        const collectionType = col.collectionType;
        const collectionCreator = col.creator;
        const collectionAddress = col.collectionAddress;
        // Si l'URI est dans la struct, par ex col.uri
        const uri = col.uri || (await contract.getCollectionURI(id));

        const ipfsHash = uri.split("/").pop();
        const response = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
        const metadata = await response.json();

        return {
          id,
          name,
          collectionType,
          creator: collectionCreator,
          mintContractAddress: collectionAddress,
          imageUrl: metadata.image,
        };
      })
    );

    setCollections(collectionsData);
  } catch (error) {
    console.error("Erreur fetchUserCollections", error);
  } finally {
    setIsLoading(false);
  }
};

useEffect(() => {
  if (collections.length > 0 && Object.keys(startIndexes).length === 0) {
    const initialIndexes: Record<string, number> = {};
    collections.forEach((col) => {
      if (!(col.collectionType in initialIndexes)) {
        initialIndexes[col.collectionType] = 0;
      }
    });
    setStartIndexes(initialIndexes);
  }
}, [collections, startIndexes]);




useEffect(() => {
  if (creator) {
    fetchUserCollections();
  }
}, [creator]);




const updateStartIndex = (type: string) => {
  setStartIndexes((prev) => {
    const currentIndex = prev[type] || 0;
    const total = collectionsGroupedByType[type]?.length || 0;
    const nextIndex = currentIndex + LIMIT;

    const newIndex = nextIndex >= total ? 0 : nextIndex; // boucle ou pas

    return {
      ...prev,
      [type]: newIndex,
    };
  });
};

const decrementStartIndex = (type: string) => {
  setStartIndexes((prev) => {
    const currentIndex = prev[type] || 0;
    const total = collectionsGroupedByType[type]?.length || 0;
    const prevIndex = currentIndex - LIMIT;

    // Option 1 : boucle en revenant à la fin
    // const newIndex = prevIndex < 0 ? Math.max(total - LIMIT, 0) : prevIndex;

    // Option 2 : bloque à 0 (pas de boucle)
    const newIndex = prevIndex < 0 ? 0 : prevIndex;

    return {
      ...prev,
      [type]: newIndex,
    };
  });
};




  const collectionsGroupedByType = collections.reduce<Record<string, Collection[]>>((acc, col) => {
    if (!acc[col.collectionType]) acc[col.collectionType] = [];
    acc[col.collectionType].push(col);
    return acc;
  }, {});

  const btnBg = useColorModeValue("whiteAlpha.800", "blackAlpha.800");
  const btnHoverBg = useColorModeValue("whiteAlpha.900", "blackAlpha.900");
  const headingSize = useBreakpointValue({ base: "md", md: "lg" });

  const HorizontalSlider: React.FC<{
  collections: Collection[];
  type: string;
  fetchNext: () => void;
  hasMore: boolean;
  isLoading: boolean;
  increaseVisibleCount: () => void;
  decreaseVisibleCount: () => void;  // <== ajouté
  startIndex: number;
}> = ({ collections, type, fetchNext, hasMore, isLoading, increaseVisibleCount, decreaseVisibleCount, startIndex }) => {

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    slides: {
      perView: LIMIT,
      spacing: 10,
    },
    breakpoints: {
      "(max-width: 768px)": {
        slides: { perView: 1, spacing: 5 },
      },
      "(min-width: 769px) and (max-width: 1024px)": {
        slides: { perView: 2, spacing: 5 },
      },
    },
    slideChanged(slider) {
      const lastIndex = slider.track.details.slides.length - 1;
      const current = slider.track.details.rel;

      if (current >= lastIndex - 2 && hasMore && !isLoading) {
        increaseVisibleCount(); // 👈 ajouter cette ligne
        fetchNext();
      }
    },
  });

  useEffect(() => {
    // Quand la tranche change, on remet le slider au début (slide 0)
    instanceRef.current?.moveToIdx(0);
  }, [startIndex]);

  // La gestion de l'espacement se fait dans le collection map, dans le box


  return (
    <Box position="relative" w="100%" overflow="hidden" mb={6}>
      <Heading size="md" mb={3}>{type}</Heading>
      <Box
        ref={sliderRef}
        className="keen-slider"
        display="flex"
        justifyContent="center"
        gap="10px" // pour gérer l’espacement de 10px entre slides (plutôt que spacing dans Keen)
        overflow="hidden"
      >
        {collections.map((collection) => (
          <Box
            key={collection.id}
            className="keen-slider__slide"
              minW="100px"
              maxW="100px"
            flexShrink={0}
          >
            <CollectionCard collection={collection} type={type} />
          </Box>
        ))}
      </Box>

      <Flex position="absolute" top="50%" transform="translateY(-50%)" width="100%" justifyContent="space-between" px={2} pointerEvents="none">
      <IconButton
        aria-label="Précédent"
        icon={<ChevronLeftIcon />}
        onClick={() => {
          decreaseVisibleCount();
          instanceRef.current?.moveToIdx(0); // Pour remettre le slider au début de la tranche
        }}
        pointerEvents="auto"
        bg={btnBg}
        _hover={{ bg: btnHoverBg }}
        boxShadow="md"
        borderRadius="full"
        size="sm"
      />
      <IconButton
        aria-label="Suivant"
        icon={<ChevronRightIcon />}
        onClick={() => {
          increaseVisibleCount();
          instanceRef.current?.moveToIdx(0);
        }}
        pointerEvents="auto"
        bg={btnBg}
        _hover={{ bg: btnHoverBg }}
        boxShadow="md"
        borderRadius="full"
        size="sm"
      />

      </Flex>
    </Box>
  );
};


  return (
    <Box>
      {isLoading && collections.length === 0 ? (
        <Spinner />
      ) : collections.length === 0 ? (
        <Text>Aucune collection trouvée.</Text>
      ) : (
        Object.entries(collectionsGroupedByType).map(([type, typeCollections]) => (
          <HorizontalSlider
            key={type}
            type={type}
            collections={typeCollections.slice(
              startIndexes[type] || 0,
              (startIndexes[type] || 0) + LIMIT
            )}
            fetchNext={fetchUserCollections}
            hasMore={hasMore}
            isLoading={isLoading}
            increaseVisibleCount={() => updateStartIndex(type)}
            decreaseVisibleCount={() => decrementStartIndex(type)}  // <== ajouté
            startIndex={startIndexes[type] || 0}
          />


        ))
      )}
    </Box>
  );
};

export default CollectionsByType;
