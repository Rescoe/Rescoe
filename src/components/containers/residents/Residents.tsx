// src/app/residents/page.tsx
'use client';

import {
  Box, Container, Heading, SimpleGrid, Card, CardBody, Flex, Text, Badge,
  Avatar, HStack, VStack, IconButton, Tooltip, useColorModeValue
} from '@chakra-ui/react';
import { FaCopy } from 'react-icons/fa';

import { RESIDENTS_CONFIG } from '@/lib/residentsConfig'; // ✅ IMPORT CENTRALISÉ
import { useAuth } from '../../../utils/authContext';
import { useState } from 'react';
import Link from 'next/link';

export default function Residents() {
  const { address: connectedAddress } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  const shortAddress = (addr: string) =>
    addr.slice(0, 6) + "..." + addr.slice(-4);

  return (
    <Box minH="100vh" bg={useColorModeValue("gray.50", "gray.900")}>
      <Container maxW="container.xl" py={20}>
        <VStack spacing={8} align="start">
          <Heading size="2xl" mb={4}>Annuaire Résidents RESCOE</Heading>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={6} w="full">
            {RESIDENTS_CONFIG.map((resident) => (
              <Link
                key={resident.address}
                href={`/resident/${resident.address}`}
                style={{ textDecoration: 'none' }}
              >
                <Card
                  cursor="pointer"
                  _hover={{ transform: 'translateY(-4px)', boxShadow: '2xl' }}
                  borderWidth={2}
                  borderColor={connectedAddress?.toLowerCase() === resident.address.toLowerCase() ? "green.400" : "transparent"}
                >
                  <CardBody p={6}>
                    <Flex align="center" mb={4}>
                      <Avatar size="lg" src={resident.avatar} name={resident.name} bg="purple.500" />
                      <Box ml={3} flex={1}>
                        <Heading size="md" mb={1}>{resident.name}</Heading>
                        <Badge colorScheme="purple" variant="subtle">{resident.role}</Badge>
                      </Box>

                      <Tooltip label="Copier adresse">
                        <IconButton
                          aria-label="Copier adresse"  // ← AJOUTE ÇA
                          icon={<FaCopy />}
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            copyAddress(resident.address);
                          }}
                          colorScheme={copied === resident.address ? "green" : "gray"}
                          variant="ghost"
                        />
                      </Tooltip>
                    </Flex>
                    <Text fontSize="sm" color="gray.500">{shortAddress(resident.address)}</Text>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
};
