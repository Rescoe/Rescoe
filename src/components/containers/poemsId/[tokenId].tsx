import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import { ethers } from 'ethers';

import ABI from '../../../components/ABI/HaikuEditions.json';
import ABIRESCOLLECTION from '../../../components/ABI/ABI_Collections.json';
import { useAuth } from '../../../utils/authContext';
import { Box, Text, Heading, VStack, Spinner, useToast, Button, List, ListItem, Table, Thead, Tbody, Tr, Th, Td, Divider, Grid, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon } from '@chakra-ui/react';
import PoetryGallery from "./PoesieGalerieProps";
import TextCard from "../galerie/TextCard";
import { FramedText } from '../../../utils/Cadre';

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
  const toast = useToast();

  const [provider, setProvider] = useState<any>(null);
  const [accounts, setAccounts] = useState<string[]>([]);

  const [thisTokenforSale, setThisTokenforSale] = useState<boolean>(false);
  const [PoemPrice, setPoemPrice] = useState('');
  const [poemData, setPoemData] = useState<PoemData | null>(null);
  const [poems, setPoems] = useState<Poem[]>([]); // Utiliser un tableau pour les poèmes
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFeatured, setIsFeatured] = useState<boolean>(false);

  const [isOwner, setIsOwner] = useState('');
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const [editionsForSale, setEditionsForSale] = useState<Poem[]>([]);


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
            console.log("tokenIdtoHaikuUnique");

            console.log(tokenIdtoHaikuUnique);

            const details = await contract.getTokenFullDetails(Number(tokenId));

            setIsOwner(details.owner);
            console.log(isOwner);

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

            setThisTokenforSale(details[3]);

            // Récupération et mapping de l’historique
            // Récupération de l’historique (et on sécurise si pas de résultat)
            const txHistory = await contract.getTransactionHistory(haikuId);
            const formattedTxHistory = (txHistory || []).map((tx: any) => ({
              from: tx[0],
              to: tx[1],
              price: formatUnits(tx[2] ?? BigInt(0), 18),
              date: new Date(Number(tx[3] ?? 0) * 1000).toLocaleString()
            }));

            const owners = computeOwnersFromHistory(txHistory);


            const collection = await contract.collectionId();

            const collectionDatas = await contractCollection.collections(collection);
            setIsFeatured(collectionDatas[6]);

            setPoemData({
                    contrat:contractAddress,
                    owner: details.owner,
                    mintDate: details.mintDate,
                    title: collectionDatas[1],
                    text: details[6],
                    author: details.artist,
                    forsale: thisTokenforSale,
                    price: formatUnits(details.currentPrice, 18),
                    collectionId: Number(collection),
                    owners: owners,
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
const handleBuy = async (tokenId: number) => { // Assurez-vous de recevoir tokenId
    if (!web3 || !accounts.length) {
        alert("Connectez votre wallet pour acheter un haiku.");
        return;
    }

    try {
        if (!provider) {
            throw new Error('Ethereum provider is not available. Please install MetaMask or another Ethereum wallet.');
        }

        // Assurez-vous que contractAddress est défini
        if (!contractAddress) {
            throw new Error('Contract address is not defined. Please check your environment variables.');
        }

        // Vérifiez si poemData est défini
        if (!poemData) {
            alert("Données du poème non disponibles.");
            return; // Ou gérer le cas d'une manière appropriée
        }

        // Vérifiez que poemData.price est un nombre valide
        const price = parseFloat(poemData.price); // Convertir en nombre flottant
        if (isNaN(price)) {
            alert("Le prix du poème est invalide.");
            return;
        }

        const signer = provider.getSigner(); // Utilise le provider configuré
        const contract = new web3.eth.Contract(ABI as any, contractAddress);

        const isForSale = await contract.methods.isNFTForSale(tokenId).call(); // Récupérer la valeur avec call
        if (!isForSale) {
            alert("Ce haiku n'est pas en vente.");
            return;
        }

        // Calculez le prix en Wei
        const priceInWei = web3.utils.toWei(price, "ether");
        const tx = await contract.methods.buyEdition(tokenId).send({ value: priceInWei });

        await tx;

        alert("Haiku acheté avec succès !");
    } catch (error) {
        console.error("Error while buying the haiku:", error);
    }
};



  if (isLoading) return <Spinner size="xl" />;
  if (!poemData) return <Text>{errorMessage || "Poème introuvable"}</Text>;

  const tokenIdNumber = tokenId ? parseInt(tokenId as string, 10) : undefined;

  const formatAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "N/A";

  // fonction pour transformer ton historique brut en quelque chose de lisible
  const formattedTransactions = poemData?.transactionHistory?.map((tx: any) => ({
    oldOwner: tx.from,      // ou tx.seller selon ton mapping
    newOwner: tx.to,        // ou tx.buyer
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



    <Text fontSize="lg">Auteur : {poemData.owner}</Text>

   <Text fontWeight="bold">Prix : {poemData.price} ETH</Text>

   <Text>
     {thisTokenforSale && address?.toLowerCase() !== isOwner?.toLowerCase() ? (
       tokenId !== undefined ? (
         <Button
           onClick={() => tokenIdNumber !== undefined && handleBuy(tokenIdNumber)}
         >
           Acheter
         </Button>       ) : (
         <Text>Token ID est indisponible.</Text>
       )
     ) : (
       <Text>
         <strong>Vous êtes propriétaire de ce poème</strong>
       </Text>
     )}
   </Text>


   <Text>
     {isFeatured ? (
       <>
       <strong>  ✅ Cette collection a été mise en avant par la communauté !</strong>
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
      </Box>
    );
  };

  export default PoemPage;
