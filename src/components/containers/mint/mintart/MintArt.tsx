import React, { useState, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import contractABI from '../../../ABI/ABI_ART.json'; // Assurez-vous d'avoir le bon chemin pour votre ABI
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';

import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';

import {
  Button,
  Input,
  Select,
  Spinner,
  Box,
  Text,
  FormLabel,
  Heading,
  VStack,
  Image,
  Checkbox
} from "@chakra-ui/react";

const NFTManager = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [metadata, setMetadata] = useState({ name: "", description: "", tags: "" });
  const [provider, setProvider] = useState(null);
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [ipfsUrl, setIpfsUrl] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [customFee, setCustomFee] = useState(10);
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [userCollections, setUserCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [salePrice, setSalePrice] = useState("");
  const [isSaleListing, setIsSaleListing] = useState(false);
  const [showBananas, setShowBananas] = useState(false);

  const Bananas = dynamic(() => import('../../../modules/Bananas'), { ssr: false });

  useEffect(() => {
    const setupWeb3 = async () => {
      try {
        const detectedProvider = await detectEthereumProvider();
        if (detectedProvider) {
          setProvider(detectedProvider);
          const web3Instance = new Web3(detectedProvider);
          setWeb3(web3Instance);
          const userAccounts = await detectedProvider.request({ method: "eth_requestAccounts" });
          setAccounts(userAccounts);
        } else {
          console.error("MetaMask not detected");
        }
      } catch (error) {
        console.error("Error setting up Web3:" );
      }
    };
    setupWeb3();
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleMetadataChange = (e) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const uploadFileToIPFS = async () => {
    if (file && metadata) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
          headers: {
            'Authorization': `Bearer ${process.env.PINATA_JWT}`,
            'Content-Type': 'multipart/form-data'
          }
        });

        const imageUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
        const metadataJson = {
          artist: metadata.artist,
          name: metadata.name,
          description: metadata.description,
          image: imageUrl,
          tags: metadata.tags.split(',').map(tag => tag.trim()),
        };

        const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
          headers: {
            'Authorization': `Bearer ${process.env.PINATA_JWT}`,
            'Content-Type': 'application/json'
          }
        });

        setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      } catch (error) {
        console.error('Error uploading to IPFS:' );
        alert('Error uploading to IPFS: ' );
      } finally {
        setIsUploading(false);
      }
    } else {
      alert("Please ensure both file and metadata are set.");
    }
  };

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
          .filter((collection) => collection.type === "Art"); // Filtrer uniquement les collections de type "Art"

        setCollections(filteredCollections);
      } else {
        console.error('Unexpected result format:', result);
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
    if (accounts[0]) fetchUserCollections();
  }, [accounts]);

  const mintNFT = async () => {
    if (!ipfsUrl || selectedCollectionId === null) {
      alert("Please upload metadata to IPFS and select a collection.");
      return;
    }

    setIsMinting(true);
    try {
      // Appel à getCollection pour obtenir les détails de la collection
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const collectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

      // Vérifier si la collection est de type "Art" avant de permettre le minting
      if (collectionDetails.collectionType !== "Art") {
        alert("You cannot mint poetry. Please select an art collection.");
        return;
      }

      // Récupérer l'adresse du contrat de mint de la collection
      const collectionMintAddress = collectionDetails.collectionAddress;
      const typeDeCollection = collectionDetails.collectionType;

      // Définir le nombre d'éditions en fonction du type de collection
      let editions = 1; // Valeur par défaut pour "Art"
      if (typeDeCollection === "Poesie") {
        editions = 250; // Limite d'édition pour "Poesie"
      }

      // Appel du contrat de mint de la collection sélectionnée
      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

      // Paramètres de mint : l'URI de l'IPFS et l'ID de la collection
      const salePriceInWei = web3.utils.toWei(salePrice, 'ether');

      // Appel de la fonction de mint avec la vérification du type de collection et le nombre d'éditions
      const mintResult = await mintContract.methods.mint(ipfsUrl, editions).send({ from: accounts[0] });

      const tokenId = mintResult.events.Transfer.returnValues.tokenId;

      if (isSaleListing && salePrice) {
        await mintContract.methods.listNFTForSale(tokenId, salePriceInWei).send({ from: accounts[0] });
      }

      alert("NFT minted and added to collection successfully!");
    } catch (error) {
      console.error("Error minting NFT:" );
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <Box p={5} maxWidth="600px" mx="auto" boxShadow="md" borderRadius="md">
      <Heading size="lg" mb={5}>Mint NFT</Heading>
      <FormLabel>Upload File</FormLabel>
      <Input type="file" onChange={handleFileChange} mb={3} />
      {previewUrl && <Image src={previewUrl} alt="Preview" mb={3} boxSize="200px" objectFit="cover" />}
      <VStack spacing={3} align="stretch">
        <Input placeholder="Artist" name="artist" value={metadata.artist} onChange={handleMetadataChange} />
        <Input placeholder="Name" name="name" value={metadata.name} onChange={handleMetadataChange} />
        <Input placeholder="Description" name="description" value={metadata.description} onChange={handleMetadataChange} />
        <Input placeholder="Tags (comma-separated)" name="tags" value={metadata.tags} onChange={handleMetadataChange} />
      </VStack>
      <Button mt={4} colorScheme="teal" onClick={uploadFileToIPFS} isLoading={isUploading}>
        Upload to IPFS
      </Button>
      {ipfsUrl && <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>}

      <FormLabel mt={5}>Select Collection</FormLabel>
      <Select onChange={(e) => setSelectedCollectionId(e.target.value)} placeholder="Select a Collection">
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </Select>

      <Checkbox mt={3} isChecked={isSaleListing} onChange={(e) => setIsSaleListing(e.target.checked)}>
        List on Sale
      </Checkbox>
      {isSaleListing && (
        <Input
          mt={3}
          type="number"
          placeholder="Sale Price (ETH)"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
      )}

      <Button
        mt={4}
        colorScheme="teal"
        onClick={mintNFT}
        isLoading={isMinting}
        isDisabled={!ipfsUrl || !selectedCollectionId}
      >
        Mint NFT
      </Button>
    </Box>
  );
};

export default NFTManager;
