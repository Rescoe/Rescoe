import React, { useState, useEffect, ChangeEvent } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract } from 'ethers';

import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import contractABI from '../../../ABI/ABI_ART.json';
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import { useAuth } from '../../../../utils/authContext';

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

  const { address, web3, provider } = useAuth();



  useEffect(() => {
    if (address) {
        fetchUserCollections();
            }
  }, [address]);


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
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS); // Utilisation du fournisseur JSON-RPC

      if (!contractRESCOLLECTION) {
          console.error("L'adresse du contrat de collection n'est pas définie.");
          return;
      }

      const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

      try {
          // Récupération des collections de l'utilisateur

          const result = await contract.getCollectionsByUser(address); // Appel de la méthode pour obtenir les collections

          if (Array.isArray(result)) {
              const filteredCollections = result
                  .map((collection: any) => ({
                      id: collection[0].toString(),
                      name: collection[1],
                      type: collection[2],
                      owner: collection[3],
                      address: collection[4],
                  }))
                  .filter((collection) => collection.type === "Art"); // Filtrer uniquement les collections d'art

              setCollections(filteredCollections); // Mettre à jour l'état avec les collections filtrées
          } else {
              console.error('Format de résultat inattendu:', result);
              setError('Format de résultat inattendu');
          }
      } catch (err) {
          console.error("Erreur lors de la récupération des collections :", err);
          setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
  };



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
          alert("Veuillez télécharger les métadonnées sur IPFS et sélectionner une collection.");
          return;
      }

      if (!web3) {
          alert("Web3 non initialisé. Veuillez vous reconnecter.");
          return;
      }

/*
if(web3){
try {
    const accounts = await web3.eth.getAccounts(); // Récupération des comptes
    if (!accounts[0]) {
        alert("Aucun compte Ethereum détecté. Ouvrez MetaMask pour vous connecter.");
        return; // Quitte la fonction si aucun compte n'est disponible
    }

    // Récupération des détails de la collection
    const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
    const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

    if (!collectionDetails) {
        throw new Error("Détails de la collection introuvables.");
    }

    // Vérification du type de la collection
    if (collectionDetails.collectionType !== "Art") {
        alert("Vous ne pouvez pas mint une poésie. Veuillez sélectionner une collection d'art.");
        return;
    }

    // Récupération de l'adresse du contrat de mint
    const collectionMintAddress: string = collectionDetails.collectionAddress;
    if (!web3.utils.isAddress(collectionMintAddress)) {
        throw new Error(`Adresse de contrat invalide : ${collectionMintAddress}`);
    }

    const editions = 1; // Nombre d'éditions à mint
    const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

    // Appel de la fonction de mint
    const mintResult: MintResult = await mintContract.methods.mint(ipfsUrl, editions).send({ from: accounts[0] });

    if (!mintResult.events?.Transfer?.returnValues?.tokenId) {
        throw new Error("Token ID introuvable dans l'événement Transfer.");
    }

    const tokenId = mintResult.events.Transfer.returnValues.tokenId; // Récupération du token ID

    // Si mise en vente activée, ajout automatique à la liste
    if (isSaleListing) {
        // Vous pouvez ajouter ici la logique pour la mise en vente si nécessaire
    }

    alert("Félicitations ! Votre œuvre est publiée !");
} catch (error) {
    console.error("Erreur lors du minting NFT :", error);
    alert('Erreur lors de la publication de l\'œuvre. Vérifiez la console pour plus de détails.');
} finally {
    setIsMinting(false); // Termine l'état de minting
}
}
};
*/

      setIsMinting(true); // Indique que le mint commence
      try {
          const userAddress = address; // Utilisez l'adresse depuis l'authContext

          //const contractResCollection = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);
          const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);



          const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();


          if (!collectionDetails) {
              throw new Error("Détails de la collection introuvables.");
          }

          if (collectionDetails.collectionType !== "Art") {
              alert("Vous ne pouvez pas mint une poésie. Veuillez sélectionner une collection d'art.");
              return;
          }

          const collectionMintAddress = collectionDetails.collectionAddress;
          if (!web3.utils.isAddress(collectionMintAddress)) {
              throw new Error(`Adresse de contrat invalide : ${collectionMintAddress}`);
          }

          const editions = 1; // Nombre d'éditions à mint
          const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

          if (!userAddress) {
              throw new Error("L'adresse utilisateur est invalide ou non connectée.");
          }

          const mintResult = await mintContract.methods.mint(ipfsUrl, editions).send({ from: userAddress });

          if (!mintResult.events?.Transfer?.returnValues?.tokenId) {
              throw new Error("Token ID introuvable dans l'événement Transfer.");
          }

          alert("Félicitations ! Votre œuvre est publiée !");
      } catch (error) {
          console.error("Erreur lors du minting NFT :", error);
          alert('Erreur lors de la publication de l\'œuvre. Vérifiez la console pour plus de détails.');
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
      <Text mt={2}>Wallet connecté : {address}</Text>

    </Box>
  );
};

export default MintArt;
