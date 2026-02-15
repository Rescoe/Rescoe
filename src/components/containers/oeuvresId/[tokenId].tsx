import { useEffect, useState } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { useRouter } from 'next/router';
import { JsonRpcProvider, Contract, ethers, formatUnits  } from 'ethers';
import {FilteredCollectionsCarousel} from '../galerie/art'; // Mettez à jour le chemin
import { resolveIPFS } from '@/utils/resolveIPFS';  // ✅ TON UTILS



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
  Stack,
  useToast,
  Grid,
} from '@chakra-ui/react';
import ABI from '../../../components/ABI/ABI_ART.json';
import { useAuth } from '../../../utils/authContext';
import NFTCard from '../galerie/NFTCard';


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
    //artistENS: string;
    forsale: boolean;
    price: string;
    collectionId: number;  // Vérifiez ceci
}

interface HistoryData {
    priceHistory: bigint[];
    transactionHistory: Transaction[];
}

interface CustomError extends Error {
    message: string;
}

type NFTCache = Record<string, NFTData>;

const TokenPage: React.FC = () => {
  const router = useRouter();
  const { contractAddress, tokenId } = router.query as { contractAddress?: string; tokenId?: string };
  const { address: authAddress } = useAuth();
  const toast = useToast();


  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | any>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [provider, setProvider] = useState<any>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isForSale, setIsForSale] = useState<boolean>(false);
  const [nftCache, setNFTCache] = useState<NFTCache>({});
  //const [collectionId, setCollectionId] = useState<bigint>({});
  const [transacActivity, setTransacActivity] = useState<boolean>(false);
  const [tabIndex, setTabIndex] = useState(0); // Initialement l'onglet 0 (Détails)
  //const [ensName, setEnsName] = useState<string>('');

  const [collectionNFTs, setCollectionNFTs] = useState<any[]>([]);
  const [isLoadingCollection, setIsLoadingCollection] = useState(true);


  const [isOwner, setIsOwner] = useState(false);
  const [canPurchase, setCanPurchase] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

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

    if (contractAddress) {
        fetchCollectionNFTs(contractAddress);
      }

    setIsLoading(true);

    const fetchNFT = async () => {
      try {
        const data = await fetchNFTData(contractAddress, Number(tokenId));

            if (!data) {  // Vérifiez si `data` est `null`
        setErrorMessage('Cette œuvre a été détruite ou n\'existe pas encore.');
        setNftData(null);  // Optionnel, mais permet de réinitialiser les données de l'NFT
        return; // Arrêtez l'exécution ici si le token n'existe pas

        }
        setNftData(data);
        setIsForSale(data.forsale);
        setMembershipStatus(data.forsale ? 'actif' : 'expiré');
        setName(data.name);
        setBio(data.description);
        setFormattedTransactions(data.transactions); // Mettre à jour ici
        //setCollectionId(data.collectionId);

        setErrorMessage(''); // Réinitialiser le message d'erreur

        }catch (error: unknown) {
            const customError = error as CustomError;

            console.error('Erreur lors de la récupération des détails du token :', customError);
            if (customError.message && customError.message.includes('nonexistent')) {
                setErrorMessage('Cette œuvre a été détruite ou n\'existe pas encore.');
            } else {
                setErrorMessage('Une erreur s\'est produite lors de la récupération des détails du token.');
            }
        }
      finally {
        setIsLoading(false);
      }
    };


    fetchNFT();
  }, [router.isReady, contractAddress, tokenId]);


