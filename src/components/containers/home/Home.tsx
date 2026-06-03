import React from 'react';
import Head from 'next/head';

import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  SimpleGrid,
  Icon,
  Flex,
  useColorModeValue,
  Badge,
} from '@chakra-ui/react';

import {
  FaPaintBrush,
  FaGraduationCap,
  FaUsers,
  FaHandshake,
} from 'react-icons/fa';

import NextLink from 'next/link';
import { motion } from 'framer-motion';
import { keyframes } from '@emotion/react';
import { brandHover } from '@styles/theme';

import DynamicCarousel from '../../../utils/DynamicCarousel';
import HeroSection from '../../../utils/HeroSection';
import { useRescoeData } from './useRescoeData';
import RelatedFull from '../../../utils/RelatedFull';
import RelatedFullPoems from '../../../utils/RelatedFullPoemes';
import DerniersAdherents from '../association/Adherents/DerniersAdherents';
import FeaturedMembers from '../association/Adherents/FeaturedMembers';

// ─── Constantes module-level ──────────────────────────────────────────────────

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(255,237,166,0.65); }
  70%  { box-shadow: 0 0 0 18px rgba(255,237,166,0);   }
  100% { box-shadow: 0 0 0 0   rgba(255,237,166,0);    }
`;

const featuredAddresses = [
  '0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879',
];

const benefits = [
  {
    icon: FaPaintBrush,
    title: 'Créer et exposer',
    description:
      "Vos œuvres et poèmes signés, préservés sur blockchain. Des espaces d'exposition décentralisés, vivants et partagés.",
  },
  {
    icon: FaGraduationCap,
    title: 'Formations & ateliers',
    description:
      'Des ateliers ouverts — code, poésie, Web3 — pour toutes et tous, sans prérequis, dans un esprit de partage.',
  },
  {
    icon: FaUsers,
    title: 'Un réseau phygital',
    description:
      'Entre réel et numérique : rencontres, expositions et collaborations avec des artistes, poètes et développeurs.',
  },
  {
    icon: FaHandshake,
    title: 'Démarche solidaire',
    description:
      "Association loi 1901. Chaque adhésion soutient la transmission, la recherche et l'accès libre aux outils créatifs.",
  },
];

// ─── Section wrapper animé ────────────────────────────────────────────────────

function SectionWrapper({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut', delay }}
      viewport={{ once: true, margin: '-80px' }}
    >
      {children}
    </motion.div>
  );
}

// ─── Eyebrow (petite étiquette de section) ────────────────────────────────────

function Eyebrow({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <Text
      fontSize="10px"
      letterSpacing="0.18em"
      textTransform="uppercase"
      fontWeight="semibold"
      color={color}
    >
      {children}
    </Text>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const Home = () => {
  // ── Palette (toutes les valeurs ici, jamais dans un map/callback) ──────────
  const pageBg        = useColorModeValue('brand.cream', 'brand.navy');
  const altBg         = useColorModeValue('rgba(1,28,57,0.04)', 'rgba(255,255,255,0.025)');
  const cardBg        = useColorModeValue('rgba(247,245,236,0.95)', 'rgba(1,28,57,0.9)');
  const cardWhiteBg   = useColorModeValue('white', 'rgba(255,255,255,0.03)');
  const textColor     = useColorModeValue('brand.navy', 'brand.cream');
  const mutedColor    = useColorModeValue('gray.600', 'whiteAlpha.600');
  const iconColor     = useColorModeValue('brand.navy', 'brand.gold');
  const borderColor   = useColorModeValue('rgba(1,28,57,0.10)', 'rgba(255,255,255,0.07)');
  const hoverBorder   = useColorModeValue('rgba(1,28,57,0.28)', '#FFEDA6');
  const hoverShadow   = useColorModeValue(
    '0 10px 28px rgba(1,28,57,0.10)',
    '0 10px 28px rgba(255,237,166,0.09)',
  );
  const iconBg        = useColorModeValue('rgba(1,28,57,0.07)', 'rgba(255,237,166,0.08)');
  const eyebrowColor  = useColorModeValue('brand.navy', 'brand.gold');
  const badgeBorder   = useColorModeValue('brand.navy', 'brand.gold');
  const badgeColor    = useColorModeValue('brand.navy', 'brand.gold');
  const ctaShadow     = useColorModeValue(
    '0 8px 40px rgba(1,28,57,0.07)',
    '0 8px 40px rgba(255,237,166,0.06)',
  );
  const dividerColor  = useColorModeValue('rgba(1,28,57,0.10)', 'rgba(255,255,255,0.07)');

  // ── Données ────────────────────────────────────────────────────────────────
  const { collections, collectionsWithNfts, allNfts, allHaikus } = useRescoeData();

  const nftCollections  = collectionsWithNfts.filter((c: any) => c.nfts.length > 0);
  const haikuCollections = collectionsWithNfts.filter((c: any) => c.haikus.length > 0);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── SEO ─────────────────────────────────────────────────────────── */}
      <Head>
        <title>RESCOE — Art numérique, poésie et blockchain solidaire</title>
        <meta
          name="description"
          content="RESCOE : réseau expérimental pour artistes, poètes et codeurs. Créez, exposez et partagez vos œuvres NFT et haïkus on-chain. Adhérez à l'association."
        />
        <meta name="keywords" content="art numérique, poésie blockchain, NFT art, haïkus on-chain, réseau artistique solidaire, RESCOE" />
        <meta property="og:title" content="RESCOE — Art, Poésie & Blockchain Solidaire" />
        <meta property="og:description" content="Rejoignez le réseau RESCOE pour créer des œuvres numériques préservées sur blockchain. Ateliers, expositions, communauté ouverte." />
        <meta property="og:image" content="/visuels/og-rescoe-hero.jpg" />
        <meta property="og:url" content="https://rescoe.fr" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://rescoe.fr/" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'RESCOE',
            description: 'Réseau Expérimental Solidaire de Crypto Œuvres Émergentes',
            url: 'https://rescoe.fr',
          })}
        </script>
      </Head>

      <Box w="100%" position="relative">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. HERO                                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        >
          <VStack
            textAlign="center"
            spacing={{ base: 5, md: 6 }}
            py={{ base: 16, md: 22, lg: 28 }}
            px={{ base: 5, md: 8 }}
            maxW="760px"
            mx="auto"
          >
            {/* Étiquette associative */}
            <Badge
              px={4}
              py={1}
              borderRadius="full"
              fontSize="10px"
              letterSpacing="0.15em"
              fontWeight="semibold"
              textTransform="uppercase"
              bg="transparent"
              border="1px solid"
              borderColor={badgeBorder}
              color={badgeColor}
            >
              Association loi 1901 · Depuis 2018
            </Badge>

            {/* Titre principal — phrase, pas uppercase */}
            <Heading
              as="h1"
              size={{ base: '2xl', md: '3xl', lg: '4xl' }}
              bgClip="text"
              fontWeight="extrabold"
              lineHeight={{ base: '1.2', md: '1.15' }}
              textTransform="none"
              letterSpacing="tight"
              maxW="680px"
            >
              Art numérique, poésie et blockchain solidaire
            </Heading>

            {/* Accroche */}
            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              color={mutedColor}
              maxW="560px"
              lineHeight="tall"
            >
              RESCOE connecte artistes, poètes et codeurs dans un réseau ouvert.
              Créez des œuvres préservées on-chain, participez aux ateliers,
              rejoignez une communauté qui expérimente ensemble.
            </Text>

            {/* CTA unique — un seul bouton pulsant sur la page */}
            <Button
              as={NextLink}
              href="/adhesion"
              size="lg"
              px={{ base: 8, md: 12 }}
              py={7}
              fontSize="md"
              fontWeight="bold"
              borderRadius="full"
              animation={`${pulse} 2.8s ease infinite`}
              mt={1}
              _hover={{ ...brandHover }}
            >
              Rejoindre le réseau
            </Button>

            {/* Info prix discrète */}
            <Text fontSize="xs" color={mutedColor} opacity={0.55} mt={-2}>
              Badge NFT unique · ~0,005 ETH · 2 minutes
            </Text>
          </VStack>
        </motion.div>

        {/* Trait séparateur léger */}
        <Box h="1px" bg={dividerColor} maxW="520px" mx="auto" />


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. ŒUVRE & POÈME DU JOUR                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionWrapper>
          <Box
            py={{ base: 14, md: 20 }}
            px={{ base: 4, md: 8 }}
            maxW="1000px"
            mx="auto"
          >
            <VStack spacing={2} mb={10} textAlign="center">
              <Eyebrow color={eyebrowColor}>Production en direct</Eyebrow>
              <Heading size="lg" bgClip="text">
                Œuvre et poème du jour
              </Heading>
              <Text fontSize="sm" color={mutedColor} maxW="460px" lineHeight="tall">
                Chaque jour, une création de nos membres — signée et préservée on-chain.
              </Text>
            </VStack>
            <HeroSection nfts={allNfts} haikus={allHaikus} />
          </Box>
        </SectionWrapper>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. BÉNÉFICES DE L'ADHÉSION                                     */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionWrapper>
          <Box
            bg={altBg}
            borderTop="1px solid"
            borderBottom="1px solid"
            borderColor={dividerColor}
            py={{ base: 14, md: 20 }}
            px={{ base: 4, md: 8 }}
          >
            {/* En-tête de section */}
            <VStack spacing={2} mb={12} textAlign="center">
              <Eyebrow color={eyebrowColor}>Adhérer à RESCOE</Eyebrow>
              <Heading size="xl" bgClip="text">
                Ce que vous obtenez
              </Heading>
              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                color={mutedColor}
                maxW="500px"
                lineHeight="tall"
              >
                Un badge NFT unique, une communauté active, des ateliers ouverts.
              </Text>
            </VStack>

            {/* Grille de bénéfices */}
            <SimpleGrid
              columns={{ base: 1, sm: 2, lg: 4 }}
              spacing={{ base: 4, md: 5 }}
              maxW="1080px"
              mx="auto"
            >
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.1 }}
                  viewport={{ once: true }}
                  style={{ height: '100%' }}
                >
                  <VStack
                    bg={cardWhiteBg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="2xl"
                    p={{ base: 6, md: 7 }}
                    h="100%"
                    spacing={4}
                    align="center"
                    textAlign="center"
                    transition="all 0.22s ease"
                    role="group"
                    _hover={{
                      transform: 'translateY(-4px)',
                      boxShadow: hoverShadow,
                      borderColor: hoverBorder,
                    }}
                  >
                    {/* Icône */}
                    <Flex
                      bg={iconBg}
                      borderRadius="xl"
                      p={3}
                      align="center"
                      justify="center"
                      flexShrink={0}
                    >
                      <Icon as={b.icon} boxSize={6} color={iconColor} />
                    </Flex>

                    {/* Titre card — title case, pas uppercase */}
                    <Heading
                      as="h3"
                      size="sm"
                      textTransform="none"
                      color={textColor}
                      fontWeight="700"
                      lineHeight="snug"
                    >
                      {b.title}
                    </Heading>

                    {/* Description */}
                    <Text
                      fontSize="sm"
                      color={mutedColor}
                      lineHeight="tall"
                    >
                      {b.description}
                    </Text>
                  </VStack>
                </motion.div>
              ))}
            </SimpleGrid>

            {/* CTA discret */}
            <VStack mt={12} spacing={2}>
              <Button
                as={NextLink}
                href="/adhesion"
                variant="outline"
                size="md"
                px={8}
                borderRadius="full"
                _hover={{ ...brandHover }}
              >
                Adhérer maintenant
              </Button>
              <Text fontSize="xs" color={mutedColor} opacity={0.5}>
                Association loi 1901 · badge on-chain · ~0,005 ETH
              </Text>
            </VStack>
          </Box>
        </SectionWrapper>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 4. GALERIE — CAROUSEL + COLLECTIONS                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionWrapper>
          <Box
            py={{ base: 14, md: 20 }}
            px={{ base: 4, md: 8 }}
          >
            <VStack spacing={2} mb={10} textAlign="center">
              <Eyebrow color={eyebrowColor}>Les collections</Eyebrow>
              <Heading size="lg" bgClip="text">
                Œuvres digitales &amp; poèmes on-chain
              </Heading>
              <Text
                fontSize="sm"
                color={mutedColor}
                maxW="480px"
                lineHeight="tall"
              >
                Explorez les créations des membres — signées et préservées sur la blockchain Base.
              </Text>
            </VStack>

            {/* Carousel */}
            <Box maxW="1100px" mx="auto">
              {collections.length > 0 ? (
                <DynamicCarousel
                  nfts={allNfts}
                  haikus={allHaikus}
                  maxNfts={20}
                  maxHaikus={20}
                />
              ) : (
                <Text textAlign="center" color={mutedColor} py={10} fontSize="sm">
                  Chargement des collections…
                </Text>
              )}
            </Box>

            {/* Collections NFT */}
            {nftCollections.length > 0 && (
              <Box maxW="1100px" mx="auto" mt={16}>
                <Heading
                  size="md"
                  bgClip="text"
                  textAlign="center"
                  mb={8}
                >
                  Œuvres NFT
                </Heading>
                {nftCollections.map((collection: any) => (
                  <RelatedFull
                    key={`nft-${collection.id}`}
                    nft={collection.nfts[0]}
                    allNFTs={collection.nfts.slice(0, 5)}
                    title={collection.name}
                  />
                ))}
              </Box>
            )}

            {/* Collections Haïku */}
            {haikuCollections.length > 0 && (
              <Box maxW="1100px" mx="auto" mt={16}>
                <Heading
                  size="md"
                  bgClip="text"
                  textAlign="center"
                  mb={8}
                >
                  Poèmes Haïku
                </Heading>
                {haikuCollections.map((collection: any) => (
                  <RelatedFullPoems
                    key={`poem-${collection.id}`}
                    haiku={collection.haikus[0]}
                    allHaikus={collection.haikus.slice(0, 5)}
                    title={collection.name}
                  />
                ))}
              </Box>
            )}
          </Box>
        </SectionWrapper>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 5. ARTISTES EN RÉSIDENCE                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionWrapper>
          <Box
            bg={altBg}
            borderTop="1px solid"
            borderBottom="1px solid"
            borderColor={dividerColor}
            py={{ base: 14, md: 20 }}
            px={{ base: 4, md: 8 }}
          >
            <VStack spacing={2} mb={10} textAlign="center">
              <Eyebrow color={eyebrowColor}>Le réseau</Eyebrow>
              <Heading size="lg" bgClip="text">
                Artistes en résidence
              </Heading>
              <Text
                fontSize="sm"
                color={mutedColor}
                maxW="480px"
                lineHeight="tall"
              >
                Artistes, poètes et codeurs que nous accompagnons au fil des projets.
              </Text>
            </VStack>
            <FeaturedMembers addresses={featuredAddresses} />
          </Box>
        </SectionWrapper>


        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 6. COMMUNAUTÉ & CTA FINAL                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionWrapper>
          <Box
            py={{ base: 14, md: 20 }}
            px={{ base: 4, md: 8 }}
          >
            {/* Derniers adhérents */}
            <VStack spacing={2} mb={10} textAlign="center">
              <Eyebrow color={eyebrowColor}>La communauté</Eyebrow>
              <Heading size="lg" bgClip="text">
                Ils viennent de rejoindre
              </Heading>
              <Text
                fontSize="sm"
                color={mutedColor}
                maxW="460px"
              >
                Découvrez les nouveaux membres et leurs créations.
              </Text>
            </VStack>

            <DerniersAdherents />

            {/* Encart CTA final */}
            <VStack
              mt={{ base: 14, md: 20 }}
              spacing={5}
              textAlign="center"
              py={{ base: 12, md: 16 }}
              px={{ base: 6, md: 12 }}
              maxW="580px"
              mx="auto"
              bg={cardBg}
              borderRadius="3xl"
              border="1px solid"
              borderColor={borderColor}
              boxShadow={ctaShadow}
            >
              {/* Titre final — ton chaleureux, pas corporate */}
              <Heading
                size="xl"
                bgClip="text"
                textTransform="none"
                lineHeight="1.2"
              >
                Rejoindre RESCOE
              </Heading>

              <Text
                fontSize={{ base: 'sm', md: 'md' }}
                color={mutedColor}
                lineHeight="tall"
                maxW="420px"
              >
                Création, transmission et communauté autour de l'art numérique et
                poétique sur blockchain. Un badge NFT unique, des ateliers ouverts,
                une démarche solidaire.
              </Text>

              <Button
                as={NextLink}
                href="/adhesion"
                size="lg"
                px={10}
                py={7}
                fontSize="md"
                fontWeight="bold"
                borderRadius="full"
                boxShadow="md"
                mt={2}
                _hover={{ ...brandHover }}
              >
                Adhérer en 2 minutes
              </Button>

              <Text fontSize="xs" color={mutedColor} opacity={0.45}>
                Association loi 1901 · Sécurisé sur blockchain Base · Sans spéculation
              </Text>
            </VStack>
          </Box>
        </SectionWrapper>

      </Box>
    </>
  );
};

export default Home;
