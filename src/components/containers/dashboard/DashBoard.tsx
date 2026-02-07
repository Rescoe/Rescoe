import React, { useState, useEffect } from 'react';
import { InfoOutlineIcon } from "@chakra-ui/icons";
import { Box, Tooltip, Icon, Image, Heading, VStack, Stack, Button, Text, Link, HStack, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, FormLabel, Spinner, Divider, useToast } from '@chakra-ui/react';
import * as jdenticon from 'jdenticon';

import { useAuth } from "@/utils/authContext";
import { JsonRpcProvider } from 'ethers';
import { ethers } from "ethers";

import { BrowserProvider, Eip1193Provider } from "ethers";
import UserNFTFeed from "@/hooks/Moralis/userNFT";
import UserTransactionsFeed from "@/hooks/Moralis/UserTransactionsFeed";

import { Contract } from 'ethers';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '../../ABI/ABI_ADHESION_MANAGEMENT.json';
import CreateCollection from './CreateCollection';
import { FilteredCollectionsCarousel } from '../galerie/art';
import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from "web3";

import { useRouter } from 'next/router';

const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;


function formatSeconds(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
}



const Dashboard = () => {
  const { address: authAddress } = useAuth();

  interface UserData {
    address: string;
    name: string;
    biography: string;
    avatarSvg: string;
    roles: string[];
    finAdhesion: string;
    nfts: Array<{
      tokenId: string;
      image: string;
      role?: string;
      finAdhesion?: string;
      remainingTime?: string;  // ✅ AJOUTÉ
    }>;
    collections: any[];
    rewardPoints: number;
    pendingPoints: number;
    userCollections?: number;
    remainingCollections?: number;
  }

  interface NFTData {
    tokenId: string;
    metadata: {
      image: string;
      role?: string;
      finAdhesion?: string;
      [key: string]: any; // pour tout autre champ présent dans le JSON
    };
    remainingTime?: string;  // ✅ AJOUTÉ

  }

  const [userData, setUserData] = useState<UserData>({
    address: authAddress || '',
    name: '',
    biography: '',
    avatarSvg: '',
    roles: [],
    finAdhesion: '',
    nfts: [],
    collections: [],
    rewardPoints: 0,
    pendingPoints: 0, // ✅ Initialisation

  });


  const [loading, setLoading] = useState<boolean>(true);
  const [pointsToBuy, setPointsToBuy] = useState<number>(0); // État pour les points à acheter
  const toast = useToast();
  const { address: account, web3, isAuthenticated } = useAuth();

  const router = useRouter();

  const goToToken = (tokenId: string | number) => {  // ✅ Accepte string OU number
    router.push(`/AdhesionId/${contractAdhesion}/${tokenId}`,
               undefined,
               { shallow: true }); // ✅ Pas de re-render global
  };

  useEffect(() => {
    const setupWeb3 = async () => {
      const detectedProvider = await detectEthereumProvider();
      if (detectedProvider) {
        const web3Instance = new Web3(detectedProvider);
        const accounts: string[] = await web3Instance.eth.requestAccounts();
        if (accounts.length > 0) {
          setUserData(prev => ({ ...prev, address: accounts[0] }));
        }
      } else {
        console.error("MetaMask not detected");
      }
    };
    setupWeb3();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authAddress) return; // Sortir si l'adresse est vide
      setLoading(true);
      try {
        const [rolesAndImages, adhesionPoints, pendingsPoints, nfts, stats] = await Promise.all([
          fetchRolesAndImages(authAddress),
          fetchAdhesionPoints(authAddress),
          fetchPendingPoints(authAddress),
          fetchNFTs(authAddress),
          fetchStatsCollection(authAddress),
        ]);

        const allNFTs = rolesAndImages.nfts;

        const mergedUserData = {
          address: authAddress,
          name: rolesAndImages.name || '',
          avatarSvg: rolesAndImages.nfts?.[0]?.image || '',
          biography: rolesAndImages.biography || '',
          roles: rolesAndImages.roles,
          finAdhesion: rolesAndImages.finAdhesion,
          rewardPoints: adhesionPoints,
          pendingPoints: pendingsPoints,
          nfts: allNFTs,
          collections: stats.collections,
          userCollections: stats.userCollections,
          remainingCollections: stats.remainingCollections,
        };

        setUserData(mergedUserData);
      } catch (err) {
        console.error("Erreur lors du chargement du profil :", err);
        toast({ title: "Erreur", description: "Échec de la récupération des données utilisateur.", status: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [authAddress]);

  const fetchRolesAndImages = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
    const contractadhesion = new Contract(contractAdhesion, ABI, provider);

    const tokenIds = await contractadhesion.getTokensByOwner(userAddress);
    const userInfos = await contractadhesion.getUserInfo(userAddress);

    const fetchedRolesAndImages = await Promise.all(tokenIds.map(async (tokenId: number) => {
      const fullDatas = await contractadhesion.getTokenDetails(tokenId);

      const mintTimestamp = Number(fullDatas[2]); // secondes
      const remainingTime = Number(await contractadhesion.getRemainingMembershipTime(tokenId)); // secondes
      const finAdhesion = new Date((mintTimestamp + remainingTime) * 1000);

      const tokenURI = await contractadhesion.tokenURI(tokenId);
      const response = await fetch(tokenURI);
      const metadata = await response.json();

      return {
        role: metadata.role,
        image: metadata.image,
        tokenId: Number(tokenId),
        finAdhesion,
        remainingTime: formatSeconds(remainingTime),  // ✅ AJOUTÉ (comme TokenPage)
      };
    }));

    return {
      name: userInfos.name,
      biography: userInfos.bio,
      roles: fetchedRolesAndImages.map(item => item.role),
      finAdhesion: fetchedRolesAndImages[0]?.finAdhesion || '',
      nfts: fetchedRolesAndImages,
    };
  };

  const fetchNFTs = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contractadhesionVar = new Contract(contractAdhesion, ABI, provider);
    const contractadhesionManagementVar = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);


    const nftsData: NFTData[] = []; // <- type explicite

    try {
      const totalMinted = await contractadhesionVar.getTotalMinted();
      const tokenIds = await contractadhesionManagementVar.getTokensByOwnerPaginated(userAddress, 0, totalMinted);
      await Promise.all(tokenIds.map(async (tokenId: string) => {
        const tokenURI = await contractadhesionVar.tokenURI(tokenId);
        const response = await fetch(tokenURI);
        const metadata = await response.json();

        nftsData.push({ tokenId: tokenId.toString(), metadata });
      }));

      return nftsData; // Retournner la liste
    } catch (error) {
      console.error("Erreur lors de la récupération des NFTs:", error);
      return []; // fallback vide
    }
  };

  const fetchStatsCollection = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const userCollections = await contract.getNumberOfCollectionsByUser(userAddress);
      const remainingCollections = await contract.getRemainingCollections(userAddress);

      return {
        collections: [], // Vous pouvez ajouter la logique pour récupérer les collections
        userCollections: Number(userCollections),
        remainingCollections: Number(remainingCollections)
      };
    } catch (err) {
      console.error("Erreur de récupération des collections:", err);
      return {
        collections: [],
        userCollections: 0,
        remainingCollections: 0
      };
    }
  };

  const fetchAdhesionPoints = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractAdhesion, ABI, provider);
    try {
      const points = await contract.rewardPoints(userAddress);
      return Number(points);
    } catch (error) {
      console.error("Erreur lors de la récupération des points:", error);
      return 0; // fallback
    }
  };

  const fetchPendingPoints = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);
    try {
      const Pendingpoints = await contract.getPendingPoints(userAddress);
      return Number(Pendingpoints);
    } catch (error) {
      console.error("Erreur lors de la récupération des points:", error);
      return 0; // fallback
    }
  };


  const buyAdhesionPoints = async (userAddress: string) => {
    if (!window.ethereum) {
      throw new Error("Wallet non détecté.");
    }


    if (!web3) {
      throw new Error("Web3 non initialisé");
    }

    if (!account) throw new Error("Compte non connecté");


    const contract = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);

    const gasPrice = await web3.eth.getGasPrice(); // ✅ IDENTIQUE

    try {
      const prixParPoint = await fetchPointPrice();
      const totalPrice = BigInt(prixParPoint) * BigInt(pointsToBuy);


      // ✅ COPIE EXACTE de ton code qui marche
      const tx = await contract.methods
        .buyPendingPoints(pointsToBuy)
        .send({
          from: account,
          value: totalPrice.toString(),
          gasPrice: gasPrice.toString(),      // ✅ force string
          maxFeePerGas: null as any,           // ✅ TS ok
          maxPriorityFeePerGas: null as any    // ✅ legacy tx
        });



      // Met à jour le nombre de points après l'achat
      const updatedPoints = await fetchAdhesionPoints(userAddress);

      const updatedPointspending = await fetchPendingPoints(userAddress);
      setUserData(prev => ({ ...prev, rewardPoints: updatedPoints, pendingPoints: updatedPointspending }));


      // Après tx.send() de l'achat
      const claimResponse = await fetch('/api/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: account })
      });

      const claimData = await claimResponse.json();
      //console.log('Points distribués:', claimData);

    } catch (error) {
      console.error("Erreur lors de l'achat des points:", error);
    }
  };


  const fetchPointPrice = async () => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractAdhesion, ABI, provider);
    try {
      const prixPoints = await contract.pointPrice();
      return prixPoints;
    } catch (error) {
      console.error("Erreur lors de la récupération du prix des points:", error);
    }
  };

  // Fonction pour raccourcir l'adresse Ethereum
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Box mt={10} textAlign="center" w="100%" maxW="1200px" mx="auto">
      {loading ? (
        <Spinner size="xl" />
      ) : (
        <>
          <Box display="flex" justifyContent="center" alignItems="center">
            <HStack spacing={4}>
            <Box
              w="100px"
              h="100px"
              borderRadius="full"
              overflow="hidden"
              mb={2}
            >
              {userData.avatarSvg ? (
                <Image
                  src={userData.avatarSvg} // ici tu mets ton URL IPFS
                  alt="Avatar"
                  objectFit="cover"
                  w="100%"
                  h="100%"
                />
              ) : (
                <Box w="100%" h="100%" bg="gray.300" /> // fallback si pas d'image
              )}
            </Box>

              <Box textAlign="center" w="100%">
                <Heading mb={2}>{userData.name}</Heading>
                <Text fontSize="xl">{userData.roles[0]}</Text>
                <Text fontSize="xl">{userData.biography}</Text>

                <Divider my={6} borderColor="purple.700" w="80%" mx="auto" />


                <Text fontSize="s">
                  <strong>Fin de l'adhésion</strong> le {userData.finAdhesion ? new Date(userData.finAdhesion).toLocaleDateString("fr-FR") : ""}
                </Text>

              </Box>
            </HStack>
          </Box>

          <Divider my={4} />

          <Tabs variant="soft-rounded" colorScheme="purple" isFitted>
            <TabList mb={2}>
              <Tab>Profil adhérent</Tab>
            {/*  <Tab>Créer une Collection</Tab> */}
              <Tab>Collections et oeuvres</Tab>
              <Tab>Economie</Tab>

            </TabList>

            <TabPanels>
              <TabPanel>
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                  <Box borderWidth="1px" borderRadius="xl" p={4} shadow="md" w="100%">
                    <Heading size="md" mb={3}>Jetons d'Adhésion</Heading>
                    <HStack spacing={4} flexWrap="wrap" w="full">
                      {userData.nfts.length > 0 ? (
                        userData.nfts.map((nft, index) => (
                          <Box
                            key={nft.tokenId}                    // ✅ key stable
                            w="140px"
                            h="180px"
                            borderRadius="lg"
                            shadow="md"
                            borderWidth={2}
                            p={3}
                            textAlign="center"
                            cursor="pointer"
                            _hover={{
                              shadow: "xl",
                              transform: "translateY(-2px)",
                              borderColor: "blue.400",
                            }}
                            transition="all 0.2s ease-in-out"
                            onClick={() => goToToken(Number(nft.tokenId))}
                            flexShrink={0}                       // ✅ Pas de rétrécissement
                          >
                            {/* IMAGE CARRÉE */}
                            <Box
                              w="80px"
                              h="80px"
                              mx="auto"
                              mb={2}
                              borderRadius="lg"
                              overflow="hidden"
                            >
                              <Image
                                src={nft.image}
                                alt={`Jeton ${nft.tokenId}`}
                                w="full"
                                h="full"
                                objectFit="cover"
                                transition="transform 0.2s"
                              />
                            </Box>

                            {/* INFO */}
                            <Heading size="xs" fontWeight="bold" mb={1} noOfLines={1}>
                              #{nft.tokenId}
                            </Heading>

                            <Text fontSize="xs" color="gray.600" noOfLines={1}>
                              {userData.name}
                            </Text>

                            {/* STATUS */}
                            <HStack justify="center" mt={1} spacing={1}>
                              <Box
                                w={2.5}
                                h={2.5}
                                borderRadius="full"
                                bg={(nft as any).remainingTime && (nft as any).remainingTime !== '0j 0h 0m 0s' ? "green.400" : "orange.400"}
                                boxShadow="0 0 0 2px white"
                              />
                              <Text fontSize="9px" color="gray.500" fontWeight="500">
                                {nft.remainingTime?.slice(0, 4) || '0j'}
                              </Text>
                            </HStack>
                          </Box>
                        ))
                      ) : (
                        <Box p={8} textAlign="center" w="full">
                          <Text color="gray.500" fontSize="sm">
                            Aucun jeton trouvé.
                          </Text>
                        </Box>
                      )}
                    </HStack>


                    <Divider my={4} />

                    <FormLabel htmlFor="pointsToBuy" display="flex" alignItems="center">
                      Acheter des points :
                      <Tooltip
                        label="La création d'une collection coûte 5 points..."
                        fontSize="sm"
                        hasArrow
                      >
                        <span>
                          <Icon as={InfoOutlineIcon} ml={2} color="gray.500" cursor="pointer" />
                        </span>
                      </Tooltip>
                    </FormLabel>

                    <HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="teal"
                        onClick={() => setPointsToBuy(Math.max(0, pointsToBuy - 10))}
                        isDisabled={pointsToBuy <= 0}
                      >
                        -
                      </Button>
                      <Text>{pointsToBuy}</Text>
                      <Button
                        size="sm"
                        variant="outline"
                        colorScheme="teal"
                        onClick={() => setPointsToBuy(pointsToBuy + 10)}
                      >
                        +
                      </Button>

                      <Divider my={6} borderColor="purple.700" />


                      <Button
                        size="sm"
                        colorScheme="purple"
                        borderRadius="full"
                        px={6}
                        onClick={() => buyAdhesionPoints(userData.address)}
                      >
                        Acheter
                      </Button>
                    </HStack>
                  </Box>

                  <Box borderWidth="1px" borderRadius="xl" p={4} shadow="md" w="100%">
                    <Heading size="md" mb={3}>Statistiques</Heading>
                    <VStack align="start" spacing={3}>
                      <Text>
                        <strong>Nom :</strong> {userData.name || 'Non défini'}
                      </Text>
                      <Text>
                        <strong>Bio :</strong> {userData.biography}
                      </Text>

                      <Text
                        cursor="pointer"
                        onClick={() => {
                          if (userData.address) {
                            navigator.clipboard.writeText(userData.address);
                            alert("Adresse Ethereum copiée !");
                          }
                        }}
                      >
                        <strong>Adresse Ethereum: </strong> {formatAddress(userData.address)}
                      </Text>

                      <Divider />
                      <Text>
                        <strong>Collections créées :</strong> {userData.userCollections}
                      </Text>

                      <Text>
                        <strong>Collections restantes :</strong> {userData.remainingCollections}
                      </Text>

                      <strong>Points RESCOE en attente</strong>
                      {userData.pendingPoints && userData.pendingPoints > 0n ? `${userData.pendingPoints} 🐝` : '0 🐝'}

                      <Text>
                        <strong>Points RESCOE :</strong> {userData.rewardPoints || 'Chargement...'} 🐝
                      </Text>
                    </VStack>
                  </Box>
                </Grid>
              </TabPanel>

{/*
              <TabPanel>
                <CreateCollection />
              </TabPanel>
*/}
              <TabPanel>
                <Box borderWidth="1px" borderRadius="xl" p={6} shadow="md" w="100%">
                  <Heading size="md" mb={4}>Mes Collections</Heading>
                  <Box mt={1} overflow="hidden" w="100%">
                    {userData.address && <FilteredCollectionsCarousel creator={userData.address} />}
                  </Box>
                  <Divider my={6} borderColor="purple.700" />
                </Box>

                <Box borderWidth="1px" borderRadius="xl" p={6} shadow="md" w="100%">
                  <Heading size="md" mb={4}>Mes oeuvres et poèmes</Heading>
                  <Box mt={1} overflow="hidden" w="100%">
                    {userData.address && <UserNFTFeed walletAddress={userData.address} />}
                  </Box>
                  <Divider my={6} borderColor="purple.700" />
                </Box>

              </TabPanel>

              <TabPanel>
                <Box borderWidth="1px" borderRadius="xl" p={6} shadow="md" w="100%">
                  <Heading size="md" mb={4}>Transactions</Heading>
                  <Box mt={1} overflow="hidden" w="100%">
                    {userData.address && <UserTransactionsFeed walletAddress={userData.address} />}
                  </Box>
                  <Divider my={6} borderColor="purple.700" />
                </Box>
              </TabPanel>


            </TabPanels>
          </Tabs>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
