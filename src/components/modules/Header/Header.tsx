//Header :
import { Box, Tooltip, Container, Button, Menu, MenuButton, MenuList, MenuItem, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay, useDisclosure, HStack, VStack, Flex } from '@chakra-ui/react';
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
    <Box ref={headerRef} borderBottom="1px" borderBottomColor="chakra-border-color">
      <Container maxW="container.xl" p={'20px'}>
        <Flex align="center" justify="space-between" flexDirection={{ base: 'column', md: 'row' }} w="100%" p={4} minHeight="70px">
          {/* Logo avec taille fixe et non affecté par le Flex */}
          <Box style={{ minWidth: '150px', maxWidth: '150px', height: 'auto' }}>
            <GenerativeLogo />
          </Box>

          {/* Affichage conditionnel du NavBar pour mobile */}
          <HStack display={{ base: 'flex', md: 'none' }} gap={'20px'}>
            <Button onClick={onOpen} variant="ghost" aria-label="Ouvrir le menu">
              <FaBars />
            </Button>
          </HStack>

          <HStack display={{ base: 'none', md: 'flex' }} gap={'20px'}>
            <NavBar />
          </HStack>

          {/* Autres éléments */}
          <HStack gap={'20px'} spacing={{ base: 2, md: 4 }} direction={{ base: 'column', md: 'row' }}>
            <ConnectBouton />

            {isAdmin && (
              <Menu>
                <MenuButton as={Button} rightIcon={<ChevronDownIcon />} colorScheme="green" size="sm">
                  Admin
                </MenuButton>
                <MenuList>
                  <NextLink href="/u/admin" passHref>
                    <MenuItem>Gestion du site</MenuItem>
                  </NextLink>
                  <NextLink href="/u/dashboard" passHref>
                    <MenuItem>Dashboard</MenuItem>
                  </NextLink>
                </MenuList>
              </Menu>
            )}

            {isPoet && (
              <NextLink href="/u/dashboard" passHref>
                <Button colorScheme="blue" size="sm">
                  Poète
                </Button>
              </NextLink>
            )}

            {isArtist && (
              <NextLink href="/u/dashboard" passHref>
                <Button colorScheme="purple" size="sm">
                  Artiste
                </Button>
              </NextLink>
            )}

            {isTrainee && (
              <NextLink href="/u/dashboard" passHref>
                <Button colorScheme="orange" size="sm">
                  Apprenti
                </Button>
              </NextLink>
            )}

            {isContributor && (
              <NextLink href="/u/dashboard" passHref>
                <Button colorScheme="teal" size="sm">
                  Contributeur
                </Button>
              </NextLink>
            )}

            {isAuthenticated && (
              <HStack spacing={4} cursor="pointer">
                <Menu>
                  <MenuButton as="div">
                    <Button colorScheme="teal" size="sm">
                      <FaBug />
                    </Button>
                  </MenuButton>
                  <MenuList>
                    <Box mt={4} display="flex" justifyContent="center">
                    </Box>
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

            {isAuthenticated ? (
              <Box mt={4} display="flex" justifyContent="center">
                {isInsectVisible && selectedInsect && (
                  <Insecte
                    headerRef={headerRef}
                    selectedInsect={selectedInsect.image}
                  />
                )}
              </Box>
            ) : (
              <Tooltip label="Veuillez d'abord connecter votre wallet pour adhérer" aria-label="Aide Adhésion">
                <span>
                  <NextLink href="/adhesion" passHref>
                    <Button
                      colorScheme="yellow"
                      size="sm"
                      isDisabled={!isAuthenticated}
                    >
                      Adhérer
                    </Button>
                  </NextLink>
                </span>
              </Tooltip>
            )}

            <ColorModeButton />
          </HStack>
        </Flex>

        {/* Drawer pour mobile */}
        <Drawer isOpen={isOpen} onClose={onClose} placement="right">
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>Menu</DrawerHeader>
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
