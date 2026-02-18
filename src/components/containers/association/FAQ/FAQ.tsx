'use client';

import {
  Box,
  Heading,
  VStack,
  Text,
  Collapse,
  chakra,
  Container,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { useDisclosure } from '@chakra-ui/react';

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const { isOpen, onToggle } = useDisclosure();

  return (
    <VStack
      align="start"
      spacing={0}
      w="full"
      border="1px solid"
      borderColor="purple.600"
      borderRadius="lg"
      overflow="hidden"
      bg="gray.800"
      _hover={{ borderColor: "purple.400", boxShadow: "lg" }}
      transition="all 0.2s"
    >
      <chakra.button
        as="button"
        w="full"
        px={6}
        py={4}
        textAlign="left"
        fontWeight="bold"
        color="white"
        onClick={onToggle}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        _hover={{ bg: "purple.900/30" }}
      >
        {question}
        {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </chakra.button>
      {/* 🔥 FIXÉ : style supprimé */}
      <Collapse in={isOpen} animateOpacity>
        <Box p={6} bg="purple.900/20" color="gray.200" fontSize="sm" w="full">
          {answer}
        </Box>
      </Collapse>
    </VStack>
  );
};

const faqs = [
  { question: "Comment devenir adhérent ?", answer: "Menu > Devenir adhérent > Formulaire + paiement 29€/an. Accès NFT instantané !" },
  { question: "Avantages membres ?", answer: "Drops NFT prioritaires, events VIP, communauté 300+ Web3 France." },
  { question: "Durée ?", answer: "1 an auto-renouvelable. Premium = vie. TVA OK entreprises." },
  { question: "Rescoe c'est quoi ?", answer: "Association 1901 NFT/Web3 : galerie art, éducation, soutien artistes." },
  { question: "Entreprises ?", answer: "Oui ! Réseautage pro, Discord privé, tarifs spéciaux." },
  { question: "Résilier ?", answer: "Profil > Abonnement. Remboursement >30j avant fin." },
  { question: "Sécurité NFT ?", answer: "IPFS/Pinata + Solidity audité. 99% uptime." },
  { question: "Paiement ?", answer: "Stripe CB. Facture TVA. Test 7j remboursable." },
];

export default function FAQPage() {
  return (
    <Container maxW="container.lg" py={{ base: 12, md: 24 }} px={6}>
      <Box textAlign="center" mb={16}>
        <Heading size="2xl" bgGradient="linear(to-r, purple.400, pink.400)" bgClip="text" mb={4}>
          FAQ Rescoe
        </Heading>
        <Text fontSize="lg" color="gray.400" maxW="md" mx="auto">
          Adhésion NFT Web3 | support@rescoe.xyz
        </Text>
      </Box>
      <VStack spacing={6} w="full">
        {faqs.map((faq, i) => <FAQItem key={i} {...faq} />)}
      </VStack>
    </Container>
  );
}
