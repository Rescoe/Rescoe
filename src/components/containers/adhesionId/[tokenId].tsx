// pages/.../TokenPage.tsx
import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract as EthersContract, formatUnits } from 'ethers';
import Web3 from 'web3';

import {
  Box,
  Button,
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
  Divider,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';
import ABI from '../../../components/ABI/ABIAdhesion.json';
import { useAuth } from '../../../utils/authContext';
import ABI_Management from '../../../components/ABI/ABI_ADHESION_MANAGEMENT.json';
import { PublicProfile } from "../../../components/containers/dashboard";

interface NFTData {
  owner: string;
  role: number;
  mintTimestamp: string;
  price: string; // in ether (human readable)
  name: string;
  bio: string;
  remainingTime: string;
  fin: string;
  forSale: boolean;
  membership: string;
  image?: string;
}

const contractAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

const TokenPage = () => {
  const router = useRouter();
  const { tokenId } = router.query;

  // USING THE AUTH PROVIDER FROM YOUR MINT PAGE
  const { address: authAddress, web3: authWeb3, provider: authProvider } = useAuth();

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isForSale, setIsForSale] = useState<boolean>(false);
  const [nftCache, setNFTCache] = useState<{ [key: string]: NFTData }>({});

  // Helper formatters (tu avais déjà)
  function formatSeconds(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;
    return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  // WHEN ROUTER READY -> fetch NFT data (read-only)
  useEffect(() => {
    if (!router.isReady || !contractAdhesion || tokenId === undefined) return;

    setIsLoading(true);

    const fetchNFT = async () => {
      try {
        const data = await fetchNFTData(contractAdhesion as string, Number(tokenId));
        setNftData(data);
        setIsForSale(data.forSale);
        const remainingTimeInSeconds = Number(data.remainingTime);
        setMembershipStatus(remainingTimeInSeconds > 0 ? 'actif' : 'expiré');
        setName(data.name);
        setBio(data.bio);
        setPrice(data.price);
      } catch (err) {
        console.error('Erreur lors de la récupération du NFT:', err);
        setError('Erreur lors de la récupération des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [router.isReady, contractAdhesion, tokenId]);

  // READ function: utilise ethers.JsonRpcProvider pour lecture depuis Moralis (comme dans ton mint fetchUserCollections)
  const fetchNFTData = async (contractAdhesionAddress: string, tokenIdNumber: number) => {
    const cacheKey = `${contractAdhesionAddress}_${tokenIdNumber}`;
    if (nftCache[cacheKey]) return nftCache[cacheKey];

    try {
      const rpcProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contract = new EthersContract(contractAdhesionAddress, ABI, rpcProvider);
      const contractManagement = new EthersContract(contractAdhesionManagement, ABI_Management, rpcProvider);

      // getTokenDetails retourne plusieurs champs (tu l'utilisais déjà)
      const [
        owner,
        role,
        mintTimestamp,
        priceWei,
        nameOnChain,
        bioOnChain,
        remainingTime,
        forSale,
      ] = await contract.getTokenDetails(tokenIdNumber);

      // récupère infos utilisateurs dans le contract management
      const [membership, realName, realBio] = await contract.getUserInfo(owner);

      // tokenURI + fetch via ton proxy pinata
      const uri = await contract.tokenURI(tokenIdNumber);
      const ipfsHash = uri.split('/').pop();
      const res = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
      const metadata = await res.json();
      const finAdhesion = new Date((Number(mintTimestamp) + 365 * 24 * 60 * 60) * 1000).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

      console.log(finAdhesion);
      const nftData: NFTData = {
        ...metadata,
        owner,
        role: Number(role),
        mintTimestamp: formatTimestamp(Number(mintTimestamp)),
        price: formatUnits(priceWei, 'ether'), // string (ether)
        name: realName || nameOnChain,
        bio: realBio || bioOnChain,
        remainingTime: formatSeconds(Number(remainingTime)),
        fin : finAdhesion,
        forSale: Boolean(forSale),
        membership,
      };

      setNFTCache(prev => ({ ...prev, [cacheKey]: nftData }));
      return nftData;
    } catch (err) {
      console.error('Erreur lors de la récupération des données NFT:', err);
      throw new Error('Erreur lors de la récupération des données NFT.');
    }
  };

  // TRANSACTION helpers: on utilise authWeb3 (fourni par useAuth) pour les envois, comme dans ton mint
  // Important: vérifier que authWeb3 et authAddress existent avant d'envoyer

  const handleRenewMembership = async () => {
    if (!contractAdhesion || Array.isArray(contractAdhesion)) {
      console.error('Adresse de contrat invalide');
      return;
    }
    if (!authWeb3 || !authAddress) {
      alert('Veuillez vous connecter à MetaMask.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      // obtenir mintPrice via call (en wei)
      const mintPriceWei: string = await contract.methods.mintPrice().call();
      // on envoie la tx en utilisant web3 (pattern identique à ton mint)
      await contract.methods.renewMembership(Number(tokenId)).send({
        from: authAddress,
        value: mintPriceWei,
      });
      alert('Adhésion renouvelée avec succès.');
    } catch (err) {
      console.error('Erreur lors du renouvellement de l\'adhésion:', err);
      alert('Erreur lors du renouvellement. Voir console.');
    }
  };

  const handleUpdateInfo = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      await contract.methods.setNameAndBio(Number(tokenId), name, bio).send({ from: authAddress });
      alert('Informations mises à jour avec succès.');
    } catch (err) {
      console.error('Erreur lors de la mise à jour des informations:', err);
      alert('Erreur lors de la mise à jour. Voir console.');
    }
  };

  const handleListForSale = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert('Prix invalide.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const priceWei = (authWeb3 as Web3).utils.toWei(price, 'ether');
      await contract.methods.listTokenForSale(Number(tokenId), priceWei).send({ from: authAddress });

      setIsForSale(true);
      alert('NFT mis en vente avec succès.');
    } catch (err) {
      console.error('Erreur lors de la mise en vente du NFT:', err);
      alert('Erreur lors de la mise en vente. Voir console.');
    }
  };

  const handlePurchase = async () => {
    if (!nftData) {
      console.error('nftData is not available.');
      return;
    }
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      // nftData.price est en ETH (string), on convertit en wei
      const valueWei = (authWeb3 as Web3).utils.toWei(nftData.price, 'ether');
      await contract.methods.buyNFT(Number(tokenId)).send({ from: authAddress, value: valueWei });
      alert('NFT acheté avec succès.');
      // Optionnel : rafraîchir les données
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);
      setIsForSale(updated.forSale);
    } catch (err) {
      console.error('Erreur lors de l\'achat du NFT:', err);
      alert('Erreur lors de l\'achat. Voir console.');
    }
  };

  // UI
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
        <Text fontSize="2xl" color="red.500">Une erreur est survenue... Tentez de recharger la page</Text>
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
  const isVendable = Number(nftData.remainingTime) === 0;
  const canPurchase = !isOwner && isForSale;
  return (
      <Box textAlign="center" mt={10} p={6}>

        <Heading as="h1" fontSize="3xl" mb={6}>
          Carte d'adhésion de {nftData.name}
        </Heading>

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
            {isOwner && isVendable && <Tab>Mise en vente</Tab>}
            {isOwner && <Tab>Mise à jour</Tab>}
            {!isOwner && canPurchase && <Tab>Achat</Tab>}
          </TabList>

          <TabPanels>
            {/* --- Onglet Détails --- */}
            <TabPanel>

              <VStack spacing={4} alignItems="start" mb={6}>
                <Text fontSize="lg"><strong>Nom :</strong> {nftData.name}</Text>
                <Text fontSize="lg"><strong>Addresse du propriétaire :</strong> {nftData.owner}</Text>
                <Text fontSize="lg"><strong>Rôle :</strong> {nftData.role === 1 ? 'Artiste' : 'Poète'}</Text>
                <Text fontSize="lg"><strong>Bio :</strong> {nftData.bio}</Text>
                {isForSale && (
                  <Text fontSize="lg">
                    <strong>Prix :</strong> {nftData.price} ETH
                  </Text>
                )}
                <Text fontSize="lg"><strong>Durée restante d'adhésion :</strong> {nftData.remainingTime}</Text>
                <Text fontSize="lg"><strong>Soit le:</strong> {nftData.fin}</Text>
                {isOwner && (
                  <Button colorScheme="blue" mt={4} onClick={handleRenewMembership}>
                    Renouveler adhésion
                  </Button>
                )}

                <Divider my={6} borderColor="purple.700" w="95%" mx="auto" />

                {nftData && nftData.owner && <PublicProfile address={nftData.owner} />} {/* Passer l'adresse */}



              </VStack>
            </TabPanel>

            {/* --- Autres onglets --- */}
            {isOwner && isVendable && (
              <TabPanel>
                {/* Mise en vente */}
                <FormControl mt={4}>
                  <FormLabel htmlFor="price">Prix pour mise en vente</FormLabel>
                  <Input
                    id="price"
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 0.01"
                  />
                  <Button colorScheme="teal" mt={4} onClick={handleListForSale}>
                    Mettre en vente
                  </Button>
                </FormControl>
              </TabPanel>
            )}

            {isOwner && (
              <TabPanel>
                {/* Mise à jour */}
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
                  <Button colorScheme="blue" mt={4} onClick={handleUpdateInfo}>
                    Mettre à jour
                  </Button>
                </FormControl>
              </TabPanel>
            )}

            {!isOwner && canPurchase && (
              <TabPanel>
                {/* Achat */}
                <Button colorScheme="green" mt={4} onClick={handlePurchase}>
                  Acheter ce NFT
                </Button>
              </TabPanel>
            )}

          </TabPanels>
        </Tabs>
      </Box>
    );
  };

  export default TokenPage;