//################################################################ Fetch NFT DATA
// Fonction pour raccourcir l'adresse Ethereum
const formatAddress = (address: string) => {
if (!address) return '';
return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/*
const formatAddress5lettres = (address: string) => {
if (!address) return '';
return `${address.slice(0, 8)}`;
};
*/


const fetchNFTData = async (contractAddress: string, tokenId: number): Promise<NFTData | null> => {
    const cacheKey = `${contractAddress}_${tokenId}`;
    if (nftCache[cacheKey]) return nftCache[cacheKey];

    const web3Instance = new Web3(new Web3.providers.HttpProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!));

    try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractAddress, ABI, provider);

        let fullDetails;
        try {
            fullDetails = await contract.getTokenFullDetails(tokenId);
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
                }

        const ownerCheck = Boolean(authAddress && fullDetails?.owner && authAddress.toLowerCase() === fullDetails.owner.toLowerCase());
        setIsOwner(ownerCheck);

        //const resolvedOwner = await fetchENS(fullDetails.owner);

        const owner: string = fullDetails.owner;
        const mintDate: bigint = fullDetails.mintDate;
        const currentPrice: bigint = fullDetails.currentPrice;
        const forsale: boolean = fullDetails.forSale;
        const priceHistory: bigint[] = fullDetails.priceHistory;
        const transactions: Transaction[] = fullDetails.transactions;
        const collectionId: bigint = fullDetails[6];

        const formattedTransactions = transactions.map((transaction: Transaction) => ({
            oldOwner: transaction.seller,
            newOwner: transaction.buyer,
            date: formatTimestamp(transaction.timestamp),
            price: formatUnits(transaction.price, 18),
        }));

        if(formattedTransactions.length != 0){
          setTransacActivity(true);
        }

        const priceInEther = formatUnits(currentPrice, 18);
        setPrice(priceInEther);

        // Dans fetchNFTData, remplace cette partie :
        // Dans fetchNFTData, remplace :
        const uri = await contract.tokenURI(tokenId);
        if (!uri) throw new Error("URI invalide.");

        const hash = uri.replace('ipfs://', '').split('/')[0];  // QmUUWndns...
    const res = await fetch(`/api/metadata/${hash}`);
    const data = await res.json();
    data.image = resolveIPFS(data.image, true)!;  // Pour affichage

        console.log("📄 Main NFT metadata:", data);


        const nftData: NFTData = {
            owner,
            mintDate,
            priceHistory: priceHistory.map((price) => (Number(price) / 1e18)),
            transactions: formattedTransactions,
            image: data.image,
            name: data.name,
            description: data.description,
            artist: data.artist,
            //artistENS: resolvedArtist,
            forsale,
            price: priceInEther,
            collectionId: Number(collectionId),
        };





        setCanPurchase(!ownerCheck && nftData.forsale);


        nftCache[cacheKey] = nftData;
        return nftData;

    } catch (error: any) {
        console.error('Erreur lors de la récupération des détails du token :', error);
        return null; // Indiquez que l'opération a échoué sans lancer d'erreurs sur l'application
    }
};

const fetchCollectionNFTs = async (contractAddress: string) => {
  try {
    setIsLoadingCollection(true);
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const collectionContract = new Contract(contractAddress, ABI, provider);

    const tokenIds: string[] = await collectionContract.getTokenPaginated(0, 19);

    const nftsData = await Promise.all(
      tokenIds.map(async (tokenId: string) => {
        try {
          const tokenURI = await collectionContract.tokenURI(tokenId);

          // ✅ 1. RESOLVE METADATA URI AVANT fetch()
          const resolvedMetadataUri = resolveIPFS(tokenURI, true)!;  // /api/ipfs/CID
          console.log("📄 Fetch metadata:", resolvedMetadataUri);  // DEBUG

          const response = await fetch(resolvedMetadataUri);
          if (!response.ok) throw new Error("Metadata fetch failed");

          const metadata = await response.json();

          // ✅ 2. RESOLVE IMAGE URI pour affichage
          const resolvedImageUri = resolveIPFS(metadata.image, true)!;  // /api/ipfs/imageCID

          const owner = await collectionContract.ownerOf(tokenId);
          const isForSale = await collectionContract.isNFTForSale(tokenId);
          const priceWei = await collectionContract.getTokenPrice(tokenId);
          const priceEth = Number(priceWei) / 1e18;

          return {
            tokenId: Number(tokenId),
            name: metadata.name,
            image: resolvedImageUri,  // ✅ URL proxy prête à afficher
            description: metadata.description,
            owner,
            forSale: isForSale,
            price: priceEth,
            mintContractAddress: contractAddress,
          };
        } catch (err) {
          console.error("❌ Erreur token", tokenId, err);
          return null;
        }
      })
    );

    const filteredNFTs = nftsData.filter((nft) => nft !== null) as any[];
    setCollectionNFTs(filteredNFTs);
  } catch (error) {
    console.error("❌ Collection load error:", error);
  } finally {
    setIsLoadingCollection(false);
  }
};




