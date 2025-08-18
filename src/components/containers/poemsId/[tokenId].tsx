import { useEffect, useState} from 'react';
import { useRouter } from 'next/router';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { JsonRpcProvider, Contract, ethers, formatUnits } from 'ethers';
import ABI from '../../../components/ABI/HaikuEditions.json'; // Votre ABI pour les poèmes
import { useAuth } from '../../../utils/authContext';
import { Box, Text, Heading, VStack, Spinner, useToast, List, ListItem, Table,Thead,Tbody,Tr,Th,Td} from '@chakra-ui/react';
import PoetryGallery from "./PoesieGalerieProps";
import TextCard from "../galerie/TextCard";

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

interface PoemOwner {
  owner: string;
  count: number; // Nombre d'éditions possédées par ce propriétaire
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
  owners: PoemOwner[]; // Liste des propriétaires
  priceHistory: number[]; // Historique des prix
  totalEditions: number; // Total des éditions
  remainingEditions: number; // Éditions restantes
  transactionHistory: number[];
}

const PoemPage: React.FC = () => {
  const router = useRouter();
  const { tokenId, contractAddress } = router.query as { tokenId?: string; contractAddress?: string };
  const { address: authAddress } = useAuth();
  const toast = useToast();

  const { web3, address } = useAuth();

  const [poemData, setPoemData] = useState<PoemData | null>(null);
  const [Poemm, setPoem] = useState<Poem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);


  useEffect(() => {
    const setupWeb3 = async () => {
      const provider = (await detectEthereumProvider()) as any;
      if (provider) {
        const web3Instance = new Web3(provider);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
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

        const details = await contract.getTokenFullDetails(Number(tokenId));


        if (!details) throw new Error('Poème inexistant');

        // Obtention des détails supplémentaires
        const haikuId = tokenId; // Récupérer l'ID du haiku
        const haikuData = await contract.haikus(haikuId); // Récupérer les détails de l'haiku

        const remainingEditions = await contract.getRemainingEditions(haikuId); // Éditions restantes


        const premierToDernier = await contract.getHaikuInfoUnique(haikuId);
        const premierIDDeLaSerie = Number(premierToDernier[0]);
        const nombreHaikusParSerie = Number(premierToDernier[1]);
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

        const availableEditions = await contract.getRemainingEditions(haikuId);
        const totalMinted = nombreHaikusParSerie - Number(availableEditions);
        const collection = await contract.collectionId();

        setPoemData({
                contrat:contractAddress,
                owner: details.owner,
                mintDate: details.mintDate,
                title: details.name,
                text: details[6],
                author: details.artist,
                forsale: details.forSale,
                price: formatUnits(details.currentPrice, 18),
                collectionId: Number(collection),
                owners: owners,
                priceHistory: (haikuData.priceHistory || []).map((p: bigint) => formatUnits(p, 18)),
                totalEditions: nombreHaikusParSerie,
                remainingEditions: availableEditions,
                transactionHistory: formattedTxHistory
              });


              const poem: Poem = {
                tokenId: tokenId.toString(),
                poemText: details[6],
                creatorAddress: details.owner.toString(),
                totalEditions: nombreHaikusParSerie.toString(),
                mintContractAddress: contractAddress,
                price: formatUnits(details.currentPrice, 18).toString(),
                totalMinted: totalMinted.toString(), // ← totalMinted n'est jamais défini
                availableEditions: "...",
                isForSale: details.forSale,
                tokenIdsForSale: [],
              };

              setSelectedCollectionId(collection);
              setPoem(poem);

      } catch (err: any) {
        setErrorMessage(err.message || 'Erreur lors de la récupération du poème');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoemData();

  }, [router.isReady, contractAddress, tokenId]);

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


  const handleBuy = async (nft: Poem, tokenId: number) => {
    if (!web3 || !address) {
        alert("Connectez votre wallet pour acheter un haiku.");
        return;
    }

    console.log(`Début du processus d'achat pour le haiku avec l'ID de token : ${tokenId}`);

    try {
        const contract = new web3.eth.Contract(ABI, nft.mintContractAddress);
        const isForSale = await contract.methods.isNFTForSale(tokenId).call();
        console.log(`Le haiku ${tokenId} est-il à vendre ? ${isForSale}`);

        if (!isForSale) {
            alert("Ce haiku n'est pas en vente.");
            return;
        }



        if (Number(nft.tokenIdsForSale) <= 0) {
            alert("Plus d'éditions disponibles.");
            return;
        }

        const receipt = await contract.methods.buyEdition(tokenId).send({ from: address, value: nft.price });
        alert("Haiku acheté avec succès !");
        console.log("Détails de la transaction :", receipt);

    } catch (error: any) {
        console.error("Erreur lors de l'achat :", error);
        alert("Erreur lors de l'achat : " + (error.message || "inconnue"));
    }
};

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
    <Box padding={4}>
      <Heading>{poemData.title}</Heading>
      <Text fontWeight="bold">Contrat : {poemData.contrat}</Text>

      <Text fontSize="lg">Auteur : {poemData.owner}</Text>
      <VStack textAlign="center" color="white" maxWidth="120%">
        {poemData.text
          ? poemData.text.split("\n").map((line, i) => (
              <Text key={i} fontStyle="italic" fontSize="sm">
                {line}
              </Text>
            ))
          : "Pas de poème disponible"}
      </VStack>
      <Text fontWeight="bold">Prix : {poemData.price} ETH</Text>
      <List spacing={3}>
        {poemData.owners && poemData.owners.length > 0 ? (
          poemData.owners.map((owner, index) => (
            <ListItem key={index}>
              {owner.owner} - {owner.count} éditions
            </ListItem>
          ))
        ) : (
          <ListItem>Aucun propriétaire enregistré.</ListItem>
        )}
      </List>
      <Text fontWeight="bold">Mint Date : {new Date(Number(poemData.mintDate) * 1000).toLocaleDateString()}</Text>
      <Text fontWeight="bold">Total des Éditions : {poemData.totalEditions}</Text>
      <Text fontWeight="bold">Éditions Restantes : {poemData.remainingEditions}</Text>



      <VStack spacing={4} marginTop={6}>
      <Heading size="md">Historique des Transactions</Heading>


      <Box overflowX="auto" w="full">
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
      {Poemm && (
        <TextCard
          key={tokenId}
          nft={Poemm}
          showBuyButton={true}
          onBuy={(tokenId) => handleBuy(Poemm, Number(tokenId))}
        />
      )}
      </VStack>
      <PoetryGallery collectionAddress={contractAddress!} />
    </Box>
  );
};

export default PoemPage;
