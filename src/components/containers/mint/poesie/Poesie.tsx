import React, { useState, useEffect } from "react";
import { Box, Button, Input, Select, FormLabel, Textarea, useToast } from "@chakra-ui/react";
import Web3 from "web3";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from '../../../ABI/HaikuEditions.json';

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
  const [line1, setLine1] = useState<string>("");
  const [line2, setLine2] = useState<string>("");
  const [line3, setLine3] = useState<string>("");
  const [editions, setEditions] = useState<number>(1);
  const [salePrice, setSalePrice] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [contractAddress, setContractAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null); // Créez un état pour web3

  const toast = useToast();

  useEffect(() => {
    // Vérifiez si nous sommes dans le navigateur
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

      const contract = new web3Instance.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
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
    if (!web3) return; // Ne pas exécuter si web3 n'est pas disponible
    try {
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
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

  const mintPoem = async () => {
    if (!line1 || !line2 || !line3 || !selectedCollectionId || !salePrice || !contractAddress || !web3) {
      toast({
        title: "Missing Information",
        description: "Please provide all fields to mint the haiku.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      setIsMinting(true);
      const contract = new web3.eth.Contract(ABI, contractAddress);
      const accounts = await web3.eth.getAccounts();
      const userAddress = accounts[0];
      const fullHaiku = `${line1}\n${line2}\n${line3}`;
      await contract.methods.createHaiku(fullHaiku, editions, web3.utils.toWei(salePrice, "ether")).send({ from: userAddress });
      toast({
        title: "Haiku Minted!",
        description: "Your haiku has been successfully minted.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      setLine1("");
      setLine2("");
      setLine3("");
      setEditions(1);
      setSalePrice("");
      setSelectedCollectionId("");
      setContractAddress("");
    } catch (error) {
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

  return (
    <Box p={5} maxWidth="600px" mx="auto">
      <FormLabel>Haiku Text</FormLabel>
      <FormLabel mt={5}>Line 1</FormLabel>
      <Textarea
        value={line1}
        onChange={(e) => setLine1(e.target.value)}
        placeholder="Enter the first line of your haiku"
        rows={2}
      />
      <FormLabel mt={5}>Line 2</FormLabel>
      <Textarea
        value={line2}
        onChange={(e) => setLine2(e.target.value)}
        placeholder="Enter the second line of your haiku"
        rows={2}
      />
      <FormLabel mt={5}>Line 3</FormLabel>
      <Textarea
        value={line3}
        onChange={(e) => setLine3(e.target.value)}
        placeholder="Enter the third line of your haiku"
        rows={2}
      />

      <FormLabel mt={5}>Select Collection</FormLabel>
      <Select
        onChange={(e) => {
          setSelectedCollectionId(e.target.value);
          fetchMintingContractAddress(e.target.value); // Récupérer l'adresse du contrat après sélection
        }}
        placeholder="Select a Poetry Collection"
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

      <FormLabel mt={5}>Sale Price (ETH)</FormLabel>
      <Input
        type="number"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        placeholder="Sale Price in ETH"
      />

      <Button
        mt={4}
        colorScheme="teal"
        onClick={mintPoem}
        isLoading={isMinting}
        isDisabled={!line1 || !line2 || !line3 || !selectedCollectionId || !salePrice || !editions || !contractAddress}
      >
        Mint Haiku
      </Button>
    </Box>
  );
};

export default PoemMintingPage;
