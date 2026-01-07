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
  family?: string;  // ✅ Ajouté pour famille (15ème attribut)
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
  const [family, setFamily] = useState<string[]>([]);  // ✅ string[] cohérent

  const { colorMode } = useColorMode();
  const bgColor = useColorModeValue(Backgrounds.cardBorderLight, Backgrounds.cardBorderDark);

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const contractAddressManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

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
        //console.log("✅ Derniers adhérents:", membersInfo);
      } catch (err) {
        console.error("Erreur lors de la récupération des adhérents:", err);
      }
    };

    fetchDerniersAdherents();
  }, []);

  // ✅ CORRIGÉ : Récupération famille (index 14 = 15ème élément)
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

      // ✅ Récupère TOUS les insectes + familles
      const insects = await Promise.all(
        tokens.map(async (tokenId) => {
          try {
            const tokenURI: string = await contract.tokenURI(tokenId);
            const res = await fetch(tokenURI);
            if (!res.ok) throw new Error(`Erreur tokenURI ${tokenId}`);
            const metadata = await res.json();

            // ✅ Famille = 15ème attribut (index 14)
            const insectFamily = metadata.attributes?.[15]?.value || 'Inconnue';
            //console.log(`Token ${tokenId} → Famille: ${insectFamily}`);

            return {
              id: tokenId.toString(),
              image: metadata.image,
              name: metadata.name,
              family: insectFamily  // ✅ Stockée localement
            };
          } catch (err) {
            console.error("Erreur récupération token:", err);
            return null;
          }
        })
      );

      // ✅ TOUTES les familles après Promise.all (setState asynchrone OK ici)
      const allFamilies = insects
        .filter(Boolean)
        .map((insect): string => (insect as InsectURI).family || 'Inconnue');
      setFamily(allFamilies);
      //console.log("✅ Toutes les familles:", allFamilies);

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
                  <Text fontSize="md" fontWeight="bold" color="pink.200" noOfLines={1}>
                    {info.name || "Utilisateur anonyme"}
                  </Text>
                  <Text fontSize="xs" color="gray.300" noOfLines={2}>
                    {info.bio || "Aucune bio"}
                  </Text>

                  {/* ✅ Layout 2x2 : MAX 4 insectes */}
                  <Box position="relative" mt={2}>
                    {info.insects.length > 0 ? (
                      <>
                        {/* Ligne 1 : 1er & 2ème */}
                        <Box display="flex" justifyContent="center" gap={1}>
                          {info.insects.slice(0, 2).map((insect) => (
                            <Box key={`top-${insect.id}`} textAlign="center" minW="42px">
                              <Image
                                src={insect.image}
                                alt={insect.name}
                                boxSize="38px"
                                borderRadius="md"
                                objectFit="cover"
                              />
                              <Text fontSize="2xs" color="gray.400" mt={0.5} noOfLines={1}>
                                {insect.family?.slice(0,6) || '???'} #{insect.id}
                              </Text>
                            </Box>
                          ))}
                        </Box>

                        {/* Ligne 2 : 3ème & 4ème */}
                        <Box display="flex" justifyContent="center" gap={1}>
                          {info.insects.slice(2, 4).map((insect) => (
                            <Box key={`bot-${insect.id}`} textAlign="center" minW="42px">
                              <Image
                                src={insect.image}
                                alt={insect.name}
                                boxSize="38px"
                                borderRadius="md"
                                objectFit="cover"
                              />
                              <Text fontSize="2xs" color="gray.400" mt={0.5} noOfLines={1}>
                                {insect.family?.slice(0,6) || '???'} #{insect.id}
                              </Text>
                            </Box>
                          ))}
                        </Box>

                        {/* Badge +X si >4 */}
                        {info.insects.length > 4 && (
                          <Box
                            position="absolute"
                            top="1"
                            right="1"
                            bg="pink.500"
                            color="white"
                            borderRadius="full"
                            w="18px"
                            h="18px"
                            fontSize="3xs"
                            fontWeight="bold"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            +{info.insects.length - 4}
                          </Box>
                        )}
                      </>
                    ) : (
                      <Center mt={4}>
                        <Text fontSize="2xs" color="gray.500">
                          Aucun jeton
                        </Text>
                      </Center>
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
