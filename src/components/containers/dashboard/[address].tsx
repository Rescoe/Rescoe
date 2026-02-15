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
      mt={12}
      w="100%"
      maxW="1000px"
      mx="auto"
      p={8}
      borderRadius="2xl"
      boxShadow="xl"
    >
      {/* ================= HEADER ================= */}
      <HStack spacing={8} align="center" flexWrap="wrap">
        {/* Avatar avec gradient ring */}
        <Box
          w="130px"
          h="130px"
          borderRadius="full"
          bgGradient="linear(to-r, brand.mauve, brand.gold)"
          p="4px"
        >
          <Box
            w="100%"
            h="100%"
            borderRadius="full"
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
              <Box
                w="100%"
                h="100%"
                bg={avatarFallbackBg}
              />
            )}
          </Box>
        </Box>


        {/* Infos utilisateur */}
        <VStack align="start" spacing={3} flex="1">
          <Heading size="lg">
            {userData?.name || formatAddress(userData?.address)}
          </Heading>

          <HStack spacing={3}>
            {userData?.ensName && (
              <Text
                fontSize="sm"
                color="purple.500"
                fontWeight="semibold"
              >
                {userData.ensName}
              </Text>
            )}

            <Text fontSize="sm">
              {formatAddress(userData?.address)}
            </Text>
          </HStack>

          {userData?.biography && (
            <Text
              fontSize="sm"
              maxW="600px"
              lineHeight="1.6"
            >
              {userData.biography}
            </Text>
          )}
        </VStack>
      </HStack>

      <Divider my={10} />

      {/* ================= TABS ================= */}
      <Tabs variant="soft-rounded" colorScheme="purple" isFitted>
        <TabList>
          <Tab>Collections</Tab>
          <Tab>Adhésion</Tab>
        </TabList>

        <TabPanels mt={8}>
          {/* ================= COLLECTIONS ================= */}
          <TabPanel px={0}>
            <Box
              p={6}
              borderWidth="1px"
              borderRadius="xl"
            >
              <Heading size="md" mb={6}>
                Collections de{" "}
                {userData?.name || formatAddress(userData?.address)}
              </Heading>

              {userCollections?.length > 0 ? (
                <FilteredCollectionsCarousel
                  creator={userData?.address}
                />
              ) : (
                <Text>
                  Aucune collection trouvée.
                </Text>
              )}
            </Box>
          </TabPanel>

          {/* ================= ADHÉSION ================= */}
          <TabPanel px={0}>
            <Box
              p={6}
              borderWidth="1px"
              borderRadius="xl"
            >
              {/* Stats */}
              <HStack
                spacing={10}
                mb={8}
                flexWrap="wrap"
              >
                <VStack align="start">
                  <Text fontSize="sm">
                    Points RESCOE
                  </Text>
                  <Text size="md">
                    {userData?.rewardPoints ?? 0} 🐝
                  </Text>
                </VStack>

                <VStack align="start">
                  <Text fontSize="sm">
                    Collections créées
                  </Text>
                  <Text size="md">
                    {userData?.userCollectionsCount ?? 0}
                  </Text>
                </VStack>

                <VStack align="start">
                  <Text fontSize="sm">
                    Collections restantes
                  </Text>
                  <Text size="md">
                    {userData?.remainingCollections ?? 0}
                  </Text>
                </VStack>
              </HStack>

              <Divider mb={6} />

              <Heading size="md" mb={6}>
                Jetons d'adhésion
              </Heading>

              <Box
                display="grid"
                gridTemplateColumns="repeat(auto-fill, minmax(140px, 1fr))"
                gap={6}
              >
                {userData?.nfts?.length > 0 ? (
                  userData.nfts.map((nft) => (
                    <Link
                      key={nft.tokenId}
                      href={`/AdhesionId/${contractAdhesion}/${nft.tokenId}`}
                    >
                      <Box
                        borderWidth="1px"
                        borderRadius="xl"
                        overflow="hidden"
                        transition="all 0.2s ease"
                        _hover={{
                          boxShadow: "lg",
                          transform: "translateY(-3px)",
                        }}
                      >
                        <Image
                          src={nft.image}
                          alt={`NFT #${nft.tokenId}`}
                          h="140px"
                          w="100%"
                          objectFit="cover"
                        />

                        <Box p={3}>
                          <Text
                            fontSize="sm"
                            fontWeight="medium"
                            noOfLines={1}
                          >
                            {nft.name}
                          </Text>
                          <Text
                            fontSize="xs"
                          >
                            #{nft.tokenId}
                          </Text>
                        </Box>
                      </Box>
                    </Link>
                  ))
                ) : (
                  <Text>
                    Aucun NFT trouvé.
                  </Text>
                )}
              </Box>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};


export default PublicProfile;
