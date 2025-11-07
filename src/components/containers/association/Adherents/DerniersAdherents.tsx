import { useState, useEffect } from "react";
import Web3 from "web3";
import ABI from '../../../ABI/ABIAdhesion.json';
import ABI_ADHESION_MANAGEMENT from '../../../ABI/ABI_ADHESION_MANAGEMENT.json';
import { Box, Heading, Text, Grid, GridItem, Center, Image, Tooltip, useColorModeValue, useColorMode } from "@chakra-ui/react";
import Link from 'next/link';

import {borderAnimation, gradients, animations, styles, Backgrounds} from "@/styles/theme"

interface InsectURI {
  id: string;
  image: string;
  name?: string;
}

interface UserInfo {
  membershipValid: boolean;
  name: string;
  bio: string;
  address: string;
  tokens: number[];
  insects: InsectURI[];
}


const DerniersAdherents: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [rpcWeb3, setRpcWeb3] = useState<Web3 | null>(null); // ✅ Provider public Moralis
  const [dernierAdherentsInfo, setDernierAdherentsInfo] = useState<UserInfo[]>([]);

  const { colorMode } = useColorMode();

  const bgColor = useColorModeValue(
    Backgrounds.cardBorderLight,
    Backgrounds.cardBorderDark
  );

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

  // ✅ Initialisation de Web3 + fallback RPC
  useEffect(() => {
    const initProviders = async () => {
      let instanceWeb3: Web3 | null = null;

      if (typeof window !== "undefined" && (window as any).ethereum) {
        instanceWeb3 = new Web3((window as any).ethereum);
        console.log("✅ Provider MetaMask détecté");
      } else {
        console.log("❌ Pas de MetaMask, fallback RPC public");
      }

      const rpcInstance = new Web3(new Web3.providers.HttpProvider(RPC_URL));

      setWeb3(instanceWeb3);
      setRpcWeb3(rpcInstance);
    };

    initProviders();
  }, [RPC_URL]);

  // ✅ Fetch toujours avec le provider public (lecture seule)
  useEffect(() => {
    if (rpcWeb3) fetchDerniersAdherents(rpcWeb3);
  }, [rpcWeb3]);

  const fetchDerniersAdherents = async (provider: Web3) => {
    try {
      const contract = new provider.eth.Contract(ABI as any, contractAddress);
      const uniqueMembers = new Set<string>();
      const roles = [0, 1, 2, 3];

      for (const role of roles) {
        const members: string[] = await contract.methods.getMembersByRole(role).call();
        members.forEach((m) => uniqueMembers.add(m));
      }

      const lastFour = Array.from(uniqueMembers).slice(-4);
      const membersInfo = await Promise.all(
        lastFour.map((addr) => getUserInfo(addr, provider))
      );

      setDernierAdherentsInfo(membersInfo);
    } catch (err) {
      console.error("❌ Erreur lors de la récupération des derniers adhérents :", err);
    }
  };

  const getUserInfo = async (address: string, contract: any): Promise<UserInfo> => {
      try {
          const contractManagement = new web3!.eth.Contract(ABI_ADHESION_MANAGEMENT, contractAddressManagement);

          // <-- Typage minimal pour ne pas casser la logique runtime (on garde userInfo[0], [1], [2] tels quels)
          const userInfo = await contractManagement.methods.getUserInfo(address).call() as any;

          const membershipValid = userInfo[0]; // Booléen pour la validité
          const name = userInfo[1]; // Nom
          const bio = userInfo[2]; // Bio

          // Récupérer les tokens
          const tokens = await contract.methods.getTokensByOwner(address).call();

          // Récupérer les images des insectes associés aux tokens
          const insects = await Promise.all(tokens.map(async (tokenId: number) => {
              try {
                  const tokenURI: string = await contract.methods.tokenURI(tokenId).call();
                  const response = await fetch(tokenURI);

                  if (!response.ok) {
                      throw new Error(`Erreur lors de la récupération de l'URI : ${response.statusText}`);
                  }

                  const metadata = await response.json();
                  return { id: tokenId.toString(), image: metadata.image, name: metadata.name }; // Récupérer l'image
              } catch (error) {
                  console.error("Erreur lors de la récupération de l'insecte:", error);
                  return null;
              }
          }));

          // Filtrer les null et renvoyer un tableau vide si pas d'insectes
          return {
              membershipValid,
              name,
              bio,
              address,  // Ajoutez l'adresse Ethereum ici
              tokens,
              insects: (insects.filter(Boolean) as InsectURI[])
          };
      } catch (error) {
          console.error(`Erreur lors de la récupération des informations de l'utilisateur ${address}:`, error);
          return { membershipValid: false, name: "", bio: "", address, tokens: [], insects: [] }; // Initialiser insects comme tableau vide
      }
  };

  return (
    <Box p={5}>
      <Box mt={5}>
        {dernierAdherentsInfo.length > 0 ? (
          <Grid
            templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
            gap={6}
            justifyContent="center"
          >
            {dernierAdherentsInfo.map((info, idx) => (
              <GridItem
                key={idx}
                w={{ base: "100%", md: "200px" }}
                h="250px"
                borderRadius="xl"
                position="relative"
                p="2px"
                bgGradient={
                  colorMode === "light"
                    ? gradients.cardBorderLight
                    : gradients.cardBorderDark
                }
                backgroundSize="300% 300%"
                animation={animations.borderGlow}
                transition="all 0.3s ease"
                _hover={{
                  animation: animations.borderGlow.replace("6s", "2s"),
                  transform: "scale(1.05)",
                  boxShadow:
                    colorMode === "light"
                      ? "0 0 25px rgba(180, 166, 213, 0.6)"
                      : "0 0 25px rgba(238, 212, 132, 0.6)",
                }}
                justifySelf="center"
                mx="auto"
              >
              <Box
                borderRadius="xl"
                height="100%"
                p={4}
                textAlign="center"
                bg={bgColor} // <-- couleur dynamique
              >
                  <Link href={`/u/${info.address}`} passHref>
                    <Tooltip label="Voir le profil" hasArrow>
                      <Box as="a" display="block" height="100%">
                        <Text fontWeight="bold" color="pink.200">
                          {info.name || "Utilisateur anonyme"}
                        </Text>
                        <Text fontSize="sm" color="gray.300">
                          {info.bio || "Aucune bio"}
                        </Text>
                        <Box display="flex" justifyContent="center" mt={3}>
                          {info.insects.length > 0 ? (
                            info.insects.map((insect) => (
                              <Box key={insect.id} mr={2} textAlign="center">
                                <Image
                                  src={insect.image}
                                  alt={insect.name}
                                  boxSize="45px"
                                  borderRadius="md"
                                  objectFit="cover"
                                />
                                <Text fontSize="xs" color="gray.400" mt={1}>
                                  {insect.name}
                                </Text>
                              </Box>
                            ))
                          ) : (
                            <Text fontSize="xs" color="gray.500">
                              Aucun jeton
                            </Text>
                          )}
                        </Box>
                      </Box>
                    </Tooltip>
                  </Link>
                </Box>
              </GridItem>
            ))}
          </Grid>
        ) : (
          <Center><Text>Aucun adhérent trouvé.</Text></Center>
        )}
      </Box>
    </Box>
  );
};

export default DerniersAdherents;
