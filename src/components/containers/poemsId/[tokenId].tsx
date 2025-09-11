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
  Stack
 } from '@chakra-ui/react';
import PoetryGallery from "./PoesieGalerieProps";
import TextCard from "../galerie/TextCard";
import { FramedText } from '../../../utils/Cadre';

//UseUsercollection ne sert a rien dans ce FaCode
//il fauut l'améliorer pour qu'il face mieux que le FilteredCollectionsCarousel

import { useUserCollections } from "../../../hooks/useUserCollections";
import {FilteredCollectionsCarousel} from '../galerie/art';

import { BrowserProvider, Eip1193Provider } from "ethers";


interface Poem {
  tokenId: string;
  poemText: string;
  creatorAddress: string;
  totalEditions: string;
  mintContractAddress: string;
  price: string;
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

  const [thisTokenforSale, setThisTokenforSale] = useState<boolean>(false);
  const [PoemPrice, setPoemPrice] = useState('');
  const [poemData, setPoemData] = useState<PoemData | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]); // Utiliser un tableau pour les poèmes
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);

  const [isCreator, setIsCreator] = useState('');
  const [Owner, setOwner] = useState<{ owner: string; count: number }[]>([]);


  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const [editionsForSale, setEditionsForSale] = useState<Poem[]>([]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [price, setPrice] = useState('');




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
    if (!router.isReady || !contractAddress || !tokenId) return;

    const fetchPoemData = async () => {
          try {
            const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
            const contract = new Contract(contractAddress, ABI, provider);
            const contractCollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);


            const tokenIdtoHaikuUnique = await contract.tokenIdToHaikuId(tokenId);

            const details = await contract.getTokenFullDetails(Number(tokenId));

            setIsCreator(details[7]);
            console.log(details);

            if (!details) throw new Error('Poème inexistant');

            // Obtention des détails supplémentaires
            const haikuId = tokenId; // Récupérer l'ID du haiku
            const haikuData = await contract.haikus(tokenIdtoHaikuUnique); // Récupérer les détails de l'haiku



            const premierToDernier = await contract.getHaikuInfoUnique(tokenIdtoHaikuUnique);
            const premierIDDeLaSerie = Number(premierToDernier[0]);
            const nombreHaikusParSerie = Number(premierToDernier[1]);

            const availableEditions = await contract.getRemainingEditions(tokenIdtoHaikuUnique);
            const totalMinted = nombreHaikusParSerie - Number(availableEditions);

            const editionsRestantes = Number(haikuData[2]-haikuData[4]).toString(); // Éditions restantes = TotalMinted - TotalSold

            setThisTokenforSale(Number(availableEditions) > 0);

            // Récupération et mapping de l’historique
            // Récupération de l’historique (et on sécurise si pas de résultat)
            const txHistory = await contract.getTransactionHistory(haikuId);
            const formattedTxHistory = (txHistory || []).map((tx: any) => ({
              from: tx[0],
              to: tx[1],
              price: formatUnits(tx[2] ?? BigInt(0), 18),
              date: new Date(Number(tx[3] ?? 0) * 1000).toLocaleString()
            }));

              setOwner(computeOwnersFromHistory(txHistory));

            const collection = await contract.collectionId();

            const collectionDatas = await contractCollection.collections(collection);
            setIsFeatured(collectionDatas[6]);

            setPoemData({
                    contrat:contractAddress,
                    owner: details.owner,
                    mintDate: details.mintDate,
                    title: collectionDatas[1],
                    text: details[6],
                    author: isCreator,
                    forsale: thisTokenforSale,
                    price: formatUnits(details.currentPrice, 18),
                    collectionId: Number(collection),
                    owners: Owner,
                    priceHistory: (haikuData.priceHistory || []).map((p: bigint) => formatUnits(p, 18)),
                    totalEditions: nombreHaikusParSerie,
                    remainingEditions: editionsRestantes,
                    transactionHistory: formattedTxHistory
                  });


                  const poem: Poem = {
                    tokenId: tokenId,
                    poemText: details[6],
                    creatorAddress: details.artist.toString(),
                    totalEditions: nombreHaikusParSerie.toString(),
                    mintContractAddress: contractAddress,
                    price: formatUnits(details.currentPrice, 18),
                    totalMinted: totalMinted.toString(),
                    availableEditions: editionsRestantes, // ⏳ placeholder
                    isForSale: details[3],
                    tokenIdsForSale: [], // ⏳ placeholder
                  };


                //setPoemPrice(haikuData[3]);
                  setPoems([poem]);

/*
                  // 🔹 On lance la récupération "asynchrone" après coup
                  fetchTokenIdsForSale(contractAddress, premierIDDeLaSerie, nombreHaikusParSerie)
                    .then((tokenIdsForSale) => {
                      const nbAVendre = tokenIdsForSale.length;

                      // Mise à jour en remplaçant uniquement les champs dépendants
                      setPoems((prevPoems) =>
                        prevPoems.map((p) =>
                          p.tokenId === poem.tokenId
                            ? { ...p, availableEditions: nbAVendre.toString(), tokenIdsForSale }
                            : p
                        )
                      );
                    });

*/

          } catch (err: any) {
            setErrorMessage(err.message || 'Erreur lors de la récupération du poème');
          } finally {
            setIsLoading(false);
          }
        };

        fetchPoemData();

      }, [router.isReady, contractAddress, tokenId]);

      // Utilisation du hooks de récupération des collections d'artistes
      const { collections: poetryCollections, isLoading: isLoadingCollections } =
      useUserCollections(poemData?.author);
      console.log(poemData?.author);

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

  const formatAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "N/A";

