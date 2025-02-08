import React, { useState, useEffect, ChangeEvent } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import contractABI from '../../../ABI/ABI_ART.json';
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

interface Metadata {
  artist?: string;
  name: string;
  description: string;
  tags: string;
}

interface Collection {
  id: bigint; // Utilisation de bigint pour traiter les grands nombres
  name: string;
  type: string;
  owner: string; // Réputation du créateur de la collection
  address: string; // Adresse de la collection
  // Ajoutez d'autres champs nécessaires ici, selon les données que vous attendez
}

interface CollectionDetails {
  collectionAddress: string;
  collectionType: string;
}

interface MintResult {
  transactionHash: string;
  transactionIndex: bigint;
  blockHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  cumulativeGasUsed: bigint;
  gasUsed: bigint;
  events?: {
    [eventName: string]: {
      event: string;
      returnValues: {
        tokenId?: string; // Marqué comme optionnel car il peut ne pas être présent
        // Ajoutez d'autres propriétés retournées selon les événements
      };
      // Autres propriétés de l'événement
    };
  };
}



const Bananas = dynamic(() => import('../../../modules/Bananas'), { ssr: false });

const MintArt: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({ name: "", description: "", tags: "" });
  const [provider, setProvider] = useState<any>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [customFee, setCustomFee] = useState<number>(10);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState<string>("");
  const [isSaleListing, setIsSaleListing] = useState<boolean>(false);
  const [showBananas, setShowBananas] = useState<boolean>(false);

  useEffect(() => {
    const setupWeb3 = async () => {
      try {
        const detectedProvider = (await detectEthereumProvider()) as any;
        if (detectedProvider) {
          setProvider(detectedProvider);
          const web3Instance = new Web3(detectedProvider);
          setWeb3(web3Instance);
          const userAccounts: string[] = await detectedProvider.request({ method: "eth_requestAccounts" });
          setAccounts(userAccounts);
        } else {
          console.error("MetaMask not detected");
        }
      } catch (error) {
        console.error("Error setting up Web3:", error);
      }
    };
    setupWeb3();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleMetadataChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const fetchUserCollections = async () => {
    if (!web3) return;
    try {
      setLoading(true);
      const accounts = await web3.eth.getAccounts();
      const userAddress = accounts[0];
      const contract = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const result = await contract.methods.getCollectionsByUser(userAddress).call();
      if (Array.isArray(result)) {
        const filteredCollections = result
          .map((collection: any) => ({
            id: collection[0].toString(),
            name: collection[1],
            type: collection[2],
            owner: collection[3],
            address: collection[4],
          }))
          .filter((collection) => collection.type === "Art");
        setCollections(filteredCollections);
      } else {
        console.error('Unexpected result format:', result);
        setError('Unexpected result format');
      }
    } catch (err) {
      console.error("Error fetching collections:", err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accounts.length > 0) fetchUserCollections();
  }, [accounts]);


  const uploadFileToIPFS = async (): Promise<void> => {
    if (file && metadata) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const imageResponse = await axios.post<{ IpfsHash: string }>(
          'https://api.pinata.cloud/pinning/pinFileToIPFS',
          formData,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        const imageUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
        const metadataJson = {
          artist: metadata.artist,
          name: metadata.name,
          description: metadata.description,
          image: imageUrl,
          tags: metadata.tags.split(',').map(tag => tag.trim()),
        };

        const metadataResponse = await axios.post<{ IpfsHash: string }>(
          'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          metadataJson,
          {
            headers: {
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
              'Content-Type': 'application/json',
            },
          }
        );

        setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      } catch (error) {
        console.error('Error uploading to IPFS:', error);
        alert('Error uploading to IPFS');
      } finally {
        setIsUploading(false);
      }
    } else {
      alert('Please ensure both file and metadata are set.');
    }
  };



  const mintNFT = async (): Promise<void> => {
    if (!ipfsUrl || selectedCollectionId === null) {
      alert("Please upload metadata to IPFS and select a collection.");
      return;
    }

    if (!web3) {
      console.error("Web3 is not initialized.");
      return;
    }

    setIsMinting(true);
    try {
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) {
        throw new Error("No Ethereum account detected.");
      }

      // Récupération des détails de la collection
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

      if (!collectionDetails) {
        throw new Error("Collection details not found.");
      }

      // Vérification du type de collection
      if (collectionDetails.collectionType !== "Art") {
        alert("You cannot mint poetry. Please select an art collection.");
        return;
      }

      // Récupération de l'adresse du contrat de mint
      const collectionMintAddress: string = collectionDetails.collectionAddress;
      if (!web3.utils.isAddress(collectionMintAddress)) {
        throw new Error(`Invalid contract address: ${collectionMintAddress}`);
      }


      // Définition du nombre d'éditions
      const editions = collectionDetails.collectionType === "Poesie" ? 250 : 1;

      // Contrat de mint
      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);
      const salePriceInWei = web3.utils.toWei(salePrice, 'ether');


      // Appel de la fonction de mint
      const mintResult: MintEvent = await mintContract.methods.mint(ipfsUrl, editions).send({ from: accounts[0] });

      if (!mintResult.events?.Transfer?.returnValues?.tokenId) {
        throw new Error("Token ID not found in Transfer event.");
      }

      const tokenId = mintResult.events.Transfer.returnValues.tokenId;

      // Si mise en vente activée, listing automatique
      if (isSaleListing && salePrice) {
        await mintContract.methods.listNFTForSale(tokenId, salePriceInWei).send({ from: accounts[0] });
      }

      alert("Félicitations ! Votre oeuvre est publiée !");
    } catch (error) {
      console.error("Error minting NFT:", error);
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
    {/*}  {ipfsUrl && <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>} */}

      <FormLabel mt={5}>Select Collection</FormLabel>
      <Select onChange={(e) => setSelectedCollectionId(e.target.value)} placeholder="Select a Collection">
  {collections.map((collection) => (
    <option key={collection.id} value={collection.id.toString()}>  {/* Conversion ici */}
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

export default MintArt;
