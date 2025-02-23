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
} from '@chakra-ui/react';
import { useAuth } from '../../../utils/authContext';
import ABI_MINT_CONTRACT from '../../../components/ABI/ABI_GENERATIVE_ART.json';

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

  useEffect(() => {
    if (!router.isReady || !contractAddress || !tokenId) return;

    setIsLoading(true);
    const fetchNFTData = async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractAddress, ABI_MINT_CONTRACT, provider);

        // Récupérer le tokenURI du NFT
        const uri = await contract.tokenURI(tokenId as string);
        const CIID = await contract.getCID();
        console.log(CIID);
                // Récupérer les métadonnées de l'IPFS
        const IndexLoad = "https://ipfs.io/ipfs/" + CIID + "/index.html";
        console.log(IndexLoad);
        const res = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
        const data = await res.json();

        setNftData({
          name: data.name,
          description: data.description,
          image: IndexLoad,
          price: price,
        });
        console.log(data);
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
    </Box>
  );
};

export default TokenPage;
