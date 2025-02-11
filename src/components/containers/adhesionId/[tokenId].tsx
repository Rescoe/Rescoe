import { useEffect, useState, useContext, createContext } from 'react';
import { JsonRpcProvider, Contract, ethers, formatUnits  } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import Web3 from 'web3';

import {
  Box,
  Button,
  Divider,
  Heading,
  Image,
  Text,
  VStack,
  Spinner,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import ABI from '../../../components/ABI/ABIAdhesion.json';
import { useAuth } from '../../../utils/authContext';

interface NFTData {
  owner: string;
  role: number;
  mintTimestamp: string;
  price: string;
  name: string;
  bio: string;
  remainingTime: string;
  forSale: boolean;
  membership: string;
  image?: string;  // Ajouter une image optionnelle
}

const TokenPage = () => {
  const router = useRouter();
  const { contractAddress, tokenId } = router.query;
  const { address: authAddress } = useAuth();

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [provider, setProvider] = useState<any>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [isForSale, setIsForSale] = useState<boolean>(false); // Nouveau state
  const [nftCache, setNFTCache] = useState<{ [key: string]: NFTData }>({}); // Cache typé
  const [accounts, setAccounts] = useState<string[]>([]);


  function formatSeconds(seconds: number): string {
      const days = Math.floor(seconds / (24 * 60 * 60));
      const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((seconds % (60 * 60)) / 60);
      const remainingSeconds = seconds % 60;

      return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000); // Convertir en millisecondes
  return date.toLocaleString(); // Format lisible selon les paramètres locaux
}


useEffect(() => {
  const setupWeb3 = async () => {
    try {
      const detectedProvider = (await detectEthereumProvider()) as any;
      if (detectedProvider) {
        setProvider(detectedProvider);
        const web3Instance = new Web3(detectedProvider);
        setWeb3(web3Instance);
        const userAccounts: string[] = await detectedProvider.request({ method: "eth_requestAccounts" });
        setAccounts(userAccounts);
      } else {
        console.error("MetaMask not detected");
      }
    } catch (error) {
      console.error("Error setting up Web3:");
    }
  };
  setupWeb3();
}, []);


useEffect(() => {
    if (!router.isReady || !contractAddress || !tokenId) return;

    setIsLoading(true);

    const fetchNFT = async () => {
      try {
        // Assurez-vous que tokenId est bien un nombre
        const data = await fetchNFTData(contractAddress as string, Number(tokenId));
        setNftData(data);
        setIsForSale(data.forSale); // Utilisez forSale au lieu de forsale

        const remainingTimeInSeconds = Number(data.remainingTime); // Convertir le temps restant en nombre
        setMembershipStatus(remainingTimeInSeconds > 0 ? 'actif' : 'expiré'); // Comparer en tant que nombre

        setName(data.name);
        setBio(data.bio);
        setPrice(data.price);
      } catch (error) {
        console.error('Erreur lors de la récupération du NFT:', error);
        setError('Erreur lors de la récupération des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [router.isReady, contractAddress, tokenId]);

  const fetchNFTData = async (contractAddress: string, tokenId: number): Promise<NFTData> => {
    const cacheKey = `${contractAddress}_${tokenId}`;

    // Si le cache existe, on retourne les données du cache
    if (nftCache[cacheKey]) {
      return nftCache[cacheKey];
    }

    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contract = new ethers.Contract(contractAddress, ABI, provider);

      const [
        owner,
        role,
        mintTimestamp,
        price,
        name,
        bio,
        remainingTime,
        forSale,
      ] = await contract.getTokenDetails(tokenId);

      const uri = await contract.tokenURI(tokenId);
      const res = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
      const data = await res.json();

      // S'assurer que web3 est initialisé avant de l'utiliser
      if (!web3) {
          throw new Error('Web3 not initialized');
      }
      const priceInEther: string = web3.utils.fromWei(price.toString(), 'ether'); // Convertir le prix en Ether
      const nftData: NFTData = {
        owner,
        role,
        mintTimestamp: formatTimestamp(Number(mintTimestamp)),
        price: priceInEther, // Utilisation de la valeur convertie
        name,
        bio,
        remainingTime: formatSeconds(Number(remainingTime)),
        forSale,
        membership: '', // Initialisez si besoin
        image: data.image, // Ajoutez l'image si nécessaire
      };

      setNFTCache((prev) => ({ ...prev, [cacheKey]: nftData }));

      return nftData;
    } catch (error) {
      console.error('Erreur lors de la récupération des données NFT:', error);
      throw new Error('Erreur lors de la récupération des données NFT.');
    }
  };


  const handleRenewMembership = async () => {
      // Vérifier que contractAddress est défini et est une chaîne
      if (!contractAddress || Array.isArray(contractAddress)) {
          console.error("Contract address is invalid");
          return;
      }

      // L'utilisateur peut renouveler son adhésion même si elle a expiré
      try {
          const contract = new ethers.Contract(contractAddress as string, ABI, provider); // Affirme que c'est un string
          const tx = await contract.renewMembership(tokenId, { value: ethers.parseEther("0.005") });
          await tx.wait();

          alert('Adhésion renouvelée avec succès.');
      } catch (error) {
          console.error('Erreur lors du renouvellement de l\'adhésion:', error);
      }
  };


  const handleUpdateInfo = async () => {
    try {
      const contract = new ethers.Contract(contractAddress as string, ABI, provider); // Affirme que c'est un string
      await contract.setNameAndBio(tokenId, name, bio); // Ajout du tokenId
      alert("Informations mises à jour avec succès.");
    } catch (error) {
      console.error('Erreur lors de la mise à jour des informations:' );
    }
  };

  const handleListForSale = async () => {
    try {
      const contract = new ethers.Contract(contractAddress as string, ABI, provider); // Affirme que c'est un string
      await contract.listTokenForSale(tokenId, ethers.parseEther(price));
      setIsForSale(true); // Ajoutez une variable locale si vous gérez l'état côté frontend

      alert('NFT mis en vente avec succès.');
    } catch (error) {
      console.error('Erreur lors de la mise en vente du NFT:' );
    }
  };

  const handlePurchase = async () => {
    // Vérifiez que nftData n'est pas null avant de l'utiliser
    if (!nftData) {
      console.error("nftData is not available.");
      return;
    }

    if (!web3) {
        throw new Error('Web3 not initialized');
    }

    try {
      const contract = new ethers.Contract(contractAddress as string, ABI, provider);

      const priceInEther: string = web3.utils.fromWei(nftData.price, 'ether')

      const tx = await contract.buyNFT(tokenId, { value: priceInEther }); // Utilisez nftData ici
      await tx.wait();
      alert('NFT acheté avec succès.');
    } catch (error) {
      console.error('Erreur lors de l\'achat du NFT:');
    }
  };


  // UI Handling
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl" color="red.500">Une erreur est survenue</Text>
      </Box>
    );
  }

  if (!nftData) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl">NFT non trouvé.</Text>
      </Box>
    );
  }

  const isOwner = authAddress && authAddress.toLowerCase() === nftData.owner.toLowerCase();
  const canPurchase = !isOwner && isForSale; // L'utilisateur ne doit pas être le propriétaire et le NFT doit être en vente


  return (
    <Box textAlign="center" mt={10} p={6}>
      <Heading as="h1" fontSize="3xl" mb={6}>Détails du NFT #{tokenId}</Heading>

      <Image
        src={nftData.image || '/fallback-image.png'}
        alt={nftData.name}
        maxWidth="400px"
        mx="auto"
        mb={6}
      />


      <Tabs variant="enclosed" colorScheme="teal">
        <TabList>
          <Tab>Détails</Tab>
          {isOwner && <Tab>Mise en vente</Tab>} {/* Afficher si propriétaire */}
          {isOwner && <Tab>Mise à jour</Tab>} {/* Afficher si propriétaire */}
          {/* Optionnel : Historique */}
          {isOwner && <Tab>Actions</Tab>}
          {!isOwner && <Tab>Achat</Tab>} {/* Afficher si pas propriétaire */}
        </TabList>


        <TabPanels>
          <TabPanel>
            <VStack spacing={4} alignItems="start" mb={6}>
              <Text fontSize="lg"><strong>Nom :</strong> {nftData.name}</Text>
              <Text fontSize="lg"><strong>Propriétaire actuel :</strong> {nftData.owner}</Text>
              <Text fontSize="lg"><strong>Rôle :</strong> {nftData.role === 1 ? 'Artiste' : 'Poète'}</Text>
              <Text fontSize="lg"><strong>Bio :</strong> {nftData.bio}</Text>
              <Text fontSize="lg"><strong>Prix :</strong> {nftData.price} ETH</Text>
              <Text fontSize="lg"><strong>Fin de l'adhésion dans :</strong> {nftData.remainingTime}</Text>
              <Text fontSize="lg"><strong>Date de mint :</strong> {nftData.mintTimestamp}</Text>
            </VStack>
          </TabPanel>


                    <TabPanel>
                    {isOwner && (
                      <FormControl mt={4}>
                        <FormLabel htmlFor="price">Prix pour mise en vente</FormLabel>
                        <Input
                          id="price"
                          type="text"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Ex: 0.01"
                        />
                        <Button colorScheme="teal" mt={4} onClick={handleListForSale}>Mettre en vente</Button>
                      </FormControl>
                    )}

                    {canPurchase ? (
                            <Button colorScheme="green" mt={4} onClick={handlePurchase}>
                              Acheter ce NFT
                            </Button>
                          ) : (
                            <Text mt={4} color="red">
                              Ce NFT n'est pas à vendre
                            </Text>
                          )}
                    </TabPanel>

          <TabPanel>
            <FormControl mt={4}>
              <FormLabel htmlFor="name">Nom</FormLabel>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Entrez votre nom"
              />

              <FormLabel htmlFor="bio">Biographie</FormLabel>
              <Input
                id="bio"
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Entrez votre biographie"
              />
              <Button colorScheme="blue" mt={4} onClick={handleUpdateInfo}>Mettre à jour</Button>
            </FormControl>
          </TabPanel>


{/* // TOute la partie historique pose problème, il faudra résoudre ca plus tard
          <TabPanel>
            <VStack spacing={2} alignItems="start">
              <Text fontSize="lg"><strong>Historique des Événements</strong></Text>
              {transactionHistory.length === 0 ? (
                <Text>Aucun historique trouvé.</Text>
              ) : (
                transactionHistory.map((event, index) => (
                  <Box key={index} p={4} borderWidth={1} borderRadius={10} width="full">
                    <Text><strong>Type d'événement :</strong> {event.eventType}</Text>
                    <Text><strong>Date :</strong> {new Date(event.timestamp * 1000).toLocaleString()}</Text>
                    {event.details && <Text><strong>Détails :</strong> {event.details}</Text>}
                  </Box>
                ))
              )}
            </VStack>
          </TabPanel>
*/}

          <TabPanel>
          {isOwner && (
            <Button colorScheme="blue" mt={4} onClick={handleRenewMembership}>Renouveler adhesion</Button>
          )}
          </TabPanel>

        </TabPanels>
      </Tabs>
    </Box>
  );
};


export default TokenPage;
