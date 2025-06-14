import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Spinner,
  Grid,
  Text,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  useMediaQuery
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import { useRouter } from "next/router";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";

import { useAuth } from '../../../../utils/authContext';
import TextCard from "../TextCard";

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
  totalMinted: string;
  availableEditions?: string;
  isForSale: boolean;
}

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

const PoetryGallery: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  const { web3, address } = useAuth();

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  const fetchPoetryCollections = async () => {
    setIsLoading(true);
    try {
      const total: BigNumberish = await contract.getTotalCollectionsMinted();
      const totalNumber = total.toString();
      const collectionsPaginated = await contract.getCollectionsPaginated(7, Number(totalNumber));

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

      setCollections(collectionsData.filter(Boolean).sort((a, b) => Number(b!.isFeatured) - Number(a!.isFeatured)));
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
      const uniqueHaikuCount: BigNumberish = await collectionContract.getLastUniqueHaikusMinted();

      const poemsData: Poem[] = await Promise.all(
        Array.from({ length: Number(uniqueHaikuCount) }, (_, i) => i + 1).map(async (uniqueHaikuId) => {
          const [firstTokenId] = await collectionContract.getHaikuInfoUnique(uniqueHaikuId);
          const tokenDetails = await collectionContract.getTokenFullDetails(firstTokenId);

          return {
            tokenId: firstTokenId.toString(),
            poemText: tokenDetails.haiku_,
            creatorAddress: tokenDetails.owner.toString(),
            totalEditions: tokenDetails.totalEditions,
            mintContractAddress: associatedAddress,
            price: tokenDetails.currentPrice.toString(),
            totalMinted: tokenDetails.totalEditions,
            availableEditions: await collectionContract.getRemainingEditions(uniqueHaikuId),
            isForSale: tokenDetails.forSale,
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

  const handleBuy = async (nft: Poem) => {
    if (!web3 || !address) {
      alert("Connectez votre wallet pour acheter un haiku.");
      return;
    }

    try {
      const contract = new web3.eth.Contract(ABI, nft.mintContractAddress);
      const isForSale = await contract.methods.isForSale(nft.tokenId).call();
      if (!isForSale) return alert("Ce haiku n'est pas en vente.");

      const priceOnChain = await contract.methods.getSalePrice(nft.tokenId).call();
      if (Number(priceOnChain).toString() !== nft.price.toString()) {
        return alert("Le prix a changé, veuillez rafraîchir.");
      }

      const editionsRemaining = await contract.methods.getRemainingEditions(nft.tokenId).call();
      if (Number(editionsRemaining) <= 0) {
        return alert("Plus d'éditions disponibles.");
      }

      const receipt = await contract.methods.buyHaiku(nft.tokenId).send({ from: address, value: nft.price });
      alert("Haiku acheté avec succès !");
      console.log(receipt);
    } catch (error: any) {
      console.error("Erreur lors de l'achat :", error);
      alert("Erreur lors de l'achat : " + (error.message || "inconnue"));
    }
  };

  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
    setSelectedCollectionId(collectionId);
    fetchPoems(collectionId, associatedAddress);
    setCurrentTabIndex(1);
  };

  useEffect(() => {
    fetchPoetryCollections();
  }, []);

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie de Poésie</Heading>
      {isLoading && <Spinner />}

      <Tabs index={currentTabIndex} onChange={(index) => {
        setCurrentTabIndex(index);
        if (index === 0) {
          setPoems([]);
          setSelectedCollectionId(null);
        }
      }}>
        <TabList>
          <Tab>Collections</Tab>
          {poems.length > 0 && <Tab>Poèmes</Tab>}
        </TabList>

        <TabPanels>
          <TabPanel>
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={6}>
              {collections.map((collection) => (
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
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </Box>
                  )}
                  <Text>{collection.name}</Text>
                </Box>
              ))}
            </Grid>
          </TabPanel>

          <TabPanel>
            <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={6}>
              {poems.map((poem) => (
                <TextCard
                  key={poem.tokenId}
                  nft={poem}
                  showBuyButton={true}
                  onBuy={() => handleBuy(poem)}
                />

              ))}
            </Grid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default PoetryGallery;
