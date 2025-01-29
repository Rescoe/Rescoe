import React, { useState, useEffect } from "react";
import { Box, Button, Input, Select, FormLabel, Textarea, useToast } from "@chakra-ui/react";
import Web3 from "web3";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from '../../../ABI/HaikuEditions.json';

const PoemMintingPage = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [line1, setLine1] = useState("");  // Ligne 1 du haiku
  const [line2, setLine2] = useState("");  // Ligne 2 du haiku
  const [line3, setLine3] = useState("");  // Ligne 3 du haiku
  const [editions, setEditions] = useState(1);
  const [salePrice, setSalePrice] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [contractAddress, setContractAddress] = useState(""); // Contrat du mint (pour la collection choisie)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toast = useToast();
  const web3 = new Web3(window.ethereum); // Initialisation Web3 avec Metamask

  const fetchUserCollections = async () => {
    try {
      setLoading(true);
      const accounts = await web3.eth.getAccounts();
      const userAddress = accounts[0];

      const contract = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const result = await contract.methods.getCollectionsByUser(userAddress).call();

      if (Array.isArray(result)) {
        const filteredCollections = result
          .map((collection) => ({
            id: collection[0].toString(),
            name: collection[1],
            type: collection[2],
            owner: collection[3],
            otherData: collection[4],
          }))
          .filter((collection) => collection.type === "Poesie"); // Filtrer uniquement les collections de type "Art"

        setCollections(filteredCollections);
      } else {
        console.error('Unexpected result format:');
        setError('Unexpected result format');
      }
    } catch (err) {
      console.error("Error fetching collections:");
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCollections = async () => {
      const accounts = await web3.eth.getAccounts();
      if (accounts[0]) fetchUserCollections();
    };

    fetchCollections();
  }, []);

  const fetchMintingContractAddress = async (collectionId: string) => {
    try {
      const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const collectionDetails = await contractResCollection.methods.getCollection(collectionId).call();
      const collectionMintAddress = collectionDetails.collectionAddress;

      if (collectionMintAddress) {
        setContractAddress(collectionMintAddress);
      } else {
        toast({
          title: "Contract Address Error",
          description: "Unable to retrieve the minting contract address for this collection.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
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
    if (!line1 || !line2 || !line3 || !selectedCollectionId || !salePrice || !contractAddress) {
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

      // Accéder au contrat de mint pour la collection sélectionnée
      const contract = new web3.eth.Contract(ABI, contractAddress);

      // L'adresse de l'utilisateur connecté
      const accounts = await web3.eth.getAccounts();
      const userAddress = accounts[0];

      // Assembler le haiku avec les trois lignes, en insérant un retour à la ligne entre chaque ligne
      const fullHaiku = `${line1}\n${line2}\n${line3}`;

      // Appeler la méthode du contrat pour créer un haiku
      const transaction = await contract.methods.createHaiku(fullHaiku, editions, web3.utils.toWei(salePrice, "ether")).send({ from: userAddress });

      await transaction;

      toast({
        title: "Haiku Minted!",
        description: "Your haiku has been successfully minted.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Reset form
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
        onChange={(e) => setEditions(e.target.value)}
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
