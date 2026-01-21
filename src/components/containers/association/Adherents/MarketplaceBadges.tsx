"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ABI from "../../../ABI/ABIAdhesion.json"; // Ajoute l'ABI pour _tokenForSale
import {
  Box, Heading, Text, Card, CardBody, CardHeader,
  Badge, Button, SimpleGrid, VStack, HStack, Tag,
  Stat, StatLabel, StatNumber, Image, AspectRatio,
  Alert, AlertIcon, AlertTitle,  Center,

} from "@chakra-ui/react";
import NextLink from "next/link";
import { ExternalLinkIcon } from "@chakra-ui/icons";

interface MarketplaceBadgesProps {
  contractAddress: string;
  rpcUrl: string;
  isVisible?: boolean;
}

const MarketplaceBadges = ({
  contractAddress,
  rpcUrl,
  isVisible = false  // ✅ Default false
}: MarketplaceBadgesProps) =>
{
  const [forSaleTokens, setForSaleTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  // ✅ ABI pour _tokenForSale (généré par mapping public)
  const tokenForSaleABI = {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "_tokenForSale",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  };

  useEffect(() => {
    const init = async () => {
      const jsonProvider = new ethers.JsonRpcProvider(rpcUrl);
      const contr = new ethers.Contract(contractAddress, [...ABI, tokenForSaleABI], jsonProvider);
      setProvider(jsonProvider);
      setContract(contr);
    };
    init();
  }, [rpcUrl, contractAddress]);

  useEffect(() => {
    if (!isVisible || !contract) return;  // ✅ SKIP si tab caché

    const fetchForSale = async () => {
      setLoading(true);
      try {
        const totalMinted = await contract.getTotalMinted();
        const forSale: any[] = [];

        // ✅ LOOP OPTIMISÉ : CHECK ownerOf AVANT tout
        for (let i = 0; i < Number(totalMinted); i++) {
          try {
            // ✅ ÉTAPE 1 : Token existe ? (skip burned)
            const owner = await contract.ownerOf(i).catch(() => null);
            if (!owner || owner === "0x0000000000000000000000000000000000000000") {
              //console.log(`⏭️ Marketplace skip burned ${i}`);
              continue;
            }

            // ✅ ÉTAPE 2 : En vente ?
            const isForSale = await contract._tokenForSale(i);
            if (!isForSale) continue;

            // ✅ ÉTAPE 3 : Détails
            const details = await contract.getTokenDetails(i);
            const price = await contract._tokenPrices(i);

            forSale.push({
              id: i,
              owner: details.ownerAddr,
              role: details.role,
              price: ethers.formatEther(price),
              remainingTime: details.remainingTime,
              bio: details.bio
            });
          } catch (e) {
          }
        }

        //console.log(`🛒 ${forSale.length} badges en vente trouvés`);
        setForSaleTokens(forSale);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };



    fetchForSale();
  }, [isVisible, contract]);

  if (loading) {
    return (
      <Center p={12}>
        <Text>🔍 Recherche des badges en vente...</Text>
      </Center>
    );
  }

  return (
    <Box maxW="7xl" mx="auto" px={8} py={12}>
      <Heading mb={6} textAlign="center">
        🛒 Marketplace - Badges en vente
      </Heading>

      {forSaleTokens.length === 0 ? (
        <Alert status="info" borderRadius="xl">
          <AlertIcon />
          <AlertTitle>Aucun badge en vente pour le moment</AlertTitle>
          <Text mt={2}>Revenez bientôt ou mettez le vôtre en vente !</Text>
        </Alert>
      ) : (
        <>
          <Text fontSize="lg" textAlign="center" mb={8} color="gray.600">
            {forSaleTokens.length} badge{forSaleTokens.length > 1 ? 's' : ''} disponible{forSaleTokens.length > 1 ? 's' : ''} à l'achat
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {forSaleTokens.map((token) => (
              <Card key={token.id} shadow="lg" rounded="2xl" overflow="hidden">
                <CardHeader bg="brandStartLight" color="white">
                  <Heading size="sm">Badge #{token.id}</Heading>
                </CardHeader>
                <CardBody p={6}>
                  <AspectRatio ratio={1} mb={4}>
                    <Image
                      src={`/api/insect/${token.id}`} // ou ton endpoint image
                      alt={`Badge ${token.id}`}
                      objectFit="cover"
                      rounded="lg"
                    />
                  </AspectRatio>

                  <VStack align="start" spacing={3}>
                    <HStack justify="space-between" w="full">
                      <Badge colorScheme="purple" variant="solid">
                        Rôle {token.role}
                      </Badge>
                      <Tag colorScheme="green" size="sm">
                        {token.remainingTime > 0 ? 'Actif' : 'Expiré'}
                      </Tag>
                    </HStack>

                    <Stat size="sm">
                      <StatLabel>Prix</StatLabel>
                      <StatNumber>{token.price} ETH</StatNumber>
                    </Stat>

                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                      {token.bio || 'Aucune bio'}
                    </Text>
                  </VStack>

                  <Button
                    w="full"
                    mt={4}
                    colorScheme="teal"
                    size="lg"
                    as={NextLink}
                    href={`/buy-badge/${contractAddress}/${token.id}`}
                  >
                    Acheter {token.price} ETH <ExternalLinkIcon ml={2} />
                  </Button>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </>
      )}
    </Box>
  );
};

export default MarketplaceBadges;
