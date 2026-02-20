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
  Center
} from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '../../ABI/ABI_ADHESION_MANAGEMENT.json';
import { FilteredCollectionsCarousel } from '../galerie/art';
import { resolveIPFS } from "@/utils/resolveIPFS";
import { useColorModeValue } from "@chakra-ui/react";

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
  rewardPoints: number;
  userCollectionsCount: number;
  remainingCollections: number;
}

interface PublicProfileProps {
  address?: string; // <-- le ? la rend optionnelle
}


const PublicProfile: React.FC<PublicProfileProps> = ({ address }) => {
  //const { address } = router.query;

  const avatarBg = useColorModeValue("brand.cream", "brand.navy");
  const avatarFallbackBg = useColorModeValue("brand.cream", "brand.navy");


  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userCollections, setUserCollections] = useState<CollectionData[]>([]);

  const router = useRouter();
  const userAddress = (address as string) || (router.query.address as string) || null;

  useEffect(() => {
    if (!userAddress) return;

    const fetchData = async () => {
      setLoading(true);
      const provider = new JsonRpcProvider(RPC_URL);

      try {

        // --- Contracts
        const adhesionContract = new Contract(contractAdhesion, ABI, provider);
        const adhesionManager = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
        const rescollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

        // --- Infos utilisateur
        const userInfos = await adhesionContract.getUserInfo(userAddress);
        const tokenIds = await adhesionManager.getTokensByOwnerPaginated(userAddress, 0, 20);

        const ensName = userInfos.name || `Utilisateur ${userAddress.slice(0, 6)}`;;

        // --- Récupérer les NFTs avec métadonnées
        const nfts: NFTData[] = await Promise.all(
          tokenIds.map(async (tokenId: number) => {
            try {
              const tokenURI = await adhesionContract.tokenURI(tokenId);

              const metadataUrl = resolveIPFS(tokenURI, true); // -> /api/ipfs/...
              if (!metadataUrl) throw new Error("Impossible de résoudre le tokenURI");

              const response = await fetch(metadataUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);

              const metadata = await response.json();

              return {
                tokenId,
                image: resolveIPFS(metadata.image, true) || "", // URL HTTP prête
                name: metadata.name || metadata.role || `Jeton ${tokenId}`,
                role: metadata.role || "Membre",
              };
            } catch {
              return { tokenId, image: "", name: `Jeton ${tokenId}` };
            }
          })
        );



        // --- Points et collections
        const rewardPoints = Number(await adhesionContract.rewardPoints(userAddress));
        const userCollectionsCount = Number(await rescollection.getNumberOfCollectionsByUser(userAddress));
        const remainingCollections = Number(await rescollection.getRemainingCollections(userAddress));

        const allCollections = await rescollection.getCollectionsByUser(userAddress);

        const collectionsWithMetadata: CollectionData[] = await Promise.all(
          allCollections.map(async (collection: any) => {
            try {
              const uri =
                collection.uri ||
                (await rescollection.getCollectionURI(collection.id.toString()));

              const metadataUrl = resolveIPFS(uri, true);
              if (!metadataUrl) throw new Error("Impossible de résoudre l'URI de collection");

              const response = await fetch(metadataUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);

              const metadata = await response.json();

              return {
                id: collection.id.toString(),
                name: metadata.name || `Collection #${collection.id}`,
                type: collection.collectionType || "inconnue",
                imageUrl: resolveIPFS(metadata.image, true) || "",
                uri, // on garde l'URI "propre"
              };
            } catch {
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


        setUserData({
          address: userAddress,
          ensName,
          name: userInfos.name,
          biography: userInfos.bio,
          nfts,
          rewardPoints,
          userCollectionsCount,
          remainingCollections,
        });

        setUserCollections(collectionsWithMetadata);
      } catch (err) {
        console.error('❌ Erreur chargement profil public :', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userAddress]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // --- UI

  if (loading) {
    return (
      <Box textAlign="center" mt={10}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (!userData) {
    return (
      <Box textAlign="center" mt={10}>
        <Text>Utilisateur introuvable</Text>
      </Box>
    );
  }
  return (
    <Box
      mt={2}
      w="full"
      maxW={{ base: "full", sm: "600px", lg: "full" }}
      mx="auto"
      px={{ base: 4, sm: 6, md: 8, lg: 12 }}
      py={{ base: 6, md: 8 }}
      borderRadius={{ base: "xl", md: "2xl" }}
      boxShadow={{ base: "md", md: "xl" }}
    >
      {/* HEADER RESPONSIVE */}
      <VStack spacing={{ base: 6, md: 8 }} align="center" w="full">
        {/* Avatar centré mobile */}
        <Box
          w={{ base: "100px", sm: "120px", md: "130px" }}
          h={{ base: "100px", sm: "120px", md: "130px" }}
          borderRadius={{ base: "lg", md: "10px" }}
          bgGradient="linear(to-r, brand.cream, brand.gold)"
          p="1px"
          mx="auto"
        >
          <Box
            w="100%"
            h="100%"
            borderRadius={{ base: "lg", md: "10px" }}
            overflow="hidden"
            bg={avatarBg}
          >
            {userData?.nfts?.[0]?.image ? (
              <Image
                src={userData.nfts[0].image}
                alt="Avatar"
                objectFit="cover"
                w="100%"
                h="100%"
              />
            ) : (
              <Box w="100%" h="100%" bg={avatarFallbackBg} />
            )}
          </Box>
        </Box>

        {/* Infos centrées */}
        <VStack align="center" spacing={3} w="full" maxW="500px">
          <Heading size={{ base: "md", md: "lg" }} textAlign="center">
            {userData?.name || formatAddress(userData?.address)}
          </Heading>

          <HStack spacing={2} flexWrap="wrap" justify="center">
            {userData?.ensName && (
              <Text fontSize="sm" color="purple.500" fontWeight="semibold">
                {userData.ensName}
              </Text>
            )}
            <Text fontSize="sm" textAlign="center">
              {formatAddress(userData?.address)}
            </Text>
          </HStack>

          {userData?.biography && (
            <Text
              fontSize="sm"
              textAlign="center"
              maxW="600px"
              lineHeight="1.6"
            >
              {userData.biography}
            </Text>
          )}
        </VStack>
      </VStack>

      <Divider my={{ base: 6, md: 10 }} />

      {/* TABS RESPONSIVE */}
      <Tabs variant="line" colorScheme="brand" mt={{ base: 4, md: 8 }}>
        <TabList
          justifyContent="center"
          flexWrap="wrap"
          gap={{ base: 1, md: 0 }}
        >
          <Tab
            flex="1"
            minW={{ base: "120px", md: "auto" }}
            _selected={{ color: "brand.gold", borderColor: "brand.gold" }}
          >
            Collections
          </Tab>
          <Tab
            flex="1"
            minW={{ base: "120px", md: "auto" }}
            _selected={{ color: "brand.gold", borderColor: "brand.gold" }}
          >
            Adhésion
          </Tab>
        </TabList>

        <TabPanels>
          {/* COLLECTIONS */}
          <TabPanel px={0} py={6}>
            <Box
              p={{ base: 4, md: 6 }}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.2)"
              borderRadius="xl"
            >
              <Heading size="md" mb={6} textAlign="center">
                Collections de {userData?.name || formatAddress(userData?.address)}
              </Heading>

              {userCollections?.length > 0 ? (
                <FilteredCollectionsCarousel creator={userData?.address} />
              ) : (
                <Center py={12}>
                  <Text fontSize="md" opacity={0.7}>
                    Aucune collection trouvée.
                  </Text>
                </Center>
              )}
            </Box>
          </TabPanel>

          {/* ADHÉSION */}
          <TabPanel px={0} py={6}>
            <Box
              p={{ base: 4, md: 6 }}
              borderWidth={1}
              borderColor="rgba(255,255,255,0.2)"
              borderRadius="xl"
            >
              {/* Stats responsive */}
              <SimpleGrid
                columns={{ base: 1, md: 3 }}
                spacing={6}
                mb={8}
                w="full"
              >
                <VStack align="center" spacing={1}>
                  <Text fontSize="sm" opacity={0.8}>Points RESCOE</Text>
                  <Text fontSize="lg" fontWeight="semibold">
                    {userData?.rewardPoints ?? 0} 🐝
                  </Text>
                </VStack>

                <VStack align="center" spacing={1}>
                  <Text fontSize="sm" opacity={0.8}>Collections créées</Text>
                  <Text fontSize="lg" fontWeight="semibold">
                    {userData?.userCollectionsCount ?? 0}
                  </Text>
                </VStack>

                <VStack align="center" spacing={1}>
                  <Text fontSize="sm" opacity={0.8}>Restantes</Text>
                  <Text fontSize="lg" fontWeight="semibold">
                    {userData?.remainingCollections ?? 0}
                  </Text>
                </VStack>
              </SimpleGrid>

              <Divider mb={6} />

              <Heading size="md" mb={6} textAlign="center">
                Jetons d'adhésion
              </Heading>

              <SimpleGrid
                columns={{ base: 2, sm: 3, md: 4 }}
                spacing={{ base: 3, md: 6 }}
                w="full"
              >
                {userData?.nfts?.length > 0 ? (
                  userData.nfts.slice(0, 8).map((nft) => (
                    <Link
                      key={nft.tokenId}
                      href={`/AdhesionId/${contractAdhesion}/${nft.tokenId}`}
                    >
                      <Box
                        borderWidth={1}
                        borderColor="rgba(255,255,255,0.2)"
                        borderRadius="lg"
                        overflow="hidden"
                        transition="all 0.2s ease"
                        _hover={{
                          boxShadow: "lg",
                          transform: "translateY(-2px)",
                        }}
                        minH="160px"
                      >
                        <Image
                          src={nft.image}
                          alt={`NFT #${nft.tokenId}`}
                          h={{ base: "100px", md: "140px" }}
                          w="100%"
                          objectFit="cover"
                        />
                        <Box p={{ base: 2, md: 3 }}>
                          <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" noOfLines={1}>
                            {nft.name}
                          </Text>
                          <Text fontSize="xs" opacity={0.7}>
                            #{nft.tokenId}
                          </Text>
                        </Box>
                      </Box>
                    </Link>
                  ))
                ) : (
                  <Center py={12} gridColumn="1 / -1">
                    <Text fontSize="md" opacity={0.7}>
                      Aucun NFT trouvé.
                    </Text>
                  </Center>
                )}
              </SimpleGrid>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );

};


export default PublicProfile;
