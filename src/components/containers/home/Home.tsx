import React, { useEffect, useState, useRef } from 'react';
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
      mintContractAddress: string;
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


// Charger uniquement les collections FEATURED
const fetchCollections = async () => {
  setIsLoading(true);
  try {
    const total = await contract.getTotalCollectionsMinted();
    const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

    type CollectionTuple = [number, string, string, string, string[], boolean, boolean];

    const collectionsData = await Promise.all(
      collectionsPaginated.map(async (tuple: CollectionTuple | null) => {
        // ⚠️ Skip si le tuple est null/undefined
        if (!tuple) return null;

        const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;

        // ⚠️ Skip si pas featured
        if (!isFeatured) return null;

        const uri = await contract.getCollectionURI(id);
        const mintContractAddress = associatedAddresses;

        let metadata;
        const cachedMetadata = localStorage.getItem(uri);

        if (cachedMetadata) {
          metadata = JSON.parse(cachedMetadata);
        } else {
          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          metadata = await response.json();
          localStorage.setItem(uri, JSON.stringify(metadata));
        }

        return {
          id: id.toString(),
          name,
          collectionType,
          imageUrl: metadata?.image || "",
          mintContractAddress,
          isFeatured,
          creator,
        };
      })
    );

    // ⚠️ On ne garde que les objets valides
    const featured = collectionsData.filter((col): col is Collection => col !== null);

    ////console.log("Collections FEATURED :", featured);
    setCollections(featured);
  } catch (error) {
    console.error("Erreur lors du chargement des collections featured :", error);
  } finally {
    setIsLoading(false);
  }
};


// Récupérer les poèmes (haikus)
const fetchPoems = async (collectionId: string, associatedAddress: string): Promise<void> => {
  setIsLoading(true);
  try {
    const collectionContract = new Contract(associatedAddress, haikuContractABI, provider);
    const uniqueTokenCount = await collectionContract.getLastUniqueHaikusMinted();  //Nombre de poemes unique dans la collection (independant du nombre d'editions)

    const tokenIds = Array.from({ length: Number(uniqueTokenCount) }, (_, i) => i + 2);

    const poemsData = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const haikuText = await collectionContract.getTokenFullDetails(tokenId);


        const poemText = haikuText[6];
        //console.log(poemText);
        const totalEditions = await collectionContract.getRemainingEditions(tokenId);
        //console.log(totalEditions);
        //const price = haikuText[4];

        return {
          tokenId: tokenId.toString(),
          poemText: haikuText, // Ici on envoi toute les données du poemes, pas que le texte en fait
          /*}
          creatorAddress: creatorAddress,

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

const fetchNFTs = async (collectionId: string, associatedAddress: string): Promise<void> => {
  setIsLoading(true);

  try {
    const collectionContract = new Contract(associatedAddress, nftContractABI, provider);

    // Récupère le max et limite à 10
    let max = await collectionContract.getLastMintedTokenId();
    if (max > 9) max = 9;
    const pagination = Number(max) + 1;
    const tokenIds = await collectionContract.getTokenPaginated(0, pagination);
    //console.log("Token IDs récupérés:", tokenIds);

    const nftsData = await Promise.all(
      tokenIds.map(async (tokenId: string) => {
        try {
          // 🔍 Vérifie si le token est encore vivant
          const owner = await collectionContract.ownerOf(tokenId).catch(() => null);
          if (!owner || owner === "0x0000000000000000000000000000000000000000") {
            //console.log(`⛔ Token ${tokenId} est burn → skip`);
            return null;
          }

          // Si le token existe encore → on récupère son URI
          let tokenURI = await collectionContract.tokenURI(tokenId);
          //console.log(`Récupération du tokenURI pour ${tokenId}: ${tokenURI}`);

          // Gestion du cache local
          const cachedMetadata = localStorage.getItem(tokenURI);
          const metadata = cachedMetadata
            ? JSON.parse(cachedMetadata)
            : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

          // Retourne un objet NFT normalisé
          return {
            tokenId: tokenId.toString(),
            image: metadata.image,
            name: metadata.name,
            description: metadata.description,
            price: metadata.price || 'Non défini',
            tags: metadata.tags || [],
            mintContractAddress: associatedAddress,
            artist: metadata.artist || "Inconnu",
          };
        } catch (error) {
          console.warn(`⚠️ Erreur pour le tokenId ${tokenId}:`);
          return null;
        }
      })
    );

    setNfts(nftsData.filter(nft => nft !== null));
  } catch (error) {
    console.error('Erreur lors de la récupération des NFTs:', error);
  } finally {
    setIsLoading(false);
  }
};


//Use effetc appelé deux fois, probleme récurrent. On Evite les doublons ici :
const hasFetched = useRef(false);
useEffect(() => {
  if (!hasFetched.current) {
    fetchCollections();
    hasFetched.current = true;
  }
}, []);


// Fonction pour obtenir des éléments aléatoires
const getRandomItems = <T,>(array: T[], count: number): T[] => {
  return array.length > 0
    ? array.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, array.length))
    : [];
};


const fetchedCollections = useRef(new Set()); // Utilisation de useRef pour garder les collections déjà récupérées

const fetchAllNFTsAndPoems = async () => {
  const artCollections = collections.filter(col => col.collectionType === 'Art');
  const poetryCollections = collections.filter(col => col.collectionType === 'Poesie');

  // Récupérez 5 collections randomisées pour art et poésie
  const randomArtCollections = getRandomItems(artCollections, 5);
  const randomPoetryCollections = getRandomItems(poetryCollections, 5);

  //console.log("Collections d'art sélectionnées :", randomArtCollections.map(c => c.id));
  //console.log("Collections de poésie sélectionnées :", randomPoetryCollections.map(c => c.id));

  // Récupérer les NFTs pour les collections d'art
  for (const collection of randomArtCollections) {
    if (collection && !fetchedCollections.current.has(collection.id)) {
      //console.log(`Récupération des NFTs pour la collection d'art ${collection.id}...`);
      const nftsBefore = nfts.length;
      await fetchNFTs(collection.id, collection.mintContractAddress);
      const nftsAfter = nfts.length;
      //console.log(`Collection ${collection.id} récupérée : ${nftsAfter - nftsBefore} NFTs ajoutés`);
      fetchedCollections.current.add(collection.id); // Marquez comme récupérée
    }
  }

  // Récupérer les poèmes pour les collections de poésie
  for (const collection of randomPoetryCollections) {
    if (collection && !fetchedCollections.current.has(collection.id)) {
      //console.log(`Récupération des poèmes pour la collection ${collection.id}...`);
      const poemsBefore = haikus.length; // si tu as un state "poems"
      await fetchPoems(collection.id, collection.mintContractAddress);
      const poemsAfter = haikus.length;
      //console.log(`Collection ${collection.id} récupérée : ${poemsAfter - poemsBefore} poèmes ajoutés`);
      fetchedCollections.current.add(collection.id); // Marquez comme récupérée
    }
  }

  //console.log("Récupération terminée. NFTs totaux :", nfts.length);
  //console.log("Poèmes totaux :", haikus.length);
};

// Appel de la fonction dans useEffect
useEffect(() => {
  if (collections.length > 0) {
    fetchAllNFTsAndPoems();
  }
}, [collections]);


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
