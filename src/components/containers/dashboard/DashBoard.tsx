import React, { useState, useEffect, useMemo } from 'react';
import { InfoOutlineIcon } from "@chakra-ui/icons";
import { FaBoxes } from 'react-icons/fa'; // ajout en haut

import { Box, Flex, Tooltip, Icon, Image, Heading,Tag, VStack, Stack, Button, Text, Link, HStack, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, FormLabel, Spinner, Divider, useToast, Badge } from '@chakra-ui/react';

import { useColorModeValue } from '@chakra-ui/react'
import { colors, effects, hoverStyles } from '@/styles/theme'  // Ajuste chemin


import { useAuth } from "@/utils/authContext";
import { JsonRpcProvider } from 'ethers';
import { ethers } from "ethers";

import { BrowserProvider, Eip1193Provider } from "ethers";
import UserNFTFeed from "@/hooks/Moralis/userNFT";
import UserTransactionsFeed from "@/hooks/Moralis/UserTransactionsFeed";

import { resolveIPFS } from "@/utils/resolveIPFS";

import { Contract } from 'ethers';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '../../ABI/ABI_ADHESION_MANAGEMENT.json';
import CreateCollection from './CreateCollection';
import { FilteredCollectionsCarousel } from '../galerie/art';
import { fetchAdhesionPoints, fetchStatsCollection } from "@/utils/dashboardFetcher";

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

  const rpcProvider = useMemo(
    () => new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string),
    []
  );

  const goToToken = (tokenId: string | number) => {
    router.push(`/AdhesionId/${contractAdhesion}/${tokenId}`,
               undefined,
               { shallow: true });
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authAddress) return; // Sortir si l'adresse est vide
      setLoading(true);
      try {
        const [rolesAndImages, adhesionPoints, pendingsPoints, stats] = await Promise.all([
          fetchRolesAndImages(authAddress),
          fetchAdhesionPoints(authAddress),
          fetchPendingPoints(authAddress),
          fetchStatsCollection(authAddress),
        ]);

        const allNFTs = rolesAndImages.nfts;

        const mergedUserData = {
          address: authAddress,
          name: rolesAndImages.name || '',
          avatarSvg: resolveIPFS(rolesAndImages.nfts?.[0]?.image, true) || "",
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
    const cacheKey = `dashboard_roles_${userAddress}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < 5 * 60 * 1000) return data;
        localStorage.removeItem(cacheKey);
      }
    } catch {}

    const contract = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, rpcProvider);
    const contractadhesion = new Contract(contractAdhesion, ABI, rpcProvider);

    const tokenIds = await contractadhesion.getTokensByOwner(userAddress);
    const userInfos = await contractadhesion.getUserInfo(userAddress);

    const fetchedRolesAndImages = await Promise.all(
      tokenIds.map(async (tokenId: number) => {
        const fullDatas = await contractadhesion.getTokenDetails(tokenId);

        const mintTimestamp = Number(fullDatas[2]);
        const remainingTime = Number(
          await contractadhesion.getRemainingMembershipTime(tokenId)
        );
        const finAdhesion = new Date((mintTimestamp + remainingTime) * 1000);

        const tokenURI = await contractadhesion.tokenURI(tokenId);

        const metadataUrl = resolveIPFS(tokenURI, true); // -> /api/ipfs/...
        let metadata: any = {};
        try {
          if (!metadataUrl) throw new Error("no metadataUrl");
          const response = await fetch(metadataUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          metadata = await response.json();
        } catch (e) {
          console.warn("❌ metadata fetch failed for token", tokenId, e);
        }

        return {
          role: metadata.role,
          image: resolveIPFS(metadata.image, true) || "",
          tokenId: Number(tokenId),
          finAdhesion,
          remainingTime: formatSeconds(remainingTime),
        };
      })
    );

    const result = {
      name: userInfos.name,
      biography: userInfos.bio,
      roles: fetchedRolesAndImages.map((item) => item.role),
      finAdhesion: fetchedRolesAndImages[0]?.finAdhesion || "",
      nfts: fetchedRolesAndImages,
    };
    try { localStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() })); } catch {}
    return result;
  };

  const fetchPendingPoints = async (userAddress: string) => {
    const cacheKey = `pendingPoints_${userAddress}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < 5 * 60 * 1000) return data as number;
        localStorage.removeItem(cacheKey);
      }
    } catch {}
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, rpcProvider);
    try {
      const Pendingpoints = await contract.getPendingPoints(userAddress);
      const result = Number(Pendingpoints);
      try { localStorage.setItem(cacheKey, JSON.stringify({ data: result, ts: Date.now() })); } catch {}
      return result;
    } catch (error) {
      console.error("Erreur lors de la récupération des points:", error);
      return 0;
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



      // Invalide le cache avant de relire les points post-transaction
      localStorage.removeItem(`adhesionPoints_${account}`);
      localStorage.removeItem(`pendingPoints_${account}`);
      const updatedPoints = await fetchAdhesionPoints(account!);
      const updatedPointspending = await fetchPendingPoints(account!);
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
    const contract = new Contract(contractAdhesion, ABI, rpcProvider);
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
    <Box
      mt={10}
      textAlign="center"
      w="100%"
      maxW="1200px"
      mx="auto"
      p={{ base: 4, md: 8 }}
    >
    {loading ? (
      <Spinner
        size="xl"
        color={useColorModeValue('brand.navy', 'brand.gold')}
        thickness="4px"
      />
    ) : (
      <>
        {/* Header - Disposition ORIGINALE gardée */}
        <Box display="flex" justifyContent="center" alignItems="center">
        <Flex
          direction={{ base: "column", md: "row" }}
          align="center"
          justify="center"
          textAlign={{ base: "center", md: "left" }}
          gap={{ base: 6, md: 10 }}
        >
            <Box
              w="100px"
              h="100px"
              borderRadius="full"
              overflow="hidden"
              mb={2}
              boxShadow={useColorModeValue(
                "0 8px 25px rgba(1,28,57,0.15)",
                `${effects.glowDark}`
              )}
              border="3px solid"
              borderColor={useColorModeValue('brand.navy', 'brand.gold')}
            >
              {userData.avatarSvg ? (
                <Image
                  src={userData.avatarSvg || "/fallback-image.png"}
                  alt="Avatar"
                  objectFit="cover"
                  w="100%"
                  h="100%"
                />
              ) : (
                <Box
                  w="100%"
                  h="100%"
                  bg={useColorModeValue('gray.200', 'gray.700')}
                />
              )}
            </Box>

            <Box textAlign="center" w="100%">
            <VStack >
              <Heading
                mb={2}
                bgGradient={useColorModeValue(
                  `linear(to-r, brand.navy, brand.blue)`,
                  `linear(to-r, brand.gold, #F0D98E)`
                )}
                bgClip="text"
              >
                {userData.name}
              </Heading>
              <Text
                fontSize="xl"
                color={useColorModeValue('brand.navy', 'brand.cream')}
                fontWeight="bold"
              >
                {userData.roles[0]}
              </Text>
              <Text
                fontSize="xl"
                color={useColorModeValue('gray.600', 'gray.300')}
              >
                {userData.biography}
              </Text>

              <Box
                as="button"
                w="full"
                p={3}
                transition="all 0.2s"
                _hover={{
                  bg: useColorModeValue('brand.navy10', 'brand.gold10'),
                  transform: "translateX(4px)"
                }}
                onClick={() => {
                  if (userData.address) {
                    navigator.clipboard.writeText(userData.address)
                    toast({ title: 'Adresse copiée !', status: 'success' })
                  }
                }}
              >
                <Text color={useColorModeValue('brand.navy', 'brand.gold')}>
                  {formatAddress(userData.address)}
                </Text>

              </Box>
              <Divider
                my={6}
                borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                w="20%"
                mx="auto"
              />

              <Text
                fontSize="s"
                color={useColorModeValue('brand.navy', 'brand.textLight')}
                fontWeight="medium"
              >
                <strong>Fin de l&apos;adhésion</strong> le {userData.finAdhesion ? new Date(userData.finAdhesion).toLocaleDateString("fr-FR") : ""}
              </Text>
              </VStack>

            </Box>
          </Flex>
        </Box>

        <Divider my={4} borderColor={useColorModeValue('brand.navy', 'brand.gold')} />


                {/* Tabs thémés */}
                <Tabs
                  variant="soft-rounded"
                  colorScheme={useColorModeValue('brand.navy', 'brand.gold')}
                  isFitted
                  mb={8}
                >
                  <TabList mb={6} borderColor={useColorModeValue('brand.navy', 'brand.gold')}>
                    <Tab
                      _selected={{
                        color: useColorModeValue('brand.navy', 'brand.gold'),
                        borderColor: useColorModeValue('brand.navy', 'brand.gold'),
                        bg: useColorModeValue('brand.cream10', 'brand.gold10')
                      }}
                    >
                      Profil adhérent
                    </Tab>
                    <Tab
                      _selected={{
                        color: useColorModeValue('brand.navy', 'brand.gold'),
                        borderColor: useColorModeValue('brand.navy', 'brand.gold'),
                        bg: useColorModeValue('brand.cream10', 'brand.gold10')
                      }}
                    >
                      Collections et oeuvres
                    </Tab>
                    <Tab
                      _selected={{
                        color: useColorModeValue('brand.navy', 'brand.gold'),
                        borderColor: useColorModeValue('brand.navy', 'brand.gold'),
                        bg: useColorModeValue('brand.cream10', 'brand.gold10')
                      }}
                    >
                      Economie
                    </Tab>
                  </TabList>

                  <TabPanels>
                    <TabPanel p={0}>
                      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>

                        {/* Jetons d'Adhésion */}
                        <Box
                          borderWidth="1px"
                          borderRadius="xl"
                          p={{ base: 4, md: 6 }}
                          shadow={useColorModeValue('md', 'dark-lg')}
                          w="100%"
                          borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                          bg={useColorModeValue(
                            'rgba(253,251,212,0.4)',
                            'rgba(1,28,57,0.2)'
                          )}
                          backdropFilter="blur(8px)"
                          transition="all 0.3s ease"
                          _hover={{
                            boxShadow: useColorModeValue(
                              `0 12px 40px rgba(1,28,57,0.15)`,
                              `${effects.glowDark}`
                            )
                          }}
                        >
                          <Heading
                            size="md"
                            mb={6}
                            bgGradient={useColorModeValue(
                              `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue})`,
                              `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                            )}
                            bgClip="text"
                          >
                            Jetons d&apos;Adhésion
                          </Heading>

                          <HStack spacing={4} flexWrap="wrap" w="full" justify="center">
                            {userData.nfts.length > 0 ? (
                              userData.nfts.map((nft) => (
                                <Box
                                  key={nft.tokenId}
                                  w={"140px"}
                                  h={"180px"}
                                  borderRadius="lg"
                                  shadow="md"
                                  borderWidth={2}
                                  p={3}
                                  textAlign="center"
                                  cursor="pointer"
                                  borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                                  bg={useColorModeValue('whiteAlpha.800', 'blackAlpha.300')}
                                  transition="all 0.3s cubic-bezier(0.4,0,0.2,1)"
                                  _hover={{
                                    ...hoverStyles.brandHover._hover,
                                    borderColor: useColorModeValue('brand.blue', 'brand.mauve'),
                                    transform: "translateY(-4px)",
                                  }}
                                  onClick={() => goToToken(Number(nft.tokenId))}
                                  flexShrink={0}
                                >
                                  {/* Image */}
                                  <Box
                                    w="80px"
                                    h="80px"
                                    mx="auto"
                                    mb={3}
                                    borderRadius="lg"
                                    overflow="hidden"
                                    boxShadow="sm"
                                  >
                                    <Image
                                      src={nft.image || "/fallback-image.png"}
                                      alt={`Jeton ${nft.tokenId}`}
                                      w="full"
                                      h="full"
                                      objectFit="cover"
                                      transition="transform 0.3s ease"
                                      _hover={{ transform: "scale(1.05)" }}
                                    />
                                  </Box>

                                  {/* Infos */}
                                  <Heading size="xs" fontWeight="bold" mb={1} noOfLines={1}
                                    color={useColorModeValue('brand.navy', 'brand.gold')}
                                  >
                                    #{nft.tokenId}
                                  </Heading>
                                  <Text
                                    fontSize="xs"
                                    color={useColorModeValue('gray.600', 'gray.300')}
                                    noOfLines={1}
                                  >
                                    {userData.name}
                                  </Text>

                                  {/* Status */}
                                  <HStack justify="center" mt={2} spacing={1}>
                                    <Box
                                      w={2.5}
                                      h={2.5}
                                      borderRadius="full"
                                      bg={(nft as any).remainingTime && (nft as any).remainingTime !== '0j 0h 0m 0s'
                                        ? "green.400"
                                        : "orange.400"
                                      }
                                      boxShadow={`0 0 0 2px ${useColorModeValue('white', 'brand.navy')}`}
                                    />
                                    <Text
                                      fontSize="9px"
                                      color={useColorModeValue('gray.500', 'gray.400')}
                                      fontWeight="500"
                                    >
                                      {nft.remainingTime?.slice(0, 4) || '0j'}
                                    </Text>
                                  </HStack>
                                </Box>
                              ))
                            ) : (
                              <Box p={8} textAlign="center" w="full">
                                <Icon as={FaBoxes} boxSize={12} color="gray.400" mb={2} />
                                <Text color="gray.500" fontSize="sm">
                                  Aucun jeton trouvé.
                                </Text>
                              </Box>
                            )}
                          </HStack>

                          {/* Acheter points */}
                          <Divider my={6} borderColor={useColorModeValue('brand.navy', 'brand.gold')} />

                          <FormLabel
                            htmlFor="pointsToBuy"
                            display="flex"
                            alignItems="center"
                            mb={3}
                            color={useColorModeValue('brand.navy', 'brand.textLight')}
                            fontWeight="bold"
                          >
                            Acheter des points :
                            <Tooltip
                              label="La création d'une collection coûte 5 points..."
                              fontSize="sm"
                              hasArrow
                              bg={useColorModeValue('brand.navy', 'brand.gold')}
                              color="white"
                            >
                              <Icon as={InfoOutlineIcon} ml={2} color="gray.500" cursor="pointer" boxSize={4} />
                            </Tooltip>
                          </FormLabel>

                          <HStack spacing={3} justify="center" mb={6}>
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="teal"
                              borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                              onClick={() => setPointsToBuy(Math.max(0, pointsToBuy - 10))}
                              isDisabled={pointsToBuy <= 0}
                              _hover={{ bg: 'teal.50' }}
                            >
                              -
                            </Button>
                            <Text
                              px={4}
                              py={2}
                              bg={useColorModeValue('brand.cream', 'brand.navy')}
                              borderRadius="md"
                              fontWeight="bold"
                              minW="60px"
                            >
                              {pointsToBuy}
                            </Text>
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="teal"
                              borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                              onClick={() => setPointsToBuy(pointsToBuy + 10)}
                              _hover={{ bg: 'teal.50' }}
                            >
                              +
                            </Button>
                          </HStack>

                          <Button
                            w="full"
                            size="lg"
                            colorScheme="brand"
                            borderRadius="full"
                            px={8}
                            py={6}
                            fontSize="lg"
                            fontWeight="extrabold"
                            bgGradient={useColorModeValue(
                              `linear(to-r, ${colors.brand.blue}, ${colors.brand.navy})`,
                              `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                            )}
                            color="white"
                            boxShadow="xl"
                            _hover={{
                              ...hoverStyles.brandHover._hover,
                              bgGradient: `linear(to-r, ${colors.brand.gold}, ${colors.brand.gold})`
                            }}
                            onClick={() => buyAdhesionPoints(userData.address)}
                          >
                            Acheter {pointsToBuy} points 🐝
                          </Button>
                        </Box>

                        {/* Statistiques */}
                        <Box
                          borderWidth="1px"
                          borderRadius="xl"
                          p={{ base: 4, md: 6 }}
                          shadow={useColorModeValue('md', 'dark-lg')}
                          w="100%"
                          borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                          bg={useColorModeValue(
                            'rgba(253,251,212,0.4)',
                            'rgba(1,28,57,0.2)'
                          )}
                          backdropFilter="blur(8px)"
                        >
                          <Heading
                            size="md"
                            mb={6}
                            bgGradient={useColorModeValue(
                              `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue})`,
                              `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                            )}
                            bgClip="text"
                          >
                            Statistiques
                          </Heading>

                          <VStack justify="space-between" w="full">

                            <Divider borderColor={useColorModeValue('brand.navy', 'brand.gold')} />

                              <Text color={useColorModeValue('brand.navy', 'brand.textLight')}>
                                <strong>Collections créées:</strong> {userData.userCollections}
                              </Text>
                              {userData.remainingCollections !== undefined && (
                                <Tag
                                  colorScheme={userData.remainingCollections > 0 ? "green" : "orange"}
                                  size="sm"
                                >
                                  {userData.remainingCollections} restantes
                                </Tag>
                              )}

                            <Text fontSize="lg" fontWeight="bold" color={useColorModeValue('brand.navy', 'brand.gold')}>
                              <strong>Points RESCOE:</strong> {userData.rewardPoints || 'Chargement...'} 🐝
                            </Text>
                            <Text>
                            {userData.pendingPoints > 0 && (
                              <Badge ml={2} colorScheme="yellow" fontSize="xs">
                                +{userData.pendingPoints} en attente
                              </Badge>
                            )}
                            </Text>
                          </VStack>
                        </Box>
                      </Grid>
                    </TabPanel>

                    {/* Autres TabPanels inchangés mais thémés pareil */}
                    <TabPanel p={0}>
                      <Box
                        borderWidth="1px"
                        borderRadius="xl"
                        p={6}
                        shadow="md"
                        w="100%"
                        borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                        bg={useColorModeValue('rgba(253,251,212,0.3)', 'rgba(1,28,57,0.15)')}
                      >
                        <Heading
                          size="md"
                          mb={6}
                          bgGradient={useColorModeValue(
                            `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue})`,
                            `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                          )}
                          bgClip="text"
                        >
                          Mes Collections
                        </Heading>
                        <Box mt={4} overflow="hidden" w="100%">
                          {userData.address && <FilteredCollectionsCarousel creator={userData.address} />}
                        </Box>
                        <Divider my={6} borderColor={useColorModeValue('brand.navy', 'brand.gold')} />
                      </Box>

                      <Box
                        borderWidth="1px"
                        borderRadius="xl"
                        p={6}
                        shadow="md"
                        w="100%"
                        borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                        bg={useColorModeValue('rgba(253,251,212,0.3)', 'rgba(1,28,57,0.15)')}
                      >
                        <Heading
                          size="md"
                          mb={6}
                          bgGradient={useColorModeValue(
                            `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue})`,
                            `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                          )}
                          bgClip="text"
                        >
                          Mes oeuvres et poèmes
                        </Heading>
                        <Box mt={4} overflow="hidden" w="100%">
                          {userData.address && <UserNFTFeed walletAddress={userData.address} />}
                        </Box>
                      </Box>
                    </TabPanel>

                    <TabPanel p={0}>
                      <Box
                        borderWidth="1px"
                        borderRadius="xl"
                        p={6}
                        shadow="md"
                        w="100%"
                        borderColor={useColorModeValue('brand.navy', 'brand.gold')}
                        bg={useColorModeValue('rgba(253,251,212,0.3)', 'rgba(1,28,57,0.15)')}
                      >
                        <Heading
                          size="md"
                          mb={6}
                          bgGradient={useColorModeValue(
                            `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue})`,
                            `linear(to-r, ${colors.brand.gold}, #F0D98E)`
                          )}
                          bgClip="text"
                        >
                          Transactions
                        </Heading>
                        <Box mt={4} overflow="hidden" w="100%">
                          {userData.address && <UserTransactionsFeed walletAddress={userData.address} />}
                        </Box>
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
