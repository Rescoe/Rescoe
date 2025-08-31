import React, { useState, useEffect } from "react";
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
  mintContractAddress: string; // au lieu de collectionAddress
  imageUrl?: string;
  uri : string;
};

type HorizontalSliderProps = {
  type: string;
  collections: CollectionOnChain[];
  startIndex: number;
  children?: React.ReactNode; // <-- important !
};


const CollectionsByType: React.FC<{ creator: string }> = ({ creator }) => {
  const [collections, setCollections] = useState<CollectionOnChain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startIndexes, setStartIndexes] = useState<{ [key: string]: number }>({});
  const [LIMIT, setLIMIT] = useState<number>(4); // par exemple 5 par défaut
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!, ABIRESCOLLECTION, provider);

  const btnBg = useColorModeValue("white", "gray.700");
  const btnHoverBg = useColorModeValue("gray.100", "gray.600");

  const fetchUserCollections = async () => {
    setIsLoading(true);
    try {
      const userCollectionsOnChain: CollectionOnChain[] = await contract.getCollectionsByUser(creator);
      const nbOfCollection = await contract.getNumberOfCollectionsByUser(creator);
      setLIMIT(Number(nbOfCollection));
      const collectionsData = await Promise.all(
        userCollectionsOnChain.map(async (col) => {
          const uri = col.uri || (await contract.getCollectionURI(col.id.toString()));
          const ipfsHash = uri.split("/").pop();
          const response = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
          const metadata = await response.json();

          return {
            id: col.id.toString(),
            name: col.name,
            collectionType: col.collectionType,
            creator: col.creator,
            mintContractAddress: col.mintContractAddress,
            imageUrl: metadata.image,
          };
        })
      );
      const collectionsDataFormatted: CollectionOnChain[] = collectionsData.map(c => ({
        ...c,
        collectionAddress: c.mintContractAddress, // si besoin selon ton type
        uri: c.imageUrl || "", // on mappe imageUrl sur uri, ou une string vide par défaut
      }));

      setCollections(collectionsDataFormatted);


    } catch (error) {
      console.error("Erreur fetchUserCollections", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (creator) {
      fetchUserCollections();
    }
  }, [creator]);

  useEffect(() => {
    const initialIndexes: Record<string, number> = {};
collections.forEach(col => {
  initialIndexes[col.collectionType] = 0;
});
setStartIndexes(initialIndexes);

  }, [collections]);

  const collectionsGroupedByType = collections.reduce<Record<string, CollectionOnChain[]>>(
    (acc, col) => {
      if (!acc[col.collectionType]) acc[col.collectionType] = [];
      acc[col.collectionType].push(col);
      return acc;
    },
    {}
  );


  const HorizontalSlider = ({
    type,
    collections,
    startIndex,
    children,
  }: {
    type: string;
    collections: any[];
    startIndex: number;
    children?: React.ReactNode; // <-- ajouter ça
  }) => {
    const [isMobile] = useMediaQuery("(max-width: 768px)");

    const [sliderRef, instanceRef] = useKeenSlider({
      slides: { perView: 2, spacing: 15 },
      breakpoints: {
        "(max-width: 768px)": {
          slides: { perView: 1, spacing: 10 },
        },
        "(min-width: 769px) and (max-width: 1024px)": {
          slides: { perView: 2, spacing: 10 },
        },
        "(min-width: 1025px)": {
          slides: { perView: 3, spacing: 15 },
        },
      },
    });

    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        w="100%"
        maxW="100%"
        minH="100vh"
        bg="transparent"
        color="white"
        pb="6rem" // plus responsive que 100px
        overflow="hidden"
      >

              <Heading size="md" mb={3}>
          {type}
        </Heading>

{/*Affichage mobile de mémors*/}

        {isMobile ? (
          <Box ref={sliderRef} className="keen-slider" overflow="hidden">
          {collections.map((collection) => (
            <NextLink
              key={collection.id}
              href={`/galerie/${collection.type}?search=${collection.collectionName}`} // page de destination
              passHref
            >
              <Box
                className="keen-slider__slide"
                flex="0 0 auto"
                width="100%"
                cursor="pointer" // pour indiquer que c'est cliquable
                _hover={{ opacity: 0.8 }} // petit effet au survol
              >
                <CollectionCard collection={collection} type={type} />
              </Box>
            </NextLink>
          ))}
          </Box>
        ) : (

          <Flex
            className="keen-slider"
            justify="center"
            gap={6}
            wrap="wrap"
          >
          {collections.map((collection) => (
            <NextLink
              key={collection.id}
              href={`/galerie/${collection.collectionType.toLowerCase()}?search=${collection.name}`} // page de destination
              passHref
            >
              <Box
                className="keen-slider__slide"
                flex="0 0 auto"
                width="100%"
                cursor="pointer" // pour indiquer que c'est cliquable
                _hover={{ opacity: 0.8 }} // petit effet au survol
              >
                <CollectionCard collection={collection} type={type} />
              </Box>
            </NextLink>
          ))}
          </Flex>
        )}


{/*  Position des chevrons de mémors*/}
        <Flex
          position="absolute"
          top="50%"
          transform="translateY(-50%)"
          width="100%"
          justifyContent="space-between"
          px={2}
        >
          <IconButton
            aria-label="Précédent"
            icon={<ChevronLeftIcon />}
            onClick={() =>
              isMobile ? instanceRef.current?.prev() : console.log("prev PC")
            }
            bg={btnBg}
            _hover={{ bg: btnHoverBg }}
            boxShadow="md"
            borderRadius="full"
            size="sm"
          />
          <IconButton
            aria-label="Suivant"
            icon={<ChevronRightIcon />}
            onClick={() =>
              isMobile ? instanceRef.current?.next() : console.log("next PC")
            }
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
      {isLoading ? (
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
            startIndex={startIndexes[type] || 0}
          >
            {typeCollections.map((collection) => (
              <NextLink
                key={collection.id}
                href={`/galerie/${collection.collectionType.toLowerCase()}?search=${encodeURIComponent(collection.name)}`}
                passHref
                legacyBehavior // important pour Next.js >= 13 si pas app router
              >
                <Box
                  as="a" // important pour que NextLink fonctionne
                  className="keen-slider__slide"
                  flex="0 0 auto"
                  width="200px"
                  cursor="pointer"
                  _hover={{ opacity: 0.8 }}
                >
                <CollectionCard
                  collection={{ ...collection, imageUrl: collection.imageUrl || "" }}
                  type={type}
                />                </Box>
              </NextLink>
            ))}
          </HorizontalSlider>
        ))
      )}
    </Box>
  );
};

export default CollectionsByType;
