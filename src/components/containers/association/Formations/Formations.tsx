import React, { useEffect, useState } from 'react';
import { Box, Heading, Text, Grid, GridItem, VStack, Icon, List, ListItem, Image } from '@chakra-ui/react';
import {
  FaQuoteLeft,
  FaPaintBrush,
  FaHandsHelping,
  FaGraduationCap,
  FaSearch,
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import CommentForm from './CommentForm'; // Chemin à ajuster selon votre structure de fichiers

const Formations: React.FC = () => {
  const [activeSection, setActiveSection] = useState<number>(0); // Typage de activeSection

  const handleScroll = () => {
      const sections = document.querySelectorAll('.scroll-section');
      const scrollPos = window.scrollY + window.innerHeight / 2;

      sections.forEach((section: Element, index: number) => {
          // Cast de section vers HTMLElement pour accéder à offsetTop
          const offsetTop = (section as HTMLElement).offsetTop;

          if (scrollPos >= offsetTop) {
              setActiveSection(index);
          }
      });
  };


  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Box p={5}>

      {/* Titre principal */}
      <Heading as="h1" size="xl" textAlign="center" mb={10}>
        Découvrez nos Formations
      </Heading>

      {/* Section descriptive */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="scroll-section"
      >
        <Box mb={10} textAlign="center">
          <Text fontSize="lg" mb={3}>
            Notre association s'engage à offrir des formations en art digital et cryptoArt pour tous. Que vous soyez débutant ou artiste en devenir, nous vous accompagnons dans l'exploration des outils numériques pour exprimer votre créativité.
          </Text>
          <List spacing={3} textAlign="left">
            <ListItem><Icon as={FaPaintBrush} mr={2} /> Initiation aux outils graphiques digitaux</ListItem>
            <ListItem><Icon as={FaSearch} mr={2} /> Introduction au cryptoArt et NFT</ListItem>
            <ListItem><Icon as={FaHandsHelping} mr={2} /> Ateliers collaboratifs pour les créateurs</ListItem>
            <ListItem><Icon as={FaGraduationCap} mr={2} /> Formation et accompagnement individualisé</ListItem>
          </List>
        </Box>
      </motion.div>

      {/* Section Galerie des retours de formations */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="scroll-section"
      >
        <Heading as="h2" size="lg" textAlign="center" mt={10} mb={5}>
          Rendus et Retours de Formations
        </Heading>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={6}>
          {/* Exemple d'image de rendu */}
          <GridItem>
            <Image src="/path/to/image1.jpg" alt="Rendu de formation 1" borderRadius="md" />
            <Text mt={2} textAlign="center" fontSize="sm">Œuvre réalisée par un participant</Text>
          </GridItem>
          <GridItem>
            <Image src="/path/to/image2.jpg" alt="Rendu de formation 2" borderRadius="md" />
            <Text mt={2} textAlign="center" fontSize="sm">Découverte de la peinture numérique</Text>
          </GridItem>
          <GridItem>
            <Image src="/path/to/image3.jpg" alt="Rendu de formation 3" borderRadius="md" />
            <Text mt={2} textAlign="center" fontSize="sm">Exemple d'art génératif en cryptoArt</Text>
          </GridItem>
        </Grid>
      </motion.div>

      {/* Section Avis et Témoignages */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="scroll-section"
      >
        <Heading as="h2" size="lg" textAlign="center" mt={10} mb={5}>
          Avis de nos Participants
        </Heading>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
          <GridItem>
            <VStack align="center" p={5} borderWidth="1px" borderRadius="lg" bg="black.50">
              <Icon as={FaQuoteLeft} boxSize={6} color="blue.500" />
              <Text fontSize="md" textAlign="center">
                "Une expérience inoubliable qui m'a permis de découvrir de nouvelles techniques et de me lancer dans le cryptoArt!"
              </Text>
              <Text fontSize="sm" color="blue.500">- Marie L., participante</Text>
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align="center" p={5} borderWidth="1px" borderRadius="lg" bg="black.50">
              <Icon as={FaQuoteLeft} boxSize={6} color="blue.500" />
              <Text fontSize="md" textAlign="center">
                "Un apprentissage encadré et des échanges enrichissants. J'ai adoré chaque instant!"
              </Text>
              <Text fontSize="sm" color="blue.500">- Alex M., participant</Text>
            </VStack>
          </GridItem>
        </Grid>
      </motion.div>

      <Box mt={10}>
        <CommentForm />
      </Box>

    </Box>
  );
};

export default Formations;