/*
const fetchENS = async (userAddress: string): Promise<string> => {
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
  try {
    const resolvedEnsName = await provider.lookupAddress(userAddress);
    return resolvedEnsName || formatAddress(userAddress);
  } catch (error) {
    console.error("Error fetching ENS:", error);
    return formatAddress(userAddress);
  }
};
*/

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


const handleBurn = async () => {
  if (!web3 || !contractAddress || !tokenId || accounts.length === 0) return;
  try {
    const contract = new web3.eth.Contract(ABI as any, contractAddress);
    await contract.methods.burn(tokenId)
      .send({ from: accounts[0] });

    alert("Oeuvres détruite avec succès");
  } catch (error) {
    console.error("Erreur lors de la destruction de l'oeuvre");
  }
};


const handleListForSale = async () => {
  if (!web3 || !contractAddress || !tokenId || accounts.length === 0) {
    console.error("Web3, contractAddress, tokenId ou accounts sont manquants");
    return;
  }

  try {
    const contract = new web3.eth.Contract(ABI as any, contractAddress as string);
    const gasPrice = await web3.eth.getGasPrice();

    await contract.methods.listNFTForSale(tokenId, web3.utils.toWei(price, "ether"))
    .send({ from: accounts[0],
      gasPrice: gasPrice.toString(),  // <-- force string
      maxFeePerGas: null as any,       // TS ok
      maxPriorityFeePerGas: null as any
    });

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
        <Text fontSize="2xl">Cette œuvre n'existe pas encore ou a été détruite</Text>
        <Button
          mt={4}
          colorScheme="teal"
          onClick={() => router.push('../../galerie/art')} // Remplacez '/url-de-votre-collection' par le chemin réel de votre collection
        >
          Retourner aux collections
        </Button>
      </Box>
    );
  }

const handleTabChange = (index: number) => {
  setTabIndex(index); // Met à jour l'index de l'onglet actif
};

