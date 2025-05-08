import React, { useState, useEffect } from 'react';
import { Box, Image, Heading, VStack, Button, Text, Link, HStack, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, FormLabel, Spinner, Divider, useToast, useClipboard } from '@chakra-ui/react';
import * as jdenticon from 'jdenticon';
import { useAuth } from '../../../utils/authContext';
import { JsonRpcProvider } from 'ethers';
import { ethers } from "ethers";
import { Contract } from 'ethers';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import ABI_ADHESION_MANAGEMENT from '../../ABI/ABI_ADHESION_MANAGEMENT.json';

import { BrowserProvider, Eip1193Provider } from "ethers";

import axios from "axios";
import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from "web3";


const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;


// Interfaces pour le typage
interface UserStats {
  collectionsCreated: number;
}

interface CollectionData {
  id: string;
  name: string;
  imageUrl: string;
}

interface RoleImageData {
  role: string;
  image: string;
  tokenId: number;
}

const Dashboard = () => {
  const { address: authAddress } = useAuth();
  const [address, setAddress] = useState<string>(authAddress || '');
  const [ensName, setEnsName] = useState<string>('');
  const [biography, setBiography] = useState<string>('');
  const [avatarSvg, setAvatarSvg] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);
  const [biographies, setBiographies] = useState<string[]>([]);
  const [usernames, setUserName] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState<boolean>(false);
  const [collectionName, setCollectionName] = useState<string>('');
  const [collectionURI, setCollectionURI] = useState<string>('');
  const [maxCollections, setMaxCollections] = useState<number>(0);
  const [userStats, setUserStats] = useState<UserStats>({ collectionsCreated: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [nfts, setNfts] = useState<{ tokenId: string }[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ name: string; description: string; tags: string }>({ name: "", description: "", tags: "" });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [userCollections, setUserCollections] = useState<number>(0);
  const [remainingCollections, setRemainingCollections] = useState<number>(0);
  const [isActualise, setIsActualise] = useState<boolean>(false);
  const [rewardPoints, setRewardPoints] = useState<number | null>(null);
  const [tokensIdsAdherent, setTokenIdAdherent] = useState<number[]>([]); // Changement ici pour accepter plusieurs IDs
  const [error, setError] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [pointsToBuy, setPointsToBuy] = useState(0);
  const [nombreTotalMint, setNombreTotalMint] = useState<number | null>(null);


  const toast = useToast();


  useEffect(() => {
    const setupWeb3 = async () => {
      try {
        // Détecte le fournisseur Ethereum
        const detectedProvider = await detectEthereumProvider();
        if (detectedProvider) {
          const web3Instance = new Web3(detectedProvider);
          setWeb3(web3Instance);

          // Demande les comptes utilisateur
          const accounts: string[] = await web3Instance.eth.requestAccounts();
          if (accounts.length > 0) {
            setAddress(accounts[0]);
          }
        } else {
          console.error("MetaMask not detected");
        }
      } catch (error) {
        console.error("Error setting up Web3:", error);
      }
    };
    setupWeb3();
  }, []);

  useEffect(() => {
    // Chargement des données utilisateur depuis le localStorage
    const savedData = localStorage.getItem(address);
    if (savedData) {
      const { biography, name } = JSON.parse(savedData);
      setBiography(biography);
      setName(name);
    }

    // Si l'adresse est disponible, charger les données utilisateur
    if (address) {
      const svgString = jdenticon.toSvg(address, 100);
      setAvatarSvg(svgString);

      // Appels aux différentes fonctions pour récupérer les données
      fetchNFTs();
      fetchRolesAndImages(address);
      fetchENS(address);
      fetchStatsCollection(address);
      fetchCollections(address);
      fetchAdhesionPoints(address);
    } else {
      // Réinitialiser l'avatar si aucune adresse n'est disponible
      setAvatarSvg('');
    }
  }, [address]);


  const fetchENS = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    try {
      const resolvedEnsName = await provider.lookupAddress(userAddress);
      setEnsName(resolvedEnsName || 'Pas d\'ENS associé');
    } catch (error) {
      console.error("Error fetching ENS:", error);
      setEnsName('Erreur lors de la récupération de l\'ENS');
    }
  };

  // Fonction pour raccourcir l'adresse Ethereum
const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

  const fetchRolesAndImages = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
    const contractadhesion = new Contract(contractAdhesion, ABI, provider);
    console.log(userAddress);

    console.log(Number(nombreTotalMint));

    try {

      const tokenIds = await contract.getTokensByOwnerPaginated(userAddress, 0, Number(nombreTotalMint));
      console.log('test');
      const userInfos = await contract.getUserInfo(userAddress);

      const username = userInfos.name;
      const bio = userInfos.bio;

      const fetchedRolesAndImages: RoleImageData[] = await Promise.all(
        tokenIds.map(async (tokenId: number) => {
          const tokenURI = await contractadhesion.tokenURI(tokenId);
          const response = await fetch(tokenURI);
          const metadata = await response.json();

          return {
            role: metadata.role,
            image: metadata.image,
            tokenId: Number(tokenId),
          };
        })
      );

      const tokensIdsAdherents = fetchedRolesAndImages.map((item) => item.tokenId);
      const roles = fetchedRolesAndImages.map((item) => item.role);
      const images = fetchedRolesAndImages.map((item) => item.image);

      setTokenIdAdherent(tokensIdsAdherents);
      setUserName([username]);
      setRoles(roles);
      setImages(images);
      setBiographies([bio]);
    } catch (error) {
      console.error("Error fetching roles and images:", error);
    }
  };

  const fetchStatsCollection = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const userCollections = await contract.getNumberOfCollectionsByUser(userAddress);
      const remainingCollections = await contract.getRemainingCollections(userAddress);

      setUserCollections(Number(userCollections.toString()));
      setRemainingCollections(Number(remainingCollections.toString()));

    } catch (err) {
      console.error("Erreur de récupération des collections:", err);
      setError("Erreur de récupération des collections.");
    }
  };

  const fetchCollections = async (userAddress: string) => {
    setIsLoading(true);
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const collectionsPaginated = await contract.getCollectionsByUser(userAddress);

      const collectionsData: CollectionData[] = await Promise.all(
        collectionsPaginated.map(async (tuple: any) => {
          const [id, name, collectionType, creator, associatedAddresses, isActive, isEditable] = tuple;
          const uri = await contract.getCollectionURI(id);

          const cachedMetadata = localStorage.getItem(uri);
          if (cachedMetadata) {
            const metadata = JSON.parse(cachedMetadata);
            return {
              id: id.toString(),
              name: name,
              imageUrl: metadata.image,
            };
          }

          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          const metadata = await response.json();
          localStorage.setItem(uri, JSON.stringify(metadata));

          return {
            id: id.toString(),
            name: name,
            imageUrl: metadata.image,
          };
        })
      );

      setCollections(collectionsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des collections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNFTs = async () => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);
    const contractadhesionManagementVar = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider);
    const contractadhesionVar = new Contract(contractAdhesion, ABI, provider);

    try {
      const totalMinted = await contractadhesionVar.getTotalMinted();
      setNombreTotalMint(totalMinted);
      const tokenIds = await contractadhesionManagementVar.getTokensPaginated(0, totalMinted);
      const nftsData = tokenIds.map((id: string) => ({ tokenId: id.toString() }));
      setNfts(nftsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des NFTs:", error);
    }
  };

  const handleSaveProfile = () => {
    const profileData = { biography, name };
    localStorage.setItem(address, JSON.stringify(profileData));
  };

  const fetchAdhesionPoints = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractAdhesion, ABI, provider);
    try {
      const points = await contract.rewardPoints(userAddress);
      setRewardPoints(parseInt(points.toString()));
    } catch (error) {
      console.error("Erreur lors de la récupération des points:", error);
    }
  };


  const fetchPointPrice = async () => {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
      const contract = new Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, provider); // Pas besoin de signer pour lire le prix

      try {
          // Appel pour récupérer le prix des points
          const prixPoints = await contract.pointPrice(); // Ceci devrait fonctionner si pointPrice est public
          //console.log(`Le prix par point est : ${prixPoints.toString()} Wei`); // Afficher le prix en Wei
          return prixPoints; // Retourner en Ether
      } catch (error) {
          console.error("Erreur lors de la récupération du prix des points:", error);
      }
  };

  // Ensuite, appellez cette fonction dans l'effet useEffect pour l'initialisation si nécessaire
  useEffect(() => {
      const getPointPrice = async () => {
          const price = await fetchPointPrice();
          // Enregistrer ou utiliser ce prix comme besoin
      };

      getPointPrice();
  }, [contratAdhesionManagement]);


  const buyAdhesionPoints = async (userAddress: string) => {
    if (!window.ethereum) {
      throw new Error("Wallet non détecté.");
    }

    const ethereum = window.ethereum as Eip1193Provider;

    await ethereum.request({ method: "eth_requestAccounts" });

    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();


    const contract = new ethers.Contract(contratAdhesionManagement, ABI_ADHESION_MANAGEMENT, signer);

    try {
      const prixParPoint = await fetchPointPrice(); // exemple : "100000000000000"

      if (!prixParPoint || isNaN(Number(prixParPoint))) {
        throw new Error("Le prix par point est invalide.");
      }

      const totalPrice = BigInt(prixParPoint) * BigInt(pointsToBuy);

      const tx = await contract.buyRewardPoints(userAddress, pointsToBuy, {
        value: totalPrice,
      });

      await tx.wait();
      console.log(`Achat réussi: ${pointsToBuy} points achetés !`);
      fetchAdhesionPoints(userAddress);
    } catch (error) {
      console.error("Erreur lors de l'achat des points:", error);
    }
  };







  return (
    <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      <VStack spacing={8} align="stretch" width="100%" maxW="800px">
      <Box display="flex" justifyContent="center" alignItems="center">
          <HStack spacing={4}>
            <Box
              dangerouslySetInnerHTML={{ __html: avatarSvg }}
              boxSize="100px"
              bg="gray.200"
              borderRadius="full"
              mb={2}
            />
            <Box textAlign="center">
              <Heading mb={2}>{usernames[0]}</Heading>
              <Text fontSize="xl">{roles[0]}</Text>
              <Text fontSize="xl">{biographies[0]}</Text>
              <Divider my={6} borderColor="gray.200" w="80%" mx="auto" />
              <Text fontWeight="bold">Adresse Ethereum:</Text>
              <Text>{formatAddress(address)}</Text> {/* Affichage de l'adresse raccourcie */}
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(address); // Copier l'adresse dans le presse-papiers
                  alert("Adresse Ethereum copiée !");
                }}
                size="sm"
                mt={2}
              >
                Copier
              </Button>
              {ensName && (
                <Text fontWeight="bold" mt={2}>ENS: {ensName}</Text>
              )}
            </Box>
          </HStack>
        </Box>

        <Tabs variant="enclosed">
          <TabList>
            <Tab>Vos adhésions</Tab>
            <Tab>Gérer vos collections</Tab>
            <Tab>Statistiques</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <VStack spacing={4}>
                <Text>Voici vos jetons d'adhésion (Insectes) :</Text>
                <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={4}>
                  {images.length > 0 && roles.length > 0 ? (
                    images.map((imgUri, index) => (
                      <VStack key={index} spacing={2}>
                        <Link
                          href={`/AdhesionId/${contractAdhesion}/${tokensIdsAdherent[index]}`}
                        >
                          <Box
                            as="a"
                            cursor="pointer"
                            width="100%"
                            p={2}
                          >
                            <img
                              src={imgUri}
                              alt={`Adhesion ${index}`}
                              style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
                            />
                          </Box>
                        </Link>
                        <Text>{roles[index] ? `${roles[index]}` : 'Aucun rôle associé'}</Text>
                      </VStack>
                    ))
                  ) : (
                    <VStack>
                      <Text>Aucun insecte ou rôle trouvé</Text>
                      <Button onClick={() => fetchRolesAndImages(address)}>Rafraîchir mes jetons</Button>
                    </VStack>
                  )}
                </Grid>
              </VStack>
            </TabPanel>

            <TabPanel>
              {isLoading ? (
                <Spinner />
              ) : (
                <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={6}>
                  {collections.length === 0 ? (
                    <Text>Aucune collection trouvée.</Text>
                  ) : (
                    collections.map((collection) => (
                      <Box
                        key={collection.id}
                        borderWidth="1px"
                        borderRadius="lg"
                        p={4}
                        cursor="pointer"
                        textAlign="center"
                      >
                        {collection.imageUrl && (
                          <Box
                            width="100%"
                            height="150px"
                            overflow="hidden"
                            borderRadius="md"
                          >
                            <img
                              src={collection.imageUrl}
                              alt={collection.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          </Box>
                        )}
                        <Box mt={2} textAlign="center">
                          <Text>{collection.name}</Text>
                        </Box>
                      </Box>
                    ))
                  )}
                </Grid>
              )}

              <Divider my={6} borderColor="gray.200" />
              <Box mt={2} textAlign="center" p={4}>
                <Link href="/u/createCollection">
                  <Button colorScheme="teal">
                    Créer une collection
                  </Button>
                </Link>
              </Box>
            </TabPanel>

            <TabPanel>
              <VStack>
                <Text mt={4}>Collections créées : {userCollections}.</Text>
                <Text mt={4}>Collections restantes : {remainingCollections}.</Text>
                <VStack>

                <div>
                  <h1>Points d'Adhésion</h1>
                  <p>Points actuels: {rewardPoints}</p>
                  <input
                    type="number"
                    value={pointsToBuy}
                    onChange={(e) => setPointsToBuy(parseInt(e.target.value))}
                    placeholder="Nombre de points à acheter"
                  />
                  <button onClick={() => buyAdhesionPoints(address)} >Acheter des Points</button>
                </div>


                  <Text mt={4}>Points d'Adhésion</Text>
                  {rewardPoints !== null ? (
                    <Text>Vos points Rescoe : {rewardPoints} 🐝</Text>
                  ) : (
                    <Text>Chargement des points...</Text>
                  )}
                </VStack>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
};

export default Dashboard;
