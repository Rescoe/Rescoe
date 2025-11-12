import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  Input,
  Button,
  Text,
  FormLabel,
  useToast,
  Select,
  Image,
  Flex,
  Divider,
} from "@chakra-ui/react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import { useAuth } from '../../../../utils/authContext';

import ABI_MESSAGE_FACTORY from '../../../ABI/Factories/MessageFactory.json';
import ABI_RESCOLLECTION from "../../../ABI/ABI_Collections.json";

const CreateSocialCollection: React.FC = () => {
  const toast = useToast();
  const { address: authAddress } = useAuth();

  const MESSAGE_FACTORY_ADDRESS = "0xb2E7A696AC5AD781460608AC8410D18C571cBa31";
  const RESCOLLECTION_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [royaltyAddress, setRoyaltyAddress] = useState<string>(authAddress || ""); // valeur par défaut


  const [salonName, setSalonName] = useState<string>("");
  const [requiresMembership, setRequiresMembership] = useState<boolean>(false);
  const [metadata, setMetadata] = useState({ name: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [salons, setSalons] = useState<string[]>([]);

  interface CollectionInfo {
    name?: string;
    collectionType?: string;
    collectionAddress: string;
    creator?: string;
  }

  const [addressSalons, setAddressSalons] = useState<CollectionInfo[]>([]);

  const [isFetchingSalons, setIsFetchingSalons] = useState<boolean>(false);


  // --- Init Web3 ---
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


  const fetchAllSalons = async () => {
    if (!web3) return;
    setIsFetchingSalons(true);

    try {
      const messageFactory = new web3.eth.Contract(ABI_MESSAGE_FACTORY, MESSAGE_FACTORY_ADDRESS);
      const resFactory = new web3.eth.Contract(ABI_RESCOLLECTION, RESCOLLECTION_FACTORY_ADDRESS);

      // --- Récupération des noms de salons depuis MessageFactory ---
      const salonListRaw: any = await messageFactory.methods.getAllSalons().call();
      const salonList = Array.isArray(salonListRaw) ? salonListRaw : Object.values(salonListRaw);

      // --- Récupération de TOUTES les collections Social ---
      const totalMinted = await resFactory.methods.getTotalCollectionsMinted().call();
      const addressSalonRaw: any = await resFactory.methods
        .getCollectionsByType("Social", 0, Number(totalMinted)-1)
        .call();

      const addressSalonArray = Array.isArray(addressSalonRaw)
        ? addressSalonRaw
        : Object.values(addressSalonRaw);

      // --- Association correcte par NOM (pas par index) ---
      const collectionsInfo: CollectionInfo[] = addressSalonArray.map((c: any) => {
        const collectionAddress =
          typeof c === "string"
            ? c
            : c.collectionAddress || JSON.stringify(c);

        const collectionType =
          typeof c === "object" && c.collectionType ? c.collectionType : "Social";

        // Trouver un salon dont le nom correspond à la collection
        const match = salonList.find((s: any) => {
          const salonName =
            typeof s === "string"
              ? s
              : s.name || s.salonName || "";
          return (
            salonName.toLowerCase().trim() ===
            (c.name || c.collectionName || "").toLowerCase().trim()
          );
        });

        const name = match
          ? typeof match === "string"
            ? match
            : match.name || match.salonName
          : "Salon inconnu";

        return { name, collectionType, collectionAddress };
      });

      setSalons(salonList);
      setAddressSalons(collectionsInfo);

      toast({
        title: "Salons chargés",
        description: `${collectionsInfo.length} salon(s) trouvé(s).`,
        status: "success",
        duration: 2500,
        isClosable: true,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les salons.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsFetchingSalons(false);
    }
  };

  // --- Gestion fichier image ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  // --- Upload sur IPFS ---
  const uploadToIPFS = async () => {
    if (!file || !metadata.name) {
      toast({
        title: "Champs manquants",
        description: "Veuillez ajouter une image et un nom.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const fileRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
      });

      const imageUrl = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${fileRes.data.IpfsHash}`;

      const meta = {
        name: metadata.name,
        description: metadata.description,
        image: imageUrl,
      };

      const metaRes = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", meta, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
      });

      const url = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${metaRes.data.IpfsHash}`;
      setIpfsUrl(url);

      toast({
        title: "Upload réussi",
        description: "Fichier et métadonnées envoyés sur IPFS.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d’envoyer les données sur IPFS.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- Création du salon social ---
  const handleCreateSocial = async () => {
    if (!web3 || !account) return;
    if (!salonName || !ipfsUrl) {
      toast({
        title: "Champs manquants",
        description: "Le nom du salon et l'image IPFS sont requis.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      // 1️⃣ Configurer le salon sur MessageFactory
      const messageFactory = new web3.eth.Contract(ABI_MESSAGE_FACTORY, MESSAGE_FACTORY_ADDRESS);
      await messageFactory.methods
        .configureSalon(salonName, requiresMembership, royaltyAddress)
        .send({ from: account });

      // 2️⃣ Créer la collection sur ResCollectionFactory
      const resFactory = new web3.eth.Contract(ABI_RESCOLLECTION, RESCOLLECTION_FACTORY_ADDRESS);
      const tx = await resFactory.methods.createCollection(metadata.name, ipfsUrl, "Social").send({ from: account });

      toast({
        title: "Salon social créé",
        description: `Collection "${metadata.name}" déployée. Tx: ${tx.transactionHash.slice(0, 10)}...`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur",
        description: err.message || "Échec lors de la création.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };


//On donne automatiquement a la collection le nom du salon.
//C'est necessaire au niveau du contrat que les deux aient le meme nom pour transmettre les règles d'adhésion (et peut etre d'autres dans le futur, royalties etc)
  useEffect(() => {
  setMetadata((prev) => ({ ...prev, name: salonName }));
}, [salonName]);

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
<Box>
<Heading
  size="xl"
  mb={6}
  textAlign="center"
  fontWeight="black"
  bgGradient="linear(to-r, purple.400, pink.400)"
  bgClip="text"
>
  Voir les salon existants
</Heading>

    <Button
  onClick={fetchAllSalons}
  bgGradient="linear(to-r, blue.500, cyan.400)"
  color="white"
  mb={4}
  isLoading={isFetchingSalons}
>
  📜 Afficher les salons existants
</Button>

{salons.length > 0 && (
  <Box mt={4} p={4} borderRadius="xl" bg="blackAlpha.400">
    <Heading size="md" mb={3} color="purple.200">
      Salons existants :
    </Heading>
    <VStack align="start" spacing={2}>
    {addressSalons.map((s, i) => (
      <Text key={i}>
        {s.name} — {s.collectionAddress}
      </Text>
      ))}
    </VStack>
  </Box>
)}

</Box>
      <Heading
        size="xl"
        mb={6}
        textAlign="center"
        fontWeight="black"
        bgGradient="linear(to-r, purple.400, pink.400)"
        bgClip="text"
      >
        Création d’un salon social
      </Heading>
      <Heading
        size="l"
        mb={6}
        textAlign="center"
        fontWeight="black"
        bgGradient="linear(to-r, purple.400, pink.400)"
        bgClip="text"
      >
        Attention addresse adhesion du contrat doit etre management adhesion
      </Heading>

      <VStack spacing={4} align="stretch">
        <FormLabel color="gray.300" fontWeight="bold">Nom du salon</FormLabel>
        <Input
          placeholder="Nom du salon Discord"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">Adhésion requise ?</FormLabel>
        <Select
          value={requiresMembership ? "yes" : "no"}
          onChange={(e) => setRequiresMembership(e.target.value === "yes")}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        >
          <option style={{ backgroundColor: "#1A202C" }} value="no">Non</option>
          <option style={{ backgroundColor: "#1A202C" }} value="yes">Oui</option>
        </Select>

        <FormLabel color="gray.300" fontWeight="bold">Description</FormLabel>
        <Input
          placeholder="Description du salon social"
          value={metadata.description}
          onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">Adresse de royaltie principale</FormLabel>
<Input
  placeholder="0x..."
  value={royaltyAddress}
  onChange={(e) => setRoyaltyAddress(e.target.value)}
  bg="blackAlpha.300"
  color="white"
  borderColor="purple.300"
/>


        <FormLabel color="gray.300" fontWeight="bold">Image</FormLabel>
        <Input type="file" onChange={handleFileChange} border="2px dashed" borderColor="purple.400" />
        {previewUrl && <Image src={previewUrl} alt="Preview" borderRadius="xl" mt={3} />}

        <Button
          mt={3}
          bgGradient="linear(to-r, teal.500, green.400)"
          color="white"
          onClick={uploadToIPFS}
          isLoading={isUploading}
        >
          🔼 Envoyer sur IPFS
        </Button>

        {ipfsUrl && <Text wordBreak="break-word">IPFS: {ipfsUrl}</Text>}


        <Divider borderColor="purple.400" my={6} />

        <Text fontStyle="italic">
Nom de la collection : {metadata.name || "— (sera le même que le salon)"}
</Text>

        <Flex justify="center">

          <Button
            onClick={handleCreateSocial}
            px={10}
            py={6}
            fontSize="lg"
            fontWeight="bold"
            borderRadius="full"
            bgGradient="linear(to-r, purple.700, pink.600)"
            color="white"
            boxShadow="lg"
            _hover={{ transform: "scale(1.05)" }}
            isLoading={isLoading}
          >
            🚀 Créer le salon social
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};

export default CreateSocialCollection;
