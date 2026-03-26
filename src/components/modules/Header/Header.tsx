import { Box, Badge, Tooltip, Container, Button, Menu, MenuButton, MenuList, MenuItem, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, useDisclosure, HStack, VStack, Flex, useColorModeValue, useTheme } from '@chakra-ui/react';
import { FaBug, FaEye, FaEyeSlash, FaBars } from 'react-icons/fa';

import { ChevronDownIcon } from '@chakra-ui/icons';
import React, { useRef, useState, useEffect } from 'react';
import { ColorModeButton } from '../../../components/elements/ColorModeButton';
import { NavBar } from '../../../components/elements/navigation/NavBar';

import { ConnectBouton } from '../ConnectBouton';
import { SoldeWallet } from '../ConnectBouton';

import { GenerativeLogo } from '../../../components/elements/RescoeLogo';
import NextLink from 'next/link';
import { useAuth } from '@/utils/authContext';
import Insecte from '../MoovingInsect';
import SelectInsect from '../InsectSelector';

import { Insect } from '../InsectSelector';

import { motion } from "framer-motion";

const MotionMenuButton = motion(MenuButton);

import { brandHover, hoverStyles } from "@styles/theme"; //Style

// ✅ NOUVELLE LISTE CENTRALE DES ADRESSES RÉSIDENTS
const RESIDENT_ADDRESSES = [
  "0x552C63E3B89ADf749A5C1bB66fE574dF9203FfB4".toLowerCase(),
] as const;

// ✅ CONFIG MÉNUS PAR RÔLE CENTRALISÉE
type RoleKey =
  | "admin"
  | "contributor"
  | "poet"
  | "artist"
  | "trainee"
  | "nonMember";

type RoleMenuItem = {
  label: string;
  href: string;
};

type RoleMenuConfig = {
  label: string;
  items: RoleMenuItem[];
};

const ROLE_MENUS: Record<RoleKey, RoleMenuConfig> = {
  admin: {
    label: "Admin",
    items: [
      { label: "Gestion du site", href: "/u/admin" },
      { label: "Dashboard", href: "/u/dashboard" },
      { label: "Créer une collection", href: "/u/createCollection" },
      { label: "Ajouter des oeuvres", href: "/mint/mintart" },
    ],
  },
  contributor: {
    label: "Contributeur",
    items: [
      { label: "Dashboard", href: "/u/dashboard" },
      { label: "Créer une collection", href: "/u/createCollection" },
      { label: "Ajouter des oeuvres", href: "/mint/mintart" },
    ],
  },
  poet: {
    label: "Poète",
    items: [
      { label: "Dashboard", href: "/u/dashboard" },
      { label: "Créer une collection", href: "/u/createCollection" },
      { label: "Ajouter des poèmes", href: "/mint/poesie" },
    ],
  },
  artist: {
    label: "Artiste",
    items: [
      { label: "Dashboard", href: "/u/dashboard" },
      { label: "Créer une collection", href: "/u/createCollection" },
      { label: "Ajouter des oeuvres", href: "/mint/mintart" },
    ],
  },
  trainee: {
    label: "Apprenti",
    items: [
      { label: "Dashboard", href: "/u/dashboard" },
      { label: "Créer une collection", href: "/u/createCollection" },
      { label: "Ajouter des oeuvres", href: "/mint/mintart" },
      { label: "Accéder aux formations", href: "/association/formations" },
    ],
  },
  nonMember: {
    label: "visiteur",
    items: [
      { label: "Devenir adhérent", href: "/adhesion" },
      { label: "FAQ", href: "/association/faq" },
    ],
  },

};

