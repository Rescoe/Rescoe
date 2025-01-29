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

        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            "Content-Type": "multipart/form-data",
          },
        });

        const imageUrl = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
        const metadataJson = {
          ...metadata,
          image: imageUrl,
          tags: metadata.tags.split(",").map((tag) => tag.trim()),
        };

        const metadataResponse = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", metadataJson, {
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            "Content-Type": "application/json",
          },
        });

        setIpfsUrl(`https://gateway.pinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      } catch (error) {
        console.error("Error uploading to IPFS:" );
        alert("Error uploading to IPFS: " );
      } finally {
        setIsUploading(false);
      }
    } else {
      alert("Please ensure both file and metadata are set.");
    }
  };

  const mintNFT = async () => {
    if (!ipfsUrl || selectedCollectionId === null) {
      alert("Please upload metadata to IPFS and select a collection.");
      return;
    }

    setIsMinting(true);
    try {
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const collectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

      const collectionMintAddress = collectionDetails.collectionAddress;

      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);
      const salePriceInWei = web3.utils.toWei(salePrice, 'ether');

      const mintResult = await mintContract.methods.mint(ipfsUrl).send({ from: accounts[0] });

      const tokenId = mintResult.events.Transfer.returnValues.tokenId;

      if (isSaleListing && salePrice) {
        await mintContract.methods.putNFTForSale(tokenId, salePriceInWei).send({ from: accounts[0] });
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
      <Select placeholder="Select a collection" value={selectedCollectionId || ""} onChange={(e) => setSelectedCollectionId(e.target.value)}>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>{collection.name}</option>
        ))}
      </Select>
      <FormLabel mt={5}>Sale Price (in ETH)</FormLabel>
      <Input type="text" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Enter sale price in ETH" />
      <Checkbox mt={3} isChecked={isSaleListing} onChange={(e) => setIsSaleListing(e.target.checked)}>
        List for Sale
      </Checkbox>
      <Button mt={4} colorScheme="blue" onClick={mintNFT} isLoading={isMinting}>
        Mint NFT
      </Button>
    </Box>
  );
};

export default NFTManager;
