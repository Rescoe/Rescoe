import React, { useState, useEffect } from "react";
import { Box, Heading, VStack, Divider, Flex, HStack, Input, Button, Text, FormLabel, useToast, Image, Select } from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import { useAuth } from '@/utils/authContext';
import { handleMessageTransactions } from '@/utils/handleMessageTransactions';
import ABIRESCOLLECTION from '@/components/ABI/ABI_Collections.json';
import ABIMasterFactory from '@/components/ABI/Factories/ABI_MasterFactory.json';
import ABI_ART_FACTORY from '@/components/ABI/Factories/ABI_ART_FACTORY.json';
import ABI_POESIE_FACTORY from '@/components/ABI/Factories/ABI_POESIE_FACTORY.json';
import axios from "axios";
import Web3 from "web3";

const CreateCollection: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
  const masterFactoryAddress = process.env.NEXT_PUBLIC_MASTERFACTORY_CONTRACT as string;
  const { web3, address, isAuthenticated } = useAuth();
  const toast = useToast();

  // State variables
  const [account, setAccount] = useState<string | null>(null);
  const [avatarSvg, setAvatarSvg] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('');
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ id: string, name: string, imageUrl: string }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [metadata, setMetadata] = useState<{ name: string, description: string, tags: string }>({ name: "", description: "", tags: "" });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [userCollections, setUserCollections] = useState<number>(0);
  const [remainingCollections, setRemainingCollections] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [collectionType, setCollectionType] = useState<string>('');
  const [splitRoyalties, setSplitRoyalties] = useState<boolean>(true);
  const [royaltyData, setRoyaltyData] = useState<{ address: string; value: string }[]>([{ address: "", value: "" }]);
  const [maxEditions, setMaxEditions] = useState<number>(1);


  const canUpload =
    file &&
    metadata.name.trim() &&
    metadata.description.trim() &&
    metadata.tags.trim() &&
    collectionType &&
    (collectionType !== "Art" ||
      (maxEditions > 0 &&
        (!splitRoyalties ||
          (
            royaltyData.every((r) => {
              if (!web3) return false;
              return web3.utils.isAddress(r.address) && r.value !== "";
            })
          )
        )
      )
    );



  useEffect(() => {
    if (address) {
      initialize();
    }
  }, [address]);

  const initialize = async () => {
    if (!address) return;   // <- protection

    await fetchCollections(address);
    await fetchStatsCollection(address);
  };


  // Fetch user collections
  const fetchCollections = async (userAddress: string): Promise<void> => {
    setIsLoading(true);
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const collectionsPaginated = await contract.getCollectionsByUser(userAddress);
      const collectionsData = await Promise.all(collectionsPaginated.map(mapCollectionData(contract)));
      setCollections(collectionsData);
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapCollectionData = (contract: Contract) => async (tuple: [BigNumber, string, string, string, string[], boolean, boolean]) => {
    const [id, name, type, creator, associated, isActive, isEditable] = tuple;
    const uri = await contract.getCollectionURI(id);
    return { id: id.toString(), name, type, creator, associated, isActive, isEditable, uri };
  };

  const fetchStatsCollection = async (userAddress: string) => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string);
    const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

    try {
      const userCollections: bigint = await contract.getNumberOfCollectionsByUser(userAddress);
      const remainingCollections: bigint = await contract.getRemainingCollections(userAddress);
      setUserCollections(Number(userCollections));
      setRemainingCollections(Number(remainingCollections));
    } catch (err) {
      console.error("Erreur de récupération des collections :", err);
    }
  };

  // Upload file and metadata to IPFS
  const uploadFileToIPFS = async (): Promise<void> => {
    if (!file || !metadata.name) {
      alert("Veuillez sélectionner un fichier et remplir le nom.");
      return;
    }

    if (!address ||! web3) {
      console.error("Erreur Web3 || Wallet");
      return;
    }

    setIsUploading(true);
    const factoryAddress = await fetchFactoryAddress(collectionType);
    const factoryABI = collectionType === "Art" ? ABI_ART_FACTORY : ABI_POESIE_FACTORY;
    const factoryContract = new web3.eth.Contract(factoryABI as any, factoryAddress);

    const gasPrice = await web3.eth.getGasPrice();

    try {
      const imageUrl = await uploadFile(file);
      const metadataUrl = await uploadMetadata({ ...metadata, image: imageUrl, maxEditions: collectionType === "Art" ? maxEditions : null });

      setIpfsUrl(metadataUrl);

      // Handle royalties
      const collaborators = splitRoyalties ? royaltyData.map(r => r.address) : [address || ""];
      const percents = splitRoyalties ? royaltyData.map(r => Number(r.value)) : [90];

      const tx = await handleMessageTransactions(
        factoryContract.methods
          .configureCollection(metadata.name, maxEditions, collaborators, percents)
          .send({ from: address,
            gasPrice: gasPrice.toString(),  // <-- force string
            maxFeePerGas: null as any,       // TS ok
            maxPriorityFeePerGas: null as any
           }),
        toast,
        "Configuration temporaire appliquée ✅",
        "Échec configuration"
      );


    } catch (err) {
      console.error('Erreur upload IPFS:', err);
      alert("Erreur lors de l'upload vers IPFS : ");
    } finally {
      setIsUploading(false);
    }
  };


  const handleRoyalties = async (factoryContract: any) => {
    const collaborators = splitRoyalties ? royaltyData.map(r => r.address) : [address || ""];
    const percents = splitRoyalties ? royaltyData.map(r => Number(r.value)) : [90];

    await handleMessageTransactions(
      factoryContract.methods.configureCollection(metadata.name, maxEditions, collaborators, percents).send({ from: address }),
      toast,
      "Configuration temporaire appliquée ✅",
      "Échec configuration"
    );
  };

  // Upload file to Pinata
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, createPinataHeaders());
    return `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${response.data.IpfsHash}`;
  };

  const uploadMetadata = async (metadata: any): Promise<string> => {
    const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadata, createPinataHeaders(true));
    return `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${response.data.IpfsHash}`;
  };

  const createPinataHeaders = (isJson: boolean = false) => ({
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
      'Content-Type': isJson ? 'application/json' : 'multipart/form-data'
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const addRoyaltyLine = () => {
    setRoyaltyData(prev => [...prev, { address: "", value: "" }]);
  };

  const removeRoyaltyLine = (index: number) => {
    setRoyaltyData(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch the factory address by type
  const fetchFactoryAddress = async (type: string): Promise<string> => {

    if (!web3) {
      console.error("Erreur Web3 || Wallet");
      throw new Error("Web3 non disponible");
    }


    const masterFactoryContract = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
    return await masterFactoryContract.methods.collectionFactories(type).call();
  };

  const handleRoyaltyChange = (index: number, field: "address" | "value", newValue: string) => {
    setRoyaltyData(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: newValue
      };
      return updated;
    });
  };


  const handleCreateCollection = async (): Promise<void> => {
    if (!metadata.name || !ipfsUrl) {
      toast({ title: "Erreur", description: "Nom et image requis", status: "error" });
      return;
    }

    setLoading(true);
    try {
      const tx = await createCollection();
      toast({ title: "Succès", description: `Collection créée ! TX: ${tx.transactionHash}`, status: "success" });
    } catch (err) {
      console.error("Erreur création : ", err);
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async (): Promise<any> => {

    if (!address ||! web3) {
      console.error("Erreur Web3 || Wallet");
      throw new Error("Web3 non disponible");
    }


    const accounts = await web3.eth.getAccounts();
    const from = accounts[0];
    const factoryAddress = await fetchFactoryAddress(collectionType);
    const factoryABI = collectionType === "Art" ? ABI_ART_FACTORY : ABI_POESIE_FACTORY;
    const factoryContract = new web3.eth.Contract(factoryABI as any, factoryAddress);
    const rescoeContract = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);

    const gasPrice = await web3.eth.getGasPrice();

    return handleMessageTransactions(
      rescoeContract.methods.createCollection(metadata.name, ipfsUrl, collectionType)
      .send({ from: address,
        gasPrice: gasPrice.toString(),  // <-- force string
        maxFeePerGas: null as any,       // TS ok
        maxPriorityFeePerGas: null as any
       }),
      toast,
      "Collection créée 🎉",
      "Échec création"
    );
  };

  // Render UI
  return (
    <Box maxW="700px" mx="auto" mt={10} p={10} borderRadius="3xl" boxShadow="dark-lg" border="1px solid" borderColor="purple.300">
      <Heading size="2xl" mb={6} textAlign="center" fontWeight="black" bgGradient="linear(to-r, purple.400, pink.400)" bgClip="text" letterSpacing="tight">
        Créez une collection
      </Heading>

      <HStack mx="auto" mb={6} textAlign="center" fontWeight="black" bgGradient="linear(to-r, purple.400, pink.400)" bgClip="text" letterSpacing="tight">
        <Text mt={4}>Collections crées : {userCollections} - </Text>
        <Text mt={4}>Collections restantes : {remainingCollections}</Text>
      </HStack>

      {/* File Input */}
      <FormLabel fontWeight="bold" color="gray.200">Image de la collection</FormLabel>
      <Input type="file" onChange={handleFileChange} mb={5} border="2px dashed" borderColor="purple.400" bg="blackAlpha.300" color="white" py={2} />

      {previewUrl && (
        <Box borderRadius="xl" overflow="hidden" boxShadow="md" mb={6} border="1px solid" borderColor="purple.300">
          <Image src={previewUrl} alt="Preview" boxSize="300px" objectFit="cover" mx="auto" transition="transform 0.3s ease" _hover={{ transform: "scale(1.05)" }} />
        </Box>
      )}

      <VStack spacing={4} align="stretch">
        <Input placeholder="Nom de la collection" name="name" value={metadata.name} onChange={handleMetadataChange} bg="blackAlpha.300" color="white" borderColor="purple.300" />
        <Input placeholder="Description" name="description" value={metadata.description} onChange={handleMetadataChange} bg="blackAlpha.300" color="white" borderColor="purple.300" />
        <Input placeholder="Tags (séparés par des virgules)" name="tags" value={metadata.tags} onChange={handleMetadataChange} bg="blackAlpha.300" color="white" borderColor="purple.300" />
      </VStack>

      <FormLabel mt={6} color="gray.300" fontWeight="bold">Type de collection</FormLabel>
      <Select placeholder="Sélectionnez un type" value={collectionType} onChange={(e) => setCollectionType(e.target.value)} bg="blackAlpha.300" color="white" borderColor="purple.300" mb={4}>
        <option style={{ backgroundColor: "#1A202C" }} value="Art">Art</option>
        <option style={{ backgroundColor: "#1A202C" }} value="Poesie">Poésie</option>
      </Select>

      {collectionType === "Art" && (
        <Box mt={6} p={4} border="1px solid" borderColor="purple.300" borderRadius="xl">
          <Heading size="md" mb={4} color="purple.300">Paramètres spécifiques ART</Heading>
          <FormLabel color="gray.300" fontWeight="bold">Nombre maximum d’éditions</FormLabel>
          <Input type="number" min={1} value={maxEditions} onChange={(e) => setMaxEditions(Number(e.target.value))} bg="blackAlpha.300" color="white" borderColor="purple.300" mb={4} />

          <HStack mb={4}>
            <input type="checkbox" checked={!splitRoyalties} onChange={() => {
              if (!splitRoyalties) {
                setRoyaltyData([{ address: address || "", value: "90" }]);
              }
              setSplitRoyalties(!splitRoyalties);
            }} />
            <Text color="white">Ne pas split (royalties 100% créateur)</Text>
          </HStack>

          {splitRoyalties && (
            <VStack spacing={3} align="stretch">
              {royaltyData.map((row, index) => (
                <HStack key={index}>
                  <Input placeholder="Adresse" value={row.address} onChange={e => handleRoyaltyChange(index, "address", e.target.value)} bg="blackAlpha.300" color="white" borderColor="purple.300" />
                  <Input placeholder="%" type="number" value={row.value} onChange={e => handleRoyaltyChange(index, "value", e.target.value)} bg="blackAlpha.300" color="white" borderColor="purple.300" w="100px" />
                  <Button size="sm" colorScheme="red" onClick={() => removeRoyaltyLine(index)}>-</Button>
                </HStack>
              ))}
              <Button size="sm" colorScheme="purple" onClick={addRoyaltyLine}>+ Ajouter une adresse</Button>
            </VStack>
          )}
        </Box>
      )}

      <Button mt={4} w="full" bgGradient="linear(to-r, teal.500, green.400)" color="white" fontWeight="bold" _hover={{ transform: "scale(1.03)" }} onClick={uploadFileToIPFS} isLoading={isUploading} isDisabled={!canUpload}>
        🚀 Enregistrez votre collection
      </Button>

      {ipfsUrl && <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>}
      <Divider my={10} borderColor="purple.300" />

      <Flex justify="center">
        <VStack>

          <Button
            onClick={handleCreateCollection}
            px={10} py={6} fontSize="lg" fontWeight="bold"
            borderRadius="full" bgGradient="linear(to-r, purple.700, pink.600)"
            color="white" boxShadow="lg"
            _hover={{ transform: "scale(1.05)", boxShadow: "2xl" }}
            isLoading={loading}
          >
            🎨 Créer la collection
          </Button>

        </VStack>
      </Flex>
    </Box>
  );
};

export default CreateCollection;
