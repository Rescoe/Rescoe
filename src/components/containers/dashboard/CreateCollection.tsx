import React, { useState, useEffect } from "react";
import { Box, Heading, VStack, HStack, Input, Button, Text, FormLabel, useToast, Spinner, Tab, TabList, TabPanels, TabPanel, Tabs, Image, Grid, FormControl, Select } from "@chakra-ui/react";
import { JsonRpcProvider, Contract, ethers } from "ethers";
import { useAuth } from '../../../utils/authContext';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import { BigNumberish } from "ethers";
import axios from "axios";
import Web3 from "web3";
import detectEthereumProvider from '@metamask/detect-provider';


const CreateCollection: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

  const { address: authAddress } = useAuth();
  const [address, setAddress] = useState<string>(authAddress || '');

  const [web3, setWeb3] = useState<Web3 | null>(null);
const [account, setAccount] = useState<string | null>(null);

  const [avatarSvg, setAvatarSvg] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ id: string, name: string, imageUrl: string }[]>([]);
  const [nfts, setNfts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<{ name: string, description: string, tags: string }>({
    name: "",
    description: "",
    tags: ""
  });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [collectionURI, setCollectionURI] = useState<string>('');
  const [userCollections, setUserCollections] = useState<number>(0);
  const [remainingCollections, setRemainingCollections] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [collectionType, setCollectionType] = useState<string>('');

  const toast = useToast();

  useEffect(() => {
    const initialize = async () => {
      if (!address) {
        console.error("L'adresse de l'utilisateur est undefined.");
        return;
      }

      await fetchCollections(address);
      await fetchStatsCollection(address);
    };

    if (address) {
      initialize();
    }
  }, [address]);

  useEffect(() => {
      const initWeb3 = async () => {
          const provider = await detectEthereumProvider();
          if (provider) {
              const web3Instance = new Web3(provider);
              setWeb3(web3Instance);
              const accounts = await web3Instance.eth.getAccounts();
              setAccount(accounts[0]);
          }
      };
      initWeb3();
  }, []);

  // Récupérer les collections
  const fetchCollections = async (userAddress: string): Promise<void> => {
    setIsLoading(true);
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const collectionsPaginated = await contract.getCollectionsByUser(userAddress);

      const collectionsData = await Promise.all(
        collectionsPaginated.map(async (tuple: [BigNumberish, string, string, string, string[], boolean, boolean]) => {
          const [id, name, collectionType, creator, associatedAddresses, isActive, isEditable] = tuple;
          const uri = await contract.getCollectionURI(id);
          return { id: id.toString(), name, collectionType, creator, associatedAddresses, isActive, isEditable, uri };
        })
      );

      setCollections(collectionsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :' );
    } finally {
      setIsLoading(false);
    }
  };



    // Upload file and metadata to IPFS
    const uploadFileToIPFS = async (): Promise<void> => {
    if (file && metadata) {
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
            'Content-Type': 'multipart/form-data'
          }
        });

        const imageUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

        const metadataJson = {
          name: metadata.name,
          description: metadata.description,
          image: imageUrl,
          tags: metadata.tags.split(',').map(tag => tag.trim()),
        };

        const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
            'Content-Type': 'application/json'
          }
        });

        setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      } catch (error) {
        console.error('Error uploading to IPFS:' );
        alert('Error uploading to IPFS: ');
      } finally {
        setIsUploading(false);
      }
    } else {
      alert("Please ensure both file and metadata are set.");
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // Handle metadata input changes
  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const fetchStatsCollection = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string); // Typage de l'URL RPC
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider); // Initialisation du contrat

    try {
      // Appel à la fonction Solidity pour récupérer le nombre de collections créées
      const userCollections: bigint = await contract.getNumberOfCollectionsByUser(userAddress);

      // Appel à la fonction Solidity pour récupérer le nombre de collections restantes
      const remainingCollections: bigint = await contract.getRemainingCollections(userAddress);

      // Conversion en nombre classique
      const userCollectionsNumber: number = Number(userCollections);
      const remainingCollectionsNumber: number = Number(remainingCollections);

      setUserCollections(userCollectionsNumber);
      setRemainingCollections(remainingCollectionsNumber);

      return { userCollections: userCollectionsNumber, remainingCollections: remainingCollectionsNumber };
    } catch (err) {
      console.error("Erreur de récupération des collections:", err);
      setError("Erreur de récupération des collections.");
    }
  };


  const handleCreateCollection = async (): Promise<void> => {
    if (!metadata.name || !ipfsUrl) {
      toast({
        title: "Erreur",
        description: "Le nom de la collection (issu des métadonnées) et l'image (IPFS) ne peuvent pas être vides.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!web3) {
      console.error("Web3 n'est pas initialisé.");
      toast({
        title: "Erreur",
        description: "Web3 n'est pas initialisé.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) {
        throw new Error("Aucun compte Ethereum détecté.");
      }

      // Création du contrat pour RESCOLLECTION
      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

      // Appel de la fonction createCollection du contrat
      const tx = await contractResCollection.methods.createCollection(metadata.name, ipfsUrl, collectionType).send({ from: accounts[0] });

      // Vérification de la réussite de la transaction
      if (!tx || !tx.transactionHash) {
        throw new Error("La création de la collection a échoué.");
      }

      toast({
        title: "Succès",
        description: `Collection "${metadata.name}" créée avec succès. Transaction Hash: ${tx.transactionHash}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Erreur lors de la création de la collection :", error);
      toast({
        title: "Erreur",
        description: "Échec de la création de la collection. Vérifiez vos données.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };




    return (
      <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
        <Heading mb={4}>Gestion des collections</Heading>
        <Tabs variant='enclosed'>
          <TabList>
            <Tab>Gérer vos collections</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
            <HStack>
            <Text mt={4}>
              Vous avez {userCollections} collections créées.
            </Text>
            <Text mt={4}>
              Vous pouvez créer jusqu'à {remainingCollections} collections restantes.
            </Text>
            </HStack>

              <FormLabel>Upload File</FormLabel>
              <Input type="file" onChange={handleFileChange} mb={3} />
              {previewUrl && <Image src={previewUrl} alt="Preview" mb={3} boxSize="200px" objectFit="cover" />}

              <VStack spacing={3} align="stretch">
                <Input
                  placeholder="Name"
                  name="name"
                  value={metadata.name}
                  onChange={handleMetadataChange}
                />
                <Input
                  placeholder="Description"
                  name="description"
                  value={metadata.description}
                  onChange={handleMetadataChange}
                />
                <Input
                  placeholder="Tags (comma-separated)"
                  name="tags"
                  value={metadata.tags}
                  onChange={handleMetadataChange}
                />
              </VStack>

              <FormControl mb="4">
                <FormLabel htmlFor="collectionType">Type de collection</FormLabel>
                <Select
                  id="collectionType"
                  value={collectionType}
                  onChange={(e) => setCollectionType(e.target.value)}
                >
                  <option value="">Sélectionner un type</option>
                  <option value="Art">Art</option>
                  <option value="Poesie">Poésie</option>
                  <option value="Generative">Art Génératif</option>
                </Select>
              </FormControl>

              <Button mt={4} colorScheme="teal" onClick={uploadFileToIPFS} isLoading={isUploading}>
                Upload to IPFS
              </Button>

              {ipfsUrl && (
                <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>
              )}

              <Button colorScheme="blue" onClick={handleCreateCollection} mt={2}>
                Créer une Collection
              </Button>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    );
  };

  export default CreateCollection;
