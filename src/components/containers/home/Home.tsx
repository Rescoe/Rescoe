import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';

import { Box, Heading, Text, Button, VStack, Grid, GridItem, Divider, Icon, Flex, Input, FormLabel, Select, Checkbox, useColorModeValue, SimpleGrid, Stack,Collapse, HStack, Image, useTheme } from '@chakra-ui/react';
import { FaBookOpen, FaUsers, FaLightbulb, FaHandsHelping, FaPaintBrush, FaGraduationCap, FaHandshake   } from 'react-icons/fa';
//import useCheckMembership from '../../../utils/useCheckMembership';
import NextLink from 'next/link';
import { JsonRpcProvider, ethers, Contract } from 'ethers';
import haikuContractABI from '../../ABI/HaikuEditions.json';
import nftContractABI from '../../ABI/ABI_ART.json';
import DynamicCarousel from '../../../utils/DynamicCarousel'; // Assurez-vous d'importer le bon chemin
import HeroSection from '../../../utils/HeroSection'; // Assurez-vous d'importer le bon chemin
import {useRescoeData} from './useRescoeData'; // Assurez-vous d'importer le bon chemin

import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import { useRouter } from 'next/router';
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";
import { brandHover, hoverStyles } from "@styles/theme"; //Style

import FaucetWidget from '@/utils/Faucet/Faucet'; // Assurez-vous d'importer le bon chemin

import { resolveIPFS } from '../../../utils/resolveIPFS';

import RelatedFull from '../../../utils/RelatedFull'; // Assurez-vous d'importer le bon chemin
import RelatedFullPoems from '../../../utils/RelatedFullPoemes'; // Assurez-vous d'importer le bon chemin

import DerniersAdherents from '../association/Adherents/DerniersAdherents'; // Votre ABI de contrat ici.
import FeaturedMembers from '../association/Adherents/FeaturedMembers'; // Votre ABI de contrat ici.
import AteliersCalendarView from '../association/Formations/AteliersCalendarView'; // Votre ABI de contrat ici.
import MiniCalendar from '@/components/containers/actus/MiniCalendar'; // Votre ABI de contrat ici.

import ChannelPreview from '../../../utils/channels/ChannelPreview'; // Assurez-vous d'importer le bon chemin

const MotionBox = motion(Box);


// Animation pulsante pour le bouton "Adhérez"
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(238,212,132,0.7); }
  70% { box-shadow: 0 0 0 20px rgba(238,212,132,0); }
  100% { box-shadow: 0 0 0 0 rgba(238,212,132,0); }
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
const router = useRouter();
const theme = useTheme();


const bg = useColorModeValue("brand.cream", "brand.navy");
const cardBg = useColorModeValue("rgba(247,245,236,0.9)", "rgba(1,28,57,0.85)");
const textColor = useColorModeValue("brand.navy", "brand.cream");
const borderColor = useColorModeValue("brand.navy/50", "brand.gold/60");
const boxShadowHover = useColorModeValue(
  "0 0 20px rgba(1,28,57,0.4)",
  "0 0 20px rgba(238,212,132,0.5)"
);

const iconBg = useColorModeValue(
  "brand.navy/30",   // navy avec 30% d'opacité en light
  "brand.cream/18"   // cream avec 18% d'opacité en dark
);
const iconBorder = useColorModeValue(
  "brand.navy/40",   // bordure plus marquée en light
  "brand.gold/50"    // gold plus visible en dark
);
const iconColor = useColorModeValue("brand.navy", "brand.gold");


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
const [openIndex, setOpenIndex] = useState<number | null>(null);

const [nftsByCollection, setNftsByCollection] = useState<Record<string, Nft[]>>({});
const [haikusByCollection, setHaikusByCollection] = useState<Record<string, Haiku[]>>({});


function toggle(index: number) {
  setOpenIndex(openIndex === index ? null : index);
}




const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);


//Récupération des données de collection, poemes et NFT featured
const {
  isLoading,
  collections,
  collectionsWithNfts,  // ✅ NOUVEAU - Prêt à l'emploi !
  allNfts,     // ✅ Tous les NFTs
  allHaikus,   // ✅ Tous les poèmes
} = useRescoeData();


// Fonction pour obtenir des éléments aléatoires
const getRandomItems = <T,>(array: T[], count: number): T[] => {
  return array.length > 0
    ? array.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, array.length))
    : [];
};

