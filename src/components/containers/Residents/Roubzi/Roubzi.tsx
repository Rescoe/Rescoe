"use client";

import React, { useEffect, useState } from 'react';
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
} from '@chakra-ui/react';
import { JsonRpcProvider, Contract } from 'ethers';
import ABI from '@/components/ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '@/components/ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import { FilteredCollectionsCarousel } from '@/components/containers/galerie/art';
import OeuvresFeed from '@/utils/OeuvresFeed';

// 🔗 Contracts
const CONTRACT_ADHESION = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const CONTRACT_RESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const CONTRACT_ADHESION_MANAGEMENT = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string;

// ⚡ Hardcode ton adresse Ethereum ici
const HARDCODED_ADDRESS = "0x7ebde55c4aba6b3b31e03306e833ff92187f984b";

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

const Roubzi: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userCollections, setUserCollections] = useState<CollectionData[]>([]);

  const userAddress = HARDCODED_ADDRESS;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const provider = new JsonRpcProvider(RPC_URL);

      try {
        const ensName = (await provider.lookupAddress(userAddress)) || undefined;

        const adhesionContract = new Contract(CONTRACT_ADHESION, ABI, provider);
        const adhesionManager = new Contract(CONTRACT_ADHESION_MANAGEMENT, ABI_ADHESION_MANAGEMENT, provider);
        const rescollection = new Contract(CONTRACT_RESCOLLECTION, ABIRESCOLLECTION, provider);

        const userInfos = await adhesionContract.getUserInfo(userAddress);
        const tokenIds = await adhesionManager.getTokensByOwnerPaginated(userAddress, 0, 100);

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
      {/* --- Tabs --- */}
      <Tabs variant="enclosed" colorScheme="purple" isFitted>
        <TabList>
          <Tab>Collections</Tab>
          <Tab>Oeuvres</Tab>
        </TabList>

        <TabPanels>
          {/* --- Collections --- */}
          <TabPanel>
            <Box mt={4}>
              <Heading size="md" mb={4}>
                Collections de {userData.name || formatAddress(userData.address)}
              </Heading>

              {userCollections.length > 0 ? (
                <FilteredCollectionsCarousel creator={userData.address} />
              ) : (
                <Text color="gray.500">Aucune collection trouvée.</Text>
              )}
            </Box>
          </TabPanel>

          {/* --- Oeuvres --- */}
          <TabPanel>
          <OeuvresFeed
            channelId="1437047144799273061"
            collectionAddress="0xEab520A02f2dC79c61F67C6A680FCc63Ea833Aa9"
            artistAddress={HARDCODED_ADDRESS}
          />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Roubzi;
