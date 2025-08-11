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
  tokenIdsForSale: number[];

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
  const [tokenIdsForSale, setTokenIdsForSale] = useState<number[]>([]);


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
    console.log("Début de fetchPoems pour collectionId:", collectionId, "et adresse:", associatedAddress);

    try {
      const collectionContract = new Contract(associatedAddress, ABI, provider);
      const uniqueHaikuCount: BigNumberish = await collectionContract.getLastUniqueHaikusMinted();
      console.log("Nombre total de haikus uniques mintés :", uniqueHaikuCount.toString());

      const poemsData: Poem[] = await Promise.all(
        Array.from({ length: Number(uniqueHaikuCount) }, (_, i) => i).map(async (uniqueHaikuId) => {
          console.log(`Haiku unique : ${uniqueHaikuId}`);

          //On va chercher l'ID du pemier haikus d'une meme série
          const premierToDernier = await collectionContract.getHaikuInfoUnique(uniqueHaikuId);
          const premierIDDeLaSerie = Number(premierToDernier[0]);
          const nombreHaikusParSerie = Number(premierToDernier[1]);

          console.log(`prmeier haikus ID : ${premierIDDeLaSerie}`);
          console.log(`nombre dans la série : ${nombreHaikusParSerie}`);

          //On récupère les Haikus qui n'ont jamais été vendu:
          const availableEditions = await collectionContract.getRemainingEditions(uniqueHaikuId);
          console.log(`Éditions disponibles pour haiku #${uniqueHaikuId}:`, availableEditions.toString());

          //On récupère le nombre total d'editions minté dans le recueil (contrat)
          let totalEditions = await collectionContract.getLastMintedTokenId();
          totalEditions = Number(totalEditions) + 1;
          console.log(`Nombre total de haikus minté dans cette série :`, totalEditions.toString());

          //On cherche ensuite les hakus qui sont en vente reellement
          let AV = 0
          const tokenIdsForSale: number[] = []; // Tableau pour garder les IDs des tokens à vendre

          for (let id = premierIDDeLaSerie; id < (premierIDDeLaSerie+nombreHaikusParSerie); id++) {

            const forSale: boolean = await collectionContract.isNFTForSale(id);
            console.log(`Jeton ${id}:`, forSale);
              if (forSale) {
                    AV = AV +1 ;
                    tokenIdsForSale.push(id); // Ajoute l'ID à la liste s'il est à vendre

               }
          }
          console.log(tokenIdsForSale);
          setTokenIdsForSale(tokenIdsForSale);

          const nbAVendre = AV;
          console.log("nbAVendre");
          console.log(AV);

          const [firstTokenId] = await collectionContract.getHaikuInfoUnique(uniqueHaikuId);
          console.log(`firstTokenId pour haiku #${uniqueHaikuId}:`, firstTokenId.toString());


          const tokenDetails = await collectionContract.getTokenFullDetails(firstTokenId);
          console.log(`Détails du token ${firstTokenId.toString()}:`, tokenDetails);

          const creatorAddress = await collectionContract.owner();
          const totalMinted = totalEditions - Number(availableEditions);

          const poem = {
            tokenId: Number(firstTokenId).toString(),
            poemText: tokenDetails.haiku_,
            creatorAddress: creatorAddress.toString(),
            totalEditions: nombreHaikusParSerie.toString(),
            mintContractAddress: associatedAddress,
            price: tokenDetails.currentPrice.toString(),
            totalMinted: totalMinted.toString(),
            availableEditions: nbAVendre.toString(),
            isForSale: tokenDetails.forSale,
            tokenIdsForSale: tokenIdsForSale,
          };

          console.log(`Poème construit pour haiku #${uniqueHaikuId}:`, poem);

          return poem;
        })
      );

      console.log("Tableau complet des poèmes récupérés :", poemsData);
      setPoems(poemsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des poèmes :", error);
      alert("Une erreur est survenue lors de la récupération des poèmes.");
    } finally {
      setIsLoading(false);
      console.log("fetchPoems terminé");
    }
  };



  const handleBuy = async (nft: Poem, tokenId: number) => {
    if (!web3 || !address) {
        alert("Connectez votre wallet pour acheter un haiku.");
        return;
    }

    console.log(`Début du processus d'achat pour le haiku avec l'ID de token : ${tokenId}`);

    try {
        const contract = new web3.eth.Contract(ABI, nft.mintContractAddress);
        const isForSale = await contract.methods.isNFTForSale(tokenId).call();
        console.log(`Le haiku ${tokenId} est-il à vendre ? ${isForSale}`);

        if (!isForSale) {
            alert("Ce haiku n'est pas en vente.");
            return;
        }



        if (Number(nft.tokenIdsForSale) <= 0) {
            alert("Plus d'éditions disponibles.");
            return;
        }

        const receipt = await contract.methods.buyEdition(tokenId).send({ from: address, value: nft.price });
        alert("Haiku acheté avec succès !");
        console.log("Détails de la transaction :", receipt);

        // Rafraîchir la liste après achat
        if (selectedCollectionId) {
            await fetchPoems(selectedCollectionId, nft.mintContractAddress);
        }
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
                tokenIdsForSale={poem.tokenIdsForSale} // tu passes la liste ici
                onBuy={(tokenId) => handleBuy(poem, Number(tokenId))}
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
