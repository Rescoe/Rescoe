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

import { brandHover, hoverStyles } from "@styles/theme"; //Style


interface AuthContextType {
  address: string | null;
  role: 'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' | null;
  isMember: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isPoet: boolean;
  isTrainee: boolean;
  isContributor: boolean;
  isAuthenticated: boolean;
  setAddress: (address: string | null) => void;
  setIsAuthenticated: (status: boolean) => void; // Ensure this matches what's provided
}


const Header = () => {
  const headerRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const theme = useTheme();


  const { isAdmin, isArtist, isPoet, isTrainee, isContributor, address, isMember } = useAuth();
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

          {isAdmin && (
            <Menu>
              <MenuButton
                as={Button}
                px={10}
                py={6}
                fontSize="sm"
                fontWeight="bold"
                borderRadius="full"
                boxShadow="lg"
                _hover={{
                  ...hoverStyles.brandHover._hover,
                  ...brandHover,
                }}
                _active={{
                  transform: "scale(0.98)",
                }}
                transition="all 0.25s ease"
              >
                Admin
              </MenuButton>
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

          {isContributor && (
            <Menu>
            <MenuButton
              as={Button}
              px={10}
              py={6}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="full"
              color="white"
              boxShadow="lg"
              _hover={{
                ...hoverStyles.brandHover._hover,
                ...brandHover,
              }}
              _active={{
                transform: "scale(0.98)",
              }}
              transition="all 0.25s ease"
            >
              Contributeur
              </MenuButton>

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

          {isPoet && (
            <Menu>
            <MenuButton
                as={Button}
                px={10}
                py={6}
                fontSize="sm"
                fontWeight="bold"
                borderRadius="full"
                color="white"
                boxShadow="lg"
                _hover={{
                  ...hoverStyles.brandHover._hover,
                  ...brandHover,
                }}
                _active={{
                  transform: "scale(0.98)",
                }}
                transition="all 0.25s ease"
              >
                Poète
                </MenuButton>
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

          {isArtist && (
            <Menu>
            <MenuButton
                as={Button}
                px={10}
                py={6}
                fontSize="sm"
                fontWeight="bold"
                borderRadius="full"
                boxShadow="lg"
                _hover={{
                  ...hoverStyles.brandHover._hover,
                  ...brandHover,
                }}
                _active={{
                  transform: "scale(0.98)",
                }}
                transition="all 0.25s ease"
              >
                Artiste
                </MenuButton>

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

          {isTrainee && (
            <Menu>
            <MenuButton
                as={Button}
                px={10}
                py={6}
                fontSize="sm"
                fontWeight="bold"
                borderRadius="full"
                boxShadow="lg"
                _hover={{
                  ...hoverStyles.brandHover._hover,
                  ...brandHover,
                }}
                _active={{
                  transform: "scale(0.98)",
                }}
                transition="all 0.25s ease"
              >
                Apprenti
                </MenuButton>
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

          {isAuthenticated && (
            <HStack spacing={4} cursor="pointer" aria-label="Menu insecte">
              <Menu>
                <MenuButton as="div">
                  <Button colorScheme="teal" size="sm" aria-haspopup="true" aria-expanded="false">
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

          <Box
          py={6}
          fontSize="sm"
          fontWeight="bold"
          borderRadius="full"
          boxShadow="lg"
          >
            <ColorModeButton />
          </Box>


        </HStack>
      </Flex>


      {/* Affichage insecte */}
      {isAuthenticated && isInsectVisible && selectedInsect && (
        <Box mt={4} display="flex" justifyContent="center" aria-live="polite" aria-atomic="true">
          <Insecte headerRef={headerRef} selectedInsect={selectedInsect.image} />
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
