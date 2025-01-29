import React, { useState, useEffect } from 'react';
import { Box, Image, Heading, VStack, Input, Button, Textarea, Text, Link, HStack, Grid, Tab, TabList, TabPanel, TabPanels, Tabs,   FormLabel, Spinner, Divider,  useToast } from '@chakra-ui/react';
import * as jdenticon from 'jdenticon';
import { useAuth } from '../../../utils/authContext';
import { JsonRpcProvider, ethers } from 'ethers';
import { Contract } from 'ethers';
import ABI from '../../ABI/ABIAdhesion.json';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import axios from "axios";
import GetTime from './AdhesionInfos/GetTime.tsx'
//import useNFTEventListener from '../../../utils/eventListener'


const contractAddressAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;
const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;


const Dashboard = () => {
  const { address: authAddress } = useAuth();
  const [address, setAddress] = useState(authAddress || '');
  const [ensName, setEnsName] = useState('');
  const [biography, setBiography] = useState('');
  const [avatarSvg, setAvatarSvg] = useState('');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState([]);
  const [biographies, setBiographies] = useState([]);

  const [usernames, setUserName] = useState([]);
  const [images, setImages] = useState([]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionURI, setCollectionURI] = useState('');
  const [maxCollections, setMaxCollections] = useState(0); // Maximum collections based on adhesion tokens
  const [userStats, setUserStats] = useState({ collectionsCreated: 0 }); // User stats (e.g., number of collections created)
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nfts, setNfts] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [metadata, setMetadata] = useState({ name: "", description: "", tags: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [ipfsUrl, setIpfsUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [userCollections, setUserCollections] = useState(0);
const [remainingCollections, setRemainingCollections] = useState(0);
const [isActualise, setIsActualise] = useState(false);
const [rewardPoints, setRewardPoints] = useState<number | null>(null);
const [tokensIdsAdherent, setTokenIdAdherent]= useState<number | null>(null);


  const [error, setError] = useState<string | null>(null); // Pour gérer les erreurs si nécessaire



  const toast = useToast();

  useEffect(() => {
    const initialize = async () => {
      if (!address && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts.length > 0) {
            setAddress(accounts[0]);
          }
        } catch (error) {
          console.error("Error requesting accounts: " );
        }
      }

      const savedData = localStorage.getItem(address);
      if (savedData) {
        const { biography, name } = JSON.parse(savedData);
        setBiography(biography);
        setName(name);
      }

      if (address) {
        const svgString = jdenticon.toSvg(address, 100);
        setAvatarSvg(svgString);
        fetchRolesAndImages(address);
        fetchENS(address);
        fetchStatsCollection(address); // Fetch max collections
        fetchCollections(address); // Fetch user stats
        fetchAdhesionPoints(address);

      } else {
        setAvatarSvg('');
      }
    };

    initialize();
  }, [address]);


  const fetchENS = async (userAddress) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    try {
      const resolvedEnsName = await provider.lookupAddress(userAddress);
      setEnsName(resolvedEnsName || 'Pas d\'ENS associé');
    } catch (error) {
      console.error("Error fetching ENS: " );
      setEnsName('Erreur lors de la récupération de l\'ENS');
    }
  };



  const fetchRolesAndImages = async (userAddress) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractAddressAdhesion, ABI, provider);

    try {
      const tokenIds = await contract.getTokensByOwner(userAddress);
      const userInfos = await contract.getUserInfo(userAddress); // Appel à getUserInfo


      // Extraction des données depuis getUserInfo
      const username = userInfos.name;
      const bio = userInfos.bio;

      const fetchedRolesAndImages = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const tokenURI = await contract.tokenURI(tokenId);

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
      // Mise à jour des états
      setTokenIdAdherent(tokensIdsAdherents);
      setUserName([username]); // Met dans un tableau pour correspondre au format attendu
      setRoles(roles);
      setImages(images);
      setBiographies([bio]); // Met dans un tableau pour correspondre au format attendu
    } catch (error) {
      console.error("Error fetching roles and images:" );
    }
  };


  const fetchStatsCollection = async (userAddress) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS); // Utilisez l'URL Moralis ou votre RPC
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider); // Initialisation du contrat

    try {
      // Appel à la fonction Solidity pour récupérer le nombre de collections créées
      const userCollections = await contract.getNumberOfCollectionsByUser(userAddress);

      // Appel à la fonction Solidity pour récupérer le nombre de collections restantes
      const remainingCollections = await contract.getRemainingCollections(userAddress);

      // Si les valeurs retournées sont des BigInt (format "1n", "20n"), vous pouvez les convertir en nombre classique
      const userCollectionsNumber = Number(userCollections.toString());
      const remainingCollectionsNumber = Number(remainingCollections.toString());

      setUserCollections(userCollectionsNumber);
setRemainingCollections(remainingCollectionsNumber);

      return { userCollections: userCollectionsNumber, remainingCollections: remainingCollectionsNumber };
    } catch (err) {
      console.error("Erreur de récupération des collections:");
      setError("Erreur de récupération des collections.");
    }
  };
  // Récupérer les collections
