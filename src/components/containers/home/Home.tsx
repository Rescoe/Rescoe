import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, Button, VStack, Grid, GridItem, Divider, Icon, Flex, Input, FormLabel, Select, Checkbox, useColorModeValue, SimpleGrid, Stack,Collapse, HStack } from '@chakra-ui/react';
import { FaBookOpen, FaUsers, FaLightbulb, FaHandsHelping, FaPaintBrush, FaGraduationCap, FaHandshake   } from 'react-icons/fa';
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

const benefits = [
  {
    icon: FaPaintBrush,
    title: "Crée des collections",
    description: "Expose tes œuvres ou poèmes dans des collections décentralisées.",
  },
  {
    icon: FaGraduationCap,
    title: "Formations & ateliers",
    description: "Apprends à créer dans le Web3 avec nos ateliers artistiques ouverts.",
  },
  {
    icon: FaUsers,
    title: "Réseau phygital",
    description: "Rejoins une communauté locale entre numérique et physique.",
  },
  {
    icon: FaHandshake,
    title: "Démarche solidaire",
    description: "Participe à un projet associatif engagé et expérimental.",
  },
];

const Home = () => {
const [isLoading, setIsLoading] = useState(false);
const router = useRouter();

const accentGradient = "linear(to-r, purple.500, pink.400)";
const bgCard = useColorModeValue("white", "gray.800");
const colorCard = useColorModeValue("gray.800", "white");

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
const [openIndex, setOpenIndex] = useState<number | null>(null);

function toggle(index: number) {
  setOpenIndex(openIndex === index ? null : index);
}




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


      <Box
    mt={5}
    textAlign="center"
    w="100vw"
    maxW="100%"
  >

        <Heading
          size={{ base: "lg", md: "xl" }}
          bgGradient="linear(to-r, purple.400, pink.400)"
          bgClip="text"
          mb={{ base: 4, md: 6 }}
          fontWeight="extrabold"
          letterSpacing="wide"
          transition="transform 0.3s ease"
          _hover={{ transform: "scale(1.05)" }}
          tabIndex={0}
        >
          Bienvenue sur le premier réseau solidaire expérimental <br /> d'art digital en France
        </Heading>

        <Box
        py={{ base: 8, md: 12 }}
        mt={{ base: 6, md: 10 }}
        px={{ base: 4, md: 8 }}
        maxW="1200px"
        w="100%"
        mx="auto"
        >

          <HeroSection nfts={nfts} haikus={haikus} />

          <Box
          mt={5}
          maxW="1200px"
          w="100%"
          px={4}
          mx="auto"

          >
            <Text fontSize={{ base: "md", md: "lg" }} color="gray.300">
              Pour une meilleure expérience sur smartphone, <br /> utilisez le navigateur intégré à votre wallet
            </Text>
          </Box>
        </Box>

        <VStack
        boxShadow="dark-lg"
        borderWidth={1}
        borderRadius="lg"
        border="1px solid"
        borderColor="purple.300"
        maxWidth="95%" // Limite la largeur de la box
        mx="auto"
        >

        <Box mt={8}>

        <Heading
          size={{ base: "lg", md: "xl" }}
          bgGradient="linear(to-r, purple.400, pink.400)"
          bgClip="text"
          mb={{ base: 4, md: 6 }}
          fontWeight="extrabold"
          letterSpacing="wide"
          transition="transform 0.3s ease"
          _hover={{ transform: "scale(1.05)" }}
          tabIndex={0}
        >
        Découvrez, soutenez, participez.
        </Heading>



          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={12} mb={12}>
            {benefits.map((benefit, index) => (
              <Box
                key={index}
                as="button"
                onClick={() => toggle(index)}
                role="group"
                px={{ base: 8, md: 10 }}
                py={{ base: 6, md: 8 }}
                borderRadius="lg"
                bg="dark-lg"
                boxShadow="md"
                cursor="pointer"
                transition="all 0.3s ease"
                _hover={{
                  bgGradient: "linear(to-r, purple.900, pink.800)",
                  color: "white",
                  boxShadow: "xl",
                  transform: "scale(1.05)",
                }}
                _focus={{
                  boxShadow: "outline",
                }}
                aria-label={`Avantage: ${benefit.title}`}
                tabIndex={0}
              >
                <Stack align="center" spacing={4}>
                  <Icon
                    as={benefit.icon}
                    boxSize={12}
                    color="purple.600"
                    _groupHover={{ color: "white" }}
                    transition="color 0.3s ease"
                  />
                  <Text
                    fontWeight="bold"
                    fontSize={{ base: "lg", md: "xl" }}
                    _groupHover={{ color: "white" }}
                    transition="color 0.3s ease"
                    textAlign="center"
                  >
                    {benefit.title}
                  </Text>
                  <Collapse in={openIndex === index} animateOpacity>
                    <Text
                      mt={4}
                      fontSize="md"
                      color={openIndex === index ? "whiteAlpha.900" : "gray.600"}
                      maxW="320px"
                      mx="auto"
                    >
                      {benefit.description}
                    </Text>
                  </Collapse>
                </Stack>
              </Box>
            ))}
          </SimpleGrid>

          <Flex justify="center" mt={8}>
            <NextLink href="/adhesion" passHref>
              <Button
                as="a"
                px={{ base: 8, md: 10 }}
                py={{ base: 5, md: 6 }}
                fontSize={{ base: "md", md: "lg" }}
                fontWeight="bold"
                borderRadius="full"
                bgGradient="linear(to-r, purple.700, pink.600)"
                color="white"
                boxShadow="lg"
                _hover={{
                  transform: "scale(1.07)",
                  boxShadow: "2xl",
                }}
                _active={{
                  transform: "scale(0.97)",
                }}
                transition="all 0.25s ease"
                aria-label="Bouton adhésion"
              >
                Adhérez Maintenant
              </Button>
            </NextLink>
          </Flex>
        </Box>

        <Heading
          size={{ base: "lg", md: "xl" }}
          mb={6}
          mt={12}
          color="gray.100"
          fontWeight="extrabold"
        >
          Rejoignez un réseau d'art numérique et de poésie solidaire
        </Heading>


          <Heading
            as="h2"
            size={{ base: "md", md: "lg" }}
            mb={5}
            color="purple.300"
            fontWeight="semibold"
            letterSpacing="wider"
          >
            Nos missions :
          </Heading>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            maxW="700px"
            mx="auto"
            color="gray.300"
            lineHeight="tall"
          >
            RESCOE soutient les artistes émergents en leur offrant un accès privilégié à des outils numériques innovants, permettant de développer leur art à travers l'art génératif, la blockchain et l'art digital. <br /> Notre mission est de favoriser l'émergence de ce nouveau courant artistique en organisant des ateliers d'initiation au crypto-art, où chacun peut créer et minter ses premières œuvres sur notre plateforme décentralisée, tout en assurant la vente et la protection de ses droits.
          </Text>

          <Divider my={6} borderColor="purple.700" w="80%" mx="auto" />

          <Grid
          py={{ base: 8, md: 12 }}
          px={{ base: 4, md: 8 }}
            templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
            gap={6}
            w="100%"
            role="list"
            aria-label="Liste des missions"
          >
            {[
              {
                icon: FaLightbulb,
                title: "Un réseau solidaire",
                description:
                  "Faites partie d'un réseau unique, dédié à la création d'oeuvres digitales et à l'intégration de la blockchain dans l'art'.",
              },
              {
                icon: FaHandsHelping,
                title: "Engagé pour l'art",
                description:
                  "Vous soutenez directement des artistes émergents et contribuez à un projet artistique innovant.",
              },
              {
                icon: FaBookOpen,
                title: "Poétique et technologique",
                description:
                  "Créez, vendez et protégez vos droits, tout en explorant les potentialités des technologies numériques.",
              },
            ].map(({ icon, title, description }) => (
              <GridItem
                key={title}
                role="listitem"
                aria-label={title}
                tabIndex={0}
              >
                <Box
                  textAlign="center"
                  p={6}
                  bg="blackAlpha.400"
                  borderRadius="lg"
                  boxShadow="md"
                  transition="transform 0.3s ease, box-shadow 0.3s ease"
                  _hover={{ transform: "scale(1.05)", boxShadow: "xl" }}
                  cursor="pointer"
                >
                  <Icon as={icon} boxSize={12} mb={4} color="purple.400" />
                  <Heading
                    as="h3"
                    size="md"
                    mb={3}
                    color="purple.300"
                    fontWeight="semibold"
                  >
                    {title}
                  </Heading>
                  <Text fontSize="md" color="gray.300" lineHeight="tall">
                    {description}
                  </Text>
                </Box>
              </GridItem>
            ))}
          </Grid>

          </VStack>

          <Divider my={6} borderColor="purple.700" w="80%" mx="auto" />

          <VStack>


          <Box mt={8} maxW="600px" mx="auto" px={4}>
      <VStack
        spacing={6}
        wrap={{ base: "wrap", md: "nowrap" }}
        justify="center"
      >
        <NextLink href="/collections" passHref>
          <Button
            as="a"
            flex="1 1 180px"
            py={5}
            fontSize="md"
            fontWeight="semibold"
            borderRadius="full"
            bgGradient="linear(to-r, purple.700, pink.600)"
            color="white"
            boxShadow="0 4px 12px rgba(127, 86, 217, 0.4)"

            _hover={{
              bg: "white",
              color: "purple.700",
              boxShadow: "0 6px 16px rgba(127, 86, 217, 0.6)",
              transform: "scale(1.05)",
            }}
            _active={{ transform: "scale(0.97)" }}
            aria-label="Découvrez nos collections d'art"
          >
            Collections d'art
          </Button>
        </NextLink>

        <NextLink href="/ateliers" passHref>
          <Button
            as="a"
            flex="1 1 180px"
            py={5}
            fontSize="md"
            fontWeight="semibold"
            borderRadius="full"
            bgGradient="linear(to-r, purple.700, pink.600)"
            color="white"
            boxShadow="0 4px 12px rgba(127, 86, 217, 0.4)"

            _hover={{
              bg: "white",
              color: "pink.600",

              boxShadow: "0 6px 16px rgba(219, 39, 119, 0.6)",
              transform: "scale(1.05)",
            }}
            _active={{ transform: "scale(0.97)" }}
            aria-label="Rejoignez nos ateliers"
          >
            Ateliers Web3
          </Button>
        </NextLink>

        <NextLink href="/evenements" passHref>
          <Button
            as="a"
            flex="1 1 180px"
            py={5}
            fontSize="md"
            fontWeight="semibold"
            borderRadius="full"
            bgGradient="linear(to-r, purple.700, pink.600)"
            color="white"
            transition="all 0.3s ease"
            boxShadow="0 4px 12px rgba(127, 86, 217, 0.4)"

            _hover={{
              bg: "white",
              color: "red.500",

              boxShadow: "0 6px 16px rgba(225, 29, 72, 0.6)",
              transform: "scale(1.05)",
            }}
            _active={{ transform: "scale(0.97)" }}
            aria-label="Participez à nos événements"
          >
            Événements
          </Button>
        </NextLink>
      </VStack>
    </Box>

          <Divider my={6} borderColor="purple.700" w="100%" mx="auto" />

          <Heading
            as="h2"
            size="lg"
            mb={5}
            color="purple.300"
            fontWeight="semibold"
          >
            Quelques créations et poèmes associés aléatoirement :
          </Heading>
          <DynamicCarousel nfts={nfts} haikus={haikus} />
        </VStack>
      </Box>
    );

  };



export default Home;
