import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import { ethers } from 'ethers';

import ABI from '../../../components/ABI/HaikuEditions.json';
import ABIRESCOLLECTION from '../../../components/ABI/ABI_Collections.json';
import { useAuth } from '../../../utils/authContext';
import { Box, Text, Heading, VStack, Spinner, Button, List, ListItem, Table, Thead, Tbody, Tr, Th, Td, Divider, Grid, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Input,
  useDisclosure,
  useToast,
  Stack,
  HStack,
  Wrap,
  WrapItem,
  Badge
 } from '@chakra-ui/react';
import PoetryGallery from "./PoesieGalerieProps";
import TextCard from "../galerie/TextCard";
import { FramedText } from '../../../utils/Cadre';

//UseUsercollection ne sert a rien dans ce FaCode
//il fauut l'améliorer pour qu'il face mieux que le FilteredCollectionsCarousel

import { useUserCollections } from "../../../hooks/useUserCollections";
import {FilteredCollectionsCarousel} from '../galerie/art';
import UserEditionsManager from '../../../hooks/userEditionsManager';
import CopyableAddress from "../../../hooks/useCopyableAddress";
import useEthToEur from "../../../hooks/useEuro";





import { BrowserProvider, Eip1193Provider } from "ethers";


interface Poem {
  tokenId: string;
  poemText: string;
  creatorAddress: string;
  totalEditions: string;
  mintContractAddress: string;
  price: string;
  priceEur: string;
  totalMinted: string;
  availableEditions: string;
  isForSale: boolean;
  tokenIdsForSale: number[];
}

interface PoemData {
  contrat: string;
  owner: string;
  mintDate: bigint;
  title: string;
  text: string;
  author: string;
  forsale: boolean;
  price: string;
  priceEur: string;   // prix en EUR
  collectionId: number;
  owners: { owner: string; count: number; }[];
  priceHistory: number[];
  totalEditions: number;
  remainingEditions: string;
  transactionHistory: { from: string; to: string; price: string; date: string; }[];
}

