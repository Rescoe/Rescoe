import { Box, Link, Text, VStack, HStack, Button, Center, Heading } from '@chakra-ui/react';
import { FaInstagram } from 'react-icons/fa';
import { SiBluesky } from 'react-icons/si';
import NextLink from 'next/link';
import { motion } from "framer-motion";

// Animation pulsante pour le bouton "Adhérez"
import { pulse } from "@styles/theme";
import { brandHover, hoverStyles } from "@styles/theme"; //Style



const links = {
  adhesion: '/adhesion',
  instagram: 'https://www.instagram.com/r_e_s_c_o_e/', // Remplace par le bon lien
  bluesky: 'https://bsky.app/profile/rescoe.bsky.social', // Remplace par le bon lien
};




const Footer = () => {
  return (

    <Box
      mt={10}
      textAlign="center"
      p={4}
      boxShadow="dark-lg"
      borderWidth={1}
      borderRadius="lg"
      border="1px solid"
      borderColor="purple.300"
      maxWidth="95%" // Limite la largeur de la box
      mx="auto"
    >
      <VStack spacing={3}>
      <Heading fontSize="lg" fontWeight="bold"> RESCOE </Heading>
        <Heading fontSize="md" fontWeight="bold">
          Réseau expérimental solidaire de Crypto Œuvres émergentes
        </Heading>

        <Box>
          <Text fontSize="m" fontWeight="bold" mb={2}>
            Rejoignez le réseau !
          </Text>

          {/* Bouton d’appel à l’action (CTA) */}

          <NextLink href="/adhesion" passHref>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            viewport={{ once: true }}
          >
          <Center mt={10}>


            <Button
              as={NextLink}
              href="/adhesion"
              size="lg"
              px={12}
              py={6}
              fontWeight="bold"
              rounded="full"
              _hover={{
                ...hoverStyles.brandHover._hover,
                ...brandHover,
                transform: "scale(1.05)",
                transition: "all 0.3s ease",
              }}
              animation={`${pulse} 2s infinite`}
              boxShadow="0 8px 32px rgba(168, 85, 247, 0.25)"
            >
            🚀 Adhérez Maintenant
            </Button>
          </Center>

          </motion.div>

          </NextLink>
        </Box>

        <Text fontSize="md" mt={4}>Suivez-nous :</Text>

        <HStack spacing={5} mt={2}>
          <Link href={links.instagram} isExternal display="flex" alignItems="center">
            <FaInstagram size={20} />
            <Text ml={2}>Instagram</Text>
          </Link>
          <Link href={links.bluesky} isExternal display="flex" alignItems="center">
            <SiBluesky size={20} />
            <Text ml={2}>Bluesky</Text>
          </Link>
        </HStack>

        <Text fontSize="xs" mt={4}>
          &copy; 2018 - {new Date().getFullYear()} RESCOE. Tous droits réservés.
        </Text>
      </VStack>
    </Box>
  );
};

export default Footer;


