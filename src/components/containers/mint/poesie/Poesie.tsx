import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Input,
  Select,
  FormLabel,
  Textarea,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import { ethers } from "ethers";

import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";
import { useAuth } from "@/utils/authContext";
import useEstimateGas from "@/hooks/useEstimateGas"; // Importez votre hook d'estimation de gas


interface Collection {
  id: string;
  name: string;
  type: string;
  owner: string;
  otherData: string;
}

const PoemMintingPage: React.FC = () => {
  const { address, web3 } = useAuth();  // Récupération de l'adresse et de Web3 depuis le contexte
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [poemText, setPoemText] = useState<string>("");
  const [editions, setEditions] = useState<number>(1);
  const [editionsForSale, setEditionsForSale] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [contractAddress, setContractAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const { estimateGas, estimatedCost, isEstimating, estimatedCostEuro} = useEstimateGas(); // Utilisation de votre hook


  useEffect(() => {
    const fetchUserCollections = async () => {
      if (web3 && address) {
        setLoading(true);
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);
        try {
          const result: any = await contract.getCollectionsByUser(address);

          if (Array.isArray(result)) {
            const filteredCollections: Collection[] = result
              .map((collection: any) => ({
                id: collection[0].toString(),
                name: collection[1],
                type: collection[2],
                owner: collection[3],
                otherData: collection[4],
              }))
              .filter((collection) => collection.type === "Poesie");

            setCollections(filteredCollections);
          } else {
            setError("Format de résultat inattendu");
          }
        } catch (err) {
          setError((err as Error).message || "Erreur inconnue");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserCollections();
  }, [web3, address]);


  //On estme les frais de gas dès que tout est remplis
  // Gestion debouncing pour estimer les frais de gas
    useEffect(() => {
      const timer = setTimeout(() => {
        if (contractAddress && poemText && web3 && salePrice && editionsForSale && editions) {
          estimateGas(contractAddress, "mint", [editions, poemText, ethers.parseEther(salePrice ?? "0"), editionsForSale], address!, ABI);
        }
      }, 1000); // 1s après la dernière modification

      return () => clearTimeout(timer); // Nettoyer l'effet
    }, [poemText, salePrice, editions, editionsForSale, contractAddress, web3]);

  const fetchMintingContractAddress = async (collectionId: string) => {
    if (!web3) return;
    try {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contractResCollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);
      const collectionDetails: any = await contractResCollection.getCollection(collectionId);
      const collectionMintAddress: string = collectionDetails.collectionAddress;
      setContractAddress(collectionMintAddress || "");
    } catch (error) {
      toast({
        title: "Erreur lors de la récupération de l'adresse du contrat",
        description: "Quelque chose s'est mal passé. Réessayez plus tard.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };


    const mintPoem = async () => {
      if (!poemText.trim()) {
        toast({
          title: "Poème manquant",
          description: "Le poème ne peut pas être vide.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      if (!selectedCollectionId) {
        toast({
          title: "Sélectionnez une collection",
          description: "Veuillez choisir une collection de poésie.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      if (!contractAddress || !web3) {
        toast({
          title: "Wallet/Contract non prêt",
          description: "Contrat introuvable ou web3 non initialisé.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      if (editions < 1) {
        toast({
          title: "Éditions invalides",
          description: "Le nombre d’éditions doit être au moins 1.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      if (editionsForSale < 0 || editionsForSale > editions) {
        toast({
          title: "Éditions en vente invalides",
          description: "Les éditions en vente doivent être entre 0 et le total.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      try {
        setIsMinting(true);

        const contract = new web3.eth.Contract(ABI as any, contractAddress);
        const accounts = await web3.eth.getAccounts();
        const userAddress = accounts[0];

        // Conversion du prix de vente en wei
        let salePriceInWei = "0";
        if (salePrice.trim()) {
          const normalizedPrice = salePrice.trim(); // Normalisation
          // Vérification du format et conversion
          if (!/^\d+(\.\d+)?$/.test(normalizedPrice)) {
            toast({
              title: "Prix invalide",
              description: "Format de prix invalide. Exemple : 0.001",
              status: "error",
              duration: 3000,
              isClosable: true,
            });
            setIsMinting(false);
            return;
          }
          salePriceInWei = ethers.parseEther(normalizedPrice).toString();
        }



        // Estimate gas (simulation sans exécution complète)
        const gasEstimate = await contract.methods.mint(editions, poemText, salePriceInWei, editionsForSale).estimateGas({ from: userAddress });

        const gasPrice = await web3.eth.getGasPrice();

        // Mint le poème
        await contract.methods
          .mint(editions, poemText, salePriceInWei, editionsForSale)
          .send({ from: userAddress,
            gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
            gasPrice: gasPrice.toString()
           });

        if (salePriceInWei === "0" && editionsForSale > 0) {
          toast({
            title: "Minté (0 ETH)",
            description: "Poème listé à 0 ETH (gratuit).",
            status: "info",
            duration: 3500,
            isClosable: true,
          });
        } else {
          toast({
            title: "Poème Minté !",
            description: "Votre poème a été minté avec succès.",
            status: "success",
            duration: 3000,
            isClosable: true,
          });
        }

        // Reset
        setPoemText("");
        setEditions(1);
        setEditionsForSale(0);
        setSalePrice("");
        setSelectedCollectionId("");
        setContractAddress("");
      } catch (error) {
        console.error("Erreur lors du minting :", error);
        toast({
          title: "Échec du minting",
          description: "Quelque chose s'est mal passé. Réessayez plus tard.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsMinting(false);
      }
    };

    const isMintDisabled =
      !poemText.trim() ||
      !selectedCollectionId ||
      !contractAddress ||
      !web3 ||
      editions < 1 ||
      editionsForSale < 0 ||
      editionsForSale > editions;


  return (
    <Box p={5} maxWidth="640px" mx="auto">
      <FormLabel>Poème</FormLabel>
      <Textarea
        value={poemText}
        onChange={(e) => setPoemText(e.target.value)}
        placeholder={"Écris ton poème ici (tu peux utiliser des retours à la ligne)."}
        rows={6}
      />

      <FormLabel mt={5}>Sélectionnez la collection</FormLabel>
      <Select
        value={selectedCollectionId}
        onChange={(e) => {
          setSelectedCollectionId(e.target.value);
          fetchMintingContractAddress(e.target.value);
        }}
        placeholder={loading ? "Chargement..." : "Sélectionnez une collection de poésie"}
      >
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </Select>

      <FormLabel mt={5}>Nombre d'éditions</FormLabel>
      <Input
        type="number"
        min="1"
        value={editions}
        onChange={(e) => setEditions(Number(e.target.value))}
        placeholder="Nombre d'éditions"
      />

      <FormLabel mt={5}>Nombre d'éditions à vendre</FormLabel>
      <Input
        type="number"
        min="0"
        max={editions}
        value={editionsForSale}
        onChange={(e) => setEditionsForSale(Number(e.target.value))}
        placeholder="Éditions à vendre (0 au total)"
      />

      <FormLabel mt={5}>Prix de vente (en ETH)</FormLabel>
      <Input
        type="text"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        placeholder="ex: 0.001 (laisser vide = gratuit)"
      />

      {salePrice.trim() === "" && editionsForSale > 0 && (
        <Alert status="warning" mt={3} borderRadius="md">
          <AlertIcon />
          Attention : ce poème sera listé pour <strong>0 ETH</strong> si vous laissez le prix vide.
        </Alert>
      )}

      <Button
          mt={4}
          colorScheme="teal"
          onClick={mintPoem}
          isLoading={isMinting}
          isDisabled={isMintDisabled} // Utilisez une fonction pour déterminer si le bouton est désactivé
      >
          Mint Poème
          {isEstimating && <span>...Estimating gas costs...</span>}
          {estimatedCost && !isEstimating && (
              <span> - Estimated cost: {estimatedCostEuro} €</span>
          )}
      </Button>


    </Box>
  );
};

export default PoemMintingPage;
