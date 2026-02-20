'use client';

import {
  Box,
  Heading,
  VStack,
  Text,
  Collapse,
  chakra,
  Container,
  Link
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { useDisclosure } from '@chakra-ui/react';
import { useState, useEffect } from 'react';

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
      <Collapse in={isOpen} animateOpacity>
        <Box p={6} bg="purple.900/20" color="gray.200" fontSize="sm" w="full">
          {answer}
        </Box>
      </Collapse>
    </VStack>
  );
};

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQItemProps[]>([]);

  useEffect(() => {
    fetch('/faq/faq.json')  // ✅ Public path (static)
      .then((res) => res.json())
      .then((data: FAQItemProps[]) => setFaqs(data))
      .catch((err) => {
        console.log('JSON absent:', err);  // Debug
        setFaqs([
          {
            question: "FAQ en cours",
            answer: "Créez src/data/faq.json ou contact support."
          }
        ]);
      });
  }, []);

  return (
    <Container maxW="container.lg" py={{ base: 12, md: 24 }} px={6}>
      <Box textAlign="center" mb={16}>
        <Heading size="2xl"  bgClip="text" mb={4}>
          FAQ Rescoe
        </Heading>
      </Box>
      <VStack spacing={6} w="full">
        {faqs.map((faq, i) => (
          <FAQItem key={`${faq.question}-${i}`} {...faq} />
        ))}
      </VStack>
    </Container>
  );
}
