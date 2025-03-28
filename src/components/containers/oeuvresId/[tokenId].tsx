import { useEffect, useState } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { useRouter } from 'next/router';
import { JsonRpcProvider, Contract, ethers, formatUnits  } from 'ethers';

import {
  Box,
  Button,
  Divider,
  Heading,
  Image,
  Text,
  VStack,
  HStack,
  Spinner,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Table,
  Thead,
  Tr,
  Th,
  Td,
  Tbody,
} from '@chakra-ui/react';
import ABI from '../../../components/ABI/ABI_ART.json';
import { useAuth } from '../../../utils/authContext';

interface Transaction {
    seller: string;
    buyer: string;
    timestamp: bigint;
    price: bigint;
}

interface NFTData {
    owner: string;
    mintDate: bigint;
    priceHistory: number[];
    transactions: {
        oldOwner: string;
        newOwner: string;
        date: string;
        price: string;
    }[];
    image: string;
    name: string;
    description: string;
    artist: string;
    forsale: boolean;
    price: string;
}

interface HistoryData {
    priceHistory: bigint[];
    transactionHistory: Transaction[];
}


type NFTCache = Record<string, NFTData>;

const TokenPage: React.FC = () => {
  const router = useRouter();
  const { contractAddress, tokenId } = router.query as { contractAddress?: string; tokenId?: string };
  const { address: authAddress } = useAuth();

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [provider, setProvider] = useState<any>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isForSale, setIsForSale] = useState<boolean>(false);
  const [nftCache, setNFTCache] = useState<NFTCache>({});
  const [formattedTransactions, setFormattedTransactions] = useState<
    { oldOwner: string; newOwner: string; date: string; price: string }[]
  >([]);

  function formatSeconds(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;

    return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  function formatTimestamp(timestamp: number | BigInt): string {
      const date = new Date(Number(timestamp) * 1000); // Convertir BigInt à Number
      return date.toLocaleString();
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
        const data = await fetchNFTData(contractAddress, Number(tokenId));
        setNftData(data);
        setIsForSale(data.forsale);
        setMembershipStatus(data.forsale ? 'actif' : 'expiré');
        setName(data.name);
        setBio(data.description);
        setFormattedTransactions(data.transactions); // Mettre à jour ici

      } catch (error) {
        console.error('Erreur lors de la récupération du NFT');
        setError('Erreur lors de la récupération des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [router.isReady, contractAddress, tokenId]);


//################################################################ Fetch NFT DATA

const fetchNFTData = async (contractAddress: string, tokenId: number): Promise<NFTData> => {
    const cacheKey = `${contractAddress}_${tokenId}`;
    if (nftCache[cacheKey]) return nftCache[cacheKey];

    const web3Instance = new Web3(new Web3.providers.HttpProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!));

    try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractAddress, ABI, provider);

        const fullDetails = await contract.getTokenFullDetails(tokenId);

        const owner: string = fullDetails.owner;
        const mintDate: bigint = fullDetails.mintDate;
        const currentPrice: bigint = fullDetails.currentPrice;
        const forsale: boolean = fullDetails.forSale;
        const priceHistory: bigint[] = fullDetails.priceHistory;
        const transactions: Transaction[] = fullDetails.transactions;

        // Formatter les transactions
        const formattedTransactions = transactions.map((transaction: Transaction) => ({
            oldOwner: transaction.seller,
            newOwner: transaction.buyer,
            date: formatTimestamp(transaction.timestamp), // Conversion en string pour éviter les erreurs
            price: formatUnits(transaction.price, 18),
        }));

        const priceInEther = formatUnits(currentPrice, 18);
        setPrice(priceInEther);

        const uri = await contract.tokenURI(tokenId);
        if (!uri) throw new Error("URI invalide.");

        const res = await fetch(`/api/proxyPinata?ipfsHash=${uri.split("/").pop()}`);
        if (!res.ok) throw new Error("Erreur lors de la récupération des données d'image.");

        const data = await res.json();

        const nftData: NFTData = {
            owner,
            mintDate,
            priceHistory: priceHistory.map((price) => Number(price)), // Convertir les BigInts en nombres
            transactions: formattedTransactions,
            image: data.image,
            name: data.name,
            description: data.description,
            artist: data.artist,
            forsale,
            price: priceInEther,
        };

        nftCache[cacheKey] = nftData;
        return nftData;
    } catch (error: any) {
        console.error("Erreur lors de la récupération des données NFT:", error);
        throw new Error(`Erreur lors de la récupération des données NFT: ${error.message}`);
    }
};

const fetchHistory = async (contractAddress: string, tokenId: number): Promise<HistoryData> => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractAddress, ABI, provider);

    try {
        const priceHistory: bigint[] = await contract.getPriceHistory(tokenId);
        const transactionHistory: Transaction[] = await contract.getTransactionHistory(tokenId);

        return {
            priceHistory,
            transactionHistory,
        };
    } catch (error) {
        throw new Error("Erreur lors de la récupération de l'historique.");
    }
};



