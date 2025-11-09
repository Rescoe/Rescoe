import React from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Icon,
  Button,
  useColorModeValue,
  SimpleGrid
} from '@chakra-ui/react';
import { FaPaintBrush, FaPeopleArrows, FaBookOpen, FaUsers } from 'react-icons/fa';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

const AssociationPage = () => {
  const bg = useColorModeValue('Black.50', 'Black.800');
  const textColor = useColorModeValue('Black.700', 'Black.200');
  const accentColor = useColorModeValue('white.Black', 'white.300');
  const boxBg = useColorModeValue('white', 'Black.700');
  const boxShadow = useColorModeValue('md', 'dark-lg');

  const sections = [
    {
      icon: FaPaintBrush,
      title: 'Notre Mission',
      content:
        "Nous œuvrons pour permettre aux artistes émergents et aux personnes en situation de précarité d'accéder à des opportunités dans le domaine de l'art numérique et du Web3."
    },
    {
      icon: FaPeopleArrows,
      title: 'Nos Valeurs',
      content:
        "Solidarité, créativité et innovation sont au cœur de notre démarche. Nous croyons en un écosystème artistique inclusif et accessible à tous."
    },
    {
      icon: FaBookOpen,
      title: 'Nos Activités',
      content:
        "Ateliers de formation, accompagnement artistique, création de galeries numériques, et organisation d’événements artistiques sont quelques-unes de nos actions."
    },
    {
      icon: FaUsers,
      title: 'Pourquoi Nous Soutenir ?',
      content:
        "Votre soutien contribue à financer nos projets, nos formations et nos événements, tout en offrant une visibilité aux talents émergents."
    }
  ];

  return (
    <Box bg={bg} py={10} px={5} minH="100vh">
      <Heading as="h1" size="xl" textAlign="center" color={accentColor} mb={10}>
        À Propos de RESCOE
      </Heading>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10} mb={16}>
        {sections.map((section, index) => (
          <MotionBox
            key={index}
            p={6}
            bg={boxBg}
            rounded="md"
            shadow={boxShadow}
            whileHover={{ scale: 1.05 }}
            textAlign="center"
          >
            <Icon as={section.icon} boxSize={12} color={accentColor} mb={4} />
            <Heading as="h3" size="lg" color={textColor} mb={3}>
              {section.title}
            </Heading>
            <Text fontSize="md" color={textColor}>
              {section.content}
            </Text>
          </MotionBox>
        ))}
      </SimpleGrid>

      <Box textAlign="center" py={10} bg={useColorModeValue('Black.100', 'Black.700')} rounded="md" shadow={boxShadow}>
        <Heading as="h2" size="lg" mb={5} color={textColor}>
          Devenir Adhérent
        </Heading>
        <Text fontSize="md" mb={5} color={textColor}>
          En adhérant à RESCOE, vous participez à un projet solidaire tout en accédant à des avantages exclusifs : formations, expositions, et bien plus encore.
        </Text>
        <VStack align="start" spacing={3} mb={8}>
          <Text fontSize="md" color={textColor}>
            <Text as="span" fontWeight="bold">1.</Text> Obtenez un NFT unique représentant un insecte généré aléatoirement.
          </Text>
          <Text fontSize="md" color={textColor}>
            <Text as="span" fontWeight="bold">2.</Text> Accédez à des événements et ressources exclusifs.
          </Text>
          <Text fontSize="md" color={textColor}>
            <Text as="span" fontWeight="bold">3.</Text> Soutenez directement nos projets solidaires et artistiques.
          </Text>
        </VStack>
        <Button colorScheme="pink" size="lg" shadow="md">
          Rejoindre l'Association
        </Button>
      </Box>
    </Box>
  );
};

export default AssociationPage;
