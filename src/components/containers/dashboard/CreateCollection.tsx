import React, { useState, useEffect } from "react";
import { Box, Heading, VStack, Divider, Flex, HStack, Input, Button, Text, FormLabel, useToast, Spinner, Tab, TabList, TabPanels, TabPanel, Tabs, Image, Grid, FormControl, Select } from "@chakra-ui/react";
import { JsonRpcProvider, Contract, ethers } from "ethers";
import { useAuth } from '@/utils/authContext';
import { handleMessageTransactions } from '@/utils/handleMessageTransactions';

import ABIRESCOLLECTION from '@/components/ABI/ABI_Collections.json';
import ABIMasterFactory from '@/components/ABI/Factories/ABI_MasterFactory.json';

import ABI_ART_FACTORY from '@/components/ABI/Factories/ABI_ART_FACTORY.json';
import ABI_POESIE_FACTORY from '@/components/ABI/Factories/ABI_POESIE_FACTORY.json';

import { BigNumberish } from "ethers";
import axios from "axios";
import Web3 from "web3";

const CreateCollection: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
  const masterFactoryAddress = process.env.NEXT_PUBLIC_MASTERFACTORY_CONTRACT as string;

  const { web3, address, isAuthenticated } = useAuth();


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
  const [customCollectionType, setCustomCollectionType] = useState<string>('');

  const [estimatedCost, setEstimatedCost] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);


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


  // Charger les adresses existantes des factories
  const fetchFactories = async () => {
    if (web3 && account) {
      try {
        const contract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
        const types = ["Art", "Poesie"];
        const results: Record<string, string> = {};
        for (const type of types) {
          results[type] = await contract.methods.collectionFactories(type).call();
        }
        setCurrentAddresses(results);
      } catch (err) {
        console.error("Erreur lors du chargement des factories:", err);
      }
    }
  };


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

        const imageUrl = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

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

        setIpfsUrl(`https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      } catch (error) {
        console.error('Error uploading to IPFS:', error );
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


  // On suppose que tu as dans ton .env les adresses et ABIs de chaque factory par type
  // State pour stocker dynamiquement les adresses des factories
const [currentAddresses, setCurrentAddresses] = useState<Record<string, string>>({});

const fetchFactoryAddress = async (type: string): Promise<string> => {
  if (!web3 || !masterFactoryAddress) throw new Error("Web3 ou MasterFactory non initialisé");

  try {
    const masterFactoryContract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
    const factoryAddress = (await masterFactoryContract.methods.collectionFactories(type).call()) as string;
    return factoryAddress;
  } catch (err) {
    console.error(`Erreur lors de la récupération de l'adresse de la factory pour ${type}:`, err);
    throw err;
  }
};


