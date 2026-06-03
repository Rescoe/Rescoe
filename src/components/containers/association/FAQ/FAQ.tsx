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
      borderColor="whiteAlpha.200"
      borderRadius="lg"
      overflow="hidden"
      bg="rgba(1,28,57,0.7)"
      _hover={{ borderColor: "brand.gold", boxShadow: "0 0 16px rgba(238,212,132,0.15)" }}
      transition="all 0.2s"
    >
      <chakra.button
        as="button"
        w="full"
        px={6}
        py={4}
        textAlign="left"
        fontWeight="bold"
        color="brand.cream"
        onClick={onToggle}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        _hover={{ bg: "rgba(238,212,132,0.06)" }}
      >
        {question}
        {isOpen ? <ChevronUpIcon color="brand.gold" /> : <ChevronDownIcon color="brand.gold" />}
      </chakra.button>
      <Collapse in={isOpen} animateOpacity>
        <Box
          p={6}
          bg="rgba(0,65,106,0.25)"
          borderTop="1px solid"
          borderColor="whiteAlpha.100"
          color="brand.cream"
          fontSize="sm"
          opacity={0.9}
          w="full"
        >
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
       //console.log('JSON absent:', err);  // Debug
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
