import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Box, Heading, Text, Button, VStack, Grid, GridItem, Divider, Icon, Flex, Input, FormLabel, Select, Checkbox, useColorModeValue, SimpleGrid, Stack,Collapse, HStack, Image, useTheme } from '@chakra-ui/react';
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
import { keyframes } from "@emotion/react";
import { brandHover, hoverStyles } from "@styles/theme"; //Style


import RelatedFull from '../../../utils/RelatedFull'; // Assurez-vous d'importer le bon chemin
import DerniersAdherents from '../association/Adherents/DerniersAdherents'; // Votre ABI de contrat ici.
import FeaturedMembers from '../association/Adherents/FeaturedMembers'; // Votre ABI de contrat ici.
import AteliersCalendarView from '../association/Formations/AteliersCalendarView'; // Votre ABI de contrat ici.
import ChannelPreview from '../../../utils/channels/ChannelPreview'; // Assurez-vous d'importer le bon chemin

const MotionBox = motion(Box);


// Animation pulsante pour le bouton "Adhérez"
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.6); }
  70% { box-shadow: 0 0 0 15px rgba(236, 72, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
`;



const featuredAddresses = [
    "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879",
    // Ajoutez d'autres adresses ici
];

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

const benefits = [
  {
    icon: FaPaintBrush,
    title: "Crée des collections",
    description: "Expose tes œuvres ou poèmes dans des espaces décentralisés, vivants et partagés.",
  },
  {
    icon: FaGraduationCap,
    title: "Formations & ateliers",
    description: "Des ateliers ouverts où la technique devient langage, et la création devient expérience.",
  },
  {
    icon: FaUsers,
    title: "Réseau phygital",
    description: "Entre réel et numérique, rejoins une communauté d’artistes, poètes et développeurs. Des rencontres, des expositions, des collaborations — au rythme de chacun.",
  },
  {
    icon: FaHandshake,
    title: "Démarche solidaire",
    description: "RESCOE est une association expérimentale et ouverte. Chaque adhésion soutient la transmission, la recherche et l’accès libre aux outils créatifs.",
  },
];

const Home = () => {
const [isLoading, setIsLoading] = useState(false);
const router = useRouter();
const theme = useTheme();

const boxShadowHover = useColorModeValue(
"0 0 15px rgba(180, 166, 213, 0.25)", // light
"0 0 15px rgba(238, 212, 132, 0.25)"  // dark
);

const accentGradient = "linear(to-r, purple.500, pink.400)";

const bg = useColorModeValue("bg.light", "bg.dark");
const cardBg = useColorModeValue("card.light", "card.dark");
const textColor = useColorModeValue("text.light", "text.dark");
const borderColor = useColorModeValue("border.light", "border.dark");
const startColor = useColorModeValue(
    theme.colors.brand.startLight,
    theme.colors.brand.startDark
  );
const endColor = useColorModeValue(
    theme.colors.brand.endLight,
    theme.colors.brand.endDark
  );

interface Haiku {
  poemText: string[];  // Change this to string[] if it's meant to be an array of strings.
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

const [nftsByCollection, setNftsByCollection] = useState<Record<string, Nft[]>>({});
const [haikusByCollection, setHaikusByCollection] = useState<Record<string, Haiku[]>>({});


function toggle(index: number) {
  setOpenIndex(openIndex === index ? null : index);
}




const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);


// Charger uniquement les collections FEATURED
const fetchCollections = useCallback(async () => {
  setIsLoading(true);
  const cachedCollections = localStorage.getItem('featuredCollections');

  if (cachedCollections) {
    setCollections(JSON.parse(cachedCollections));
    setIsLoading(false);
    return;
  }

  try {
    const total = await contract.getTotalCollectionsMinted();
    const collectionsPaginated = await contract.getCollectionsPaginated(0, total);

    type CollectionTuple = [number, string, string, string, string[], boolean, boolean];

    const collectionsData = await Promise.all(
      collectionsPaginated.map(async (tuple: CollectionTuple | null) => {
        if (!tuple) return null;

        const [id, name, collectionType, creator, associatedAddresses, isActive, isFeatured] = tuple;

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

    const featured = collectionsData.filter((col): col is Collection => col !== null);
    localStorage.setItem('featuredCollections', JSON.stringify(featured)); // Cache les collections
    setCollections(featured);
  } catch (error) {
    console.error("Erreur lors du chargement des collections featured :", error);
  } finally {
    setIsLoading(false);
  }
}, [contract]);

const fetchPoems = async (collectionId: string, associatedAddress: string): Promise<void> => {
  setIsLoading(true);
  const cacheKey = `poems_${collectionId}`;
  const cachedPoems = sessionStorage.getItem(cacheKey);

  if (cachedPoems) {
    setHaikusByCollection(prev => ({ ...prev, [collectionId]: JSON.parse(cachedPoems) }));
    setIsLoading(false);
    return;
  }

  try {
    const collectionContract = new Contract(associatedAddress, haikuContractABI, provider);
    const uniqueTokenCount = await collectionContract.getLastUniqueHaikusMinted();

    if (uniqueTokenCount === 0) {
      setHaikusByCollection(prev => ({ ...prev, [collectionId]: [] }));
      return;
    }

    const tokenIds = Array.from({ length: Number(uniqueTokenCount) }, (_, i) => i + 1);

    const poemsData = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const haikuText = await collectionContract.getTokenFullDetails(tokenId);
        if (!Array.isArray(haikuText) || haikuText.length < 7) return null;

        const uniqueIdAssociated = await collectionContract.tokenIdToHaikuId(tokenId);

        return {
          tokenId: tokenId.toString(),
          poemText: haikuText.map(text => text.toString()), // Convertir chaque texte en chaîne
          mintContractAddress: associatedAddress,
          uniqueIdAssociated: uniqueIdAssociated.toString(), // Assurez-vous que c'est une chaîne
        };
      })
    ).then(results => results.filter(result => result !== null));

    // Stocker les poèmes dans le cache
    sessionStorage.setItem(cacheKey, JSON.stringify(poemsData)); // Assurez-vous que poemsData ne contient pas de BigInt
    setHaikusByCollection(prev => ({ ...prev, [collectionId]: poemsData }));

  } catch (error) {
    console.error('Error fetching poems:', error);
  } finally {
    setIsLoading(false);
  }
};



const fetchNFTs = async (collectionId: string, associatedAddress: string): Promise<void> => {
  setIsLoading(true);
  const cacheKey = `nfts_${collectionId}`;
  const cachedNfts = sessionStorage.getItem(cacheKey);

  if (cachedNfts) {
    setNftsByCollection(prev => ({
      ...prev,
      [collectionId]: JSON.parse(cachedNfts),
    }));
    setIsLoading(false);
    return;
  }

  try {
    const collectionContract = new Contract(associatedAddress, nftContractABI, provider);
    let max = await collectionContract.getLastMintedTokenId();
    if (max > 9) max = 9;
    const pagination = Number(max) + 1;
    const tokenIds = await collectionContract.getTokenPaginated(0, pagination);

    const nftsData = await Promise.all(
      tokenIds.map(async (tokenId: string) => {
        try {
          const owner = await collectionContract.ownerOf(tokenId).catch(() => null);
          if (!owner || owner === "0x0000000000000000000000000000000000000000") {
            return null;
          }

          let tokenURI = await collectionContract.tokenURI(tokenId);
          const cachedMetadata = localStorage.getItem(tokenURI);
          const metadata = cachedMetadata
            ? JSON.parse(cachedMetadata)
            : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

          return {
            image: metadata.image,
            name: metadata.name,
            artist: metadata.artist || "her",
            content: {
              tokenId: tokenId.toString(),
              mintContractAddress: associatedAddress,
            }
          };

        } catch (error) {
          console.warn(`⚠️ Erreur pour le tokenId ${tokenId}:`, error);
          return null;
        }
      })
    );

    sessionStorage.setItem(cacheKey, JSON.stringify(nftsData.filter(nft => nft !== null))); // Stocker dans le cache
    setNftsByCollection(prev => ({
      ...prev,
      [collectionId]: nftsData.filter(nft => nft !== null),
    }));
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
}, [fetchCollections]);


// Fonction pour obtenir des éléments aléatoires
const getRandomItems = <T,>(array: T[], count: number): T[] => {
  return array.length > 0
    ? array.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, array.length))
    : [];
};


const fetchedCollections = useRef(new Set()); // Utilisation de useRef pour garder les collections déjà récupérées

const fetchAllNFTsAndPoems = useCallback(async () => {
  const artCollections = collections.filter(col => col.collectionType === 'Art');
  const poetryCollections = collections.filter(col => col.collectionType === 'Poesie');

  // Récupérez 5 collections randomisées pour art et poésie
  const randomArtCollections = getRandomItems(artCollections, 5);
  const randomPoetryCollections = getRandomItems(poetryCollections, 5);

  ////console.log("Collections d'art sélectionnées :", randomArtCollections.map(c => c.id));
  ////console.log("Collections de poésie sélectionnées :", randomPoetryCollections.map(c => c.id));

  // Récupérer les NFTs pour les collections d'art
  for (const collection of randomArtCollections) {
    if (collection && !fetchedCollections.current.has(collection.id)) {
      ////console.log(`Récupération des NFTs pour la collection d'art ${collection.id}...`);
      const nftsBefore = nfts.length;
      await fetchNFTs(collection.id, collection.mintContractAddress);
      const nftsAfter = nfts.length;
      ////console.log(`Collection ${collection.id} récupérée : ${nftsAfter - nftsBefore} NFTs ajoutés`);
      fetchedCollections.current.add(collection.id); // Marquez comme récupérée
    }
  }

  // Récupérer les poèmes pour les collections de poésie
  for (const collection of randomPoetryCollections) {
    if (collection && !fetchedCollections.current.has(collection.id)) {
      ////console.log(`Récupération des poèmes pour la collection ${collection.id}...`);
      const poemsBefore = haikus.length; // si tu as un state "poems"
      await fetchPoems(collection.id, collection.mintContractAddress);
      const poemsAfter = haikus.length;
      ////console.log(`Collection ${collection.id} récupérée : ${poemsAfter - poemsBefore} poèmes ajoutés`);
      fetchedCollections.current.add(collection.id); // Marquez comme récupérée
    }
  }

  ////console.log("Récupération terminée. NFTs totaux :", nfts.length);
  ////console.log("Poèmes totaux :", haikus.length);
}, [collections]);

