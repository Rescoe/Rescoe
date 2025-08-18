import React, { useState, useEffect } from "react";
import { Box, Button, Input, Select, FormLabel, Textarea, useToast, Alert, AlertIcon } from "@chakra-ui/react";
import Web3 from "web3";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";

interface Collection {
  id: string;
  name: string;
  type: string;
  owner: string;
  otherData: string;
}

const PoemMintingPage: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [poemText, setPoemText] = useState<string>(""); // ← un seul champ
  const [editions, setEditions] = useState<number>(1);
  const [editionsForSale, setEditionsForSale] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<string>(""); // ← string pour éviter les floats JS
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [contractAddress, setContractAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);

  const toast = useToast();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const web3Instance = new Web3((window as any).ethereum);
      setWeb3(web3Instance);
      fetchUserCollections(web3Instance);
    }
  }, []);

  const fetchUserCollections = async (web3Instance: Web3) => {
    try {
      setLoading(true);
      const accounts = await web3Instance.eth.getAccounts();
      const userAddress = accounts[0];

      const contract = new web3Instance.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);
      const result: any = await contract.methods.getCollectionsByUser(userAddress).call();

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
        setError("Unexpected result format");
      }
    } catch (err) {
      setError((err as Error).message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMintingContractAddress = async (collectionId: string) => {
    if (!web3) return;
    try {
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);
      const collectionDetails: any = await contractResCollection.methods.getCollection(collectionId).call();
      const collectionMintAddress: string = collectionDetails.collectionAddress;
      setContractAddress(collectionMintAddress || "");
    } catch (error) {
      toast({
        title: "Error fetching contract address",
        description: "Something went wrong. Please try again later.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Conversion robuste (string décimale → wei). Accepte "0,001" et "0.001".
  const toWeiSafe = (value: string): string => {
    const normalized = String(value).trim().replace(",", ".");
    if (normalized === "") return "0";
    // autoriser 0 / nombre décimal simple
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new Error("Invalid price format");
    }
    return Web3.utils.toWei(normalized, "ether");
  };

  const mintPoem = async () => {
    // validations minimales
    if (!poemText.trim()) {
      toast({
        title: "Missing poem",
        description: "Le poème ne peut pas être vide.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (!selectedCollectionId) {
      toast({
        title: "Select a collection",
        description: "Veuillez choisir une collection de poésie.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (!contractAddress || !web3) {
      toast({
        title: "Wallet/Contract not ready",
        description: "Contrat introuvable ou web3 non initialisé.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (editions < 1) {
      toast({
        title: "Invalid editions",
        description: "Le nombre d’éditions doit être au moins 1.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    if (editionsForSale < 0 || editionsForSale > editions) {
      toast({
        title: "Invalid editions for sale",
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

      // Prix optionnel : vide → 0
      let salePriceInWei = "0";
      try {
        salePriceInWei = toWeiSafe(salePrice);
      } catch (err) {
        toast({
          title: "Invalid price",
          description: "Format de prix invalide. Exemple : 0.001",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        setIsMinting(false);
        return;
      }

      // Mint le haïku
      await contract.methods
        .mint(editions, poemText, salePriceInWei, editionsForSale)
        .send({ from: userAddress });

      if (salePriceInWei === "0" && editionsForSale > 0) {
        toast({
          title: "Minted (0 ETH)",
          description: "Poème listé à 0 ETH (gratuit).",
          status: "info",
          duration: 3500,
          isClosable: true,
        });
      } else {
        toast({
          title: "Haiku Minted!",
          description: "Your haiku has been successfully minted.",
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
      console.error("Minting error:", error);
      toast({
        title: "Minting Failed",
        description: "Something went wrong. Please try again later.",
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
      <FormLabel>Poem</FormLabel>
      <Textarea
        value={poemText}
        onChange={(e) => setPoemText(e.target.value)}
        placeholder={"Écris ton poème ici (tu peux utiliser des retours à la ligne)."}
        rows={6}
      />

      <FormLabel mt={5}>Select Collection</FormLabel>
      <Select
        value={selectedCollectionId}
        onChange={(e) => {
          setSelectedCollectionId(e.target.value);
          fetchMintingContractAddress(e.target.value);
        }}
        placeholder={loading ? "Loading..." : "Select a Poetry Collection"}
      >
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </Select>

      <FormLabel mt={5}>Number of Editions</FormLabel>
      <Input
        type="number"
        min="1"
        value={editions}
        onChange={(e) => setEditions(Number(e.target.value))}
        placeholder="Number of Editions"
      />

      <FormLabel mt={5}>Number of Editions to Sell</FormLabel>
      <Input
        type="number"
        min="0"
        max={editions}
        value={editionsForSale}
        onChange={(e) => setEditionsForSale(Number(e.target.value))}
        placeholder="Editions to Sell (0 to total editions)"
      />

      <FormLabel mt={5}>Sale Price (in ETH)</FormLabel>
      <Input
        type="text" // ← string pour éviter la notation scientifique des floats
        inputMode="decimal"
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
        isDisabled={isMintDisabled}
      >
        Mint Haiku
      </Button>
    </Box>
  );
};

export default PoemMintingPage;
