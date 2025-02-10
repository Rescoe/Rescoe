import React, { useState, useEffect } from "react";
import { Box, Heading, Spinner, Grid, Text } from "@chakra-ui/react";
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import { useRouter } from "next/router";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";

import TextCard from "../TextCard";

// Typage des collections et poèmes
interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
}

interface Poem {
  tokenId: string;
  poemText: string;
  creatorAddress: string;
  totalEditions: string;
  mintContractAddress: string;
  price: string;
}

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

const PoetryGallery: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  // Récupérer les collections de poésie
  const fetchPoetryCollections = async () => {
  setIsLoading(true);
  try {
    const total: BigNumberish = await contract.getTotalCollectionsMinted();
    const totalNumber = total.toString(); // Changer ici pour utiliser BigNumberish sans BigNumber
    const collectionsPaginated = await contract.getCollectionsPaginated(0, Number(totalNumber)); // Utiliser Number ici

    const collectionsData: Collection[] = await Promise.all(
      collectionsPaginated.map(async (tuple: any) => {
        const [id, name, collectionType, , associatedAddresses, , isFeatured] = tuple;

        if (collectionType !== "Poesie") return null;

        const uri: string = await contract.getCollectionURI(id);
        const mintContractAddress: string = associatedAddresses;

        const cachedMetadata = localStorage.getItem(uri);
        if (cachedMetadata) {
          const metadata = JSON.parse(cachedMetadata);
          return {
            id: id.toString(),
            name,
            imageUrl: metadata.image,
            mintContractAddress,
            isFeatured,
          };
        }

        const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split("/").pop()}`);
        const metadata = await response.json();
        localStorage.setItem(uri, JSON.stringify(metadata));

        return {
          id: id.toString(),
          name,
          imageUrl: metadata.image,
          mintContractAddress,
          isFeatured,
        };
      })
    );

    setCollections(collectionsData.filter((c) => c !== null).sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
  } catch (error) {
    console.error("Erreur lors de la récupération des collections :", error);
  } finally {
    setIsLoading(false);
  }
};

const fetchPoems = async (collectionId: string, associatedAddress: string) => {
  setIsLoading(true);
  try {
    const collectionContract = new Contract(associatedAddress, ABI, provider);

    const uniqueTokenCount: BigNumberish = await collectionContract.getUniqueNFTCount();
    const numberUniqueTokenCount = Number(uniqueTokenCount); // Utiliser directement sans BigNumber

    const tokenIds = Array.from({ length: numberUniqueTokenCount }, (_, i) => i + 1);

    const poemsData: Poem[] = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const haikuText: string = await collectionContract.getHaiku(tokenId);
        const creatorAddress: string = await collectionContract.getCreator(tokenId);
        const totalEditions: BigNumberish = await collectionContract.getTotalSupply(tokenId);
        const price: BigNumberish = await collectionContract.getSalePrice(tokenId);

        return {
          tokenId: tokenId.toString(),
          poemText: haikuText,
          creatorAddress,
          totalEditions: totalEditions.toString(),
          mintContractAddress: associatedAddress,
          price: price.toString(),
        };
      })
    );

    setPoems(poemsData);
  } catch (error) {
    console.error("Erreur lors de la récupération des poèmes :", error);
    alert("Une erreur est survenue lors de la récupération des poèmes.");
  } finally {
    setIsLoading(false);
  }
};

  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
    fetchPoems(collectionId, associatedAddress);
  };

  useEffect(() => {
    fetchPoetryCollections();
  }, []);

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie de Poésie</Heading>
      {isLoading ? (
        <Spinner />
      ) : (
        <Grid templateColumns="repeat(3, 1fr)" gap={6}>
          {collections.length === 0 ? (
            <Text>Aucune collection de poésie trouvée.</Text>
          ) : (
            collections.map((collection) => (
              <Box
                key={collection.id}
                borderWidth="1px"
                borderRadius="lg"
                p={4}
                cursor="pointer"
                onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
              >
                {collection.imageUrl && (
                  <Box width="100%" height="150px" overflow="hidden" borderRadius="md">
                    <img
                      src={collection.imageUrl}
                      alt={collection.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </Box>
                )}
                <Text>{collection.name}</Text>
              </Box>
            ))
          )}
        </Grid>
      )}

      {poems.length > 0 && (
        <Box mt={8}>
          <Heading size="md" mb={4}>
            Poèmes
          </Heading>
          <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6} justifyItems="center">
            {poems.map((poem) => (
              <Box key={poem.tokenId} width="100%">
                <TextCard nft={poem} />
              </Box>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default PoetryGallery;