const handleUpdateInfo = async () => {
  if (!web3 || !contractAddress || !tokenId || accounts.length === 0) return;

  try {
    const contract = new web3.eth.Contract(ABI as any, contractAddress);
    await contract.methods.setNameAndBio(tokenId, name, bio)
      .send({ from: accounts[0] });

    alert("Informations mises à jour avec succès.");
  } catch (error) {
    console.error('Erreur lors de la mise à jour des informations');
  }
};


const handleListForSale = async () => {
  if (!web3 || !contractAddress || !tokenId || accounts.length === 0) {
    console.error("Web3, contractAddress, tokenId ou accounts sont manquants");
    return;
  }

  try {
    const contract = new web3.eth.Contract(ABI as any, contractAddress as string);
    await contract.methods.listNFTForSale(tokenId, web3.utils.toWei(price, "ether"))
      .send({ from: accounts[0] });

    setIsForSale(true);
  } catch (error) {
    console.error("Erreur lors de la mise en vente de l'NFT");
  }
};

    const handlePurchase = async () => {

      if (!web3 || !contractAddress || !tokenId || !nftData?.price || accounts.length === 0) {
        console.error("Web3, contractAddress, tokenId, nftData.price ou accounts sont manquants");
        return;
      }

      try {
        const contract = new web3.eth.Contract(ABI as any, contractAddress as string);
        const priceInWei = web3.utils.toWei(nftData.price, "ether");

        const tx = await contract.methods.buyNFT(tokenId)
          .send({ from: accounts[0], value: priceInWei });

        await tx;
        alert('NFT acheté avec succès.');
      } catch (error) {
        console.error("Erreur lors de l'achat du NFT:");
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

  const isOwner = authAddress && authAddress.toLowerCase() === nftData.owner.toLowerCase();
  const canPurchase = !isOwner && nftData.forsale; // L'utilisateur ne doit pas être le propriétaire et le NFT doit être en vente


  return (
    <Box textAlign="center" mt={10} p={6}>
    <HStack align="center" spacing={2}  mt={10} p={6}>
    <Image
      src={nftData.image || '/fallback-image.png'}
      alt={nftData.name}
      maxWidth="20px"
    />

      <Heading as="h1" fontSize="3xl">
        {nftData.name} - {nftData.artist}
      </Heading>

    </HStack>
      <Tabs variant="enclosed" colorScheme="teal">
        <TabList>
          <Tab>Détails</Tab>
          {isOwner && <Tab>Mise en vente</Tab>} {/* Afficher si propriétaire */}
          {isOwner && <Tab>Mise à jour</Tab>} {/* Afficher si propriétaire */}
          {/* Optionnel : Historique */}
          {isOwner && <Tab>Actions</Tab>}
          {!isOwner && <Tab>A venir (peut etre)</Tab>} {/* Afficher si pas propriétaire */}
        </TabList>


        <TabPanels>

        <TabPanel>
            <VStack spacing={4} alignItems="start" mb={6}>
                <Text fontSize="lg"><strong>Nom :</strong> {nftData.name}</Text>
                <Text fontSize="lg"><strong>Description :</strong> {nftData.description}</Text>
                <Text fontSize="lg"><strong>Artiste :</strong> {nftData.artist}</Text>
                <Text fontSize="lg"><strong>Propriétaire :</strong> {nftData.owner}</Text>
                <Text fontSize="lg"><strong>Date de mint :</strong> {formatTimestamp(Number(nftData.mintDate))}</Text>
                <Text fontSize="lg"><strong>Prix actuel :</strong> {nftData.price} ETH</Text>
                <Text fontSize="lg"><strong>En vente :</strong> {nftData.forsale ? 'Oui' : 'Non'}</Text>
                <Text fontSize="lg"><strong>Historique des prix :</strong> {nftData.priceHistory.join(', ')}</Text>

                <img src={nftData.image} alt={nftData.name} style={{ maxWidth: '100%', borderRadius: '8px' }} />

                <Text fontSize="lg" mb={2}><strong>Historique des transactions :</strong></Text>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Ancien propriétaire</Th>
                            <Th>Nouveau propriétaire</Th>
                            <Th>Date</Th>
                            <Th>Prix</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {formattedTransactions.map((transaction, index) => (
                            <Tr key={index}>
                                <Td>{transaction.oldOwner}</Td>
                                <Td>{transaction.newOwner}</Td>
                                <Td>{transaction.date}</Td>
                                <Td>{transaction.price} ETH</Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
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
          <Text mt={4} color="red">
Cette partie devra servir a mettre a jour l'uri de l'oeuvre
          </Text>
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



        </TabPanels>
      </Tabs>
    </Box>
  );
};


export default TokenPage;
