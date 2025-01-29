// src/components/containers/actus/Actus.tsx
import React from 'react';
import { VStack, Grid, GridItem, Box, Heading, Text, Icon } from '@chakra-ui/react';
import { FaPaintBrush, FaPeopleArrows, FaBookOpen, FaUsers } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

const SectionContent = ({ icon, title, description }) => (
  <motion.div whileHover={{ scale: 1.1 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <Box textAlign="center" className="neon-box"> {/* Utilise simplement le nom de classe */}
      <Icon as={icon} boxSize={8} mb={3} className="neon-icon" />
      <Heading as="h2" size="lg" mb={2} className="neon-heading">
        {title}
      </Heading>
      <Text fontSize="md" className="neon-text">
        {description}
      </Text>
    </Box>
  </motion.div>
);

const Actus = () => {
  return (
    <VStack spacing={8}>
      <Canvas className="canvas" camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <OrbitControls enableZoom={false} />
      </Canvas>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6} className="scroll-section">
        <GridItem className="grid-item">
          <SectionContent
            icon={FaPaintBrush}
            title="Qui sommes-nous ?"
            description="Nous accompagnons artistes émergents et personnes en formation dans l’art digital et l’expression numérique."
          />
        </GridItem>

        <GridItem className="grid-item">
          <SectionContent
            icon={FaPeopleArrows}
            title="Nos ateliers"
            description="Formations à la génération d’images par IA, manipulation d’images, et création de GIF simples en pixel art et glitch."
          />
        </GridItem>

        <GridItem className="grid-item">
          <SectionContent
            icon={FaBookOpen}
            title="Notre approche"
            description="Solidarité, inclusion et sensibilisation au droit d’auteur pour un espace de création sécurisé."
          />
        </GridItem>

        <GridItem className="grid-item">
          <SectionContent
            icon={FaUsers}
            title="Ce que RESCOE vous apporte"
            description="Un partenariat pour des ateliers sur mesure, inclusifs et engageants pour vos résidents."
          />
        </GridItem>
      </Grid>
    </VStack>
  );
};

export default Actus;
