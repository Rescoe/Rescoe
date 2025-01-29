import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, Grid, GridItem, VStack, Icon, Button, Divider } from '@chakra-ui/react';
import { FaBookOpen, FaUsers, FaLightbulb, FaHandsHelping  } from 'react-icons/fa';
//import useCheckMembership from '../../../utils/useCheckMembership';
import NextLink from 'next/link';
import { JsonRpcProvider, ethers, Contract } from 'ethers';
import haikuContractABI from '../../ABI/HaikuEditions.json';
import nftContractABI from '../../ABI/ABI_ART.json';
import DynamicCarousel from '../../../utils/DynamicCarousel'; // Assurez-vous d'importer le bon chemin
import HeroSection from '../../../utils/HeroSection'; // Assurez-vous d'importer le bon chemin
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import { useRouter } from 'next/router';

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;


const Home = () => {
  const [collections, setCollections] = useState([]);
const [nfts, setNfts] = useState([]);
const [haikus, setHaikus] = useState([]); // Changer 'poems' en 'haikus'
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

// Récupérer les poèmes (haikus)
const fetchPoems = async (collectionId, associatedAddress) => {
  setIsLoading(true);
  try {
    const collectionContract = new Contract(associatedAddress, haikuContractABI, provider);
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
          /*}
          creatorAddress,
          totalEditions: totalEditions.toString(),
          mintContractAddress: associatedAddress,
          price: price.toString(),
          */
        };
      })
    );

    setHaikus(poemsData);
  } catch (error) {
    console.error('Error fetching poems:' );
  } finally {
    setIsLoading(false);
  }
};

// Récupérer les NFTs
const fetchNFTs = async (collectionId, associatedAddress) => {
  setIsLoading(true);
  try {
    const collectionContract = new Contract(associatedAddress, nftContractABI, provider);
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

    const maxBoxHeight = "150px"; // Hauteur max pour toutes les boîtes

    return (

      <Box p={5} textAlign="center">
      {/* Ajout de marge entre le HeroSection et le titre */}


      <Heading as="h1" size="xl" mb={5}>
Bienvenue sur le premier réseau solidaire expérimental <br /> d'art digital en France
</Heading>


        <Box
          bgSize="cover"
          bgPosition="center"
          py={10}
          mt={10}
          textAlign="center"
          p={4}
          color="white"
          textAlign="center"
        >
          {/*<HeroSection nfts={nfts} haikus={haikus} />*/}
        </Box>

        <Box mt={6}>
        <Text fontSize="lg" mb={6}>
          Découvrez, soutenez, participez.
        </Text>
        <NextLink href="/adhesion" passHref>
          <Button colorScheme="pink" size="lg">Adhérez Maintenant</Button>
        </NextLink>
        </Box>

        <Heading size="xl" mb={6}  mt={12}>  {/* Augmentation de mb={6} pour plus d'espace */}
          Rejoignez un réseau d'art numérique et de poésie solidaire
        </Heading>

<VStack spacing={8} mt={10} textAlign="center" >
<Heading as="h2" size="lg" mb={5}>
  Nos missions :
</Heading>
<Text fontSize="md" maxW="700px" mx="auto">
RESCOE soutient les artistes émergents en leur offrant un accès privilégié à des outils numériques innovants, leur permettant de développer leur art à travers l'art génératif, la blockchain et l'art digital. <br /> Notre mission est de favoriser l'émergence de ce nouveau courant artistique en organisant des ateliers d'initiation au crypto-art, où chacun peut créer et minter ses premières œuvres sur notre plateforme décentralisée, tout en assurant la vente et la protection de ses droits.
</Text>

<Divider my={6} borderColor="gray.200" w="80%" mx="auto" />

<Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
  <GridItem>
    <Box textAlign="center">
      <Icon as={FaLightbulb} boxSize={8} mb={3} />
      <Heading as="h2" size="lg" mb={2}>Un réseau solidaire</Heading>
      <Text fontSize="md">
        Faites partie d'un réseau unique, dédié à la promotion de l'art digital et à l'intégration de la blockchain dans les pratiques artistiques, tout en soutenant l'accès aux outils numériques pour les artistes.
      </Text>
    </Box>
  </GridItem>
  <GridItem>
    <Box textAlign="center">
      <Icon as={FaHandsHelping} boxSize={8} mb={3} />
      <Heading as="h2" size="lg" mb={2}>Engagé pour l'art</Heading>
      <Text fontSize="md">
        En rejoignant RESCOE, vous soutenez directement des artistes émergents et contribuez à un projet artistique innovant visant à dynamiser la scène artistique française.
      </Text>
    </Box>
  </GridItem>
  <GridItem>
    <Box textAlign="center">
      <Icon as={FaBookOpen} boxSize={8} mb={3} />
      <Heading as="h2" size="lg" mb={2}>La poésie et la technologie</Heading>
      <Text fontSize="md">
        RESCOE permet aux artistes et poètes de créer, vendre et protéger leurs droits, en garantissant l'authenticité de leur propriété intellectuelle via la blockchain, tout en explorant les potentialités des technologies et du numérique dans l'art et la poésie.
      </Text>
    </Box>
  </GridItem>
  </Grid>

  <Divider my={6} borderColor="gray.200" w="80%" mx="auto" />

  <Button
      colorScheme="teal"
      size="lg"
      mt={6}
      as="a"
      href="/association/rescoe"
      _hover={{ textDecoration: 'none' }}
  >
      En savoir plus sur l'association
  </Button>

  <Divider my={6} borderColor="gray.200" w="80%" mx="auto" />
  <Heading as="h2" size="lg" mb={5}>
    Quelques créations et poèmes associés aléatoirement :
  </Heading>
  <Text fontSize="md" maxW="700px" mx="auto">
Parfois les artistes et poètes collaborent, parfois le hasard les fait se rencontrer ! </Text>

                <DynamicCarousel nfts={nfts} haikus={haikus} />

            </VStack>


        </Box>
    );
};

export default Home;
