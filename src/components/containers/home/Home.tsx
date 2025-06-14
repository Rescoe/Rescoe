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

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;


const Home = () => {
const [isLoading, setIsLoading] = useState(false);
const router = useRouter();

interface Haiku {
  poemText: string;
  poet?: string;
}

const [haikus, setHaikus] = useState<Haiku[]>([]); // Typage de l'état


interface Nft {
  id: string;
  image: string;
  name?: string;
  artist?: string;
  content: {
    tokenId: string;
    mintContractAddress: string;
  };
}

    interface Collection {
      id: string;
      name: string;
      collectionType: string;
      artist?: string;
      imageUrl: string;
      mintContractAddress: string[];
      isFeatured: boolean;

    }

// Typage de l'état `nfts` avec `Nft[]` (un tableau d'objets de type Nft)
const [nfts, setNfts] = useState<Nft[]>([]);

const [collections, setCollections] = useState<Collection[]>([]);


const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

// Récupérer les collections
const fetchCollections = async () => {
  setIsLoading(true);
  try {
    const total = await contract.getTotalCollectionsMinted();
    const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

    type CollectionTuple = [number, string, string, string, string[], boolean, boolean];

    const collectionsData = await Promise.all(
      collectionsPaginated.map(async (tuple: CollectionTuple) => {
        const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;

        // 🔹 Vérifier si la collection est mise en avant
        if (!isFeatured) return null;

        const uri = await contract.getCollectionURI(id);
        const mintContractAddress = associatedAddresses;

        const cachedMetadata = localStorage.getItem(uri);
        if (cachedMetadata) {
          const metadata = JSON.parse(cachedMetadata);
          return {
            id: id.toString(),
            name,
            collectionType,
            imageUrl: metadata.image,
            mintContractAddress,
            isFeatured,
            creator,
          };
        }

        const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
        const metadata = await response.json();
        localStorage.setItem(uri, JSON.stringify(metadata));

        return {
          id: id.toString(),
          name,
          collectionType,
          imageUrl: metadata.image,
          mintContractAddress,
          isFeatured,
          creator,
        };
      })
    );

    // 🔹 Filtrer les valeurs nulles après l'exécution des promesses
    const filteredCollections = collectionsData.filter(
      (collection): collection is Collection => collection !== null
    );

    // 🔹 Trier les collections mises en avant (même si elles le sont déjà)
    const sortedCollections = filteredCollections.sort((a, b) => {
      return Number(b.isFeatured) - Number(a.isFeatured);
    });

    setCollections(sortedCollections); // Mise à jour de l'état avec les collections filtrées
    //console.log(collections)
  } catch (error) {;
    console.error('Error fetching collections:', error);
  } finally {
    setIsLoading(false);
  }
};



// Récupérer les poèmes (haikus)
const fetchPoems = async (collectionId: string, associatedAddress: string) => {
  setIsLoading(true);
  try {
    const collectionContract = new Contract(associatedAddress, haikuContractABI, provider);
    const uniqueTokenCount = await collectionContract.getLastUniqueHaikusMinted();  //Nombre de poemes unique dans la collection (independant du nombre d'editions)

    const tokenIds = Array.from({ length: Number(uniqueTokenCount) }, (_, i) => i + 2);

    const poemsData = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const haikuText = await collectionContract.getTokenFullDetails(tokenId);

        const creatorAddress = haikuText[7];
        //console.log(creatorAddress);

        const totalEditions = await collectionContract.getRemainingEditions(tokenId);
        //console.log(totalEditions);
        //const price = haikuText[4];

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
    //console.log(poemsData);

  } catch (error) {
    console.error('Error fetching poems:', error);
  } finally {
    setIsLoading(false);
  }
};

// Récupérer les NFTs
const fetchNFTs = async (collectionId: string, associatedAddress: string) => {
    setIsLoading(true);
    try {
        const collectionContract = new Contract(associatedAddress, nftContractABI, provider);
        console.log(collectionContract);
        /*let max = await collectionContract.getLastMintedTokenId();  //Penser a ajouter cette fonction ou un similaire


        if(max > 10){
          max = 10;
        }
        */
        const max = 10;
        const tokenIds = await collectionContract.getTokenPaginated(0, max);

        const nftsData = await Promise.all(
            tokenIds.map(async (tokenId: string) => {
                try {
                    // Essayer d'accéder à tokenURI tout en gérant l'erreur si le token a été brûlé
                    let tokenURI: string;
                    try {
                        tokenURI = await collectionContract.tokenURI(tokenId);
                    } catch (tokenError) {
                        // Si le token n'existe pas, loguer un avertissement et passer au suivant
                        console.warn(`Le token avec le tokenId ${tokenId} n'existe pas.`);
                        return null; // Retourner null pour cet NFT
                    }

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
                        artist: metadata.artist,
                    };
                } catch (error) {
                    console.error(`Erreur lors de la récupération des métadonnées pour le tokenId ${tokenId}:`, error);
                    return null; // Ignorez les tokens dont les métadonnées ne peuvent pas être récupérées
                }
            })
        );

        // Filtrer les résultats null pour éviter d'afficher les NFTs inexistants
        setNfts(nftsData.filter(nft => nft !== null));
    } catch (error) {
        console.error('Erreur lors de la récupération des NFTs :', error);
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
    const artCollections = collections.filter((collection: Collection) => collection.collectionType === 'Art');
    const poetryCollections = collections.filter((collection: Collection) => collection.collectionType === 'Poesie');

    if (artCollections.length > 0) {
      const randomArtCollection = artCollections[Math.floor(Math.random() * artCollections.length)];

      if (
        typeof randomArtCollection.id === 'string' &&
        typeof randomArtCollection.mintContractAddress === 'string' // On vérifie que c'est bien une string
      ) {
        const artCollectionId = randomArtCollection.id;
        const artCollectionMintContractAddress = randomArtCollection.mintContractAddress; // On récupère directement la string
        fetchNFTs(artCollectionId, artCollectionMintContractAddress);
      } else {
        console.error('Propriétés id et/ou mintContractAddress manquantes ou de type invalide dans l\'objet randomArtCollection');
      }
    }

    if (poetryCollections.length > 0) {
      const randomPoetryCollection = poetryCollections[Math.floor(Math.random() * poetryCollections.length)];
      if (
        typeof randomPoetryCollection.id === 'string' &&
        typeof randomPoetryCollection.mintContractAddress === 'string'
      ) {
        const poetryCollectionId = randomPoetryCollection.id;
        const poetryCollectionMintContractAddress = randomPoetryCollection.mintContractAddress;

        fetchPoems(poetryCollectionId, poetryCollectionMintContractAddress);
      } else {
        console.error('Propriétés id et/ou mintContractAddress manquantes ou de type invalide dans l\'objet randomPoetryCollection');
      }
    }
  }
}, [collections]);





