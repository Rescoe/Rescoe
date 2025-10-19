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
        const ensName = (await provider.lookupAddress(userAddress)) || undefined;

        // --- Contracts
        const adhesionContract = new Contract(contractAdhesion, ABI, provider);
        const adhesionManager = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
        const rescollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

        // --- Infos utilisateur
        const userInfos = await adhesionManager.getUserInfo(userAddress);
        const tokenIds = await adhesionManager.getTokensByOwnerPaginated(userAddress, 0, 100);

        // --- Récupérer les NFTs avec métadonnées
        const nfts: NFTData[] = await Promise.all(
          tokenIds.map(async (tokenId: number) => {
            try {
              const tokenURI = await adhesionContract.tokenURI(tokenId);
              const response = await fetch(tokenURI);
              const metadata = await response.json();
              return {
                tokenId,
                image: metadata.image || '',
                name: metadata.name || metadata.role || `Jeton ${tokenId}`,
                role: metadata.role || 'Membre',
              };
            } catch {
              return { tokenId, image: '', name: `Jeton ${tokenId}` };
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
              const uri = collection.uri || (await rescollection.getCollectionURI(collection.id.toString()));
              const response = await fetch(uri);
              const metadata = await response.json();
              return {
                id: collection.id.toString(),
                name: metadata.name || `Collection #${collection.id}`,
                type: collection.collectionType || 'inconnue',
                imageUrl: metadata.image || '',
                uri,
              };
            } catch {
              return {
                id: collection.id.toString(),
                name: `Collection #${collection.id}`,
                type: 'inconnue',
                imageUrl: '',
                uri: '',
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
    <Box mt={10} textAlign="center" w="100%" maxW="1000px" mx="auto">
      {/* --- Header --- */}
      <HStack spacing={4} justify="center" textAlign="center">
      <Box
        w="100px"
        h="100px"
        borderRadius="full"
        border="2px" // Épaisseur de la bordure
        borderColor="purple.500" // Couleur de la bordure
        backgroundColor="transparent" // Fond transparent
        overflow="hidden"
      >          {userData.nfts?.[0]?.image ? (
            <Image
              src={userData.nfts[0].image}
              alt="Avatar"
              objectFit="cover"
              w="100%"
              h="100%"
            />
          ) : (
            <Box w="100%" h="100%" bg="gray.300" />
          )}
        </Box>

        <Box>
        <Heading>{userData.name || formatAddress(userData.address)}</Heading>
        {userData.ensName && <Text color="purple.500">{userData.ensName}</Text>}
        <Text>{userData.biography}</Text>
        <Text fontSize="sm" color="gray.500">
          {formatAddress(userData.address)}
        </Text>
        </Box>
      </HStack>

      <Divider my={6} />

      {/* --- Tabs --- */}
      <Tabs variant="enclosed" colorScheme="purple" isFitted>
        <TabList>
          <Tab>Collections</Tab>
          <Tab>Adhésion</Tab>
        </TabList>

        <TabPanels>
          {/* --- Adhésion --- */}
          <TabPanel>

            <Box mt={4}>
              <Heading size="md" mb={4}>
                Collections de {userData.name || formatAddress(userData.address)}
              </Heading>

              {userCollections.length > 0 ? (
                <FilteredCollectionsCarousel
                  creator={userData.address}
                />
              ) : (
                <Text color="gray.500">Aucune collection trouvée.</Text>
              )}
            </Box>
          </TabPanel>

          {/* --- Collections --- */}
          <TabPanel>

          <VStack spacing={3}>
            <Text>
              <strong>Points RESCOE :</strong> {userData.rewardPoints} 🐝
            </Text>
            <Text>
              <strong>Collections créées :</strong> {userData.userCollectionsCount}
            </Text>
            <Text>
              <strong>Collections restantes :</strong> {userData.remainingCollections}
            </Text>
          </VStack>

          <Divider my={4} />
          <Heading size="md" mb={2}>
            Jetons d'adhésion
          </Heading>

          <HStack spacing={4} flexWrap="wrap" justify="center">
            {userData.nfts.length > 0 ? (
              userData.nfts.map((nft) => (
                <Link
                  key={nft.tokenId}
                  href={`/AdhesionId/${contractAdhesion}/${nft.tokenId}`}
                >
                  <VStack>
                    <Image
                      src={nft.image}
                      alt={`NFT #${nft.tokenId}`}
                      boxSize="100px"
                      borderRadius="md"
                      objectFit="cover"
                    />
                    <Text fontSize="xs">
                      {nft.name} — {`#${nft.tokenId}`}
                    </Text>
                  </VStack>
                </Link>
              ))
            ) : (
              <Text color="gray.500">Aucun NFT trouvé</Text>
            )}
          </HStack>

          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default PublicProfile;
