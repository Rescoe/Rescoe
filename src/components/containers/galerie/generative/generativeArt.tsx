import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import { useRouter } from 'next/router';
import { useMediaQuery } from '@chakra-ui/react';

import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';

import NFTCard from '../NFTCard';

interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
}

interface NFT {
  tokenId: string;
  image: string;
  name: string;
  description: string;
  price: number;
  tags: string[];
  mintContractAddress: string;
}


const UniqueArtGalerie: React.FC = () => {
  const [isMobile] = useMediaQuery('(max-width: 768px)'); // Ajuster la largeur selon vos besoins
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const router = useRouter();

  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const total: number = await contract.getTotalCollectionsMinted();
      const collectionsPaginated: any[] = await contract.getCollectionsPaginated(0, total);

      // Utiliser Promise.all et filtrer les résultats non nulls
      const collectionsData = (await Promise.all(
        collectionsPaginated.map(async (tuple: any) => {
          const [id, name, collectionType, , associatedAddresses, , isFeatured] = tuple;

          // Vérifier ici si le type de collection est "Art"
          if (collectionType !== "Generative") return null;

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

          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
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
      )).filter((collection): collection is Collection => collection !== null); // Filtrer les valeurs nulles ici

      // Définir les collections uniquement si le type est Collection
      setCollections(collectionsData.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :', error);
    } finally {
      setIsLoading(false);
    }
  };





  const fetchNFTs = async (collectionId: string, associatedAddress: string) => {
      setIsLoading(true);
      try {
          const collectionContract = new Contract(associatedAddress, ABI_MINT_CONTRACT, provider);
          const tokenIds: string[] = await collectionContract.getTokenPaginated(0, 10);

          const nftsData = (await Promise.all(
              tokenIds.map(async (tokenId: string) => {
                  try {
                      const tokenURI: string = await collectionContract.tokenURI(tokenId);
                      const cachedMetadata = localStorage.getItem(tokenURI);
                      const metadata = cachedMetadata
                          ? JSON.parse(cachedMetadata)
                          : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

                      if (!cachedMetadata) {
                          localStorage.setItem(tokenURI, JSON.stringify(metadata));
                      }

                      return {
                          tokenId: tokenId.toString(),
                          image: metadata.image,
                          name: metadata.name,
                          description: metadata.description,
                          price: metadata.price || 'Non défini',
                          tags: metadata.tags || [],
                          mintContractAddress: associatedAddress,
                      };
                  } catch (error) {
                      console.error(`Erreur pour le tokenId ${tokenId}:`, error);
                      return null; // Renvoie null en cas d'erreur
                  }
              })
          )).filter((nft): nft is NFT => nft !== null); // Filtrage des null

          setNfts(nftsData);
      } catch (error) {
          console.error('Erreur lors de la récupération des NFTs :', error);
      } finally {
          setIsLoading(false);
      }
  };




  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
    setSelectedCollectionId(collectionId);
    fetchNFTs(collectionId, associatedAddress);
    setCurrentTabIndex(2);
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie</Heading>
      <Tabs index={currentTabIndex} onChange={(index) => setCurrentTabIndex(index)}>
        <TabList>
          <Tab>Collections mise en avant</Tab>
          <Tab>Collections</Tab>
          {selectedCollectionId && <Tab>{collections.find(collection => collection.id === selectedCollectionId)?.name || 'NFTs'}</Tab>}
        </TabList>

        <TabPanels>
          {/* Collections mises en avant */}
          <TabPanel>
            {isLoading ? (
              <Spinner />
            ) : (
              <Grid templateColumns={isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)"} gap={6}>
                {collections.filter((collection) => collection.isFeatured).length === 0 ? (
                  <Text>Aucune collection mise en avant trouvée.</Text>
                ) : (
                  collections
                    .filter((collection) => collection.isFeatured)
                    .map((collection) => (
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
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
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
          </TabPanel>

          {/* Collections */}
          <TabPanel>
            {isLoading ? (
              <Spinner />
            ) : (
              <Grid templateColumns={isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)"} gap={6}>
                {collections.length === 0 ? (
                  <Text>Aucune collection trouvée.</Text>
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
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
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
          </TabPanel>

          {/* NFTs */}
          {selectedCollectionId && ( // Afficher uniquement si une collection a été cliquée
            <TabPanel>
              {isLoading ? (
                <Spinner />
              ) : (
                <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6} justifyItems="center">
                  {nfts.length === 0 ? (
                    <Text>Aucun NFT trouvé.</Text>
                  ) : (
                    nfts.map((nft) => (
                      <Box
                        key={nft.tokenId}
                        onClick={() => router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)}
                        cursor="pointer"
                        width="100%"
                      >
                        <NFTCard nft={nft} />
                      </Box>
                    ))
                  )}
                </Grid>
              )}
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Box>
  );

};

export default UniqueArtGalerie;
