import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { JsonRpcProvider, Contract, ethers } from 'ethers';
import { useRouter } from 'next/router';
import { useMediaQuery } from '@chakra-ui/react';
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_GENERATIVE_ART.json';
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
  owner: string;
  name: string;
  description: string;
  price: number | null;
  tags: string[];
  mintContractAddress: string;
  tokenURI: string;
}

const UniqueGenerativeArtGallery: React.FC = () => {
  const [isMobile] = useMediaQuery('(max-width: 768px)');
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

      const collectionsData = (await Promise.all(
        collectionsPaginated.map(async (tuple: any) => {
          const [id, name, collectionType, , associatedAddresses, , isFeatured] = tuple;

          if (collectionType !== "Generative") return null;

          try {
            const collectionContract = new ethers.Contract(
              associatedAddresses,
              ["function getCID() view returns (string)"],
              provider
            );

            const cid = await collectionContract.getCID();
            const imageUrl = `https://ipfs.io/ipfs/${cid}`;

            return {
              id: id.toString(),
              name,
              imageUrl,
              mintContractAddress: associatedAddresses,
              isFeatured,
            };
          } catch (error) {
            console.error(`Erreur lors de la récupération du CID pour la collection ${id}:`, error);
            return null;
          }
        })
      )).filter((collection): collection is Collection => collection !== null);

      setCollections(collectionsData.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
    } catch (error) {
      console.error("Erreur lors de la récupération des collections :", error);
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
            const fullDetails = await collectionContract.getFullDetails(tokenId);
            const [owner, mintDate, currentPrice, forSale, priceHistory, collectionId, tokenURI] = fullDetails;

            const cachedMetadata = localStorage.getItem(tokenURI);
            const metadata = cachedMetadata
              ? JSON.parse(cachedMetadata)
              : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

            if (!cachedMetadata) {
              localStorage.setItem(tokenURI, JSON.stringify(metadata));
            }

            return {
              tokenId: tokenId.toString(),
              owner: metadata.owner || owner,
              name: metadata.name,
              description: metadata.description,
              price: metadata.price || null,
              tags: metadata.tags || [],
              mintContractAddress: associatedAddress,
              tokenURI: tokenURI,
            };
          } catch (error) {
            console.error(`Erreur pour le tokenId ${tokenId}:`, error);
            return null;
          }
        })
      )).filter((nft): nft is NFT => nft !== null);

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
      <Heading mb={4}>Galerie d'Art Génératif</Heading>
      <Tabs index={currentTabIndex} onChange={(index) => setCurrentTabIndex(index)}>
        <TabList>
          <Tab>Collections mises en avant</Tab>
          <Tab>Collections</Tab>
          {selectedCollectionId && <Tab>{collections.find(collection => collection.id === selectedCollectionId)?.name || 'NFTs'}</Tab>}
        </TabList>

        <TabPanels>
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
                            <iframe
                              src={collection.imageUrl}
                              width="100%"
                              height="100%"
                              style={{ border: "none" }}
                              sandbox="allow-scripts"
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
                          <iframe
                            src={collection.imageUrl}
                            width="100%"
                            height="100%"
                            style={{ border: "none" }}
                            sandbox="allow-scripts"
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

          {selectedCollectionId && (
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
                        borderWidth="1px"
                        borderRadius="lg"
                        p={4}
                        cursor="pointer"
                        onClick={() => router.push(`/generativeId/${nft.mintContractAddress}/${nft.tokenId}`)}
                      >
                        {nft.tokenURI ? (
                          <Box width="100%" height="300px" overflow="hidden" borderRadius="md">
                            <iframe
                              src={nft.tokenURI}
                              width="100%"
                              height="100%"
                              style={{ border: "none", backgroundColor: "#f9f9f9" }}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          </Box>
                        ) : (
                          <Text>Pas d'aperçu disponible</Text>
                        )}
                        <Text>Token ID: {nft.tokenId}</Text>
                        <Text>Owner: {nft.owner}</Text>
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

export default UniqueGenerativeArtGallery;
