import { useState, useEffect } from "react";
import Web3 from "web3";
import { Box, Grid, GridItem, Text, Image, Tooltip } from "@chakra-ui/react";
import Link from 'next/link';
import { keyframes } from "@emotion/react";
import ABI from '../../../ABI/ABIAdhesion.json';
import ABI_ADHESION_MANAGEMENT from '../../../ABI/ABI_ADHESION_MANAGEMENT.json';

// ✅ Interfaces locales
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

// ✅ Animation d'une lueur autour du contour
const borderAnimation = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 400% 50%; }
`;

const FeaturedMembers: React.FC<FeaturedMembersProps> = ({ addresses }) => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [featuredMembersInfo, setFeaturedMembersInfo] = useState<UserInfo[]>([]);

  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string; // ✅ Fallback RPC public

  // ✅ Initialisation de Web3 : essaie MetaMask, sinon RPC public
  useEffect(() => {
    const initWeb3 = async () => {
      let web3Instance;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        // Si MetaMask est dispo, on l’utilise
        web3Instance = new Web3((window as any).ethereum);
        console.log("✅ Utilisation du provider MetaMask");
      } else {
        // Sinon fallback sur le RPC Moralis
        web3Instance = new Web3(new Web3.providers.HttpProvider(RPC_URL));
        console.log("🌐 Utilisation du provider RPC public (lecture seule)");
      }
      setWeb3(web3Instance);
    };
    initWeb3();
  }, [RPC_URL]);

  // ✅ Récupération des membres quand Web3 est prêt
  useEffect(() => {
    if (web3) fetchFeaturedMembers();
  }, [web3]);

  const fetchFeaturedMembers = async () => {
    try {
      const contractManagement = new web3!.eth.Contract(ABI_ADHESION_MANAGEMENT as any, contractAddressManagement);
      const contract = new web3!.eth.Contract(ABI as any, contractAddress);

      const membersInfoPromises = addresses.map((address) =>
        getUserInfo(address, contractManagement, contract)
      );

      const membersInfo = await Promise.all(membersInfoPromises);
      setFeaturedMembersInfo(membersInfo);
    } catch (error) {
      console.error("Erreur lors de la récupération des adhérents en avant:", error);
    }
  };

  const getUserInfo = async (
    address: string,
    contractManagement: any,
    contract: any
  ): Promise<UserInfo> => {
    try {
      const userInfo: unknown[] = await contractManagement.methods.getUserInfo(address).call();
      const membershipValid = Boolean(userInfo[0]);
      const name = String(userInfo[1] || "");
      const bio = String(userInfo[2] || "");

      const tokens: number[] = await contract.methods.getTokensByOwner(address).call();

      const insects = await Promise.all(
        tokens.map(async (tokenId: number) => {
          try {
            const tokenURI: string = await contract.methods.tokenURI(tokenId).call();
            const response = await fetch(tokenURI);
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
            const metadata = await response.json();
            return { id: tokenId.toString(), image: metadata.image, name: metadata.name } as InsectURI;
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
        insects: insects.filter((insect): insect is InsectURI => insect !== null),
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération des infos utilisateur ${address}:`, error);
      return { membershipValid: false, name: "", bio: "", address, tokens: [], insects: [] };
    }
  };

  // ✅ Rendu visuel
  return (
    <Box p={5}>
      <Box mt={5}>
        {featuredMembersInfo.length > 0 ? (
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
                height="250px"
                borderRadius="xl"
                position="relative"
                p="2px"
                bgGradient="linear-gradient(90deg, pink.400, purple.700, pink.400)"
                backgroundSize="300% 300%"
                animation={`${borderAnimation} 6s linear infinite`}
                transition="all 0.3s ease"
                _hover={{
                  animation: `${borderAnimation} 2s linear infinite`,
                  transform: "scale(1.05)",
                  boxShadow: "0 0 25px rgba(216, 112, 255, 0.6)",
                }}
                justifySelf="center"
                mx="auto"
              >
                <Box bg="gray.900" borderRadius="xl" height="100%" p={4} textAlign="center">
                  <Link href={`/u/${info.address}`} passHref>
                    <Tooltip label="Cliquez pour voir le profil" hasArrow>
                      <Box as="a" display="block" height="100%">
                        <Text fontWeight="bold" color="pink.200">{info.name}</Text>
                        <Text fontSize="sm" color="gray.300">{info.bio}</Text>

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
            Aucun adhérent trouvé.
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default FeaturedMembers;
