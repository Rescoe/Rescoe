import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Heading,
  Text,
  Image,
  Spinner,
  VStack,
  HStack,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Link,
  SimpleGrid,
  Center,
  Button,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import Web3 from 'web3';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '../../ABI/ABI_ADHESION_MANAGEMENT.json';
import { FilteredCollectionsCarousel } from '../galerie/art';
import { resolveIPFS } from "@/utils/resolveIPFS";
import { borderAnimation, gradients, animations, Backgrounds, effects } from "@/styles/theme"

// 🔗 Contracts
const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

interface NFTData {
  tokenId: number;
  image: string;
  name?: string;
  role?: string;
  family?: string;
}

interface CollectionData {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  uri: string;
}

interface UserData {
  address: string;
  ensName?: string;
  name?: string;
  biography?: string;
  nfts: NFTData[];
  tokens: number[];
  rewardPoints: number;
  userCollectionsCount: number;
  remainingCollections: number;
  membershipValid: boolean;
}

interface PublicProfileProps {
  address?: string;
}

const PublicProfile: React.FC<PublicProfileProps> = ({ address }) => {
  const { colorMode } = useColorMode();
  const cardBg = useColorModeValue("brand.cream", "brand.navy");
  const cardBorder = useColorModeValue("brand.cream", "brand.cream");
  const borderColor = useColorModeValue("brand.navy", "brand.cream");
  const bgColor = useColorModeValue(
    Backgrounds.cardBorderLight,
    Backgrounds.cardBorderDark
  );

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userCollections, setUserCollections] = useState<CollectionData[]>([]);

  const router = useRouter();
  const userAddress = (address as string) || (router.query.address as string) || null;

  // ✅ EXACTEMENT COMME FeaturedMembers
  const getUserInfo = async (
    userAddr: string,
    contract: any
  ): Promise<UserData> => {
    try {
      // 1️⃣ Récupérer infos utilisateur
      const userInfoRaw: unknown[] = await contract.methods.getUserInfo(userAddr).call();
      const membershipValid = Boolean(userInfoRaw[0]);
      const name = String(userInfoRaw[1] || "");
      const bio = String(userInfoRaw[2] || "");

      // 2️⃣ Récupérer tous les tokenIds
      const tokens: number[] = await contract.methods.getTokensByOwner(userAddr).call();

      console.log(`✅ ${userAddr} possède ${tokens.length} tokens:`, tokens);

      // 3️⃣ Fetch metadata pour chaque token (EXACT PATTERN FeaturedMembers)
      const nfts = await Promise.all(
        tokens.map(async (tokenId: number) => {
          try {
            const tokenURI: string = await contract.methods.tokenURI(tokenId).call();

            // 🔑 Résoudre tokenURI pour fetch metadata
            const metadataUrl = resolveIPFS(tokenURI, true);
            if (!metadataUrl) throw new Error(`Impossible de résoudre tokenURI ${tokenId}`);

            const response = await fetch(metadataUrl);
            if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

            const metadata = await response.json();

            console.log(`📦 Token #${tokenId}:`, {
              name: metadata.name,
              image: metadata.image,
              family: metadata.attributes?.[15]?.value || metadata.family_name || "Inconnue"
            });

            return {
              tokenId,
              image: resolveIPFS(metadata.image, true) || "",
              name: metadata.name || metadata.role || `Jeton ${tokenId}`,
              role: metadata.role || "Membre",
              family: metadata.attributes?.[15]?.value || metadata.family_name || "Inconnue"
            } as NFTData;
          } catch (err) {
            console.error(`❌ Erreur token ${tokenId}:`, err);
            return null;
          }
        })
      );

      const validNFTs = nfts.filter((n): n is NFTData => n !== null);

      // 4️⃣ Récupérer points et collections
      const rewardPoints = Number(await contract.methods.rewardPoints(userAddr).call());

      const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
      const rescollection = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);

      const userCollectionsCount = Number(await rescollection.methods.getNumberOfCollectionsByUser(userAddr).call());
      const remainingCollections = Number(await rescollection.methods.getRemainingCollections(userAddr).call());

      const allCollections = await rescollection.methods.getCollectionsByUser(userAddr).call();

      let collectionsWithMetadata: CollectionData[] = [];

      if (Array.isArray(allCollections) && allCollections.length > 0) {
        collectionsWithMetadata = await Promise.all(
          allCollections.map(async (collection: any) => {
            try {
              const uri =
                collection.uri ||
                (await rescollection.methods
                  .getCollectionURI(collection.id.toString())
                  .call());

              const metadataUrl = resolveIPFS(uri, true);
              if (!metadataUrl)
                throw new Error("Impossible de résoudre l'URI de collection");

              const response = await fetch(metadataUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);

              const metadata = await response.json();

              return {
                id: collection.id.toString(),
                name: metadata.name || `Collection #${collection.id}`,
                type: collection.collectionType || "inconnue",
                imageUrl: resolveIPFS(metadata.image, true) || "",
                uri,
              };
            } catch (err) {
              console.error("Erreur collection:", err);
              return {
                id: collection.id.toString(),
                name: `Collection #${collection.id}`,
                type: "inconnue",
                imageUrl: "",
                uri: "",
              };
            }
          })
        );
      } else {
        console.warn("Aucune collection trouvée ou allCollections n'est pas un tableau");
      }

      return {
        address: userAddr,
        ensName: name,
        name,
        biography: bio,
        nfts: validNFTs,
        tokens,
        rewardPoints,
        userCollectionsCount,
        remainingCollections,
        membershipValid,
      };
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération de ${userAddr}:`, error);
      return {
        address: userAddr,
        ensName: undefined,
        name: undefined,
        biography: undefined,
        nfts: [],
        tokens: [],
        rewardPoints: 0,
        userCollectionsCount: 0,
        remainingCollections: 0,
        membershipValid: false,
      };
    }
  };

  useEffect(() => {
    if (!userAddress) return;

    const fetchData = async () => {
      setLoading(true);
      const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

      try {
        const adhesionContract = new web3.eth.Contract(ABI as any, contractAdhesion);

        const userInfo = await getUserInfo(userAddress, adhesionContract);

        // Récupérer collections séparément
        const rescollection = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);
        const allCollections = await rescollection.methods.getCollectionsByUser(userAddress).call();

        let collectionsWithMetadata: CollectionData[] = [];

        if (Array.isArray(allCollections) && allCollections.length > 0) {
          collectionsWithMetadata = await Promise.all(
            allCollections.map(async (collection: any) => {
              try {
                const uriFromContract = await rescollection.methods
                  .getCollectionURI(collection.id.toString())
                  .call();

                // On force une string et on filtre tout type non string (ex: [] ou undefined)
                const uri: string =
                  typeof uriFromContract === 'string' ? uriFromContract : '';

                const metadataUrl = resolveIPFS(uri, true) ?? '';
                if (!metadataUrl) throw new Error("Impossible de résoudre l'URI");

                const response = await fetch(metadataUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const metadata = await response.json();

                return {
                  id: collection.id.toString(),
                  name: metadata.name || `Collection #${collection.id}`,
                  type: collection.collectionType || "inconnue",
                  imageUrl: resolveIPFS(metadata.image, true) ?? '',
                  uri,
                };
              } catch (err) {
                console.error("Erreur collection:", err);
                return {
                  id: collection.id.toString(),
                  name: `Collection #${collection.id}`,
                  type: "inconnue",
                  imageUrl: '',
                  uri: '', // toujours string
                };
              }
            })
          );
        }

        setUserData(userInfo);
        setUserCollections(collectionsWithMetadata);

        console.log("✅ UserData final:", userInfo);
      } catch (err) {
        console.error('❌ Erreur chargement profil public :', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userAddress]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // ========== COMPOSANT INSECTE CARD ==========
  const InsectCard = ({ nft }: { nft: NFTData }) => {
    return (
      <Link
        href={`/AdhesionId/${contractAdhesion}/${nft.tokenId}`}
        _hover={{ textDecoration: "none" }}
      >
        <Box
          borderRadius="xl"
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
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
        >
          <Box borderRadius="lg" p={3} textAlign="center" bg={bgColor}>
            <Image
              src={nft.image || "/fallback-image.png"}
              alt={`NFT #${nft.tokenId}`}
              h="120px"
              w="100%"
              objectFit="cover"
              borderRadius="md"
              mb={2}
              fallbackSrc="/fallback-image.png"
            />
            <Text fontSize="xs" fontWeight="semibold" noOfLines={1} mb={1}>
              {nft.name}
            </Text>
            <Text fontSize="2xs" opacity={0.7} noOfLines={1}>
              {nft.family || `#${nft.tokenId}`}
            </Text>
          </Box>
        </Box>
      </Link>
    );
  };

  // ========== RENDER ==========
  if (loading) {
    return (
      <Center minH="50vh">
        <VStack spacing={4}>
          <Spinner size="xl" color="brand.gold" thickness="4px" />
          <Text opacity={0.7}>Chargement du profil...</Text>
        </VStack>
      </Center>
    );
  }

  if (!userData) {
    return (
      <Center minH="50vh">
        <VStack spacing={4}>
          <Heading size="md">Utilisateur introuvable</Heading>
          <Text opacity={0.7}>Vérifiez l'adresse wallet</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box
      w="full"
      minH="100vh"
      bgGradient={
        colorMode === "light"
          ? `linear(to-b, ${cardBg}, ${cardBg})`
          : `linear(to-b, ${cardBg}, ${cardBg})`
      }
    >
      <Box
        maxW="1400px"
        mx="auto"
        px={{ base: 4, sm: 6, md: 8, lg: 12 }}
        py={{ base: 6, md: 8 }}
      >
        {/* ========== HEADER SECTION ========== */}
        <VStack spacing={{ base: 6, md: 8 }} align="center" w="full" mb={12}>
          {/* Avatar avec animation */}
          <Box
            position="relative"
            p="2px"
            bgGradient={
              colorMode === "light"
                ? gradients.cardBorderLight
                : gradients.cardBorderDark
            }
            backgroundSize="300% 300%"
            animation={animations.borderGlow}
            borderRadius="2xl"
            w={{ base: "120px", sm: "140px", md: "160px" }}
            h={{ base: "120px", sm: "140px", md: "160px" }}
            transition="all 0.3s ease"
            _hover={{
              animation: animations.borderGlow.replace("6s", "2s"),
              boxShadow:
                colorMode === "light"
                  ? "0 0 30px rgba(180, 166, 213, 0.6)"
                  : "0 0 30px rgba(238, 212, 132, 0.6)",
            }}
          >
            <Box
              w="100%"
              h="100%"
              borderRadius="2xl"
              overflow="hidden"
              bg={cardBg}
            >
              {userData?.nfts?.[0]?.image ? (
                <Image
                  src={userData.nfts[0].image}
                  alt="Avatar"
                  objectFit="cover"
                  w="100%"
                  h="100%"
                  fallbackSrc="/fallback-image.png"
                />
              ) : (
                <Box w="100%" h="100%" bg={cardBg} />
              )}
            </Box>
          </Box>

          {/* Infos utilisateur */}
          <VStack align="center" spacing={3} w="full" maxW="600px">
            <Heading
              size="lg"
              textAlign="center"
              bgGradient={
                colorMode === "light"
                  ? "linear(to-r, brand.navy, brand.navy)"
                  : "linear(to-r, brand.gold, brand.cream)"
              }
              bgClip="text"
            >
              {userData?.name || formatAddress(userData?.address)}
            </Heading>

            <HStack spacing={2} flexWrap="wrap" justify="center">
              {userData?.membershipValid && (
                <Text
                  fontSize="sm"
                  fontWeight="semibold"
                  color="green.400"
                  bg="green.900"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  ✓ Adhérent actif
                </Text>
              )}
              <Text
                fontSize="sm"
                opacity={0.8}
                fontFamily="monospace"
                bg="rgba(180, 166, 213, 0.1)"
                px={3}
                py={1}
                borderRadius="full"
              >
                {formatAddress(userData?.address)}
              </Text>
            </HStack>

            {userData?.biography && (
              <Text
                fontSize="sm"
                textAlign="center"
                maxW="600px"
                lineHeight="1.6"
                opacity={0.85}
                px={4}
              >
                "{userData.biography}"
              </Text>
            )}
          </VStack>
        </VStack>

        <Divider
          my={{ base: 6, md: 10 }}
          borderColor={colorMode === "light" ? "brand.navy" : "brand.gold"}
          opacity={0.2}
        />

        {/* ========== TABS SECTION ========== */}
        <Tabs
          variant="line"
          colorScheme="brand"
          mt={{ base: 4, md: 8 }}
          isLazy
        >
          <TabList
            justifyContent="center"
            flexWrap="wrap"
            gap={{ base: 2, md: 4 }}
            borderColor={colorMode === "light" ? "brand.navy" : "brand.gold"}
            opacity={0.3}
          >
            <Tab
              _selected={{
                color: colorMode === "light" ? "brand.navy" : "brand.gold",
                borderColor: colorMode === "light" ? "brand.navy" : "brand.gold",
                fontWeight: "bold",
              }}
              fontSize={{ base: "sm", md: "md" }}
            >
              🎨 Collections ({userData?.userCollectionsCount || 0})
            </Tab>
            <Tab
              _selected={{
                color: colorMode === "light" ? "brand.navy" : "brand.gold",
                borderColor: colorMode === "light" ? "brand.navy" : "brand.gold",
                fontWeight: "bold",
              }}
              fontSize={{ base: "sm", md: "md" }}
            >
              🐝 Adhésion ({userData?.nfts?.length || 0})
            </Tab>
          </TabList>

          <TabPanels>
            {/* ========== COLLECTIONS TAB ========== */}
            <TabPanel px={0} py={8}>
              <Box
                p={{ base: 4, md: 6 }}
                borderWidth={1}
                borderColor="rgba(255,255,255,0.2)"
                borderRadius="2xl"
                bgGradient={
                  colorMode === "light"
                    ? "linear(to-r, rgba(255,255,255,0.5), rgba(255,255,255,0.3))"
                    : "linear(to-r, rgba(180,166,213,0.1), rgba(238,212,132,0.05))"
                }
              >
                <Heading
                  size="md"
                  mb={8}
                  textAlign="center"
                  bgGradient={
                    colorMode === "light"
                      ? "linear(to-r, brand.navy, brand.navy)"
                      : "linear(to-r, brand.gold, brand.cream)"
                  }
                  bgClip="text"
                >
                  Collections de {userData?.name || "l'artiste"}
                </Heading>

                {userCollections?.length > 0 ? (
                  <FilteredCollectionsCarousel creator={userData?.address} />
                ) : (
                  <Center py={16}>
                    <VStack spacing={3}>
                      <Text fontSize="lg" fontWeight="semibold" opacity={0.7}>
                        Aucune collection
                      </Text>
                      <Text fontSize="sm" opacity={0.5}>
                        Cet utilisateur n'a pas encore créé de collection
                      </Text>
                    </VStack>
                  </Center>
                )}
              </Box>
            </TabPanel>

            {/* ========== ADHÉSION TAB ========== */}
            <TabPanel px={0} py={8}>
              <Box
                p={{ base: 4, md: 6 }}
                borderWidth={1}
                borderColor="rgba(255,255,255,0.2)"
                borderRadius="2xl"
                bgGradient={
                  colorMode === "light"
                    ? "linear(to-r, rgba(255,255,255,0.5), rgba(255,255,255,0.3))"
                    : "linear(to-r, rgba(180,166,213,0.1), rgba(238,212,132,0.05))"
                }
              >
                {/* STATS CARDS */}
                <SimpleGrid
                  columns={{ base: 1, sm: 2, md: 4 }}
                  spacing={6}
                  mb={10}
                  w="full"
                >
                  {/* Adhésion valide */}
                  <Box
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor={
                      userData?.membershipValid
                        ? "green.400"
                        : "red.400"
                    }
                    bgColor={
                      userData?.membershipValid
                        ? "rgba(48, 185, 107, 0.1)"
                        : "rgba(245, 101, 101, 0.1)"
                    }
                    textAlign="center"
                  >
                    <Text fontSize="xs" opacity={0.8} mb={1}>
                      Statut
                    </Text>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color={
                        userData?.membershipValid
                          ? "green.400"
                          : "red.400"
                      }
                    >
                      {userData?.membershipValid ? "✓ Actif" : "✗ Inactif"}
                    </Text>
                  </Box>

                  {/* Points */}
                  <Box
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="brand.gold"
                    bgColor="rgba(180, 166, 213, 0.1)"
                    textAlign="center"
                  >
                    <Text fontSize="xs" opacity={0.8} mb={1}>
                      Points RESCOE
                    </Text>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      bgGradient="linear(to-r, brand.cream, brand.gold)"
                      bgClip="text"
                    >
                      {userData?.rewardPoints ?? 0} 🐝
                    </Text>
                  </Box>

                  {/* Collections créées */}
                  <Box
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="brand.cream"
                    bgColor="rgba(238, 212, 132, 0.1)"
                    textAlign="center"
                  >
                    <Text fontSize="xs" opacity={0.8} mb={1}>
                      Collections
                    </Text>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      color="brand.cream"
                    >
                      {userData?.userCollectionsCount ?? 0}
                    </Text>
                  </Box>

                  {/* Restantes */}
                  <Box
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="brand.gold"
                    bgColor="rgba(180, 166, 213, 0.1)"
                    textAlign="center"
                  >
                    <Text fontSize="xs" opacity={0.8} mb={1}>
                      Créables
                    </Text>
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      bgGradient="linear(to-r, brand.gold, brand.cream)"
                      bgClip="text"
                    >
                      +{userData?.remainingCollections ?? 0}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Divider
                  my={8}
                  borderColor={colorMode === "light" ? "brand.navy" : "brand.gold"}
                  opacity={0.2}
                />

                {/* JETONS D'ADHÉSION */}
                <Heading
                  size="md"
                  mb={8}
                  textAlign="center"
                  bgGradient={
                    colorMode === "light"
                      ? "linear(to-r, brand.navy, brand.navy)"
                      : "linear(to-r, brand.gold, brand.cream)"
                  }
                  bgClip="text"
                >
                  Jetons d'adhésion
                </Heading>

                {userData?.nfts?.length > 0 ? (
                  <SimpleGrid
                    columns={{ base: 2, sm: 3, md: 4, lg: 5 }}
                    spacing={{ base: 3, md: 4 }}
                    w="full"
                  >
                    {userData.nfts.map((nft) => (
                      <InsectCard key={nft.tokenId} nft={nft} />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Center py={16}>
                    <VStack spacing={3}>
                      <Text fontSize="lg" fontWeight="semibold" opacity={0.7}>
                        Aucun jeton d'adhésion
                      </Text>
                      <Text fontSize="sm" opacity={0.5}>
                        Cet utilisateur n'a pas encore d'adhésion active
                      </Text>
                    </VStack>
                  </Center>
                )}
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
};

export default PublicProfile;
