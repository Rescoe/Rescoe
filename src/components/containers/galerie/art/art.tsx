import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import { useRouter } from 'next/router';
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';

import NFTCard from '../NFTCard';

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

const Gallery = () => {
  const [collections, setCollections] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const router = useRouter();

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  // Récupérer les collections
  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const total = await contract.getTotalCollectionsMinted();
      const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

      const collectionsData = await Promise.all(
        collectionsPaginated.map(async (tuple) => {
          const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;
          const uri = await contract.getCollectionURI(id);

          // Nouvelle étape pour récupérer l'adresse du contrat de mint
          const mintContractAddress = associatedAddresses;

          const cachedMetadata = localStorage.getItem(uri);
          if (cachedMetadata) {
            const metadata = JSON.parse(cachedMetadata);
            return {
              id: id.toString(),
              name: name,
              imageUrl: metadata.image,
              mintContractAddress, // Ajoute l'adresse du contrat de mint
              isFeatured, // Ajoute isFeatured
            };
          }

          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          const metadata = await response.json();
          localStorage.setItem(uri, JSON.stringify(metadata));
          return {
            id: id.toString(),
            name: name,
            imageUrl: metadata.image,
            mintContractAddress, // Ajoute l'adresse du contrat de mint
            isFeatured, // Ajoute isFeatured
          };
        })
      );

      // Trier les collections : les "featured" en premier
      const sortedCollections = collectionsData.sort((a, b) => b.isFeatured - a.isFeatured);

      setCollections(sortedCollections);
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :' );
    } finally {
      setIsLoading(false);
    }
  };



  const fetchNFTs = async (collectionId, associatedAddress) => {
    setIsLoading(true);
    try {
      const collectionContract = new Contract(associatedAddress, ABI_MINT_CONTRACT, provider);
      const tokenIds = await collectionContract.getTokenPaginated(0, 10);

      const nftsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const tokenURI = await collectionContract.tokenURI(tokenId);

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
            mintContractAddress: associatedAddress, // Ajout de l'adresse du contrat
          };
        })
      );

      setNfts(nftsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des NFTs :' );
      alert('Une erreur est survenue lors de la récupération des NFTs.');
    } finally {
      setIsLoading(false);
    }
  };


  // Gestion de clic sur une collection
  const handleCollectionClick = (collectionId, associatedAddress) => {
    setSelectedCollectionId(collectionId);

    fetchNFTs(collectionId, associatedAddress);
    setCurrentTabIndex(2); // Change l'onglet pour afficher les NFTs
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
          <Tab>NFTs</Tab>
        </TabList>

        <TabPanels>
          {/* Collections featured */}
          <TabPanel>
  {isLoading ? (
    <Spinner />
  ) : (
    <Grid templateColumns="repeat(3, 1fr)" gap={6}>
      {collections.filter((collection) => collection.isFeatured).length === 0 ? ( // Filtrer les collections "isFeatured"
        <Text>Aucune collection mise en avant trouvée.</Text>
      ) : (
        collections
          .filter((collection) => collection.isFeatured) // Filtrer les collections "isFeatured"
          .map((collection) => (
            <Box
              key={collection.id}
              borderWidth="1px"
              borderRadius="lg"
              p={4}
              cursor="pointer"
              onClick={() =>
                handleCollectionClick(collection.id, collection.mintContractAddress) // Passe l'adresse du contrat de mint
              }
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
              <Grid templateColumns="repeat(3, 1fr)" gap={6}>
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
                      onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}  // Passe l'adresse du contrat de mint
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
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Gallery;
