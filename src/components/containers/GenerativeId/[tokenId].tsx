import { useEffect, useState } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { useRouter } from 'next/router';
import { JsonRpcProvider, Contract } from 'ethers';
import {
  Box,
  Button,
  Heading,
  Image,
  Text,
  Spinner,
  VStack,
  HStack,
  Stack
} from '@chakra-ui/react';
import { useAuth } from '../../../utils/authContext';
import ABI_MINT_CONTRACT from '../../../components/ABI/ABI_GENERATIVE_ART.json';

import {FilteredCollectionsCarousel} from '../galerie/art'; // Mettez à jour le chemin

const TokenPage: React.FC = () => {
  const router = useRouter();
  const { contractAddress, tokenId } = router.query as { contractAddress?: string; tokenId?: string };
  const { address: authAddress } = useAuth();

  const [nftData, setNftData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<string>('0');
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [provider, setProvider] = useState<any>(null);

  useEffect(() => {
    const setupWeb3 = async () => {
      try {
        const detectedProvider = (await detectEthereumProvider()) as any;
        if (detectedProvider) {
          const web3Instance = new Web3(detectedProvider);
          setProvider(detectedProvider);
          setWeb3(web3Instance);
          const userAccounts: string[] = await detectedProvider.request({ method: "eth_requestAccounts" });
          setAccounts(userAccounts);
        } else {
          console.error("MetaMask not detected");
        }
      } catch (error) {
        console.error("Error setting up Web3:", error);
      }
    };
    setupWeb3();
  }, []);

  // Fonction pour raccourcir l'adresse Ethereum
  const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAddress5lettres = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 8)}`;
  };

  useEffect(() => {
    if (!router.isReady || !contractAddress || !tokenId) return;

    setIsLoading(true);
    const fetchNFTData = async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractAddress, ABI_MINT_CONTRACT, provider);

/*
        let fullDetails;
        try {
            fullDetails = await contract.getFullDetails(tokenId);
        } catch (error: any) { // Typage en 'any'
            if (error.message && error.message.includes('ERC721NonexistentToken')) {
                // Retourner null sans afficher d'erreur dans la console
                return null; // Indique que le token n'existe pas
            } else {
                console.error('Erreur non prévue:', error);
                throw error; // Relancez l'erreur pour le traitement ultérieur
            }
        }
                if (!fullDetails) {
                    return null;  // Si aucun détail n'est trouvé
                    console.log("AucunFull details");
                }

        */
        const fullDetails = await contract.getFullDetails(tokenId);
        console.log("Fulld etails : ");
        console.log(fullDetails);

        // Récupérer le tokenURI du NFT
        const uri = await contract.tokenURI(tokenId as string);
        const CIID = await contract.getCID();
        console.log(CIID);
                // Récupérer les métadonnées de l'IPFS
        const IndexLoad = "https://ipfs.io/ipfs/" + CIID + "/index.html";
        console.log(IndexLoad);
        const res = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
        const data = await res.json();

        const owner: string = fullDetails[0];
        const collectionId: bigint = fullDetails[5];

        console.log(owner);

        setNftData({
          name: data.name,
          description: data.description,
          image: IndexLoad,
          price: price,
          collectionId: Number(collectionId),
          owner,
        });

      } catch (err) {
        console.error('Error fetching NFT data:', err);
        setError('Erreur lors de la récupération des données du NFT');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFTData();
  }, [router.isReady, contractAddress, tokenId]);

  const handleMint = async () => {
    // Vérification que tout est bien défini avant de procéder au minage
    if (!web3 || !contractAddress || !accounts.length || !nftData || !nftData.image) {
      console.error("Données manquantes pour le minage");
      return;
    }

    const contract = new web3.eth.Contract(ABI_MINT_CONTRACT as any, contractAddress);

    // Vérification de l'URL (ImageLoad)
    console.log("URL de l'image (index.html) pour minter:", nftData.image); // Assure-toi que l'URL est correcte

    try {
      // Utilisation de l'URL de l'index.html pour le mint
      const tx = await contract.methods.mint(nftData.image) // Ici on passe l'URL de l'index
        .send({ from: accounts[0], value: web3.utils.toWei(price, 'ether') });

      alert('Nouvelle œuvre générée et minée avec succès!');
    } catch (error) {
      console.error('Erreur lors du minage de la nouvelle œuvre:', error);
      alert('Une erreur est survenue lors du minage.');
    }
  };

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
        <Text fontSize="2xl" color="red.500">Une erreur est survenue. Ressayez plus tard</Text>
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

  return (
    <Box textAlign="center" mt={10} p={6}>
      <Heading as="h1" fontSize="3xl">{nftData.name}</Heading>
      <Text>{nftData.description}</Text>
      {/* Afficher l'iframe uniquement si l'URL est définie */}
      {nftData.image && (
        <iframe
          src={nftData.image} // L'URL de l'index.html depuis IPFS
          width="100%"
          height="500px"
          style={{ border: "none" }}
          title={nftData.name}
        />
      )}
      <VStack mt={4}>
        <Text>Prix: {nftData.price} ETH</Text>
        <Button colorScheme="blue" onClick={handleMint}>Minter une itération</Button>
      </VStack>

      {/* Carrousels */}
      <Box mt={5} w="full">
        <Heading size="md" mb={3}>
          Découvrez les autres collections du même artiste
        </Heading>
        <Stack direction={{ base: "column", md: "row" }} spacing={2}>
          <FilteredCollectionsCarousel
            creator={nftData.owner}

            />
        </Stack>
      </Box>

    </Box>
  );
};

export default TokenPage;