const fetchCollections = async (userAddress) => {
  setIsLoading(true);
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  try {

    // Récupérer toutes les collections paginées
    const collectionsPaginated = await contract.getCollectionsByUser(userAddress);

    const collectionsData = await Promise.all(
      collectionsPaginated.map(async (tuple) => {
        // Déstructuration de chaque tuple
        const [id, name, collectionType, creator, associatedAddresses, isActive, isEditable] = tuple;
        // Logique pour obtenir l'URI de la collection, si elle est présente
        const uri = await contract.getCollectionURI(id); // Par exemple, collectionType pourrait être l'URI

        // Vérifier si les métadonnées sont déjà dans le localStorage
        const cachedMetadata = localStorage.getItem(uri);
        if (cachedMetadata) {
          const metadata = JSON.parse(cachedMetadata);
          return {
            id: id.toString(),
            name: name,
            imageUrl: metadata.image,
          };
        }
        // Appeler ton API route proxy pour récupérer les métadonnées JSON depuis l'IPFS
        const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
        const metadata = await response.json();
        // Stocker les métadonnées dans localStorage
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
    console.error('Erreur lors de la récupération des collections :' );
  } finally {
    setIsLoading(false);
  }
};

    const fetchNFTs = async () => {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

      try {
        const totalMinted = await contract.getTotalMinted();
        const tokenIds = await contract.getAllTokensPaginated(0, 12); // Récupérer les 12 premiers NFTs
        const nftsData = tokenIds.map((id) => ({ tokenId: id.toString() }));
        setNfts(nftsData);
      } catch (error) {
        console.error("Erreur lors de la récupération des NFTs :" );
      }
    };

  const handleSaveProfile = () => {
    const profileData = { biography, name };
    localStorage.setItem(address, JSON.stringify(profileData));
  };

  const fetchAdhesionPoints = async (userAddress) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractAddressAdhesion, ABI, provider);
  try {
    // Appeler la fonction Solidity
    const points = await contract.rewardPoints(userAddress);

    // Mettre à jour l'état avec les points
    setRewardPoints(parseInt(points));
  } catch (error) {
    console.error("Erreur lors de la récupération des points :" );
  }
};


  return (
      <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
        {/*<Heading mb={4}>Mon Dashboard</Heading>*/}
        <VStack spacing={8} align="stretch" width="100%" maxW="800px">
          {/* Avatar, Roles and Name Section */}
          <Box display="flex" justifyContent="center" alignItems="center">
            <HStack spacing={4}>
              <Box
                dangerouslySetInnerHTML={{ __html: avatarSvg }}
                boxSize="100px"
                bg="gray.200"
                borderRadius="full"
                mb={2}
              />
              <Box>

              <Heading mb={2}>{usernames[0]}</Heading>
              <Text fontSize="xl"> {roles[0]} </Text>
              <Text fontSize="xl"> {biographies[0]} </Text>

              <Divider my={6} borderColor="gray.200" w="80%" mx="auto" />

                <Text fontWeight="bold">Adresse Ethereum:</Text>
                <Text>{address}</Text>
                {ensName && (
                  <Text fontWeight="bold" mt={2}>ENS: {ensName}</Text>
                )}

              </Box>
            </HStack>
          </Box>

          {/* Navigation Tabs for Dashboard */}
          <Tabs variant="enclosed">
            <TabList>
              <Tab>Vos adhésions</Tab>
              <Tab>Gérer vos collections</Tab>
              <Tab>Gérer vos oeuvres</Tab>
              <Tab>Statistiques</Tab>

            </TabList>
            <TabPanels>
              {/* Adhesion Tokens and Insects Tab */}
              <TabPanel>
              <VStack spacing={4}>
                <Text>Voici vos jetons d'adhésion (Insectes) :</Text>
                <Grid templateColumns="repeat(4, 1fr)" gap={8}>
                {images.length > 0 && roles.length > 0 ? (
                  images.map((imgUri, index) => (
                    <VStack key={index} spacing={2}>
                      <Link
                        href={`/AdhesionId/${contractAddressAdhesion}/${tokensIdsAdherent[index]}`} // Lien vers la page de chaque NFT
                        passHref
                      >
                        <Box
                          as="a"
                          cursor="pointer"
                          width="100%" // Assure-toi que chaque Box occupe toute la largeur disponible
                          p={4}
                        >
                          <img
                            src={imgUri}
                            alt={`Adhesion ${index}`}
                            style={{ width: '85%', height: '85%', objectFit: 'cover' }}
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

              {/* Manage Collections Tab */}
              <TabPanel>
                {isLoading ? (
                  <Spinner />
                ) : (
                  <Grid templateColumns="repeat(3, 1fr)" gap={6}>
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
                        onClick={() => handleCollectionClick(collection.id)}
                      >
                        {collection.imageUrl && (
                          <Box
                            width="100%"
                            height="150px"  // Taille fixe pour toutes les images
                            overflow="hidden"
                            borderRadius="md"
                          >
                            <img
                              src={collection.imageUrl}
                              alt={collection.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',  // Assure que l'image garde son aspect mais se recadre
                              }}
                            />
                          </Box>
                        )}


                        <Box        mt={2}
                                    textAlign="center"
                                    p={4}
                                    borderWidth={1}
                                    borderRadius="lg"
                                    borderColor="gray.300"
                                    maxWidth="80%" // Limite la largeur de la box
                                    mx="auto">

                        <Text>{collection.name}</Text>

                        </Box>
                      </Box>
                    ))
                  )}
                  </Grid>
                )}

                <Divider my={6} borderColor="gray.200" w="80%" mx="auto" />
                <Box        mt={2}
                            textAlign="center"
                            p={4}
                            mx="auto">
                <Link href="/u/createCollection" >
                  <Button colorScheme="teal" >
                    Créer une collection
                  </Button>
                </Link>
                </Box>


              </TabPanel>

              {/* User nft Tab */}
              <TabPanel>
                {isLoading ? (
                  <Spinner />
                ) : (
                  <Grid templateColumns="repeat(3, 1fr)" gap={6}>
                    {nfts.length === 0 ? (
                      <Text>Aucun NFT trouvé.</Text>
                    ) : (
                      nfts.map((nft) => (
                        <Box key={nft.tokenId} borderWidth="1px" borderRadius="lg" p={4}>
                          <Text>Token ID: {nft.tokenId}</Text>
                        </Box>
                      ))
                    )}
                  </Grid>
                )}
              </TabPanel>

              {/* User Statistics Tab */}
              <TabPanel>
              <VStack>

                {isLoading ? (
                  <Spinner />
                ) : (
                  <Grid templateColumns="repeat(1, 1)" gap={6}>
                  <Text mt={4}>
                    Collections créées : {userCollections}.
                  </Text>
                  <Text mt={4}>
                    Collections restantes : {remainingCollections}.
                  </Text>

                  <VStack>

                  <Text mt={4}>
                  Points d'Adhésion
                  </Text>

                            {rewardPoints !== null ? (
                              <p>Vos points Rescoe : {rewardPoints} 🐝</p>
                            ) : (
                              <p>Chargement des points...</p>
                            )}
                            </VStack>

                  </Grid>
                )}

                </VStack>

              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Box>
    );
  };

export default Dashboard;