const estimateCollectionCost = async () => {
  if (!web3 || !address || !collectionType || !metadata.name || !ipfsUrl) return;

  try {
    setIsEstimating(true);

    // 1️⃣ Récupération dynamique de l'adresse de la factory
    const factoryAddress = await fetchFactoryAddress(collectionType);

    // 2️⃣ Choix de l'ABI
    const factoryABI = collectionType === "Art" ? ABI_ART_FACTORY : ABI_POESIE_FACTORY;

    // 3️⃣ Créer le contrat Web3
    const factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);

    const Rescoe_contract = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

    // 4️⃣ Préparer les paramètres exacts
    const params = [metadata.name, collectionType, address, 0];
    const paramsRescoe = [metadata.name, ipfsUrl, collectionType];

    // 5️⃣ Encoder l'appel pour estimateGas
    const data = factoryContract.methods.createDynamicCollection(...params).encodeABI();
    const dataRescoellection = Rescoe_contract.methods.createCollection(...paramsRescoe).encodeABI();

    // 6️⃣ Estimation du gas
    let gasLimitdata = await web3.eth.estimateGas({
      from: address,
      to: factoryAddress,
      data,
    });

/* //ICI TROP DE STACK DE DONN2E A ESTIMER, IL FAUT ESTIMER LES APPELS INDEVIDUELLEMENT
    // 6️⃣ Estimation du gas
    let gasLimitRescoellection = await web3.eth.estimateGas({
      from: address,
      to: Rescoe_contract,
      dataRescoellection,
    });
*/
    // Buffer de sécurité (+20%)
    const gasLimit = Math.floor( Number(gasLimitdata) /* +  Number(gasLimitRescoellection)*/ * 1.2);

    // 7️⃣ Gas price réel depuis le RPC ou Etherscan API
    // Option A: via web3.eth.getGasPrice (simple)
    let gasPrice = BigInt(await web3.eth.getGasPrice());

    // Option B: via un fetch sur Etherscan Gas Tracker (plus précis)

    const res = await axios.get(
      `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
    );
    const gasPriceGwei = Number(res.data.result.ProposeGasPrice); // en Gwei
    gasPrice = BigInt(Math.floor(gasPriceGwei * 1e9)); // convertir en wei


    const totalWei = BigInt(gasLimit) * gasPrice;
    const totalEth = Number(web3.utils.fromWei(totalWei.toString(), "ether")).toFixed(6);

    //console.log(
    //  `[ESTIMATION] ${collectionType} collection - GasLimit: ${gasLimit}, GasPrice: ${gasPrice.toString()} wei, Total ETH: ${totalEth}`
    //);

//MARGE de x4 pour etre sur que l'utilisateur ne soit pas surpris
setEstimatedCost((Number(totalEth) * 5).toFixed(6));
  } catch (err) {
    console.error("Erreur lors de l'estimation du gas :", err);
    setEstimatedCost(null);
  } finally {
    setIsEstimating(false);
  }
};



  useEffect(() => {
  if (metadata.name && ipfsUrl && collectionType) {
    estimateCollectionCost();
  } else {
    setEstimatedCost(null);
  }
}, [metadata.name, ipfsUrl, collectionType]);



  const handleCreateCollection = async (): Promise<void> => {
    if (!metadata.name || !ipfsUrl) {
      toast({
        title: "Erreur",
        description: "Le nom et l'image de la collection sont requis.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!web3) {
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
      const from = accounts[0];
      if (!from) throw new Error("Aucun compte Ethereum détecté.");

      const contract = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);


      // ✅ Envoi de la transaction avec gestion toasts
      const tx = await handleMessageTransactions(
        contract.methods
          .createCollection(metadata.name, ipfsUrl, collectionType)
          .send({ from }),
        toast,
        "Collection créée avec succès 🎉",
        "Échec lors de la création de la collection"
      );

      if (!tx || !tx.transactionHash) {
        throw new Error("La création de la collection a échoué.");
      }

      toast({
        title: "Succès",
        description: `Collection "${metadata.name}" créée avec succès. TX: ${tx.transactionHash}`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });

    } catch (error: any) {
      console.error("Erreur lors de la création :", error);

      let description = "Échec de la création de la collection.";
      if (error.message?.includes("insufficient funds")) {
        description = "Fonds insuffisants pour payer le gas.";
      } else if (error.message?.includes("User denied")) {
        description = "Transaction refusée par l'utilisateur.";
      }

      toast({
        title: "Erreur",
        description,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setLoading(false);
    }
  };




  return (
    <Box
      maxW="700px"
      mx="auto"
      mt={10}
      p={10}
      borderRadius="3xl"
      boxShadow="dark-lg"
      border="1px solid"
      borderColor="purple.300"
    >
      <Heading
        size="2xl"
        mb={6}
        textAlign="center"
        fontWeight="black"
        bgGradient="linear(to-r, purple.400, pink.400)"
        bgClip="text"
        letterSpacing="tight"
      >
        Créez une collection
      </Heading>

      <HStack
              mx="auto"
              mb={6}
              textAlign="center"
              fontWeight="black"
              bgGradient="linear(to-r, purple.400, pink.400)"
              bgClip="text"
              letterSpacing="tight">
                 <Text mt={4}>
                   Collections crées : {userCollections} -
                 </Text>
                 <Text mt={4}>
                   Collections restantes : {remainingCollections}
                 </Text>
      </HStack>

      <FormLabel fontWeight="bold" color="gray.200">
        Image de la collection
      </FormLabel>
      <Input
        type="file"
        onChange={handleFileChange}
        mb={5}
        border="2px dashed"
        borderColor="purple.400"
        bg="blackAlpha.300"
        color="white"
        _hover={{ bg: "blackAlpha.400" }}
        _focus={{
          borderColor: "pink.400",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.4)",
        }}
        py={2}
      />

      {previewUrl && (
        <Box
          borderRadius="xl"
          overflow="hidden"
          boxShadow="md"
          mb={6}
          border="1px solid"
          borderColor="purple.300"
        >
          <Image
            src={previewUrl}
            alt="Preview"
            boxSize="300px"
            objectFit="cover"
            mx="auto"
            transition="transform 0.3s ease"
            _hover={{ transform: "scale(1.05)" }}
          />
        </Box>
      )}

      <VStack spacing={4} align="stretch">
        <Input
          placeholder="Nom de la collection"
          name="name"
          value={metadata.name}
          onChange={handleMetadataChange}
          bg="blackAlpha.300"
          color="white"
          _placeholder={{ color: "gray.400" }}
          borderColor="purple.300"
        />
        <Input
          placeholder="Description"
          name="description"
          value={metadata.description}
          onChange={handleMetadataChange}
          bg="blackAlpha.300"
          color="white"
          _placeholder={{ color: "gray.400" }}
          borderColor="purple.300"
        />
        <Input
          placeholder="Tags (séparés par des virgules)"
          name="tags"
          value={metadata.tags}
          onChange={handleMetadataChange}
          bg="blackAlpha.300"
          color="white"
          _placeholder={{ color: "gray.400" }}
          borderColor="purple.300"
        />
      </VStack>

      <FormLabel mt={6} color="gray.300" fontWeight="bold">
        Type de collection
      </FormLabel>
      <Select
        placeholder="Sélectionnez un type"
        value={collectionType}
        onChange={(e) => setCollectionType(e.target.value)}
        bg="blackAlpha.300"
        color="white"
        borderColor="purple.300"
        mb={4}
      >
        <option style={{ backgroundColor: "#1A202C" }} value="Art">
          Art
        </option>
        <option style={{ backgroundColor: "#1A202C" }} value="Poesie">
          Poésie
        </option>
      </Select>

      <Button
        mt={4}
        w="full"
        bgGradient="linear(to-r, teal.500, green.400)"
        color="white"
        fontWeight="bold"
        _hover={{ transform: "scale(1.03)" }}
        _active={{ transform: "scale(0.97)" }}
        transition="all 0.2s ease"
        onClick={uploadFileToIPFS}
        isLoading={isUploading}
      >
        🚀 Enregistrez votre collection
      </Button>


      {ipfsUrl && (
        <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>
      )}

      <Divider my={10} borderColor="purple.300" />

      <Flex justify="center">


      <Button
        onClick={handleCreateCollection}
        px={10}
        py={6}
        fontSize="lg"
        fontWeight="bold"
        borderRadius="full"
        bgGradient="linear(to-r, purple.700, pink.600)"
        color="white"
        boxShadow="lg"
        _hover={{ transform: "scale(1.05)", boxShadow: "2xl" }}
        _active={{ transform: "scale(0.98)" }}
        transition="all 0.25s ease"
        isDisabled={!collectionType || !metadata.name || !file}
        isLoading={loading}
      >
        {isEstimating
          ? "💰 Estimation du coût..."
          : estimatedCost
          ? `🎨 Créer la collection (~${estimatedCost} ETH)`
          : "🎨 Créer la collection"}
      </Button>




      </Flex>
    </Box>
  );
};

  export default CreateCollection;
