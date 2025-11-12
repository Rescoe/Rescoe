import { useState, useEffect } from "react";
import Web3 from "web3";
import { Box, Grid, GridItem, Text, Image, Tooltip, useColorMode, useColorModeValue } from "@chakra-ui/react";
import Link from "next/link";

import {borderAnimation, gradients, animations, styles, Backgrounds} from "@/styles/theme"

import ABI from "../../../ABI/ABIAdhesion.json";
import ABI_ADHESION_MANAGEMENT from "../../../ABI/ABI_ADHESION_MANAGEMENT.json";

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

interface FeaturedMembersProps {
  addresses: string[];
}


const FeaturedMembers: React.FC<FeaturedMembersProps> = ({ addresses }) => {
  const [featuredMembersInfo, setFeaturedMembersInfo] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const { colorMode } = useColorMode();

  const bgColor = useColorModeValue(
    Backgrounds.cardBorderLight,
    Backgrounds.cardBorderDark
  );


  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

  // ✅ Un seul useEffect pour tout gérer
  useEffect(() => {
    const fetchMembers = async () => {
      if (!addresses || addresses.length === 0) return;

      try {
        setLoading(true);
        console.log("📬 Adresses reçues :", addresses);

        // 🔒 Toujours lecture en RPC public — pas de MetaMask ici
        const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
        console.log("🌐 Lecture via RPC public :", RPC_URL);

        const contractManagement = new web3.eth.Contract(
          ABI_ADHESION_MANAGEMENT as any,
          contractAddressManagement
        );

        const contract = new web3.eth.Contract(
          ABI as any,
          contractAddress
        );

        // 🔍 Récupération des infos utilisateur
        const membersInfoPromises = addresses.map((address) =>
          getUserInfo(address, contractManagement, contract)
        );

        const membersInfo = await Promise.all(membersInfoPromises);
        setFeaturedMembersInfo(membersInfo);
      } catch (error) {
        console.error("Erreur lors de la récupération des membres :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [addresses, RPC_URL]);

  const getUserInfo = async (
    address: string,
    contractManagement: any,
    contract: any
  ): Promise<UserInfo> => {
    try {
      console.log("🔍 Lecture infos utilisateur pour :", address);

      const userInfo: unknown[] = await contract.methods
        .getUserInfo(address)
        .call();

      const membershipValid = Boolean(userInfo[0]);
      const name = String(userInfo[1] || "");
      const bio = String(userInfo[2] || "");

      const tokens: number[] = await contract.methods
        .getTokensByOwner(address)
        .call();

      const insects = await Promise.all(
        tokens.map(async (tokenId: number) => {
          try {
            const tokenURI: string = await contract.methods
              .tokenURI(tokenId)
              .call();

            const response = await fetch(tokenURI);
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

            const metadata = await response.json();
            return {
              id: tokenId.toString(),
              image: metadata.image,
              name: metadata.name,
            } as InsectURI;
          } catch (err) {
            console.error("Erreur lors de la récupération du token", tokenId, err);
            return null;
          }
        })
      );

      return {
        membershipValid,
        name,
        bio,
        address,
        tokens,
        insects: insects.filter((i): i is InsectURI => i !== null),
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération de ${address}:`, error);
      return {
        membershipValid: false,
        name: "",
        bio: "",
        address,
        tokens: [],
        insects: [],
      };
    }
  };

  // ✅ Rendu
  return (
    <Box p={5}>
      <Box mt={5}>
        {loading ? (
          <Text color="gray.400" textAlign="center">
            Chargement des membres...
          </Text>
        ) : featuredMembersInfo.length > 0 ? (
          <Grid
            templateColumns={{
              base: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            }}
            gap={6}
            justifyContent="center"
          >
            {featuredMembersInfo.map((info, idx) => (
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
                    <Tooltip label="Cliquez pour voir le profil" hasArrow>
                      <Box as="a" display="block" height="100%">
                        <Text fontWeight="bold" color="pink.200">
                          {info.name || "Membre anonyme"}
                        </Text>
                        <Text fontSize="sm" color="gray.300">
                          {info.bio || "Aucune biographie"}
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
                              Aucun jeton d'adhésion
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
          <Text color="gray.400" textAlign="center">
            Aucun membre trouvé.
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default FeaturedMembers;