const handleCopy = () => {
  if (contractAddress) {
    navigator.clipboard.writeText(contractAddress);
    toast({
      title: 'Adresse copiée dans le presse-papier',
      status: 'success',
      duration: 1000,
      isClosable: true,
    });
  }
};



  return (
    <Box textAlign="center" mt={10} p={6} display="flex" flexDirection="column" alignItems="center">

      {/* Titre + Image */}
      <Stack direction={{ base: "column", md: "row" }} spacing={4} align="center" mt={4}>
        <Image
          src={nftData.image || '/fallback-image.png'}
          alt={nftData.name}
          maxW="80px"
          borderRadius="md"
        />
        <Heading as="h1" fontSize={{ base: "xl", md: "3xl" }}>
          {nftData.name} - {formatAddress(nftData.artist)}
        </Heading>
      </Stack>

      <Tabs
        variant="enclosed"
        colorScheme="teal"
        mt={6}
        w="full"
        maxW="container.lg"
        index={tabIndex}
        onChange={handleTabChange} // Écoute les changements d'onglet
      >
          <TabList flexWrap="wrap">
            <Tab>Détails</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <Stack direction={{ base: "column", md: "row" }} spacing={6} mb={6} align="start">

                {/* Image NFT */}
                <Box
                  borderWidth="1px"
                  borderRadius="lg"
                  overflow="hidden"
                  p={4}
                  w={{ base: "100%", md: "300px" }}
                >
                  <Box h="300px" overflow="hidden">
                    <Image
                      src={nftData.image}
                      alt={nftData.name}
                      objectFit="cover"
                      w="100%"
                      h="100%"
                    />
                  </Box>

                  {isOwner === true &&
                    <FormControl mt={4}>
                    <Text mt={4}>
                      Vous possédez cette oeuvre
                    </Text>

                      <Text mt={10}>
                      Mettre en vente :
                      </Text>

                      <FormLabel htmlFor="price">Mettre a jour le prix de vente :</FormLabel>
                      <Input
                        id="price"
                        type="text"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Ex: 0.01"
                      />
                      <Button colorScheme="teal" mt={4} onClick={handleListForSale}>Mettre en vente</Button>

                      <Divider my={6} />

                      <Text>
                        Détruire l'oeuvre :
                      </Text>
                      <Button colorScheme="red" mt={4} onClick={handleBurn}>Brûler</Button>

                    </FormControl>

                  }

                  {(canPurchase && isForSale) ? (
                          <Button colorScheme="green" mt={4} onClick={handlePurchase}>
                            Acheter ce NFT {nftData.price} ETH
                          </Button>
                        ) : (
                          <Text mt={4}>
                            Ce NFT n'est pas à vendre
                          </Text>
                  )}

                </Box>

                {/* Infos Texte */}
                <VStack spacing={4} alignItems="start" mb={6}>
                    <Text fontSize="lg"><strong>Nom :</strong> {nftData.name}</Text>
                    <Text fontSize="lg"><strong>Description :</strong> {nftData.description}</Text>
                    <Text fontSize="lg" cursor="pointer" onClick={handleCopy}><strong>Artiste :</strong> {formatAddress(nftData.artist)}</Text>
                    <Text fontSize="lg" cursor="pointer" onClick={handleCopy}><strong>Propriétaire :</strong> {formatAddress(nftData.owner)}</Text>
                    {/* Dernier prix de vente ou prix actuel */}
                      {!isForSale && nftData.price ? (
                        <Text fontSize="lg">
                          <strong>Dernier prix de vente :</strong> {nftData.price} ETH
                        </Text>
                      ) : isForSale && nftData.price ? (
                        <Text fontSize="lg">
                          <strong>Prix actuel :</strong> {nftData.price} ETH
                        </Text>
                      ) : null}

                      {/* Historique des prix (uniquement s’il y a eu des ventes) */}
                      {nftData.priceHistory && nftData.priceHistory.length > 1 && (
                        <Text fontSize="lg">
                          <strong>Historique des prix :</strong> {nftData.priceHistory.join(' → ')} ETH
                        </Text>
                      )}


                    <Text fontSize="lg"><strong>Collection ID :</strong> {nftData.collectionId ? nftData.collectionId.toString() : 'Aucune collection'}</Text>
                    <Text fontSize="lg" cursor="pointer" onClick={handleCopy}>  <strong>Adresse de contrat :</strong>{' '}{contractAddress ? formatAddress(contractAddress) : 'Adresse inconnue'}</Text>
                </VStack>
              </Stack>

              <Divider my={6} />

              {/* Tableau transactions */}
              {transacActivity && formattedTransactions && formattedTransactions.length > 0 && (
                <Box overflowX="auto" w="full" mt={4}>
                  <Table variant="simple" size="sm" minW="600px">
                    <Thead>
                      <Tr>
                        <Th>Ancien</Th>
                        <Th>Nouveau</Th>
                        <Th>Date</Th>
                        <Th>Prix</Th>
                      </Tr>
                    </Thead>

                    <Tbody>
                      {formattedTransactions.map((tx, i) => (
                        <Tr key={i}>
                          <Td>{formatAddress(tx.oldOwner)}</Td>
                          <Td>{formatAddress(tx.newOwner)}</Td>
                          <Td>{tx.date}</Td>
                          <Td>{tx.price} ETH</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>


                <Divider my={6} />

                </Box>
              )}

            </TabPanel>

          </TabPanels>
      </Tabs>

{/*
      <Box mt={10}>
        <Heading size="md" mb={4}>Autres œuvres de cette collection</Heading>

        {isLoadingCollection ? (
          <Spinner />
        ) : collectionNFTs.length === 0 ? (
          <Text>Aucune autre œuvre trouvée dans cette collection.</Text>
        ) : (
          <Grid
            templateColumns="repeat(auto-fill, minmax(220px, 1fr))"
            gap={6}
            justifyItems="center"
            mb={10} // 🔹 marge contrôlée pour l’espacement avec la section suivante

          >
            {collectionNFTs
              .filter((nft) => nft.tokenId !== Number(tokenId))
              .map((nft) => (
                <Box
                  key={nft.tokenId}
                  onClick={() =>
                    router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)
                  }
                  cursor="pointer"
                  position="relative"
                  width="220px"
                  height="220px"
                  overflow="hidden"
                  borderRadius="lg"
                  transition="transform 0.2s ease, box-shadow 0.2s ease"
                  _hover={{ transform: "scale(1.05)" }}
                >
                  <Image
                    src={nft.image}
                    alt={nft.name}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />

                  <Box
                    position="absolute"
                    bottom="0"
                    left="0"
                    width="100%"
                    bgGradient="linear(to-t, rgba(0,0,0,0.6), transparent)"
                    color="white"
                    p={2}
                    textAlign="left"
                  >
                    <Text fontWeight="bold" fontSize="sm" isTruncated>
                      {nft.name || "Œuvre sans titre"}
                    </Text>
                    {nft.forSale && (
                      <Text fontSize="xs" opacity={0.8}>
                        {nft.price} ETH
                      </Text>
                    )}
                  </Box>
                </Box>
              ))}
          </Grid>
        )}
      </Box>


<Divider/>

*/}
      {/* Carrousels */}
      {/* 🔥 SECTION DYNAMIQUE - remplace le Box existant */}
    <Box mt={10} w="full">
      {collectionNFTs.length > 1 ? (
        <>
          <Heading size="md" mb={4}>Autres œuvres de cette collection</Heading>
          <Grid
            templateColumns="repeat(auto-fill, minmax(220px, 1fr))"
            gap={6}
            mb={10}
          >
            {collectionNFTs
              .filter((nft: any) => nft.tokenId !== Number(tokenId))
              .map((nft: any) => (
                <Box
                  key={nft.tokenId}
                  onClick={() => router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)}
                  cursor="pointer"
                  position="relative"
                  width="220px"
                  height="220px"
                  overflow="hidden"
                  borderRadius="lg"
                  transition="transform 0.2s ease, box-shadow 0.2s ease"
                  _hover={{ transform: "scale(1.05)" }}
                >
                  <Image
                    src={nft.image}
                    alt={nft.name}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                  <Box
                    position="absolute"
                    bottom="0"
                    left="0"
                    width="100%"
                    bgGradient="linear(to-t, rgba(0,0,0,0.6), transparent)"
                    color="white"
                    p={2}
                    textAlign="left"
                  >
                    <Text fontWeight="bold" fontSize="sm" isTruncated>
                      {nft.name || "Œuvre"}
                    </Text>
                    {nft.forSale && (
                      <Text fontSize="xs" opacity={0.8}>
                        {nft.price} ETH
                      </Text>
                    )}
                  </Box>
                </Box>
              ))}
          </Grid>
        </>
      ) : (
        <>
          <Heading size="md" mb={3}>
            🔥 Œuvres phares de l'association
          </Heading>
          <Text mb={6} color="gray.300">
            {collectionNFTs.length === 1
              ? "Collection solo. Découvrez les œuvres mises en avant !"
              : "Découvrez les œuvres mises en avant !"
            }
          </Text>
          <FilteredCollectionsCarousel
            creator="0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879"
          />
        </>
      )}
    </Box>

    </Box>
  );
};


export default TokenPage;
