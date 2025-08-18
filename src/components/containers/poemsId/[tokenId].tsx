import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import { JsonRpcProvider, Contract, ethers, formatUnits } from 'ethers';
import ABI from '../../../components/ABI/HaikuEditions.json'; // Votre ABI pour les poèmes
import { useAuth } from '../../../utils/authContext';
import {
  Box, Text, Heading, VStack, Spinner, useToast, List, ListItem
} from '@chakra-ui/react';

interface PoemOwner {
  owner: string;
  count: number; // Nombre d'éditions possédées par ce propriétaire
}

interface PoemData {
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
}

const PoemPage: React.FC = () => {
  const router = useRouter();
  const { tokenId, contractAddress } = router.query as { tokenId?: string; contractAddress?: string };
  const { address: authAddress } = useAuth();
  const toast = useToast();

  const [poemData, setPoemData] = useState<PoemData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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

        setPoemData({
          owner: details.owner,
          mintDate: details.mintDate,
          title: details.name,
          text: details.description,
          author: details.artist,
          forsale: details.forSale,
          price: formatUnits(details.currentPrice, 18),
          collectionId: Number(details.collectionId),
          owners: haikuData.owners, // Propriétaires
          priceHistory: haikuData.priceHistory, // Historique des prix
          totalEditions: haikuData.totalEditions, // Total des éditions
          remainingEditions: remainingEditions // Editions restantes
        });
        console.log(poemData);
      } catch (err: any) {
        setErrorMessage(err.message || 'Erreur lors de la récupération du poème');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoemData();
  }, [router.isReady, contractAddress, tokenId]);

  if (isLoading) return <Spinner size="xl" />;
  if (!poemData) return <Text>{errorMessage || "Poème introuvable"}</Text>;

  return (
    <Box padding={4}>
      <Heading>{poemData.title}</Heading>
      <Text fontSize="lg">Auteur : {poemData.author}</Text>
      <Text>{poemData.text}</Text>
      <Text fontWeight="bold">Prix : {poemData.price} ETH</Text>
      <Text fontWeight="bold">Propriétaire : {poemData.owner}</Text>
      <Text fontWeight="bold">Collection ID : {poemData.collectionId}</Text>
      <Text fontWeight="bold">Mint Date : {new Date(Number(poemData.mintDate) * 1000).toLocaleDateString()}</Text>
      <Text fontWeight="bold">Total des Éditions : {poemData.totalEditions}</Text>
      <Text fontWeight="bold">Éditions Restantes : {poemData.remainingEditions}</Text>

      <VStack spacing={4} marginTop={6}>
        <Heading size="md">Historique des Propriétaires</Heading>
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

        <Heading size="md">Historique des Prix</Heading>
        <List spacing={3}>
          {poemData.priceHistory && poemData.priceHistory.length > 0 ? (
            poemData.priceHistory.map((price, index) => (
              <ListItem key={index}>
                {formatUnits(price, 18)} ETH
              </ListItem>
            ))
          ) : (
            <ListItem>Aucun historique de prix disponible.</ListItem>
          )}
        </List>
      </VStack>
    </Box>
  );

};

export default PoemPage;
