import React, { useEffect, useState, useRef } from 'react';
import { Box, Heading, Text, Button, VStack, Grid, GridItem, Divider, Icon, Flex, Input, FormLabel, Select, Checkbox, useColorModeValue, SimpleGrid, Stack,Collapse, HStack, Image } from '@chakra-ui/react';
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
import { motion } from "framer-motion";


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
  mintContractAddress: string;
  uniqueIdAssociated: string;
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
        const uniqueIdAssociated = await collectionContract.tokenIdToHaikuId(tokenId);

        //console.log(uniqueIdAssociated);
        return {
          tokenId: tokenId.toString(),
          poemText: haikuText, // Ici on envoi toute les données du poemes, pas que le texte en fait
          mintContractAddress: associatedAddress,
          uniqueIdAssociated: Number(uniqueIdAssociated).toString(), // On converti le bingInt en number puis en string c'est plus simple de tput avoir en string
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
      as={motion.div}
      w="100%"
      textAlign="center"
      position="relative"
      overflow="hidden"
  >
        {/* SECTION INTRO / PRESENTATION */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <Box
            py={{ base: 12, md: 20 }}
            px={{ base: 6, md: 10 }}
            textAlign="center"
            maxW="1100px"
            mx="auto"
          >
            <Heading
              size={{ base: "xl", md: "2xl" }}
              bgGradient="linear(to-r, purple.300, pink.400)"
              bgClip="text"
              fontWeight="extrabold"
              mb={6}
            >
              RESCOE — Réseau Expérimental Solidaire de Crypto Œuvres Émergentes
            </Heading>

            <Text
              color="gray.300"
              fontSize={{ base: "md", md: "lg" }}
              maxW="800px"
              mx="auto"
              lineHeight="tall"
            >
              Une association Web3 dédiée à la création, la formation et la
              valorisation de l’art numérique et poétique. Rejoignez une nouvelle
              génération d’artistes connectés, solidaires et décentralisés.
            </Text>

            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              spacing={10}
              mt={10}
              textAlign="center"
            >
              {[
                {
                  title: "Art & Blockchain",
                  icon: "/visuels/icon-blockchain.svg",
                  desc: "Minez vos œuvres, protégez vos droits et exposez vos créations sur la blockchain.",
                },
                {
                  title: "Formation & Transmission",
                  icon: "/visuels/icon-community.svg",
                  desc: "Initiez-vous à l’art génératif et au Web3 à travers nos ateliers et résidences.",
                },
                {
                  title: "Communauté Solidaire",
                  icon: "/visuels/icon-reseau.svg",
                  desc: "Soutenez, échangez, collaborez avec d’autres artistes et poètes du réseau.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: i * 0.2 }}
                  viewport={{ once: true }}
                >
                  <VStack
                    bg="whiteAlpha.50"
                    borderRadius="2xl"
                    boxShadow="0 4px 30px rgba(0,0,0,0.2)"
                    backdropFilter="blur(6px)"
                    p={6}
                    h="100%"
                  >
                    <Image
                      src={item.icon}
                      alt={item.title}
                      boxSize="60px"
                      mb={3}
                      mx="auto"
                    />
                    <Heading
                      size="md"
                      color="purple.300"
                      fontWeight="bold"
                      mb={2}
                    >
                      {item.title}
                    </Heading>
                    <Text color="gray.400" fontSize="sm">
                      {item.desc}
                    </Text>
                  </VStack>
                </motion.div>
              ))}
            </SimpleGrid>
          </Box>
        </motion.div>

        {/* HERO SECTION */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          viewport={{ once: true }}
        >

        <Box py={{ base: 10, md: 16 }} w="100%">
        <HeroSection nfts={nfts} haikus={haikus} />
      </Box>


        </motion.div>

        {/* SECTION BENEFICES */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9 }}
          viewport={{ once: true }}
        >
          <VStack
            boxShadow="xl"
            borderRadius="2xl"
            bg="blackAlpha.600"
            p={{ base: 8, md: 12 }}
            maxW="95%"
            mx="auto"
          >
            <Heading
              size={{ base: "lg", md: "xl" }}
              bgGradient="linear(to-r, purple.400, pink.400)"
              bgClip="text"
              mb={6}
              fontWeight="extrabold"
            >
              Découvrez, soutenez, participez.
            </Heading>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Box
                    as="button"
                    onClick={() => toggle(index)}
                    role="group"
                    px={10}
                    py={8}
                    borderRadius="xl"
                    bg="whiteAlpha.50"
                    boxShadow="md"
                    cursor="pointer"
                    transition="all 0.3s ease"
                    _hover={{
                      bgGradient: "linear(to-r, purple.900, pink.800)",
                      transform: "scale(1.05)",
                    }}
                  >
                    <Stack align="center" spacing={4}>
                      <Icon
                        as={benefit.icon}
                        boxSize={12}
                        color="purple.400"
                        _groupHover={{ color: "white" }}
                      />
                      <Text
                        fontWeight="bold"
                        fontSize="xl"
                        _groupHover={{ color: "white" }}
                      >
                        {benefit.title}
                      </Text>
                      <Collapse in={openIndex === index} animateOpacity>
                        <Text mt={3} color="gray.300">
                          {benefit.description}
                        </Text>
                      </Collapse>
                    </Stack>
                  </Box>
                </motion.div>
              ))}
            </SimpleGrid>

            <Button
              mt={10}
              px={10}
              py={6}
              fontWeight="bold"
              borderRadius="full"
              bgGradient="linear(to-r, purple.700, pink.600)"
              color="white"
              boxShadow="lg"
              _hover={{ transform: "scale(1.07)" }}
              as={NextLink}
              href="/adhesion"
            >
              Adhérez Maintenant
            </Button>
          </VStack>
        </motion.div>

        {/* SECTION MISSIONS + CAROUSEL */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          <VStack spacing={8} mt={12}>
            <Heading size="xl" color="gray.100" fontWeight="extrabold">
              Rejoignez un réseau d'art numérique et de poésie solidaire
            </Heading>
            <Text
              fontSize={{ base: "sm", md: "md" }}
              maxW="800px"
              textAlign="center"
              color="gray.300"
            >
              RESCOE soutient les artistes émergents en leur offrant un accès
              privilégié à des outils numériques innovants et à des formations
              accessibles. <br />
              Explorez l’art génératif, le Web3 et l’expression poétique sous un
              nouveau jour.
            </Text>
          </VStack>

          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

          <Box w="100%" position="relative">
            <DynamicCarousel nfts={nfts} haikus={haikus} />
          </Box>

        </motion.div>
      </Box>
    );
};

export default Home;
