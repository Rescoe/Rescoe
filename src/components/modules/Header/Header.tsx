import { Box, Tooltip, Container, Button, Menu, MenuButton, MenuList, MenuItem, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, useDisclosure, HStack, VStack, Flex, useColorModeValue, useTheme } from '@chakra-ui/react';
import { FaBug, FaEye, FaEyeSlash, FaBars } from 'react-icons/fa';
import { Badge } from '@chakra-ui/react'; // ✅ À ajouter en haut si pas déjà

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
          px={10}
          py={6}
          fontSize="sm"
          fontWeight="bold"
          borderRadius="full"
          boxShadow="lg"
          border="1px solid"
          color="white"
          whileHover={{
            scale: 1.03,
            boxShadow: boxShadowHover,
          }}
          _hover={{
            ...hoverStyles.brandHover._hover,
            ...brandHover,
          }}
          _active={{
            transform: "scale(0.98)",
          }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >


          {/* ✅ CONTENU : RÔLE + MACARON À L'INTÉRIEUR */}
          <HStack spacing={1} w="100%" justify="center">

            <Box>{config.label} | </Box>
            <SoldeWallet compact={false} showAddress={false} />


            {isResident && (
              <Badge
                colorScheme="green"
                variant="solid"
                size="xs"
                px={1}
                fontSize="9px"
                h="16px"
                borderRadius="full"
                boxShadow="sm"
                title="Résident vérifié"
              >
                ✓
              </Badge>
            )}
          </HStack>
        </MotionMenuButton>

        <MenuList bg="gray.800" borderColor="purple.600">
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

  // ✅ ÉTAT CENTRALISÉ : est-ce que l'utilisateur actuel est résident ?
  const [isResident, setIsResident] = useState(false);

  // ✅ boxShadowHover DÉPLACÉ ICI (FIX ERREUR)
  const boxShadowHover = useColorModeValue(
    "0 0 15px rgba(180, 166, 213, 0.25)", // light
    "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
  );

  // ✅ FONCTION UTILITAIRE pour vérifier si une adresse est résidente
  const checkIsResident = (userAddress: string | null): boolean => {
    if (!userAddress) return false;
    return RESIDENT_ADDRESSES.includes(userAddress as string);
  };

  // ✅ VERIFICATION AUTOMATIQUE à chaque changement d'adresse
  // ✅ REMPLACEZ TOUT le useEffect (lignes ~200-260) par ÇA :
useEffect(() => {
  const residentStatus = checkIsResident(address);
  setIsResident(residentStatus);

  // ✅ UN SEUL OBJET avec TOUTES les valeurs ACTUELLES
  const authData = {
    isAuthenticated,
    address,
    role,
    isAdmin,
    isArtist,
    isPoet,
    isTrainee,
    isContributor,
    isMember,
    web3,
    provider,
    connectWallet,
    connectWithEmail,
    logout,
    roleLoading,
    isLoading,
    isResident: residentStatus,  // ✅ isResident inclus !
  } as any;

  // ✅ ASSIGNATION DIRECTE (pas d'update ligne par ligne)
  (window as any).RESCOE_AUTH = authData;

}, [
  address, isAuthenticated, role, isAdmin, isArtist, isPoet,
  isTrainee, isContributor, isMember, web3, provider,
  roleLoading, isLoading, connectWallet, connectWithEmail, logout
]);


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
    localStorage.setItem('insectVisibility', JSON.stringify(isInsectVisible));
  }, [isInsectVisible]);

  return (
    <Box
      ref={headerRef}
      borderBottom="1px"
      role="banner"
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
            style={{ minWidth: '150px', maxWidth: '150px', height: 'auto' }}
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
                <MenuList bg="gray.800" borderColor="purple.600">
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
                  <MenuButton as="div">
                    <Button size="sm" aria-haspopup="true" aria-expanded="false">
                      <FaBug />
                    </Button>
                  </MenuButton>
                  <MenuList bg="gray.800" borderColor="purple.600" minW="180px">
                    <Box mt={4} display="flex" justifyContent="center" />
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
                    <Box as="div" p={2}>
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
                      px={10}
                      py={6}
                      fontSize="sm"
                      fontWeight="bold"
                      borderRadius="full"
                      boxShadow="lg"
                      border="1px solid whiteAlpha.300"
                      whileHover={{ scale: 1.03, boxShadow: boxShadowHover }}
                      _hover={{ ...hoverStyles.brandHover._hover, ...brandHover }}
                      _active={{ transform: "scale(0.98)" }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      Explorez
                    </MotionMenuButton>
                    <MenuList bg="gray.800" borderColor="purple.600">

                    <NextLink href="/association/rescoe" passHref>
                      <MenuItem as="a">Décourir l'asso</MenuItem>
                    </NextLink>

                    <NextLink href="/association/adherent" passHref>
                      <MenuItem as="a">Voir les adhérents</MenuItem>
                    </NextLink>

                      <NextLink href="/association/faq" passHref>
                        <MenuItem as="a">FAQ</MenuItem>
                      </NextLink>
                      <Tooltip label="Veuillez d'abord connecter votre wallet pour adhérer" aria-label="Aide Adhésion">

                      <NextLink href="/adhesion" passHref>
                        <Button
                          px={4}
                          py={6}
                          fontSize="sm"
                          borderRadius="full"
                          boxShadow="lg"
                          _hover={{
                            ...hoverStyles.brandHover._hover,
                            ...brandHover,
                          }}
                          _active={{
                            transform: "scale(0.9)",
                          }}
                          transition="all 0.25s ease"
                          isDisabled={!isAuthenticated}
                          aria-disabled={!isAuthenticated}
                        >
                          Adhérer
                        </Button>
                      </NextLink>
                      </Tooltip>

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
            <DrawerHeader borderBottomWidth="1px" borderBottomColor="purple.600">
              Menu
            </DrawerHeader>
            <DrawerBody>
              <VStack align="start" spacing={4}>
                <NavBar />
              </VStack>

              <Box py={6} borderRadius="full">
                <ColorModeButton />
              </Box>

            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Container>
    </Box>
  );
};

export default Header;