// Appel de la fonction dans useEffect
useEffect(() => {
  if (collections.length > 0) {
    fetchAllNFTsAndPoems();
  }
}, [collections]);

const allNfts = useMemo(
  () => collections.flatMap(col => nftsByCollection[col.id] || []),
  [collections, nftsByCollection]
);

const allHaikus = useMemo(
  () => collections.flatMap(col => haikusByCollection[col.id] || []),
  [collections, haikusByCollection]
);



    const maxBoxHeight = "150px"; // Hauteur max pour toutes les boîtes

    return (
      <Box
        as={motion.div}
        w="100%"
        textAlign="center"
        position="relative"
        overflow="hidden"
        bgGradient={useColorModeValue(
          "linear(to-b, bgGradientLight.start, bgGradientLight.end)",
          "linear(to-b, bgGradientDark.start, bgGradientDark.end)"
        )}
        >
      {/* ===== SECTION INTRO / PRÉSENTATION ===== */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <Box
          textAlign="center"
          maxW="1100px"
          mx="auto"
        >
        <Heading
          size={{ base: "xl", md: "2xl" }}
          bgClip="text"
          fontWeight="extrabold"
          mb={6}
          lineHeight="1.2"  // <-- espace vertical correct
          py={8}            // <-- évite la coupe du haut/bas
        >
            RESCOE — Réseau Expérimental Solidaire de Crypto Œuvres Émergentes
          </Heading>

          <Divider my={8} borderColor="purple.700" w="5%" mx="auto" />

          <Text
            color={textColor}
            fontSize={{ base: "md", md: "lg" }}
            maxW="800px"
            mx="auto"
            lineHeight="tall"
            mb={8}
          >

          Participer à un réseau d’artistes et de poètes qui font dialoguer le numérique et le réel.
          Créer des collections, exposer des œuvres, ou simplement soutenir la démarche.
          Tout commence par une adhésion — symbolique et libre.
          </Text>

          {/* Premier bouton Adhésion visible dès l'intro */}
          <Button
            as={NextLink}
            href="/adhesion"
            size="lg"
            px={12}
            py={7}
            fontWeight="bold"
            color="white"
            borderRadius="full"
            animation={`${pulse} 2.5s infinite`}
            mb={12}
            _hover={{
              ...hoverStyles.brandHover._hover,
              ...brandHover,
            }}
          >
            🚀 Adhérez Maintenant
          </Button>

          <Divider my={8} borderColor="purple.700" w="15%" mx="auto" />

          <Heading
            mt={6}
            mb={2}
            size="lg"
            bgClip="text"
            textAlign="center"
            py={2}            // <-- évite la coupe du haut/bas
          >
            Œuvre et poème du jour
          </Heading>


          <HeroSection nfts={allNfts} haikus={allHaikus} />


          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

          <Heading
            mt={6}
            mb={2}
            size="lg"
            bgClip="text"
            textAlign="center"
            py={2}            // <-- évite la coupe du haut/bas
          >
            Les nouveautées
          </Heading>
          <Flex
  direction={{ base: "column", md: "row" }}
  gap={6}
  justify="center"
  align="stretch"
  maxW="1400px"
  mx="auto"
>
  {/* Actualités */}
  <Box flex="1" borderRadius="2xl" border="1px solid #ccc" overflow="hidden">
    <NextLink
      href={{
        pathname: "/actus",
        query: { expand: "news" }, // indique quel bloc ouvrir
      }}
      passHref
    >
      <MotionBox
        as="a"
        p={6}
        cursor="pointer"
        whileHover={{ scale: 1.03, boxShadow: boxShadowHover }}
        transition={{ duration: 0.3 }}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
      >
        <ChannelPreview
          channelId={process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID!}
          title="📰 Actualités"
          limit={3}
          maxLines={5}
        />
        <Text textAlign="center" mt={8}>
          Cliquez pour afficher les dernières actualités.
        </Text>
      </MotionBox>
    </NextLink>
  </Box>

  {/* Colonne droite */}
  <Flex direction="column" flex="1" gap={6}>
    {/* Expositions */}
    <Box flex="1" borderRadius="2xl" border="1px solid #ccc" overflow="hidden">
      <NextLink
        href={{
          pathname: "/actus",
          query: { expand: "expos" },
        }}
        passHref
      >
        <MotionBox
          as="a"
          p={6}
          cursor="pointer"
          whileHover={{ scale: 1.03, boxShadow: boxShadowHover }}
          transition={{ duration: 0.3 }}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
        >
          <ChannelPreview
            channelId={process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!}
            title="🖼️ Expositions"
          />
          <Text textAlign="center" mt={8}>
            Cliquez pour en savoir plus !
          </Text>
        </MotionBox>
      </NextLink>
    </Box>
  </Flex>
</Flex>


          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

          <Box
            boxShadow="2xl"
            borderRadius="2xl"
            bg={cardBg}
          >
            <Heading
              size="lg"
              bgClip="text"
            >
          Pour vous :
          </Heading>

          {/* 3 bénéfices clés présentés proprement */}
          <SimpleGrid
            columns={{ base: 1, md: 3 }}
            spacing={10}
            mt={10}
            textAlign="center"
          >
            {[            {
                title: "Art, Poésie & Blockchain",
                icon: "/visuels/icon-blockchain.svg",
                desc: "Donner forme à des œuvres libres, signées et préservées dans le temps. Expérimenter une autre manière de créer, sans centre ni hiérarchie.",
              },
              {
                title: "Formation & Transmission",
                icon: "/visuels/icon-community.svg",
                desc: "Partager des savoirs techniques et sensibles. Apprendre à coder, à poétiser, à relier — dans des ateliers ouverts à tous.",
              },
              {
                title: "Communauté Solidaire",
                icon: "/visuels/icon-reseau.svg",
                desc: "Relier les artistes, poètes et développeurs qui œuvrent à une culture numérique commune. Chaque membre contribue à faire vivre le réseau, à son rythme.",
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
                key={i}
                bg={cardBg}
                borderRadius="2xl"
                boxShadow="xl"
                p={6}
                h="100%"
                transition="all 0.3s ease"
                _hover={{
                  bgGradient: "linear(to-r, brand.start, brand.end)",
                  color: "white",
                  transform: "scale(1.03)",
                }}
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
                    fontWeight="bold"
                    mb={2}
                  >
                    {item.title}
                  </Heading>
                  <Text color={textColor} fontSize="sm">
                    {item.desc}
                  </Text>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>

          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />


          <AteliersCalendarView />


          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

          <Heading
            mt={6}
            mb={2}
            size="lg"
            bgClip="text"
            textAlign="center"
          >
          Artistes en résidence
          </Heading>
          <Text>
          Artistes, poètes et codeurs que nous accompagnons au fil des projets.
          </Text>
          <FeaturedMembers addresses={featuredAddresses} />
        </Box>
      </Box>
      </motion.div>


      {/* ===== SECTION MISSIONS + CAROUSEL ===== */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

        <Heading
          mt={6}
          mb={2}
          size="lg"
          bgClip="text"
          textAlign="center"
        >
          Fusionnons des œuvres digitales et des poèmes on-chain
        </Heading>

        <Box w="100%" maxW="1100px" mx="auto" >
          {collections.length > 0 ? (
            <DynamicCarousel
              nfts={allNfts}
              haikus={allHaikus}
              maxNfts={20}    // réglable
              maxHaikus={20}  // réglable
            />
          ) : (
            <Text>Pas de collections disponibles.</Text>
          )}
        </Box>

        {/* ===== SECTION COLLECTIONS DU JOUR ===== */}

          <Box py={10} w="100%" maxW="1100px" mx="auto" px={{ base: 6, md: 10 }}>
            <Heading
              size="lg"
              mb={6}
              bgClip="text"
              textAlign="center"
            >
              Parmi les mêmes collections
            </Heading>

            {collections.map((collection) => {
              const collectionNFTs = nftsByCollection[collection.id];
              return collectionNFTs && collectionNFTs.length > 0 ? (
                <RelatedFull
                  key={collection.id}
                  nft={collectionNFTs[0]}          // NFT “vedette” (le premier)
                  allNFTs={collectionNFTs}         // tous les NFTs
                  title={collection.name}
                />
              ) : null;
            })}
          </Box>
        </motion.div>


      {/* ===== SECTION BENEFICES DETAILLES + APPEL A L'ADHESION ==== */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
        viewport={{ once: true }}
      >
        <VStack
        borderRadius="2xl"
        border="1px solid"
        borderColor="purple.700"
        bg={cardBg}
        p={{ base: 8, md: 12 }}
        maxW="95%"
        mx="auto"
        mt={10}
        >
          <Heading
            size={{ base: "lg", md: "xl" }}
            bgClip="text"
            fontWeight="extrabold"
            textAlign="center"
          >
            Rejoignez le réseau RESCOE
          </Heading>

          <Text
            fontSize={{ base: "md", md: "lg" }}
            color={textColor}
            textAlign="center"
            maxW="700px"
            mx="auto"
          >
          Un espace de recherche, de création et de transmission autour de l’art numérique et poétique.
          Depuis 2018, nous explorons les liens entre code, geste, et communauté.
          Nos outils s’appuient sur la blockchain pour donner à chaque œuvre — image, texte ou trace — une existence juste, traçable et partagée.
          </Text>

          {/* CARTES DE BENEFICES */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10} mt={6} w="100%">
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
                borderRadius="2xl"
                border="1px solid"
                boxShadow={useColorModeValue(
                  "0 0 15px rgba(180, 166, 213, 0.25)", // mauve clair en light
                  "0 0 15px rgba(238, 212, 132, 0.25)"  // doré doux en dark
                )}
                transition="all 0.4s ease"
                _hover={{
                  bgGradient: useColorModeValue(
                    `linear(to-r, ${theme.colors.brand.gold}, ${theme.colors.brand.mauve})`,
                    `linear(to-r, ${theme.colors.brand.mauve}, ${theme.colors.brand.gold})`
                  ),
                  transform: "scale(1.05)",
                  boxShadow: useColorModeValue(
                    "0 0 30px rgba(180, 166, 213, 0.45)", // lumière mauve en light
                    "0 0 30px rgba(238, 212, 132, 0.45)"  // halo doré en dark
                  ),
                }}
                w="100%"
                h="100%"
              >
                  <Stack align="center" spacing={4}>
                    <Icon
                      as={benefit.icon}
                      boxSize={12}
                      color={textColor}
                      transition="color 0.3s ease"
                      _groupHover={{ color: "white" }}
                    />
                    <Text
                      fontWeight="bold"
                      fontSize="xl"
                      textAlign="center"
                      _groupHover={{ color: "white" }}
                    >
                      {benefit.title}
                    </Text>
                    <Text
                      mt={3}
                      color={textColor}
                      textAlign="center"
                      fontSize="md"
                      maxW="300px"
                      mx="auto"
                    >
                      {benefit.description}
                    </Text>
                  </Stack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>

          <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

          <motion.div
            style={{ width: "100%" }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Heading
              mt={6}
              mb={2}
              size="lg"
              bgClip="text"
              textAlign="center"
            >
              Ils viennent de rejoindre l’aventure :
            </Heading>
            <Text color={textColor}  textAlign="center" mb={6} maxW="800px" mx="auto">
              Découvrez les nouveaux membres du réseau et leurs créations.
            </Text>

            <DerniersAdherents />
          </motion.div>
        </VStack>
      </motion.div>

{/*
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        viewport={{ once: true }}
      >


        <VStack spacing={8} mt={12} mb={20}>
          <Heading size="xl" color="gray.100" fontWeight="extrabold">
            Rejoignez un réseau d'art numérique et de poésie solidaire
          </Heading>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            maxW="800px"
            textAlign="center"
            color="gray.300"
            mx="auto"
          >
            RESCOE soutient les artistes émergents en leur offrant un accès privilégié à des outils numériques innovants et à des formations accessibles. <br />
            Explorez l’art génératif, le Web3 et l’expression poétique sous un nouveau jour.
          </Text>
        </VStack>


      </motion.div>
      */}

    </Box>
  );

};

export default Home;