/*
useEffect(() => {
  //console.log('🚀 useRescoeData DATA:', {
    isLoading,
    allNfts: allNfts.length,
    allHaikus: allHaikus.length,
    allNftsSample: allNfts.slice(0, 3),
    allHaikusSample: allHaikus.slice(0, 3),
    collections: collections.length,
  });
}, [isLoading, allNfts, allHaikus, collections]);
*/

    const maxBoxHeight = "150px"; // Hauteur max pour toutes les boîtes

    return (
        <>
          {/* ===== SEO OPTIMISATION ===== */}
          <Head>
            <title>RESCOE - Réseau d'art numérique, poésie et blockchain solidaire</title>
            <meta
              name="description"
              content="RESCOE : réseau expérimental pour artistes, poètes et codeurs. Créez, exposez et partagez vos œuvres NFT et haïkus on-chain. Adhérez à l'association et rejoignez la communauté !"
            />
            <meta name="keywords" content="art numérique, poésie blockchain, NFT art, haïkus on-chain, réseau artistique solidaire, RESCOE, crypto œuvres émergentes" />
            <meta property="og:title" content="RESCOE - Art, Poésie & Blockchain Solidaire" />
            <meta property="og:description" content="Rejoignez le réseau RESCOE pour créer des œuvres numériques préservées sur blockchain. Ateliers, expositions, communauté ouverte." />
            <meta property="og:image" content="/visuels/og-rescoe-hero.jpg" /> {/* Ajoute une image OG */}
            <meta property="og:url" content="https://rescoe.fr" />
            <meta name="twitter:card" content="summary_large_image" />
            <link rel="canonical" href="https://rescoe.fr/" />
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "RESCOE",
                "description": "Réseau Expérimental Solidaire de Crypto Œuvres Émergentes",
                "url": "https://rescoe.fr",
                "keywords": "art numérique, blockchain poésie, NFT artistique"
              })}
            </script>
          </Head>

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
            {/* ===== HERO ULTRA-FOCUS (Above the fold) - Pitch + CTA UNIQUES ===== */}
            {/* Tagline simple + texte "tu/vous" + CTA fort, Œuvre du jour DESCENDU */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            >
              <Box textAlign="center" maxW="1100px" mx="auto" py={12}>
              {/*
                <Heading size="3xl" fontWeight="extrabold" mb={4}>
                  RESCOE
                </Heading>
                <Divider my={4} borderColor="purple.600" w="15%" mx="auto" />
                */}

                {/*
                          <FaucetWidget />
                */}
                <Heading
                  size={{ base: "2xl", md: "4xl" }}
                  bgClip="text"
                  fontWeight="extrabold"
                  mb={2}
                  lineHeight="1.2"
                  py={8}
                >
                  Réseau Expérimental Solidaire de <br />Crypto Œuvres Émergentes
                </Heading>
                {/* Tagline simple SUGGÉRÉE */}
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  color="brand.cream"
                  mb={6}
                >
                  Un réseau d’art numérique et de poésie, ouvert à tou·tes.
                </Text>

                <Text
                  color={textColor}
                  fontSize={{ base: "lg", md: "xl" }}
                  maxW="700px"
                  mx="auto"
                  lineHeight="tall"
                  mb={12}
                >
                  En adhérant, <strong>vous rejoignez un réseau qui protège vos créations sur blockchain</strong>, vous connecte à une communauté solidaire d'artistes, poètes et codeurs, et vous ouvre ateliers et expositions gratuites.
                </Text>

                {/* CTA PRINCIPAL - Gros bouton animé PRIORITAIRE */}
                <Button
                  as={NextLink}
                  href="/adhesion"
                  size="xl"
                  px={16}
                  py={8}
                  fontSize="lg"
                  fontWeight="bold"
                  borderColor="brand.cream"
                  color="brand.gold"
                  bg="brand.navy"
                  borderRadius="full"
                  animation={`${pulse} 2.5s infinite`}
                  mb={8}
                  boxShadow="2xl"
                  _hover={{
                    ...brandHover,
                    transform: "scale(1.05)",
                  }}
                >
                  Rejoindre le réseau
                </Button>

                <Divider my={12} borderColor={"brand.cream"} />
              </Box>
            </motion.div>

            {/* ===== 2. ŒUVRE / POÈME DU JOUR (Preuve vivante, léger scroll) ===== */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Box maxW="1100px" mx="auto" px={{ base: 6, md: 10 }}>
                <Heading
                  mb={8}
                  size="lg"
                  bgClip="text"
                  textAlign="center"
                  py={4}
                >
                  Œuvre et poème du jour
                </Heading>
                <HeroSection nfts={allNfts} haikus={allHaikus} />
              </Box>
            </motion.div>



                        {/*
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


                          <Flex direction="column" flex="1" gap={6}>
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
                        */}

                        <Divider my={12} borderColor={"brand.cream"} />

                        {/*


                        <NextLink
                          href={{
                            pathname: "/actus",
                            query: { expand: "calendar" },
                          }}
                          passHref
                        >

                            <MiniCalendar onClick={() => {}} />

                            <Divider my={8} borderColor="purple.700" w="70%" mx="auto" />

                        </NextLink>
                          */}




            {/* ===== 3. POUR VOUS (3 cartes résultats-oriented) ===== */}
            {/* Titres "résultat" + hover couleur conditionnée */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
            >
              <Box
                boxShadow="2xl"
                borderRadius="3xl"
                bg={cardBg}
                p={{ base: 8, md: 12 }}
                maxW="1200px"
                mx="auto"
                color={textColor}
                mt={20}
                mb={16}
              >
                <Heading size="xl" bgClip="text" mb={12} textAlign="center">
                  Pour vous :
                </Heading>

                <SimpleGrid
                  columns={{ base: 1, md: 3 }}
                  spacing={8}
                  mb={12}
                >
                  {[
                    {
                      title: "Créer des œuvres signées et préservées", // Résultat-oriented
                      icon: "/visuels/icon-blockchain.svg",
                      desc: "Vos NFT libres, éternels sur blockchain. Expérimentez sans hiérarchie.",
                    },
                    {
                      title: "Apprendre à coder et poétiser", // Résultat-oriented
                      icon: "/visuels/icon-community.svg",
                      desc: "Ateliers ouverts : code, poésie, Web3 pour toutes et tous.",
                    },
                    {
                      title: "Relier une communauté solidaire", // Résultat-oriented
                      icon: "/visuels/icon-reseau.svg",
                      desc: "Artistes, poètes, devs : culture numérique partagée.",
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
                        bg={cardBg}
                        borderRadius="2xl"
                        boxShadow="xl"
                        p={8}
                        h="100%"
                        spacing={4}
                        transition="all 0.3s ease"

                      >
                        <Image
                          src={item.icon}
                          alt={item.title}
                          color={textColor}
                          boxSize="70px"
                          mb={4}
                          mx="auto"
                        />
                        <Heading size="md" fontWeight="bold" color={textColor}>
                          {item.title}
                        </Heading>
                        <Text
                          fontSize="sm"
                          textAlign="center"
                          color={textColor}
                          _groupHover={{ color: "white" }} // ✅ Fix contraste hover
                        >
                          {item.desc}
                        </Text>
                      </VStack>
                    </motion.div>
                  ))}
                </SimpleGrid>

                {/* ===== 4. ARTISTES EN RÉSIDENCE (Fusionné dans même bloc) ===== */}
                <Divider my={12} borderColor={"brand.cream"} />

                <Heading
                  mb={6}
                  size="lg"
                  bgClip="text"
                  textAlign="center"
                >
                  Artistes en résidence
                </Heading>
                <Text color={textColor} textAlign="center" maxW="800px" mx="auto">
                  Artistes, poètes et codeurs que nous accompagnons au fil des projets.
                </Text>
                <FeaturedMembers addresses={featuredAddresses} />
              </Box>
            </motion.div>

            {/* ===== 5. FUSION ŒUVRES/POÈMES + CAROUSEL ===== */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              viewport={{ once: true }}
            >
            <Divider my={12} borderColor={"brand.cream"} />
              <Box maxW="1100px" mx="auto">
                <Heading
                  mb={12}
                  size="2xl"
                  bgClip="text"
                  textAlign="center"
                >
                  Fusionnons œuvres digitales et poèmes on-chain
                </Heading>
                {collections.length > 0 ? (
                  <DynamicCarousel nfts={allNfts} haikus={allHaikus} maxNfts={20} maxHaikus={20} />
                ) : (
                  <Text textAlign="center">Pas de collections disponibles pour le moment.</Text>
                )}
              </Box>

              {/* NFTs et Poèmes (gardés courts) */}
              <Box py={16} maxW="1100px" mx="auto" px={{ base: 6, md: 10 }}>
                <Heading size="lg" mb={12} bgClip="text" textAlign="center">
                  Œuvres NFT (5/collection)
                </Heading>
                {collectionsWithNfts
                  .filter((c: any) => c.nfts.length > 0)
                  .map((collection: any) => (
                    <RelatedFull
                      key={`nft-${collection.id}`}
                      nft={collection.nfts[0]}
                      allNFTs={collection.nfts.slice(0, 5)}
                      title={collection.name}
                    />
                  ))}
              </Box>

              <Box py={16} maxW="1100px" mx="auto" px={{ base: 6, md: 10 }}>
                <Heading size="lg" mb={12} bgClip="text" textAlign="center">
                  Poèmes Haiku (5/collection)
                </Heading>
                {collectionsWithNfts
                  .filter((c: any) => c.haikus.length > 0)
                  .map((collection: any) => (
                    <RelatedFullPoems
                      key={`poem-${collection.id}`}
                      haiku={collection.haikus[0]}
                      allHaikus={collection.haikus.slice(0, 5)}
                      title={collection.name}
                    />
                  ))}
              </Box>
            </motion.div>

            {/* ===== 6. BLOC PERSUASION + CTA + Bénéfices + DERNIERS ADHÉRENTS ===== */}
            {/* Texte condensé + CTA secondaire */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9 }}
              viewport={{ once: true }}
            >
              <VStack
                borderRadius="3xl"
                border="1px solid"
                borderColor="brand.cream"
                bg={cardBg}
                p={{ base: 12, md: 16 }}
                maxW="95%"
                mx="auto"
                spacing={12}
              >
                <Heading
                  size={{ base: "2xl", md: "3xl" }}
                  bgClip="text"
                  fontWeight="extrabold"
                  textAlign="center"
                >
                  Rejoignez le réseau RESCOE dès maintenant
                </Heading>

                <Text
                  fontSize={{ base: "lg", md: "xl" }}
                  color={textColor}
                  textAlign="center"
                  maxW="800px"
                  mx="auto"
                  lineHeight="tall"
                >
                  Création, transmission et communauté autour de l’art numérique et poétique sur blockchain. Depuis 2018.
                </Text>

                {/* CTA SECONDaire renforcé */}
                <Button
                  as={NextLink}
                  href="/adhesion"
                  size="lg"
                  px={12}
                  py={6}
                  color="white"
                  borderRadius="full"
                  boxShadow="xl"
                  _hover={{ transform: "scale(1.05)" }}
                  animation={`${pulse} 3s infinite`} // Subtil
                >
                  Adhérez en 2 minutes
                </Button>

                {/* Bénéfices détaillés (navy/cream/gold parfait) */}
  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
    {benefits.map((benefit: any, index: number) => (
      <MotionBox
        key={index}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        minH="240px"
        as="button"
        onClick={() => toggle(index)}
        role="group"
        p={8}
        borderRadius="2xl"
        bg={useColorModeValue(
          "rgba(247,245,236,0.85)",  // ✅ cream light
          "rgba(1,28,57,0.85)"       // ✅ navy dark
        )}
        backdropFilter="blur(16px)"
        border="1px solid"

        display="flex"
        flexDir="column"
        _hover={{
          bgGradient: useColorModeValue(
            "linear(to-br, brand.cream, brand.cream)",     // ✅ navy→cream light
            "linear(to-br, brand.navy, brand.navy)"       // ✅ gold→navy dark
          ),
          transform: "translateY(-10px) scale(1.02)",
          boxShadow: useColorModeValue(
            "0 25px 60px rgba(238,212,132,0.5)",         // ✅ gold glow dark
            "0 25px 60px rgba(1,28,57,0.4)"             // ✅ navy glow light
          ),
          borderColor: "brand.cream"
        }}
        cursor="pointer"
      >
        <VStack spacing={6} align="center" flex="1" justify="center">

        <Box
          p={4}
          bg={iconBg}
          borderRadius="2xl"

          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          transition="all 0.35s cubic-bezier(0.23,1,0.32,1)"
          _groupHover={{
            transform: "translateY(-3px) scale(1.12) rotate(4deg)",
          }}
        >
          <Icon
            as={benefit.icon}
            boxSize={10}
            color={iconColor}
            _groupHover={{
              color: useColorModeValue("black", "brand.cream")  // navy light / cream dark
            }}
            transition="all 0.3s ease"
          />
        </Box>


          <Heading
            size="md"
            fontWeight="extrabold"
            textAlign="center"
            color={useColorModeValue(
              "brand.navy",              // ✅ navy titre light
              "brand.cream"              // ✅ cream titre dark
            )}
            bgClip="text"
          >
            {benefit.title}
          </Heading>

          <Text
            textAlign="center"
            fontSize="sm"
            color={useColorModeValue(
              "brand.navy",              // ✅ navy texte light
              "brand.cream"              // ✅ cream texte dark
            )}
            opacity={0.9}
            lineHeight="1.7"
            _groupHover={{
              opacity: 1
            }}
          >
            {benefit.description}
          </Text>
        </VStack>
      </MotionBox>
    ))}
  </SimpleGrid>


  <Divider my={12} borderColor={"brand.cream"} />

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  <Heading size="lg" bgClip="text" textAlign="center" mb={6}>
                    Ils viennent de rejoindre l’aventure :
                  </Heading>
                  <Text color={textColor} textAlign="center" mb={12} maxW="800px" mx="auto">
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
        </>
      );
    };

    export default Home;
