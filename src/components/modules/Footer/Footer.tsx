import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  Link,
  Center,
  Grid,
  useColorModeValue,
  Divider
} from "@chakra-ui/react";

import NextLink from "next/link";
import { motion } from "framer-motion";
import { FaInstagram, FaQuestionCircle, FaGraduationCap, FaGithub } from "react-icons/fa";
import { SiBluesky } from "react-icons/si";

import { useAuth } from '@/utils/authContext'; // Ajuste le chemin


import { effects, gradients, animations, brandHover } from "@styles/theme";

const MotionBox = motion(Box);

const links = {
  adhesion: "/adhesion",
  faq: "/association/faq",
  formations: "/association/formations",
  instagram: "https://www.instagram.com/r_e_s_c_o_e/",
  bluesky: "https://bsky.app/profile/rescoe.bsky.social",
  github: "https://github.com/Rescoe/Rescoe",
};

export default function Footer() {

  const { address, isAuthenticated } = useAuth(); // ✅ Récupère l'état auth

  const showJoinButton = !isAuthenticated || !address; // Masqué si connecté ET a un address

  const glow = useColorModeValue(effects.glowLight, effects.glowDark);
  const borderGradient = useColorModeValue(
    gradients.cardBorderLight,
    gradients.cardBorderDark
  );

  return (
    <MotionBox
      mt={10}
      px={{ base: 6, md: 12, lg: 20, xl: 24 }}
      py={{ base: 12, md: 16, lg: 20 }}
      position="relative"
      w="full"
      mx={0}
      borderRadius={6}
      minH={{ base: "auto", md: "400px" }}
      overflow="hidden"
      boxShadow={glow}
      bg={useColorModeValue("brand.cream", "brand.navy")}
      _before={{
        content: '""',
        position: "absolute",
        inset: 0,
        padding: "1px",
        background: borderGradient,
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        animation: animations.borderGlow,
      }}
    >
      <VStack
        spacing={{ base: 8, md: 8 }}
        position="relative"
        zIndex={1}
        align="center"
        w="full"
        maxW={{ base: "100%", lg: "1200px" }}
        mx="auto"
      >
        {/* BRAND - Toujours centré */}
        <Heading size={{ base: "lg", md: "xl" }} textAlign="center" mb={1}>
          RESCOE
        </Heading>
        <Text as="span" fontWeight="medium" color="brand.gold" fontSize="sm">
          Association loi 1901
        </Text>

        {/* CTA PRINCIPAL - En haut pour impact max */}
        {showJoinButton ? (
                  <motion.div whileHover={{ scale: 1.05 }} style={{ zIndex: 2 }}>
                    <NextLink href={links.adhesion} passHref>
                      <Button
                        px={12}
                        py={6}
                        rounded="2xl"
                        fontSize={{ base: "md", md: "lg" }}
                        fontWeight="extrabold"
                        bgGradient="linear(to-r, brand.gold,brand.cream, brand.cream,brand.cream, brand.gold)"
                        color="brand.navy"
                        boxShadow={glow}
                        _hover={{ ...brandHover, transform: "scale(1.05)" }}
                        size="lg"
                      >
                        🚀 Rejoindre RESCOE
                      </Button>
                    </NextLink>
                  </motion.div>
                ) : <Divider />}  {/* ✅ Rien si adhérent
                  <Box
                  p={4}
                  borderWidth={2}
                  borderColor="brand.gold"
                  borderRadius="2xl"
                  bg="transparent"
                  textAlign="center"
                  boxShadow="md"
                  _hover={{ borderColor: "brand.mauve" }}
                >

                    <Text fontSize="sm" fontWeight="medium" mb={1}>
                      👋 Bienvenue {address}
                    </Text>
                    <NextLink href="/mon-profil" passHref>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="brand.gold"  // ✅ Or initial
                      _hover={{
                        bg: "brand.gold",  // ✅ Fond or
                        color: "brand.navy" // ✅ Texte navy
                      }}
                    >
                      Mon profil
                    </Button>

                    </NextLink>
                  </Box>
                )}
                */}

        {/* DESCRIPTION PRINCIPALE */}
        <VStack spacing={2} maxW={{ base: "320px", md: "500px", lg: "560px" }} w="full">
          <Text
            fontSize={{ base: "sm", md: "md" }}
            opacity={0.95}
            textAlign="center"
            lineHeight={1.3}
            fontWeight="medium"
          >
            Galerie d'art associative depuis 2018
          </Text>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            opacity={0.8}
            textAlign="center"
            lineHeight={1.4}
          >
            Réseau d'artistes, d'expérimentation et de transmission.
          </Text>

        </VStack>

        {/* MISSION */}
        <Text
          fontSize={{ base: "xs", md: "sm" }}
          opacity={0.75}
          textAlign="center"
          maxW={{ base: "340px", md: "540px", lg: "640px" }}
          px={{ base: 3, md: 6 }}
          lineHeight={1.6}
          fontStyle="italic"
        >
          Infrastructure ouverte pour créer, publier et diffuser des œuvres numériques
          entre pratique artistique, recherche et pédagogie.
        </Text>

        {/* NAVIGATION & COMMUNITY - Parfaitement centrée */}
        <Grid
          templateColumns={{
            base: "repeat(auto-fit, minmax(140px, 1fr))",
            md: "repeat(auto-fit, minmax(160px, 1fr))",
            lg: "repeat(3, 1fr)"
          }}
          gap={{ base: 6, md: 8 }}
          w="full"
          maxW={{ base: "100%", md: "600px", lg: "800px" }}
          justifyContent="center"
        >
          <VStack align="center" spacing={3} textAlign="center">
            <Text fontSize="xs" fontWeight="medium" opacity={0.8}>
              Des Questions ?
            </Text>
            <NextLink href={links.faq} passHref>
              <HStack as={Link} spacing={2} _hover={{ opacity: 0.8 }}>
                <FaQuestionCircle size={14} />

                <Text fontSize="sm">FAQ</Text>
              </HStack>
            </NextLink>
            <NextLink href={links.formations} passHref>
            {/*
              <HStack as={Link} spacing={2} _hover={{ opacity: 0.8 }}>
                <FaQuestionCircle size={14} />
                <Text fontSize="sm">Formations</Text>
              </HStack>
            */}
            </NextLink>
          </VStack>

          <VStack align="center" spacing={3} textAlign="center">
            <Text fontSize="xs" fontWeight="medium" opacity={0.8}>
              Communauté
            </Text>
            <HStack as={Link} href={links.instagram} isExternal spacing={2} _hover={{ opacity: 0.8 }}>
              <FaInstagram size={14} />
              <Text fontSize="sm">Instagram</Text>
            </HStack>
            <HStack as={Link} href={links.bluesky} isExternal spacing={2} _hover={{ opacity: 0.8 }}>
              <SiBluesky size={14} />
              <Text fontSize="sm">Bluesky</Text>
            </HStack>
            <HStack as={Link} href={links.github} isExternal spacing={2} _hover={{ opacity: 0.8 }}>
              <FaGithub size={14} />
              <Text fontSize="sm">Github</Text>
            </HStack>
          </VStack>

          <VStack align="center" spacing={3} textAlign="center" display={{ base: "none", lg: "flex" }}>
            <Text fontSize="xs" fontWeight="medium" opacity={0.8}>
              Depuis 2018
            </Text>
            <Text fontSize="xs" opacity={0.7}>Art onchain</Text>
            <Text fontSize="xs" opacity={0.7}>France</Text>
          </VStack>
        </Grid>

        {/* COPYRIGHT - Parfaitement centré */}
        <Center
          pt={{ base: 6, md: 8 }}
          pb={6}
          w="full"
          borderTopWidth={1}
          borderTopColor="rgba(255,255,255,0.1)"
          mt={4}
          maxW="400px"
        >
          <Text fontSize="xs" opacity={0.6} textAlign="center">
            © 2018 — {new Date().getFullYear()} RESCOE
          </Text>
        </Center>
      </VStack>
    </MotionBox>
  );
}
