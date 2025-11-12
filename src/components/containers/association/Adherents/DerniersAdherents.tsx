import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ABI from "../../../ABI/ABIAdhesion.json";
import ABI_ADHESION_MANAGEMENT from "../../../ABI/ABI_ADHESION_MANAGEMENT.json";
import {
  Box, Heading, Text, Grid, GridItem, Center, Image, Tooltip, useColorModeValue, useColorMode
} from "@chakra-ui/react";
import Link from "next/link";
import { gradients, animations, Backgrounds } from "@/styles/theme";

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
  const [dernierAdherentsInfo, setDernierAdherentsInfo] = useState<UserInfo[]>([]);
  const { colorMode } = useColorMode();
  const bgColor = useColorModeValue(Backgrounds.cardBorderLight, Backgrounds.cardBorderDark);

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  // ✅ Initialisation du provider Moralis
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  useEffect(() => {
    const fetchDerniersAdherents = async () => {
      try {
        const contract = new ethers.Contract(contractAddress, ABI, provider);
        const roles = [0, 1, 2, 3];
        const uniqueMembers = new Set<string>();

        for (const role of roles) {
          const members: string[] = await contract.getMembersByRole(role);
          members.forEach((m) => uniqueMembers.add(m));
        }

        const lastFour = Array.from(uniqueMembers).slice(-4);
        const membersInfo = await Promise.all(
          lastFour.map((addr) => getUserInfo(addr))
        );

        setDernierAdherentsInfo(membersInfo);
        console.log("✅ Données récupérées via Moralis RPC");
      } catch (err) {
        console.error("Erreur lors de la récupération des adhérents:", err);
      }
    };

    fetchDerniersAdherents();
  }, []);

  // ✅ Fonction pour récupérer les infos utilisateur
  const getUserInfo = async (address: string): Promise<UserInfo> => {
    try {
      const contract = new ethers.Contract(contractAddress, ABI, provider);
      const contractManagement = new ethers.Contract(
        contractAddressManagement,
        ABI_ADHESION_MANAGEMENT,
        provider
      );

      const [membershipValid, name, bio] = await contract.getUserInfo(address);
      const tokens: bigint[] = await contract.getTokensByOwner(address);

      const insects = await Promise.all(
        tokens.map(async (tokenId) => {
          try {
            const tokenURI: string = await contract.tokenURI(tokenId);
            const res = await fetch(tokenURI);
            if (!res.ok) throw new Error(`Erreur tokenURI ${tokenId}`);
            const metadata = await res.json();
            return { id: tokenId.toString(), image: metadata.image, name: metadata.name };
          } catch (err) {
            console.error("Erreur récupération token:", err);
            return null;
          }
        })
      );

      return {
        membershipValid,
        name,
        bio,
        address,
        tokens: tokens.map((t) => Number(t)),
        insects: insects.filter(Boolean) as InsectURI[],
      };
    } catch (err) {
      console.error(`Erreur récupération infos pour ${address}:`, err);
      return { membershipValid: false, name: "", bio: "", address, tokens: [], insects: [] };
    }
  };

  // ✅ Rendu UI
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
                <Box borderRadius="xl" height="100%" p={4} textAlign="center" bg={bgColor}>
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
