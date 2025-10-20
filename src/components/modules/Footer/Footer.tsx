import { Box, Link, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { FaInstagram } from 'react-icons/fa';
import { SiBluesky } from 'react-icons/si';
import NextLink from 'next/link';
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

// Animation pulsante pour le bouton "Adhérez"
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.6); }
  70% { box-shadow: 0 0 0 15px rgba(236, 72, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
`;


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
        <Text fontSize="lg" fontWeight="bold">RESCOE</Text>
        <Text fontSize="md" fontWeight="bold">
          Réseau expérimental solidaire de Crypto Œuvres émergentes
        </Text>

        <Box>
          <Text fontSize="m" fontWeight="bold" mb={2}>
            Rejoignez le réseau !
          </Text>
          <NextLink href="/adhesion" passHref>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            viewport={{ once: true }}
          >
          <Button
            mt={10}
            px={12}
            py={7}
            fontWeight="bold"
            fontSize="lg"
            borderRadius="full"
            bgGradient="linear(to-r, purple.700, pink.600)"
            color="white"
            animation={`${pulse} 2.5s infinite`}
            transition="transform 0.3s ease"
            _hover={{
              transform: "scale(1.1)",
              bgGradient: "linear(to-r, pink.600, purple.700)",
            }}
            as={NextLink}
            href="/adhesion"
          >
            🚀 Adhérez Maintenant
          </Button>
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