/*
import { Box, Link, Text, VStack, HStack, Button, Center, Heading, useToast, useColorModeValue, useColorMode } from '@chakra-ui/react';
import { FaInstagram } from 'react-icons/fa';
import { SiBluesky } from 'react-icons/si';
import NextLink from 'next/link';
import { motion } from "framer-motion";
import RoleBasedNFTPage from '@/components/containers/home/Adhesion'; // Importez votre composant de notice d'adhésion

// Animation pulsante pour le bouton "Adhérez"
import { pulse } from "@styles/theme";
import { brandHover, hoverStyles } from "@styles/theme"; //Style
import { gradients, animations, Backgrounds } from "@/styles/theme";


const Footer = () => {
    const toast = useToast();
    const { colorMode } = useColorMode();
    const bgColor = useColorModeValue(Backgrounds.cardBorderLight, Backgrounds.cardBorderDark);

    const showMembershipToast = () => {
    const toastId = toast({
          position: "bottom",
                  duration: null,
                  isClosable: true,
                  render: () => (
                      <Box
                          position="fixed"
                          top={0}
                          left={0}
                          w="100vw"
                          h="100vh"
                          p="1px"

                          overflow="hidden"
                          zIndex={1500}
                          display="flex"
                          justifyContent="center"
                          alignItems="center"
                          onClick={() => toast.close(toastId)} // clique dehors ferme le toast
                      >
                          <Box
                              borderRadius="md"
                              maxH="90vh"
                              w="95%"
                              p="3px"
                              overflowY="auto"
                              bgGradient={
                                  colorMode === "light"
                                      ? gradients.cardBorderLight
                                      : gradients.cardBorderDark
                              }
                              backgroundSize="300% 300%"
                              animation={animations.borderGlow}
                              boxShadow="lg"
                              onClick={(e) => e.stopPropagation()} // empêche la fermeture si on clique dedans
                          >
            <Box borderRadius="xl" height="100%" p={4} textAlign="center" bg={bgColor}>

                <Button
                    position="absolute"
                    right="10px"
                    top="10px"
                    onClick={() => toast.close(toastId)} // Ferme le toast
                    aria-label="Close" // Accessibilité
                >
                    &times;
                </Button>
                <RoleBasedNFTPage />
                </Box>
            </Box>
            </Box>
        ),
    });

    // Gérer la fermeture en cliquant à l'extérieur
    const handleClickOutside = (event) => {
        const toastElement = document.getElementById(`chakra-toast-${toastId}`);
        if (toastElement && !toastElement.contains(event.target)) {
            toast.close(toastId); // Ferme le toast si le clic est à l'extérieur
        }
    };

    // Ajout d'un écouteur d'événements
    window.addEventListener("click", handleClickOutside);

    return () => {
        window.removeEventListener("click", handleClickOutside); // Nettoyage lors de la fermeture
    };
};


    return (
        <Box
            mt={10}
            textAlign="center"
            p={4}
            boxShadow="dark-lg"
            borderWidth={1}
            borderRadius="lg"
            border="1px solid"
            maxWidth="95%"
            mx="auto"
        >
            <VStack spacing={3}>
                <Heading fontSize="lg" fontWeight="bold"> RESCOE </Heading>
                <Heading fontSize="md" fontWeight="bold">
                    Réseau expérimental solidaire de Crypto Œuvres émergentes
                </Heading>

                <Box>
                    <Text fontSize="m" fontWeight="bold" mb={2}>
                        Rejoignez le réseau !
                    </Text>

                    <Center mt={10}>
                        <Button
                          size="lg"
                          px={12}
                          py={6}
                          fontWeight="bold"
                          rounded="full"
                          _hover={{
                            ...hoverStyles.brandHover._hover,
                            ...brandHover,
                            transform: "scale(1.05)",
                            transition: "all 0.3s ease",
                          }}
                          animation={`${pulse} 2s infinite`}
                          boxShadow="0 8px 32px rgba(168, 85, 247, 0.25)"
                          onClick={showMembershipToast} // Appelle le toast au clic
                        >
                        🚀 Adhérez Maintenant
                        </Button>
                    </Center>
                </Box>

                <Text fontSize="md" mt={4}>Suivez-nous :</Text>

                <HStack spacing={5} mt={2}>
                    <Link href="https://www.instagram.com/r_e_s_c_o_e/" isExternal display="flex" alignItems="center">
                        <FaInstagram size={20} />
                        <Text ml={2}>Instagram</Text>
                    </Link>
                    <Link href="https://bsky.app/profile/rescoe.bsky.social" isExternal display="flex" alignItems="center">
                        <SiBluesky size={20} />
                        <Text ml={2}>Bluesky</Text>
                    </Link>
                </HStack>

                <Text fontSize="xs" mt={4}>
                    &copy; 2018 - {new Date().getFullYear()} RESCOE. Tous droits réservés.
                </Text>
            </VStack>
        </Box>
    );
};

export default Footer;
*/
