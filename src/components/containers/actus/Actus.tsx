import React from 'react';
import {
  Box,
  Heading,
  Text,
  Grid,
  GridItem,
  VStack,
  Button,
  Divider,
} from '@chakra-ui/react';

const newsData = [
  {
    title: "Nouvelle formation en cryptoArt!",
    date: "2023-10-01",
    description: "Nous avons lancé une nouvelle formation sur le cryptoArt, accessible à tous les niveaux.",
  },
  {
    title: "Exposition d'art numérique",
    date: "2023-09-20",
    description: "Venez découvrir les œuvres réalisées par nos membres lors de l'exposition annuelle.",
  },
];

const eventFeedback = [
  {
    name: "Alice Dupont",
    feedback: "L'atelier était très enrichissant et m'a permis d'apprendre beaucoup sur les outils numériques.",
  },
  {
    name: "Benoit Martin",
    feedback: "L'événement a été très bien organisé, et j'ai adoré le partage d'expériences.",
  },
];

const EventsPage: React.FC = () => {
  return (
    <Box p={5}>
      <Heading as="h1" size="xl" mb={5}>
        Actualités et Événements
      </Heading>

      <VStack spacing={10} align="start">
        <Box w="full" p={5} borderWidth="1px" borderRadius="lg" bg="black">
          <Heading as="h2" size="lg" mb={3}>
            Actualités
          </Heading>
          {newsData.map((news, index) => (
            <Box key={index} mb={4}>
              <Heading as="h3" size="md">{news.title}</Heading>
              <Text fontSize="sm" color="black.500">{news.date}</Text>
              <Text>{news.description}</Text>
            </Box>
          ))}
          <Button colorScheme="blue">Gérer les actualités</Button>
        </Box>

        <Box w="full" p={5} borderWidth="1px" borderRadius="lg" bg="black">
          <Heading as="h2" size="lg" mb={3}>
            Calendrier d'Événements
          </Heading>
          <Text>Intégrez ici un calendrier dynamique d'événements à venir.</Text>
          {/* Placez un composant de calendrier ici, tel que react-calendar ou une bibliothèque similaire */}
          <Button colorScheme="blue">Gérer le calendrier</Button>
        </Box>

        <Box w="full" p={5} borderWidth="1px" borderRadius="lg" bg="black">
          <Heading as="h2" size="lg" mb={3}>
            Retours d'Événements
          </Heading>
          {eventFeedback.map((feedback, index) => (
            <Box key={index} mb={4}>
              <Text fontWeight="bold">{feedback.name}</Text>
              <Text>"{feedback.feedback}"</Text>
            </Box>
          ))}
          <Button colorScheme="blue">Gérer les retours</Button>
        </Box>
      </VStack>

      <Divider my={10} />

    </Box>
  );
};

export default EventsPage;
