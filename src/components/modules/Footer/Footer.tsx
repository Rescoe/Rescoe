import { Box, Link, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import NextLink from 'next/link';


const links = {
  adhesion: '/adhesion',
  instagram: 'https://github.com/your-asso-repo', // Remplacez par le lien GitHub de l'association, si existant
  twitter: 'https://twitter.com/your-asso-twitter', // Remplacez par le lien Twitter de l'association, si existant
  discord: 'https://discord.com/invite/your-asso-discord', // Remplacez par le lien Discord de l'association, si existant
};

const Footer = () => {
  return (
    <Box             mt={10}
                textAlign="center"
                p={4}
                borderWidth={1}
                borderRadius="lg"
                borderColor="gray.300"
                maxWidth="80%" // Limite la largeur de la box
                mx="auto">
      <VStack spacing={3}>
      <Text fontSize="lg" fontWeight="bold">RESCOE</Text>

        <Text fontSize="l" fontWeight="bold">Réseau expérimental solidaire de Crypto Œuvres émergentes</Text>


          <Box>
                <Text fontSize="m" fontWeight="bold" mb={2}>
                    Rejoignez le réseau !
                </Text>
                <NextLink href="/adhesion" passHref>
                    <Button colorScheme="pink">Adhérer Maintenant</Button>
                </NextLink>
            </Box>

          <HStack spacing={5} mt={4}>
          <Text>Suivez nous sur les réseaux </Text>
          </HStack>

          <HStack spacing={5} mt={4}>

          <Link href={links.instagram} isExternal>
            Instagram <ExternalLinkIcon mx="2px" />
          </Link>
          <Link href={links.twitter} isExternal>
            Twitter <ExternalLinkIcon mx="2px" />
          </Link>
          <Link href={links.discord} isExternal>
            Discord <ExternalLinkIcon mx="2px" />
          </Link>
        </HStack>

        <Text fontSize="xs" mt={4}>  &copy; 2018 - {new Date().getFullYear()} RESCOE. Tous droits réservés.</Text>
      </VStack>
    </Box>
  );
};

export default Footer;
