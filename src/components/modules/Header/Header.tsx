//Header :
import { Box, Tooltip, Container, Button, Menu, MenuButton, MenuList, MenuItem, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, useDisclosure, HStack, VStack, Flex, useColorModeValue, useTheme } from '@chakra-ui/react';
import { FaBug, FaEye, FaEyeSlash, FaBars } from 'react-icons/fa';
import { ChevronDownIcon } from '@chakra-ui/icons';
import React, { useRef, useState, useEffect } from 'react';
import { ColorModeButton } from '../../../components/elements/ColorModeButton';
import { NavBar } from '../../../components/elements/navigation/NavBar';

import { ConnectBouton } from '../ConnectBouton';
import { GenerativeLogo } from '../../../components/elements/RescoeLogo';
import NextLink from 'next/link';
import { useAuth } from '../../../utils/authContext';
import Insecte from '../MoovingInsect';
import SelectInsect from '../InsectSelector';

import { Insect } from '../InsectSelector';

import { motion } from "framer-motion";

const MotionMenuButton = motion(MenuButton);

import { brandHover, hoverStyles } from "@styles/theme"; //Style

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
  } = useAuth();

  //console.log(role);

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
    console.log(selectedInsect);
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


  const boxShadowHover = useColorModeValue(
  "0 0 15px rgba(180, 166, 213, 0.25)", // light
  "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
);


  return (
  <Box
    ref={headerRef}
    borderBottom="1px"
    role="banner"
    aria-label="En-tête du site"
    shadow="md"
    top={0}
    zIndex={1000}
  >

    <Container
    maxW="container.xl" p="20px"
    >
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
          <ConnectBouton />

          {isAdmin && isMember && (
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
                Admin
              </MotionMenuButton>
              <MenuList bg="gray.800" borderColor="purple.600">
                <NextLink href="/u/admin" passHref>
                  <MenuItem as="a">Gestion du site</MenuItem>
                </NextLink>
                <NextLink href="/u/dashboard" passHref>
                  <MenuItem as="a">Dashboard</MenuItem>
                </NextLink>
                <NextLink href="/u/createCollection" passHref>
                  <MenuItem as="a">Créer une collection</MenuItem>
                </NextLink>
                <NextLink href="/mint/mintart" passHref>
                  <MenuItem as="a">Ajouter des oeuvres</MenuItem>
                </NextLink>
              </MenuList>
            </Menu>
          )}

          {isContributor && isMember && (
            <Menu>
            <MotionMenuButton
              as={Button}
              px={10}
              py={6}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="full"
              color="white"
              boxShadow="lg"
              border="1px solid"
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
              Contributeur
              </MotionMenuButton>

              <MenuList bg="gray.800" borderColor="purple.600">
                <NextLink href="/u/dashboard" passHref>
                  <MenuItem as="a">Dashboard</MenuItem>
                </NextLink>
                <NextLink href="/u/createCollection" passHref>
                  <MenuItem as="a">Créer une collection</MenuItem>
                </NextLink>
                <NextLink href="/mint/mintart" passHref>
                  <MenuItem as="a">Ajouter des oeuvres</MenuItem>
                </NextLink>
              </MenuList>
            </Menu>
            )}

          {isPoet && isMember && (
            <Menu>
            <MotionMenuButton
                as={Button}
                px={10}
                py={6}
                fontSize="sm"
                fontWeight="bold"
                borderRadius="full"
                color="white"
                boxShadow="lg"
                border="1px solid"
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
                Poète
                </MotionMenuButton>
              <MenuList bg="gray.800" borderColor="purple.600">
                <NextLink href="/u/dashboard" passHref>
                  <MenuItem as="a">Dashboard</MenuItem>
                </NextLink>
                <NextLink href="/u/createCollection" passHref>
                  <MenuItem as="a">Créer une collection</MenuItem>
                </NextLink>
                <NextLink href="/mint/poesie" passHref>
                  <MenuItem as="a">Ajouter des poèmes</MenuItem>
                </NextLink>
              </MenuList>
            </Menu>          )}

          {isArtist && isMember && (
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
                Artiste
                </MotionMenuButton>


              <MenuList bg="gray.800" borderColor="purple.600">
                <NextLink href="/u/dashboard" passHref>
                  <MenuItem as="a">Dashboard</MenuItem>
                </NextLink>
                <NextLink href="/u/createCollection" passHref>
                  <MenuItem as="a"> Créer une collection</MenuItem>
                </NextLink>
                <NextLink href="/mint/mintart" passHref>
                  <MenuItem as="a">Ajouter des oeuvres</MenuItem>
                </NextLink>
              </MenuList>
            </Menu>
          )}

          {isTrainee && isMember && (
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
                Apprenti
                </MotionMenuButton>


                <MenuList bg="gray.800" borderColor="purple.600">
                  <NextLink href="/u/dashboard" passHref>
                    <MenuItem as="a">Dashboard</MenuItem>
                  </NextLink>
                  <NextLink href="/u/createCollection" passHref>
                    <MenuItem as="a"> Créer une collection</MenuItem>
                  </NextLink>
                  <NextLink href="/mint/mintart" passHref>
                    <MenuItem as="a">Ajouter des oeuvres</MenuItem>
                  </NextLink>
                  <NextLink href="/association/formations" passHref>
                    <MenuItem as="a">Accéder aux formations</MenuItem>
                  </NextLink>
                </MenuList>
              </Menu>
          )}

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



          {isAuthenticated && isMember && role !== "non-member" && (
            <HStack spacing={4} cursor="pointer" aria-label="Menu insecte" >
              <Menu>
                <MenuButton as="div">
                  <Button size="sm" aria-haspopup="true" aria-expanded="false"
                   >
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

          {!isAuthenticated && (
            <Tooltip label="Veuillez d'abord connecter votre wallet pour adhérer" aria-label="Aide Adhésion">
              <span>

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
              </span>
            </Tooltip>
          )}

          {isAuthenticated && role === "non-member" && (
            <Box>
              {/* Menu non-adhérent */}
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
                  Non-adhérent
                </MotionMenuButton>

                <MenuList bg="gray.800" borderColor="purple.600">
                  {/* Ici tu peux ajouter tout le "bazar" de menu que tu veux */}
                  <NextLink href="/adhesion" passHref>
                    <MenuItem as="a">Devenir adhérent</MenuItem>
                  </NextLink>
                  {/* Exemple de menu supplémentaire */}
                  <NextLink href="/faq" passHref>
                    <MenuItem as="a">FAQ</MenuItem>
                  </NextLink>
                </MenuList>
              </Menu>

            </Box>
          )}


          <Box
          py={6}
          borderRadius="full"
          >
            <ColorModeButton />
          </Box>


        </HStack>
      </Flex>


      {/* Affichage insecte */}
      {isAuthenticated && isInsectVisible && selectedInsect && (
        <Box mt={4} display="flex" justifyContent="center" aria-live="polite" aria-atomic="true">
        {isAuthenticated && isInsectVisible && selectedInsect && (
          <Box mt={4} display="flex" justifyContent="center">
            <Insecte
              headerRef={headerRef}
              selectedInsect={selectedInsect.image}
              level={selectedInsect.level ?? 0}
            />
          </Box>
        )}


        </Box>
      )}

      {/* Drawer mobile */}
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
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Container>
  </Box>
);
};

export default Header;
