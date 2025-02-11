import React from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Grid,
  GridItem,
  Image,
  List,
  ListItem,
  Icon,
  Button,
} from '@chakra-ui/react';
import { FaEnvelope, FaPhoneAlt, FaMapMarkerAlt } from 'react-icons/fa';

// Définition d'un type pour les informations de contact
interface ContactInfo {
  title: string;
  value: string;
}

// Définition d'un type pour l'organigramme
interface TeamMember {
  name: string;
  role: string;
  image: string; // URL de l'image du membre
  description: string; // Description courte
  profileLink: string; // Lien vers le profil
}

// Exemple d'informations de l'association
const contactInfo: ContactInfo[] = [
  {
    title: 'Email',
    value: '<rescoe.association@gmail.com>',
  },
  {
    title: 'Téléphone',
    value: '<06 76 76 91 62>',
  },
  {
    title: 'Adresse',
    value: '8 rue Burgade, 33500 Libourne',
  },
];

// Exemple d'organigramme
const teamMembers: TeamMember[] = [
  {
    name: 'Clément Roubeyrie',
    role: 'Président',
    image: 'https://sapphire-central-catfish-736.mypinata.cloud/ipfs/Qma243vdQ17Rc77uW1BCRSmXn5xEtpKq7R5cKkFPFgrVDq', // Lien IPFS
    description: 'Directeur de l\'association.',
    profileLink: '', // Lien vers le profil
  },
  {
    name: 'Thibault Franzinetti',
    role: 'Vice-Président',
    image: 'https://sapphire-central-catfish-736.mypinata.cloud/ipfs/QmVA6TRBDMLdp2AxQ7hs2TQiZcaUYqbVNmfLnz9eT8CU8S', // Lien IPFS
    description: 'En charge du developpement de l\'asociation',
    profileLink: '',
  },
  {
    name: 'Simon Louf',
    role: 'Secrétaire en chef',
    image: 'https://sapphire-central-catfish-736.mypinata.cloud/ipfs/QmYUmTHmHueWoGNvyXnV2kJubrGCwh6ykHvpb2HZJZ21Td', // Lien IPFS
    description: 'Bonne question tiens!',
    profileLink: '',
  },
  {
    name: 'May Santot',
    role: 'Directrice de publication',
    image: 'https://sapphire-central-catfish-736.mypinata.cloud/ipfs/QmVnujT2hHLTJ3iYD2hP7XyLGNUXtyXG3NZj9BPtJfsK8f', // Lien IPFS
    description: 'Responsable du contenu, de l\'orientation et de la validation littéraire',
    profileLink: '',
  },
];

const ContactPage: React.FC = () => {
  return (
    <Box p={5} bg="black.50">
      <Heading as="h1" size="xl" textAlign="center" mb={5}>
        Contactez-Nous
      </Heading>

      <VStack spacing={5} align="start" mb={10}>
        <Text fontSize="lg">
          Si vous avez des questions, des suggestions ou si vous souhaitez nous rejoindre, n'hésitez pas à nous contacter !
        </Text>
        <List spacing={3}>
          {contactInfo.map((info, index) => (
            <ListItem key={index}>
              <Icon as={info.title === 'Email' ? FaEnvelope : info.title === 'Téléphone' ? FaPhoneAlt : FaMapMarkerAlt} mr={2} />
              <strong>{info.title}: </strong>{info.value}
            </ListItem>
          ))}
        </List>
      </VStack>

      <Heading as="h2" size="lg" textAlign="center" mb={5}>
        Notre Équipe
      </Heading>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
        {teamMembers.map((member, index) => (
          <GridItem key={index} textAlign="center" p={5} borderWidth="1px" borderRadius="lg" bg="black" boxShadow="md" transition="0.2s" _hover={{ transform: "scale(1.05)", boxShadow: "lg" }}>
            <Image src={member.image} alt={member.name} borderRadius="full" boxSize="150px" mb={2} />
            <Text fontWeight="bold" fontSize="lg">{member.name}</Text>
            <Text fontSize="md" color="black.500">{member.role}</Text>
            <Text fontSize="sm" color="black.700" mb={2}>{member.description}</Text>
            <Button as="a" href={member.profileLink} target="_blank" colorScheme="blue" size="sm">
              Voir Profil
            </Button>
          </GridItem>
        ))}
      </Grid>

      <Box textAlign="center" mt={10}>
        <Button colorScheme="blue">
          Soumettre un Message
        </Button>
      </Box>
    </Box>
  );
};

export default ContactPage;