//Owners est la liste des ^roprietaires de l'oeurve, on regarde qui est dans la liste
const isUserOwner = Owner.some(
  o => o.owner.toLowerCase() === address?.toLowerCase());

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
        padding={10}
        margin="20px auto"
        gap={6} // espace vertical constant
      >
        <Heading>{poemData.title}</Heading>

        <FramedText>
          <VStack textAlign="center" maxWidth="120%">
            {poemData.text
              ? poemData.text.split("\n").map((line, i) => (
                  <Text
                    key={i}
                    fontStyle="italic"
                    fontSize="sm"
                    color="teal.900" // couleur visible sur fond clair
                  >
                    {line}
                  </Text>
                ))
              : (
                  <Text color="teal.900">Pas de poème disponible</Text>
                )}
          </VStack>
        </FramedText>

   <Divider/>

   <Text fontSize="lg">Auteur : {poemData.author}</Text>

   <Text fontWeight="bold">Prix : {poemData.price} ETH</Text>

   <Text>
     {/* Cas où le poème est en vente et qu'il reste des éditions */}
     {thisTokenforSale && poemData?.remainingEditions !== "0" ? (
       tokenIdNumber !== undefined ? (
         <Button onClick={() => tokenIdNumber && handleBuy(tokenIdNumber)}>
           Acheter
         </Button>
       ) : (
         <Text>Token ID est indisponible.</Text>
       )
     ) : isUserOwner ? (
       <>
         <Text>
           <strong>Vous êtes propriétaire de ce poème</strong>
         </Text>

         {tokenIdNumber !== undefined ? (
           <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
             {/* Bouton Mettre en vente */}
             <Button onClick={onOpen}>Mettre en vente</Button>

             {/* Modal pour saisir le prix */}
             <Modal isOpen={isOpen} onClose={onClose}>
               <ModalOverlay />
               <ModalContent>
                 <ModalHeader>Mettre en vente le haiku</ModalHeader>
                 <ModalCloseButton />
                 <ModalBody>
                   <Input
                     placeholder="Prix en ETH"
                     value={price}
                     onChange={(e) => setPrice(e.target.value)}
                   />
                 </ModalBody>
                 <ModalFooter>
                   <Button colorScheme="blue" mr={3} onClick={onConfirmSale}>
                     Confirmer
                   </Button>
                   <Button onClick={onClose}>Annuler</Button>
                 </ModalFooter>
               </ModalContent>
             </Modal>

             {/* Bouton retirer de la vente */}
             <Button onClick={() => tokenIdNumber && handleRemoveFromSale(tokenIdNumber)}>
               Retirer de la vente
             </Button>

             {/* Bouton burn */}
             <Button colorScheme="red" onClick={() => tokenIdNumber && handleBurn(tokenIdNumber)}>
               Brûler
             </Button>
           </div>
         ) : (
           <Text>Token ID est indisponible.</Text>
         )}
       </>
     ) : (
       <Text>Ce poème n’est pas en vente actuellement.</Text>
     )}
   </Text>




   <Text>
     {isFeatured ? (
       <>
       <strong>  ✅ Cette collection a été mise en avant par les adhérents !</strong>
       </>
     ) : null}
   </Text>
         <Divider/>

         <Text>
           {poemData.remainingEditions ? (
             <>
             <VStack>
               <strong>  Il reste des éditions : </strong>

{/*
               {poems.map((poem) => (
                 <Box key={poem.tokenId}>
                   <Button
                     onClick={() => handleBuy(poem)} // Passer le poème entier
                     colorScheme={Number(poem.availableEditions) === 0 ? 'gray' : 'teal'}
                     size="sm"
                     isDisabled={Number(poem.availableEditions) === 0}
                   >
                     {Number(poem.availableEditions) === 0 ? 'Épuisé' : 'Acheter'}
                   </Button>
                 </Box>
               ))}
*/}


               </VStack>
             </>
           ) :
          <strong>  Malheureusement plus aucune edition n'est à vendre </strong>
        }
         </Text>


   <Accordion allowToggle>
    <AccordionItem>
      <h2>
        <AccordionButton>
          <Box flex="1" textAlign="center" fontWeight="bold">
            Plus de données
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </h2>
      <AccordionPanel pb={4}>

      <Text fontWeight="bold">Contrat : {poemData.contrat}</Text>

        <List spacing={3}>
          {poemData.owners && poemData.owners.length > 0 ? (
            poemData.owners.map((owner, index) => (
              <ListItem key={index}>
                {owner.owner} - {owner.count} éditions
              </ListItem>
            ))
          ) : null}
        </List>
        <Text fontWeight="bold">Mint Date : {new Date(Number(poemData.mintDate) * 1000).toLocaleDateString()}</Text>
        <Text fontWeight="bold">Total des Éditions crées : {poemData.totalEditions}</Text>
        <Text fontWeight="bold">Nombre d'éditions restantes : {poemData.remainingEditions}</Text>

        <VStack spacing={4} marginTop={6}>

        {poemData.owners && poemData.owners.length > 0 ? (
          <Box overflowX="auto" w="full">

          <Heading size="md">Historique des Transactions</Heading>
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
            </Box>

        ) :null }

        </VStack>

        </AccordionPanel>
      </AccordionItem>
    </Accordion>

  {/*Fin du menu déroulant*/}

        <Divider/>
{/*
        <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={6}>
          {poems.map((poem) => (
            <TextCard
              key={poem.tokenId}
              nft={poem}
              showBuyButton={true}
              onBuy={(tokenId) => handleBuy(poem, Number(tokenId))}
            />
          ))}
        </Grid>
*/}
        <PoetryGallery collectionAddress={contractAddress!} />

{/* ICI ON utilise le hooks créer useUserCollection */}
        <Divider mt={8} />

<Heading size="md" mt={6}>
  Collections du poète
</Heading>

{isLoadingCollections ? (
  <Spinner />
) : poetryCollections.length > 0 ? (
  <Grid
    templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }}
    gap={6}
    mt={4}
  >
    {poetryCollections.map((col) => (
      <Box key={col.id} borderWidth="1px" borderRadius="lg" p={4}>
        {col.imageUrl && (
          <Box width="100%" height="150px" overflow="hidden" borderRadius="md">
            <img
              src={col.imageUrl}
              alt={col.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Box>
        )}
        <Text mt={2}>{col.name}</Text>
      </Box>
    ))}
  </Grid>
) : (
  <Text mt={4}>Ce poète n’a pas encore de collections.</Text>
)}

<Divider mt={8} />

<Divider mt={8} />


<Box mt={5} w="full">
  <Stack direction={{ base: "column", md: "row" }} spacing={2}>
  {address && <FilteredCollectionsCarousel creator={address} />}
  </Stack>
</Box>


      </Box>
    );
  };

  export default PoemPage;