// ✅ COMPOSANT RoleMenu RÉUTILISABLE (AVEC TOOLTIP RÉSIDENCE)
type RoleMenuProps = {
  config: RoleMenuConfig;
  isResident?: boolean; // ✅ NOUVEAU PROP
};
const RoleMenu: React.FC<RoleMenuProps> = ({ config, isResident = false }) => {
  const boxShadowHover = useColorModeValue(
    "0 0 15px rgba(180, 166, 213, 0.25)", // light
    "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
  );

  return (
    <Tooltip
    label={isResident ? "Résident vérifié ✅" : ""}
    hasArrow
    placement="top"
    shouldWrapChildren
  >
    <Menu>
      <MotionMenuButton
        as={Button}
        px={6}
        py={3}
        fontSize="sm"
        fontWeight={600}
        borderRadius="full"
        letterSpacing={0.4}
        bg="brand.navy"
        color="brand.cream"
        boxShadow="0 8px 28px rgba(0,0,0,0.35)"
        whileHover={{
          scale: 1.03,
          boxShadow: boxShadowHover,
        }}
        _hover={{
          borderColor: "brand.gold",
          bg: "brand.navy",
        }}
        _active={{
          transform: "scale(0.97)",
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        {/* CONTENU */}
        <HStack spacing={2} w="100%" justify="center">
          <Box>{config.label} |</Box>

          <SoldeWallet compact={false} showAddress={false} />

          {isResident && (
            <Badge
              bg="brand.gold"
              color="black"
              variant="solid"
              px={1.5}
              fontSize="9px"
              h="16px"
              borderRadius="full"
              boxShadow="0 0 10px rgba(238,212,132,0.45)"
              title="Résident vérifié"
            >
              ✓
            </Badge>
          )}
        </HStack>
      </MotionMenuButton>

      <MenuList
        backdropFilter="blur(18px)"
        bg="rgba(20,20,24,0.95)"
        border="1px solid whiteAlpha.200"
      >
        <ConnectBouton />

        {config.items.map((item) => (
          <NextLink key={item.href} href={item.href} passHref>
            <MenuItem as="a">{item.label}</MenuItem>
          </NextLink>
        ))}
      </MenuList>
    </Menu>
  </Tooltip>
  );
};


const Header = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const MotionButton = motion(Button)
  const MotionBadge = motion(Badge);

  const [loadStep, setLoadStep] = useState<'auth' | 'role' | 'resident' | 'ready'>('auth');
  const [isResident, setIsResident] = useState(false);
  const [evolutionCount, setEvolutionCount] = useState(0);

  const {
    isAuthenticated,
    isAdmin,
    isArtist,
    isPoet,
    isTrainee,
    isContributor,
    address,
    isMember,
    role,
    web3,
    provider,
    connectWallet,
    connectWithEmail,
    logout,
    roleLoading,
    isLoading,
  } = useAuth();

  const checkIsResident = (userAddress: string | null): boolean => {
    if (!userAddress) return false;
    return RESIDENT_ADDRESSES.includes(userAddress.toLowerCase());
  };

  // ✅ ÉTAPE 1 : Auth basique (100ms delay)
    useEffect(() => {
      if (isAuthenticated && address) {
        setLoadStep('role');
        const timer = setTimeout(() => setLoadStep('resident'), 100);
        return () => clearTimeout(timer);
      }
      setLoadStep('auth');
    }, [isAuthenticated, address]);

    // ✅ ÉTAPE 2 : Rôles (200ms après auth)
    useEffect(() => {
      if (loadStep === 'role' && !roleLoading && role !== null) {
        const timer = setTimeout(() => setLoadStep('resident'), 200);
        return () => clearTimeout(timer);
      }
    }, [loadStep, roleLoading, role]);

    useEffect(() => {
      if (loadStep === 'resident' && address) {
        const residentStatus = checkIsResident(address);
        setIsResident(residentStatus);

        // ✅ UNE SEULE ASSIGNATION FINALE
        (window as any).RESCOE_AUTH = {
          isAuthenticated, address, role, isAdmin, isArtist, isPoet,
          isTrainee, isContributor, isMember, web3, provider,
          connectWallet, connectWithEmail, logout, roleLoading, isLoading,
          isResident: residentStatus,
        };
        setLoadStep('ready');
      }
    }, [loadStep, address, isAuthenticated, role, isAdmin, isArtist, isPoet,
        isTrainee, isContributor, isMember, web3, provider, roleLoading, isLoading]);


  // ✅ boxShadowHover DÉPLACÉ ICI (FIX ERREUR)
  const boxShadowHover = useColorModeValue(
    "0 0 15px rgba(180, 166, 213, 0.25)", // light
    "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
  );


  const [isInsectVisible, setIsInsectVisible] = useState(true);
  const [selectedInsect, setSelectedInsect] = useState<Insect | null>(null);
  const [insectImage, setInsectImage] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const toggleInsectVisibility = () => {
    setIsInsectVisible((prev) => !prev);
  };

  const handleSelectInsect = (insect: Insect) => {
    setSelectedInsect(insect);
    localStorage.setItem('savedInsect', JSON.stringify(insect));
    //console.log(selectedInsect);
    setInsectImage(insect.image);
  };

  useEffect(() => {
    const savedVisibility = localStorage.getItem('insectVisibility');
    if (savedVisibility !== null) {
      setIsInsectVisible(JSON.parse(savedVisibility));
    }
  }, []);

  useEffect(() => {
    const savedInsect = localStorage.getItem('savedInsect');
    if (savedInsect) {
      try {
        const insect = JSON.parse(savedInsect);
        setSelectedInsect(insect);
        setInsectImage(insect.image);
      } catch (error) {
        console.error("Erreur lors de la récupération de l'insecte : " );
      }
    }
  }, []);

  useEffect(() => {

  const handleEvolutionUpdate = (event: any) => {
    const count = event?.detail ?? 0;
    setEvolutionCount(count);
  };

  window.addEventListener(
    "RESCOE_EVOLUTION_COUNT",
    handleEvolutionUpdate as EventListener
  );

  return () => {
    window.removeEventListener(
      "RESCOE_EVOLUTION_COUNT",
      handleEvolutionUpdate as EventListener
    );
  };

}, []);

  useEffect(() => {
    localStorage.setItem('insectVisibility', JSON.stringify(isInsectVisible));
  }, [isInsectVisible]);


  // ✅ UI DE CHARGEMENT PROGRESSIF
if (loadStep !== 'ready' && isAuthenticated) {
      return (
      <Box py={8} textAlign="center">
      <Box
        as={motion.div} // ✅ Motion wrapper
        w="40px" h="40px"
        border="3px solid"
        borderColor="brand.cream"
        borderTopColor="brand.gold"
        borderRadius="full"
        animate={{ rotate: 360 }}

        mx="auto"
        mb={4}
      />
        <Box fontSize="sm" color="brand.cream">
          {loadStep === 'auth' && 'Connexion...'}
          {loadStep === 'role' && 'Chargement rôles...'}
          {loadStep === 'resident' && 'Vérification résident...'}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={headerRef}
      borderBottom="1px"
      role="banner"
        borderBottomColor="brand.cream"
      aria-label="En-tête du site"
      shadow="md"
      px={{ base: 2, md: 4 }}  // ✅ PX=1 base (anti-bord)
      maxW="100vw"             // ✅ Jamais plus large écran
      overflowX="hidden"       // ✅ CUT overflow
      top={0}
      zIndex={1000}
      py={{ base: 2, md: 4 }}  // ✅ ESPACE HAUT/BAS ajouté !
      >

      <Container maxW="container.xl" p="20px">
        <Flex
          align="center"
          justify="space-between"
          flexDirection={{ base: 'column', md: 'row' }}
          w="100%"
          p={4}
          minHeight="70px"
          gap={{ base: 4, md: 0 }}
        >
          {/* Logo */}
          <Box
            style={{ minWidth: '150px', maxWidth: '200px', height: 'auto' }}
            aria-label="Logo de l'association"
          >
            <GenerativeLogo />
          </Box>

          {/* Menu burger mobile */}
          <HStack display={{ base: 'flex', md: 'none' }} gap="20px" aria-label="Menu mobile">
            <Button
              onClick={onOpen}
              variant="ghost"
              aria-label="Ouvrir le menu de navigation"
              _hover={{
                ...hoverStyles.brandHover._hover,
                ...brandHover,
              }}
              _focus={{ boxShadow: 'outline' }}
              fontSize="2xl"
            >
              <FaBars />
            </Button>
          </HStack>

          {/* Menu desktop */}
          <HStack
            display={{ base: 'none', md: 'flex' }}
            gap="20px"
            aria-label="Menu de navigation principal"
          >
            <NavBar />
          </HStack>

          {/* Boutons utilisateur et rôles */}
          <HStack
            gap="20px"
            spacing={{ base: 2, md: 4 }}
            direction={{ base: 'column', md: 'row' }}
            aria-label="Actions utilisateur"
          >

            {/* ✅ MÉNUS RÔLE-BASED (TOOLTIP RÉSIDENCE INTÉGRÉ !) */}
            {isMember && (
              <>
                {isAdmin && <RoleMenu config={ROLE_MENUS.admin} isResident={isResident} />}
                {isContributor && <RoleMenu config={ROLE_MENUS.contributor} isResident={isResident} />}
                {isPoet && <RoleMenu config={ROLE_MENUS.poet} isResident={isResident} />}
                {isArtist && <RoleMenu config={ROLE_MENUS.artist} isResident={isResident} />}
                {isTrainee && <RoleMenu config={ROLE_MENUS.trainee} isResident={isResident} />}
              </>
            )}

            {/* ✅ CONNECTÉ MAIS PAS ENCORE TYPÉ / rôle null (FIX boxShadowHover) */}
            {isAuthenticated && role === null && (
              <Menu>
                <MotionMenuButton
                  as={Button}
                  px={10}
                  py={6}
                  fontSize="sm"
                  fontWeight="bold"
                  borderRadius="full"
                  boxShadow="lg"
                  border="1px solid"
                  whileHover={{ scale: 1.03, boxShadow: boxShadowHover }}
                  _hover={{ ...hoverStyles.brandHover._hover, ...brandHover }}
                  _active={{ transform: "scale(0.98)" }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  Connecté (non-adhérent)
                </MotionMenuButton>
                <MenuList bg="gray.800" borderColor="brand.cream">
                  <NextLink href="/adhesion" passHref>
                    <MenuItem as="a">Devenir adhérent</MenuItem>
                  </NextLink>
                </MenuList>
              </Menu>
            )}

            {/* ✅ MENU INSECTE (inchangé) */}
            {isAuthenticated && isMember && role !== "non-member" && (
              <HStack spacing={4} cursor="pointer" aria-label="Menu insecte">
                <Menu>
                <MotionMenuButton
                  as={Button}
                  position="relative"
                >
                  <FaBug />
                  {evolutionCount > 0 && (
                    <MotionBadge
                      position="absolute"
                      top="-6px"
                      right="-6px"
                      bg="brand.gold"
                      color="black"
                      fontSize="9px"
                      borderRadius="full"
                      px={1.5}
                      animate={{
                        scale: [1, 1.25, 1],
                        opacity: [1, 0.6, 1]
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity
                      }}
                    >
                      {evolutionCount}
                    </MotionBadge>
                  )}
                </MotionMenuButton>

                  <MenuList
                    bg="gray.800"
                    borderColor="brand.cream"
                    minW="0"
                    w={{ base: "92vw", md: "320px" }}
                    maxW="92vw"
                    overflowX="hidden"
                  >                    <Box mt={4} display="flex" justifyContent="center" />
                    <MenuItem onClick={toggleInsectVisibility}>
                      {isInsectVisible ? (
                        <>
                          <FaEyeSlash />
                          <Box ml={2}>Cacher</Box>
                        </>
                      ) : (
                        <>
                          <FaEye />
                          <Box ml={2}>Voir</Box>
                        </>
                      )}
                    </MenuItem>
                    <Box as="div" p={2} w="100%" maxW="100%" overflow="hidden">
                      <SelectInsect onSelect={handleSelectInsect} />
                    </Box>
                  </MenuList>
                </Menu>
              </HStack>
            )}



            {/* ✅ RÔLE NON-MEMBER (TOOLTIP RÉSIDENCE aussi !) */}
            {isAuthenticated && role === "non-member" && (
              <RoleMenu config={ROLE_MENUS.nonMember} isResident={isResident} />
            )}



            {/* ✅ MENU NON-CONNECTÉ (quand PAS authentifié) */}
            {!isAuthenticated && (
              <>
                {/* Menu simple - FIXED */}
                <Menu>
                <MotionMenuButton
                  as={Button}
                  py={4}
                  minW="auto"
                  maxW={{ base: "calc(100vw - 40px)", md: "160px" }}
                  fontSize={{ base: "sm", md: "md" }}
                  fontWeight={600}
                  borderRadius="full"
                  letterSpacing={0.5}
                  whiteSpace="nowrap"
                  boxShadow="0 10px 40px rgba(238,212,132,0.25)"
                  border="1px solid brand.cream"
                  whileTap={{ scale: 0.98 }}
                  _active={{ transform: "scale(0.98)" }}
                  mx={1}
                  bg="brand.navy"
                  color="brand.cream"
                  _hover={{ bg: "brand.blue" }}
                >
                  Découvrir
                </MotionMenuButton>
                    <MenuList bg="gray.800" borderColor="brand.cream">

                    <NextLink href="/association/rescoe" passHref>
                      <MenuItem as="a">L'association</MenuItem>
                    </NextLink>

                    <NextLink href="/association/adherent" passHref>
                      <MenuItem as="a">Les adhérents</MenuItem>
                    </NextLink>

                    <NextLink href="/association/faq" passHref>
                      <MenuItem as="a">La FAQ</MenuItem>
                    </NextLink>

                    {/* Adhérer - MenuItem stylé + Tooltip intégré */}
                    {isAuthenticated ? (
                      <NextLink href="/adhesion" passHref>
                      <MenuItem>
                        🚀 Adhérer
                      </MenuItem>

                      </NextLink>
                    ) : (
                      <Tooltip label="Connectez votre wallet pour adhérer">
                        <MenuItem
                        isDisabled={!isAuthenticated}
                        aria-disabled={!isAuthenticated}
                        >
                          🚀 Adhérer
                        </MenuItem>
                      </Tooltip>
                    )}


                    </MenuList>
                </Menu>

                {/* ConnectBouton séparé */}
                <ConnectBouton />
              </>
            )}

          </HStack>
        </Flex>

        {/* Affichage insecte (inchangé) */}
        {isAuthenticated && isInsectVisible && selectedInsect && (
          <Box mt={4} display="flex" justifyContent="center" aria-live="polite" aria-atomic="true">
            <Insecte
              headerRef={headerRef}
              selectedInsect={selectedInsect.image}
              level={selectedInsect.level ?? 0}
            />
          </Box>
        )}

        {/* Drawer mobile (inchangé) */}
        <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xs" returnFocusOnClose={false}>
          <DrawerOverlay />
          <DrawerContent bg="gray.900" color="gray.100">
            <DrawerCloseButton _focus={{ boxShadow: 'outline' }} />
            <DrawerHeader
              borderBottomWidth="1px"
              borderBottomColor="brand.cream"
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              pr={12}   // espace pour la croix
            >
              <Box>Menu</Box>
              <ColorModeButton />
            </DrawerHeader>

            <DrawerBody>
              <VStack align="start" spacing={4}>
                <NavBar />
              </VStack>

            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Container>
    </Box>
  );
};

export default Header;