const PoemPage: React.FC = () => {
  const router = useRouter();
  const { tokenId, contractAddress } = router.query as { tokenId?: string; contractAddress?: string };
  const { web3, address } = useAuth();

  const [provider, setProvider] = useState<any>(null);
  const [accounts, setAccounts] = useState<string[]>([]);

  const [PoemPrice, setPoemPrice] = useState('');
  const [poemData, setPoemData] = useState<PoemData | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]); // Utiliser un tableau pour les poèmes
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isEditionForSale, setIsEditionForSale] = useState<boolean>(false);

  const [Owner, setOwner] = useState<{ owner: string; count: number }[]>([]);


  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const [editionsForSale, setEditionsForSale] = useState<Poem[]>([]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [price, setPrice] = useState('');

  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();





    useEffect(() => {
      const setupWeb3 = async () => {
        try {
          const detectedProvider = (await detectEthereumProvider()) as any;
          if (detectedProvider) {
            setProvider(detectedProvider);
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
    if (!router.isReady || !contractAddress || !tokenId || loadingEthPrice) return;

    const fetchPoemData = async () => {
            try {
              const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
              const contract = new Contract(contractAddress, ABI, provider);
              const contractCollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

              // On mappe le tokenId courant à son haiku unique
              const haikuUniqueId = await contract.tokenIdToHaikuId(tokenId);
              const isForSale: boolean = await contract.isNFTForSale(tokenId);
              if (!isForSale) {
                alert("Ce haiku n'est pas en vente.");
                return;
              }
              setIsEditionForSale(isForSale);


              // Infos série
              const premierToDernier = await contract.getHaikuInfoUnique(haikuUniqueId);
              const premierIDDeLaSerie = Number(premierToDernier[0]);
              const nombreHaikusParSerie = Number(premierToDernier[1]);

              // ✅ Balayer tous les tokenIds de la série
              const tokensDetails = await Promise.all(
                Array.from({ length: nombreHaikusParSerie }, async (_, i) => {
                  const currentTokenId = premierIDDeLaSerie + i;
                  try {
                    const details = await contract.getTokenFullDetails(currentTokenId);
                    const priceEth = parseFloat(formatUnits(details.currentPrice, 18));
                    const priceEur = await convertEthToEur(priceEth);



                    return {
                      tokenId: currentTokenId,
                      owner: details.owner,
                      author: details[7]?.toString() ?? "",
                      text: details[6],
                      price: formatUnits(details.currentPrice, 18),
                      priceEur: priceEur ? priceEur.toFixed(2) : "0", // €
                      mintDate: details.mintDate,
                      isForSale: details[3],
                    };
                  } catch (err) {
                    console.warn(`Impossible de récupérer le token ${currentTokenId}`, err);
                    return null;
                  }
                })
              );

              const validTokens = tokensDetails.filter(Boolean);

              // Récupération d’un seul haikuData (les infos sont partagées par la série)
              const haikuData = await contract.haikus(haikuUniqueId);

              const availableEditions = await contract.getRemainingEditions(haikuUniqueId);
              const totalMinted = nombreHaikusParSerie - Number(availableEditions);
              const editionsRestantes = Number(haikuData[2] - haikuData[4]).toString();

              // Historique (tu peux décider si c’est par tokenId unique ou global à la série)
              const txHistory = await contract.getTransactionHistory(Number(tokenId));
              const formattedTxHistory = (txHistory || []).map((tx: any) => ({
                from: tx[0],
                to: tx[1],
                price: formatUnits(tx[2] ?? BigInt(0), 18),
                date: new Date(Number(tx[3] ?? 0) * 1000).toLocaleString(),
              }));

              const owners = computeOwnersFromHistory(txHistory);

              // Collection
              const collection = await contract.collectionId();
              const collectionDatas = await contractCollection.collections(collection);

              const priceInEuro = convertEthToEur(validTokens[0]?.price) ?? 0;

              setPoemData({
                contrat: contractAddress,
                owner: validTokens[0]?.owner || "",
                mintDate: validTokens[0]?.mintDate || BigInt(0),
                title: collectionDatas[1],
                text: validTokens[0]?.text || "",
                author: validTokens[0]?.author || "",
                forsale: Number(availableEditions) > 0,
                price: validTokens[0]?.price || "0",
                priceEur: priceInEuro ? priceInEuro.toFixed(2) : "0",
                collectionId: Number(collection),
                owners,
                priceHistory: (haikuData.priceHistory || []).map((p: bigint) =>
                  parseFloat(formatUnits(p, 18))
                ),
                totalEditions: nombreHaikusParSerie,
                remainingEditions: editionsRestantes,
                transactionHistory: formattedTxHistory,
              });

              // ✅ Stocker toutes les éditions
              setPoems(validTokens as any[]);
            } catch (err: any) {
              setErrorMessage(err.message || "Erreur lors de la récupération des poèmes");
            } finally {
              setIsLoading(false);
            }
          };


        fetchPoemData();

      }, [router.isReady, contractAddress, tokenId, address, loadingEthPrice]);

      // Utilisation du hooks de récupération des collections d'artistes
      /*
      const { collections: poetryCollections, isLoading: isLoadingCollections } =
      useUserCollections(poemData?.author);
      */

/*
      // --- Fonction utilitaire pour récupérer tous les IDs en vente ---
const fetchTokenIdsForSale = async (
  collectionContract: Contract,
  premierIDDeLaSerie: number,
  nombreHaikusParSerie: number
): Promise<number[]> => {
  const tokenIdsForSale: number[] = [];

  for (let id = premierIDDeLaSerie; id < premierIDDeLaSerie + nombreHaikusParSerie; id++) {
    const forSale: boolean = await collectionContract.isNFTForSale(id);
    if (forSale) {
      tokenIdsForSale.push(id);
    }
  }

  return tokenIdsForSale;
};
*/
// Reconstruit la liste des propriétaires à partir des transactions
function computeOwnersFromHistory(txHistory: any[]) {
const balances: Record<string, number> = {};

txHistory.forEach((tx) => {
  const buyer = tx[0];
  const seller = tx[1];

  // Décrémente le vendeur (sauf si mint = address(0))
  if (seller !== "0x0000000000000000000000000000000000000000") {
    balances[seller] = (balances[seller] || 0) - 1;
    if (balances[seller] <= 0) delete balances[seller];
  }

  // Incrémente l’acheteur
  balances[buyer] = (balances[buyer] || 0) + 1;
});

return Object.entries(balances).map(([owner, count]) => ({
  owner,
  count,
}));
}


const handleBuy = async (tokenId: number) => {
  if (!window.ethereum) {
    alert("Wallet non détecté. Veuillez installer MetaMask.");
    return;
  }

  const ethereum = window.ethereum as Eip1193Provider;
  await ethereum.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  if (!contractAddress) {
    alert("Adresse du contrat non définie.");
    return;
  }

  if (!poemData) {
    alert("Données du poème non disponibles.");
    return;
  }

  // Vérification du prix
  const normalizedPrice = poemData.price.replace(",", ".");
  if (isNaN(Number(normalizedPrice))) {
    alert("Le prix du poème est invalide.");
    return;
  }

  try {
    // On crée le contrat avec ethers.js et le signer
    const contract = new ethers.Contract(contractAddress, ABI, signer);

    // Vérifie si le token est en vente
    const isForSale: boolean = await contract.isNFTForSale(tokenId);
    if (!isForSale) {
      alert("Ce haiku n'est pas en vente.");
      return;
    }

    // Convertir le prix en wei
    const priceInWei = ethers.parseEther(normalizedPrice); // BigInt, compatible ethers.js

    // Acheter le token
    const tx = await contract.buyEdition(tokenId, { value: priceInWei });
    await tx.wait(); // attendre la confirmation de la transaction

    alert("Haiku acheté avec succès !");
  } catch (error: any) {
    console.error("Erreur lors de l'achat du haiku:", error);
    alert(error?.message || "Une erreur est survenue.");
  }
};

const onConfirmSale = async () => {
  if (!tokenIdNumber) return;
  try {
    await handleListForSale(tokenIdNumber, price);
    toast({
      title: "Haiku mis en vente !",
      description: `Le haiku est maintenant en vente pour ${price} ETH`,
      status: "success",
      duration: 5000,
      isClosable: true,
    });
    onClose();
  } catch (err) {
    toast({
      title: "Erreur",
      description: "Impossible de mettre en vente le haiku.",
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  }
};


// Mettre en vente un token
const handleListForSale = async (tokenId: number, price: string) => {
    if (!web3 || !accounts.length) {
        alert("Connectez votre wallet pour mettre en vente un haiku.");
        return;
    }

    try {
        if (!provider) {
            throw new Error('Ethereum provider is not available. Veuillez installer MetaMask.');
        }

        if (!contractAddress) {
            throw new Error('Contract address is not defined. Vérifiez vos variables d’environnement.');
        }

        // Vérifie que le prix est valide
        const priceFloat = parseFloat(price);
        if (isNaN(priceFloat) || priceFloat <= 0) {
            alert("Le prix doit être un nombre supérieur à 0.");
            return;
        }

        // Conversion en Wei
        const priceInWei = web3.utils.toWei(price, "ether");

        const contract = new web3.eth.Contract(ABI as any, contractAddress);

        // Appel du smart contract
        const tx = await contract.methods.listEditionForSale(tokenId, priceInWei).send({
            from: accounts[0],
        });

        await tx;

        alert(`Haiku #${tokenId} mis en vente pour ${price} ETH.`);
    } catch (error) {
        console.error("Erreur lors de la mise en vente du haiku:", error);
    }
};


// Retirer de la vente
const handleRemoveFromSale = async (tokenId: number) => {
    if (!web3 || !accounts.length) {
        alert("Connectez votre wallet pour retirer un haiku de la vente.");
        return;
    }

    try {
        if (!provider) {
            throw new Error('Ethereum provider is not available. Veuillez installer MetaMask.');
        }

        if (!contractAddress) {
            throw new Error('Contract address is not defined. Vérifiez vos variables d’environnement.');
        }

        const contract = new web3.eth.Contract(ABI as any, contractAddress);

        const isForSale = await contract.methods.isNFTForSale(tokenId).call();
        if (!isForSale) {
            alert("Ce haiku n’est pas actuellement en vente.");
            return;
        }

        const tx = await contract.methods.removeEditionFromSale(tokenId).send({
            from: accounts[0],
        });

        await tx;

        alert(`Haiku #${tokenId} retiré de la vente.`);
    } catch (error) {
        console.error("Erreur lors du retrait de la vente du haiku:", error);
    }
};


// Brûler un token
const handleBurn = async (tokenId: number) => {
    if (!web3 || !accounts.length) {
        alert("Connectez votre wallet pour brûler un haiku.");
        return;
    }

    try {
        if (!provider) {
            throw new Error('Ethereum provider is not available. Veuillez installer MetaMask.');
        }

        if (!contractAddress) {
            throw new Error('Contract address is not defined. Vérifiez vos variables d’environnement.');
        }

        const contract = new web3.eth.Contract(ABI as any, contractAddress);

        // Vérifie que le token n’est pas en vente (contrat le fait aussi, mais utile côté front)
        const isForSale = await contract.methods.isNFTForSale(tokenId).call();
        if (isForSale) {
            alert("Impossible de brûler un haiku en vente. Retirez-le d’abord de la vente.");
            return;
        }

        const tx = await contract.methods.burnMultiple([tokenId]).send({
            from: accounts[0],
        });

        await tx;

        alert(`Haiku #${tokenId} brûlé avec succès.`);
    } catch (error) {
        console.error("Erreur lors du burn du haiku:", error);
    }
};




  if (isLoading) return <Spinner size="xl" />;
  if (!poemData) return <Text>{errorMessage || "Poème introuvable"}</Text>;

  const tokenIdNumber = tokenId ? parseInt(tokenId as string, 10) : undefined;


    // Fonction pour raccourcir l'adresse Ethereum
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

//Owners est la liste des ^roprietaires de l'oeurve, on regarde qui est dans la liste
const isUserOwner =
  Owner.some(o => o.owner.toLowerCase() === address?.toLowerCase()) ||
  poemData?.author?.toLowerCase() === address?.toLowerCase();


  // fonction pour transformer ton historique brut en quelque chose de lisible
  const formattedTransactions = poemData?.transactionHistory?.map((tx: any) => ({
    oldOwner: tx.to,      // ou tx.seller selon ton mapping
    newOwner: tx.from,        // ou tx.buyer
    price: tx.price,
    date: tx.date,
  })) || [];


    if (isLoading) return <Spinner size="xl" />;
    if (!poemData) return <Text>{errorMessage || "Poème introuvable"}</Text>;

    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
        padding={{ base: 6, md: 10 }}
        margin="20px auto"
        gap={{ base: 4, md: 6 }}
        maxW="container.xl"  // ✅ Container Chakra standard
        mx="auto"
        overflowX="hidden"
      >
        {/* Titre principal */}
        <Heading
          size={{ base: "2xl", md: "3xl" }}
          mb={4}
          bgGradient="linear(to-r, brand.gold, brand.gold)"
          bgClip="text"
        >
          {poemData.title}
        </Heading>

        <Divider my={8} borderColor="brand.gold" />

        {/* Poème encadré */}
        <Box
          w={{ base: "95%", md: "85%", lg: "75%" }}  // ✅ Large mais respirant
          maxW="900px"
          mx="auto"
          p={{ base: 8, md: 12 }}
          mb={12}
          border="2px solid"
          borderColor="brand.gold"
          borderRadius="2xl"
          boxShadow="0 12px 48px rgba(238, 212, 132, 0.25)"
          backdropFilter="blur(16px)"
        >
          <VStack spacing={6} textAlign="center" px={8}>
            {poemData.text
              ? poemData.text.split("\n").map((line, i) => (
                  <Text
                    key={i}
                    fontStyle="italic"
                    fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
                    lineHeight={1.8}
                    fontWeight="600"
                    color="brand.gold"
                    letterSpacing="0.5px"
                  >
                    {line}
                  </Text>
                ))
              : <Text fontSize="xl" fontWeight="500">Pas de poème disponible</Text>
            }
          </VStack>
        </Box>



        {/* Infos rapides */}
        <VStack spacing={3} w="100%" maxW="500px">
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
            Auteur :{' '}
            <CopyableAddress address={poemData.author} size="md" />
          </Text>

          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="brand.gold">
            Prix : {poemData.price} ETH
            {poemData.priceEur !== "0" && ` (~${poemData.priceEur} €)`}
          </Text>
        </VStack>

        {/* Actions principales */}
        <Box w="100%" maxW="500px" mb={8}>
          {isEditionForSale && poemData?.remainingEditions !== "0" ? (
            tokenIdNumber !== undefined ? (
              <Box w="100%" maxW="400px" mx="auto" mb={8}>  {/* ✅ Container centré fixe */}
                <Button
                  size={{ base: "lg", md: "xl" }}
                  w="full"  // ✅ Pleine largeur du container
                  h={{ base: "14", md: "16" }}  // ✅ Hauteur fixe cohérente
                  colorScheme="brand.gold"
                  bgGradient="linear(to-r, brand.gold, brand.gold)"  // ✅ Gradient gold/navy
                  color="brand.navy"
                  fontWeight="extrabold"
                  fontSize={{ base: "lg", md: "xl" }}
                  borderRadius="2xl"
                  boxShadow="0 12px 40px rgba(238, 212, 132, 0.4)"
                  _hover={{
                    transform: "translateY(-4px) scale(1.02)",
                    boxShadow: "0 20px 60px rgba(238, 212, 132, 0.6)",
                    bgGradient: "linear(to-r, brand.cream, brand.cream)"
                  }}
                  _active={{
                    transform: "translateY(-2px) scale(0.98)"
                  }}
                  transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  onClick={() => tokenIdNumber && handleBuy(tokenIdNumber)}
                >
                  💎 Acheter maintenant
                </Button>
              </Box>

            ) : <Text color="brand.gold.500">Token ID indisponible</Text>
          ) : isUserOwner ? (
            <HStack spacing={3} w="full" flexWrap="wrap" justify="center">
              <Text fontSize="lg" fontWeight="bold" color="brand.navy">
                Vous êtes propriétaire
              </Text>
              {tokenIdNumber !== undefined && (
                <>
                  <Button size="md" onClick={onOpen} colorScheme="teal">
                    Mettre en vente
                  </Button>
                  <Button
                    size="md"
                    onClick={() => tokenIdNumber && handleRemoveFromSale(tokenIdNumber)}
                    colorScheme="orange"
                  >
                    Retirer de la vente
                  </Button>
                  <Button
                    size="md"
                    colorScheme="red"
                    onClick={() => tokenIdNumber && handleBurn(tokenIdNumber)}
                  >
                    Brûler
                  </Button>
                </>
              )}
            </HStack>
          ) : (
            <Text fontSize="lg" color="brand.gold.600">
              Ce poème n’est pas en vente actuellement
            </Text>
          )}
        </Box>

        {/* Modal vente (inchangé mais mieux stylé) */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent borderRadius="2xl" bgGradient="linear(to-b, brand.cream, whiteAlpha.900)">
            <ModalHeader bg="brand.gold" borderRadius="xl">
              Mettre en vente le haiku
            </ModalHeader>
            <ModalCloseButton color="brand.navy" />
            <ModalBody py={8}>
              <Input
                placeholder="Prix en ETH"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                size="lg"
                borderColor="brand.gold"
                _focus={{ borderColor: "brand.navy", boxShadow: "0 0 0 3px rgba(238, 212, 132, 0.2)" }}
              />
            </ModalBody>
            <ModalFooter>
              <Button size="lg" colorScheme="brand.gold" mr={3} onClick={onConfirmSale}>
                Confirmer
              </Button>
              <Button size="lg" onClick={onClose}>Annuler</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Badge featured */}
        {isFeatured && (
          <Badge
            px={6} py={3}
            fontSize="lg"
            colorScheme="cream"
            borderRadius="full"
            boxShadow="0 4px 12px rgba(34, 197, 94, 0.3)"
          >
            ✅ Collection mise en avant par les adhérents !
          </Badge>
        )}

        <Divider my={12} borderColor="brand.gold" />

        {/* Accordion détails (amélioré) */}
        <Accordion allowToggle w="100%" maxW="container.lg">
          <AccordionItem
            border="2px solid"
            borderColor="brand.gold"
            borderRadius="2xl"
            mb={4}
            _expanded={{ boxShadow: "0 12px 40px rgba(238, 212, 132, 0.3)" }}
          >
            <AccordionButton py={8} _expanded={{ bg: "brand.navy", borderRadius: "2xl" }}>
              <Box flex="1" textAlign="center" fontWeight="bold" fontSize={{ base: "lg", md: "xl" }}>
                {poemData.remainingEditions ? (
                  <Text color="brand.gold">
                    Il reste <strong>{poemData.remainingEditions}</strong> éditions disponibles
                  </Text>
                ) : (
                  <Text color="brand.gold.600">
                    Malheureusement, plus aucune édition n’est à vendre
                  </Text>
                )}
              </Box>
              <AccordionIcon color="brand.gold" boxSize={8} />
            </AccordionButton>

            <AccordionPanel pb={10}>
              {/* Infos contrat */}
              <VStack align="start" spacing={4} mb={8} w="100%">
                <Text fontWeight="bold" fontSize="lg" >
                  📜 Contrat : <CopyableAddress address={poemData.contrat} size="md" />
                </Text>
                <Text fontWeight="bold" fontSize="lg">
                  🗓 Date de mint : {new Date(Number(poemData.mintDate) * 1000).toLocaleDateString()}
                </Text>
                <HStack>
                  <Text fontWeight="bold">Total éditions :</Text>
                  <Text fontWeight="extrabold" fontSize="xl" color="brand.gold">
                    {poemData.totalEditions}
                  </Text>
                  <Text fontWeight="bold">/ Restantes :</Text>
                  <Text fontWeight="extrabold" fontSize="xl">
                    {poemData.remainingEditions}
                  </Text>
                </HStack>
              </VStack>


                       {/* ✅ Liste des propriétaires */}
                       {poemData.owners?.length > 0 && (
                         <Box mb={8} w="100%" overflowX="auto">
                           <Heading size="sm" mb={3}>
                             👥 Propriétaires
                           </Heading>
                           <List spacing={2} pl={4} minW="300px">
                             {poemData.owners.map((owner, index) => (
                               <ListItem key={index}>
                                 <CopyableAddress address={owner.owner} size="md" /> —{" "}
                                 <strong>{owner.count}</strong> édition(s)
                               </ListItem>
                             ))}
                           </List>
                         </Box>
                       )}

                       {/* ✅ Historique des transactions */}
                       {formattedTransactions.length > 0 && (
                         <Box mb={8} w="100%" overflowX="auto">
                           <Heading size="sm" mb={3}>
                             📊 Historique des Transactions
                           </Heading>
                           <Box overflowX="auto" borderWidth="1px" borderRadius="md">
                             <Table variant="striped" size="sm" minW="600px">
                               <Thead bg="black.100">
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
                           </Box>
                         </Box>
                       )}

                       {/* ✅ Section achat */}
                       <Box w="100%" overflowX="auto">
                         <Heading size="sm" mb={3}>
                           💎 Achetez des éditions
                         </Heading>
                         <Wrap spacing={4} justify="center">
                           {poems.map((poem) => (
                             <WrapItem key={poem.tokenId}>
                               <Button
                                 onClick={() => handleBuy(Number(poem.tokenId))}
                                 colorScheme={
                                   Number(poem.availableEditions) === 0 ? "black" : "teal"
                                 }
                                 size="md"
                                 variant="outline"
                               >
                                 {Number(poem.availableEditions) === 0
                                   ? `Épuisé`
                                   : `Token #${poem.tokenId} — ${poem.price} ETH (~${poem.priceEur} €)`}
                               </Button>
                             </WrapItem>
                           ))}
                         </Wrap>
                       </Box>
                     </AccordionPanel>
                   </AccordionItem>
                 </Accordion>


        {/* Composants enfants (UserEditionsManager, PoetryGallery, etc.) */}
        {address && (
          <UserEditionsManager
            mintContractAddress={String(contractAddress)}
            userAddress={address}
            onListForSale={handleListForSale}
            onRemoveFromSale={handleRemoveFromSale}
            onBurn={handleBurn}
            onBuy={handleBuy}
            pageSize={20}
          />
        )}

        <Divider my={12} />
        <PoetryGallery collectionAddress={contractAddress!} />
        <Divider my={12} />

        <Box w="100%" maxW="container.xl">
          {poemData.author && <FilteredCollectionsCarousel creator={poemData.author} />}
        </Box>
      </Box>
    );

  };

  export default PoemPage;