// Vérifie la longueur des données pour éviter d'essayer d'afficher des éléments vides
const getRandomItems = (array: Collection[], count: number): Collection[] => {
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
          p={4}
          color="white"
          textAlign="center"
        >
          <HeroSection nfts={nfts} haikus={haikus} />

          <Box
            mt={2}
            textAlign="center"
            p={2}
            borderWidth={1}
            borderRadius="lg"
            borderColor="gray.300"
            maxWidth="100%" // Limite la largeur de la box
            mx="auto"
          >
            <Text fontSize="lg">
              Pour une meilleure expérience sur smartphone, <br /> utilisez le navigateur intégré à votre wallet
            </Text>
          </Box>

        </Box>

        <Box mt={6}>
          <Text fontSize="lg" mb={6}>
            Découvrez, soutenez, participez.
          </Text>
          <NextLink href="/adhesion" passHref>
            <Button colorScheme="pink" size="lg">Adhérez Maintenant</Button>
          </NextLink>
        </Box>

        <Heading size="xl" mb={6} mt={12}>
          Rejoignez un réseau d'art numérique et de poésie solidaire
        </Heading>

        <VStack spacing={8} mt={10} textAlign="center">
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
                <Heading as="h2" size="lg" mb={2}>Poétique et technologique</Heading>
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

          <Divider my={6} borderColor="gray.200" w="100%" mx="auto" />
          <Heading as="h2" size="lg" mb={5}>
            Quelques créations et poèmes associés aléatoirement :
          </Heading>
          <Text fontSize="md" maxW="700px" mx="auto">
            Parfois les artistes et poètes collaborent, parfois le hasard les fait se rencontrer !
          </Text>

          <DynamicCarousel nfts={nfts} haikus={haikus} />
        </VStack>
      </Box>
    );
  };


export default Home;
