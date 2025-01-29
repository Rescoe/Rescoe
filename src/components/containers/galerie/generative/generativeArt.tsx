import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Text, Image } from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import { useRouter } from 'next/router';
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';
import ABI from '../../../ABI/HaikuEditions.json';

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

const RandomGallery = () => {
  const [collections, setCollections] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [poems, setPoems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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

          const mintContractAddress = associatedAddresses;

          const cachedMetadata = localStorage.getItem(uri);


          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          const metadata = await response.json();

          localStorage.setItem(uri, JSON.stringify(metadata));
          return {
            id: id.toString(),
            name: name,
            collectionType,
            imageUrl: metadata.image,
            mintContractAddress,
            isFeatured,
          };
        })
      );

      const sortedCollections = collectionsData.sort((a, b) => b.isFeatured - a.isFeatured);
      setCollections(sortedCollections);
    } catch (error) {
      console.error('Error fetching collections:' );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPoems = async (collectionId, associatedAddress) => {
    setIsLoading(true);
    try {
      const collectionContract = new Contract(associatedAddress, ABI, provider);
      const uniqueTokenCount = await collectionContract.getUniqueNFTCount();

      const tokenIds = Array.from({ length: Number(uniqueTokenCount) }, (_, i) => i + 1);

      const poemsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const haikuText = await collectionContract.getHaiku(tokenId);

          const creatorAddress = await collectionContract.getCreator(tokenId);

          const totalEditions = await collectionContract.getTotalSupply(tokenId);

          const price = await collectionContract.getSalePrice(tokenId);

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
      console.error('Error fetching poems:' );
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
          const metadata = cachedMetadata ? JSON.parse(cachedMetadata) : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

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
        })
      );
      setNfts(nftsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des NFTs :' );
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les collections et les NFTs / Poèmes
  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (collections.length > 0) {
      const artCollections = collections.filter((collection) => collection.collectionType === 'Art');
      const poetryCollections = collections.filter((collection) => collection.collectionType === 'Poesie');

      if (artCollections.length > 0) {
        const randomArtCollection = artCollections[Math.floor(Math.random() * artCollections.length)];
        fetchNFTs(randomArtCollection.id, randomArtCollection.mintContractAddress);
      }

      if (poetryCollections.length > 0) {
        const randomPoetryCollection = poetryCollections[Math.floor(Math.random() * poetryCollections.length)];
        fetchPoems(randomPoetryCollection.id, randomPoetryCollection.mintContractAddress);
      }
    }
  }, [collections]);

  // Vérifie la longueur des données pour éviter d'essayer d'afficher des éléments vides
  const getRandomItems = (array, count) => {
    return array.length > 0 ? array.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, array.length)) : [];
  };

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie Aléatoire</Heading>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Heading size="md" mb={4}>Œuvres d'art</Heading>
          <Grid templateColumns="repeat(3, 1fr)" gap={6}>
            {getRandomItems(nfts, 5).map((nft) => (
              <Box key={nft.tokenId} cursor="pointer" onClick={() => router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)}>
                <Image src={nft.image} alt={nft.name} />
                <Text>{nft.name}</Text>
                <Text>{nft.description}</Text>
                <Text>{nft.price} ETH</Text>
              </Box>
            ))}
          </Grid>

          <Heading size="md" mb={4} mt={6}>Poèmes</Heading>
          <Grid templateColumns="repeat(3, 1fr)" gap={6}>
            {getRandomItems(poems, 5).map((poem) => (
              <Box key={poem.tokenId} cursor="pointer" onClick={() => router.push(`/poemeId/${poem.mintContractAddress}/${poem.tokenId}`)}>
                <Text>{poem.poemText}</Text>
                <Text>Créé par: {poem.creatorAddress}</Text>
                <Text>Prix: {poem.price} ETH</Text>
              </Box>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default RandomGallery;
