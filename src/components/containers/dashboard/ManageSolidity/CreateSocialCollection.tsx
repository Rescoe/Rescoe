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
  Spinner,
} from "@chakra-ui/react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import { useAuth } from "../../../../utils/authContext";

import ABI_MESSAGE_FACTORY from "../../../ABI/Factories/MessageFactory.json";
import ABI_RESCOLLECTION from "../../../ABI/ABI_Collections.json";

const CreateSocialCollection: React.FC = () => {
  const toast = useToast();
  const { address: authAddress } = useAuth();

  const MESSAGE_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_MESSAGE_FACTORY_ADDRESS!;
  const RESCOLLECTION_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  const [salonName, setSalonName] = useState<string>("");
  const [requiresMembership, setRequiresMembership] = useState<boolean>(false);
  const [royaltyAddress, setRoyaltyAddress] = useState<string>("");
  const [metadata, setMetadata] = useState({ name: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingSalons, setIsFetchingSalons] = useState<boolean>(false);
  const [addressSalons, setAddressSalons] = useState<any[]>([]);

  // --- Init Web3 ---
  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const web3Instance = new Web3(provider as any);
        setWeb3(web3Instance);

        const accounts = await web3Instance.eth.requestAccounts();
        if (accounts && accounts.length > 0) setAccount(accounts[0]);
      } else {
        toast({
          title: "Erreur Web3",
          description: "Aucun portefeuille détecté. Installez Metamask.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    };
    initWeb3();
  }, [toast]);

  // --- Gestion fichier image ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
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

      // upload image
      const fileRes = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}` },
      });

      const imageUrl = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${fileRes.data.IpfsHash}`;

      // upload metadata
      const meta = {
        name: metadata.name,
        description: metadata.description,
        image: imageUrl,
      };
      const metaRes = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", meta, {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}` },
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
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erreur IPFS",
        description: err.message || "Impossible d’envoyer sur IPFS.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // --- Création du salon social ---
  const handleCreateSocial = async () => {
    if (!web3 || !account) return;
    if (!salonName || !metadata.name || !ipfsUrl) {
      toast({
        title: "Champs manquants",
        description: "Nom, image et métadonnées requis.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
  try {
    const messageFactory = new web3.eth.Contract(ABI_MESSAGE_FACTORY, MESSAGE_FACTORY_ADDRESS);
    const resFactory = new web3.eth.Contract(ABI_RESCOLLECTION, RESCOLLECTION_FACTORY_ADDRESS);

    const royaltyAddressToUse =
      royaltyAddress && web3.utils.isAddress(royaltyAddress)
        ? royaltyAddress
        : "0x0000000000000000000000000000000000000000";

    // 1️⃣ Configure le salon
    const gasSalon = await messageFactory.methods
      .configureSalon(salonName, requiresMembership, royaltyAddressToUse)
      .estimateGas({ from: account });

    const gasSalonWithMargin = Math.floor(Number(gasSalon) * 1.2);

    await messageFactory.methods
      .configureSalon(salonName, requiresMembership, royaltyAddressToUse)
      .send({ from: account, gas: gasSalonWithMargin.toString() });

    // 2️⃣ Crée la collection
    const gasCreate = await resFactory.methods
      .createCollection(metadata.name, ipfsUrl, "Social")
      .estimateGas({ from: account });

    const gasCreateWithMargin = Math.floor(Number(gasCreate) * 1.2);

    const tx = await resFactory.methods
      .createCollection(metadata.name, ipfsUrl, "Social")
      .send({ from: account, gas: gasCreateWithMargin.toString() });

    toast({
      title: "Salon social créé ✅",
      description: `Collection "${metadata.name}" déployée avec succès.`,
      status: "success",
      duration: 4000,
      isClosable: true,
    });

    console.log("✅ Transaction réussie:", tx.transactionHash);
  } catch (err: any) {
    console.error("❌ Erreur création salon:", err);
    toast({
      title: "Erreur",
      description: err?.message || "Échec de la création du salon.",
      status: "error",
      duration: 4000,
      isClosable: true,
    });
  } finally {
    setIsLoading(false);
  }
  };

  // --- Fetch salons existants ---
  const fetchAllSalons = async () => {
    if (!web3) return;
    setIsFetchingSalons(true);

    try {
      const messageFactory = new web3.eth.Contract(ABI_MESSAGE_FACTORY, MESSAGE_FACTORY_ADDRESS);
      const resFactory = new web3.eth.Contract(ABI_RESCOLLECTION, RESCOLLECTION_FACTORY_ADDRESS);

      const salonListRaw = await messageFactory.methods.getAllSalons().call();
      const salonList = Array.isArray(salonListRaw) ? salonListRaw : [];

      const total = await resFactory.methods.getTotalCollectionsMinted().call();

      const socialsRaw = await resFactory.methods
        .getCollectionsByType("Social", 0, Number(total) - 1)
        .call();

      const socials = Array.isArray(socialsRaw) ? socialsRaw : [];

      const data = socials.map((c: any, i: number) => ({
        name: (salonList[i] as any)?.name || salonList[i] || `Salon #${i}`,
        address: typeof c === "string" ? c : c.collectionAddress,
      }));



      setAddressSalons(data);

      toast({
        title: "Salons chargés",
        description: `${data.length} salon(s) trouvés.`,
        status: "success",
        duration: 3000,
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

  return (
    <Box maxW="700px" mx="auto" mt={10} p={10} borderRadius="3xl" boxShadow="dark-lg" border="1px solid" borderColor="purple.300">
      <Heading size="xl" textAlign="center" mb={6} bgGradient="linear(to-r, purple.400, pink.400)" bgClip="text">
        Création d’un salon social
      </Heading>

      <VStack spacing={4} align="stretch">
        <FormLabel color="gray.300" fontWeight="bold">
          Nom du salon
        </FormLabel>
        <Input
          placeholder="Nom du salon Discord"
          value={salonName}
          onChange={(e) => setSalonName(e.target.value)}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">
          Adhésion requise ?
        </FormLabel>
        <Select
          value={requiresMembership ? "yes" : "no"}
          onChange={(e) => setRequiresMembership(e.target.value === "yes")}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        >
          <option style={{ backgroundColor: "#1A202C" }} value="no">
            Non
          </option>
          <option style={{ backgroundColor: "#1A202C" }} value="yes">
            Oui
          </option>
        </Select>

        <FormLabel color="gray.300" fontWeight="bold">
          Adresse de royalties (facultatif)
        </FormLabel>
        <Input
          placeholder="Adresse Ethereum"
          value={royaltyAddress}
          onChange={(e) => setRoyaltyAddress(e.target.value)}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">
          Nom de la collection
        </FormLabel>
        <Input
          placeholder="Titre de la collection"
          value={metadata.name}
          onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">
          Description
        </FormLabel>
        <Input
          placeholder="Description du salon"
          value={metadata.description}
          onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
          bg="blackAlpha.300"
          color="white"
          borderColor="purple.300"
        />

        <FormLabel color="gray.300" fontWeight="bold">
          Image
        </FormLabel>
        <Input type="file" onChange={handleFileChange} border="2px dashed" borderColor="purple.400" />
        {previewUrl && <Image src={previewUrl} alt="Preview" borderRadius="xl" mt={3} />}

        <Button onClick={uploadToIPFS} isLoading={isUploading} bgGradient="linear(to-r, teal.500, green.400)" color="white">
          🔼 Envoyer sur IPFS
        </Button>

        {ipfsUrl && <Text wordBreak="break-word">IPFS: {ipfsUrl}</Text>}

        <Divider borderColor="purple.400" my={6} />

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
            _hover={{ transform: "scale(1.05)" }}
            isLoading={isLoading}
          >
            🚀 Créer le salon social
          </Button>
        </Flex>
      </VStack>

      <Divider borderColor="purple.400" my={8} />

      <Heading size="lg" mb={4} textAlign="center" bgGradient="linear(to-r, blue.400, cyan.300)" bgClip="text">
        Voir les salons existants
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

      {isFetchingSalons ? (
        <Flex justify="center">
          <Spinner />
        </Flex>
      ) : (
        addressSalons.length > 0 && (
          <Box p={4} borderRadius="xl" bg="blackAlpha.400">
            <VStack align="start" spacing={2}>
              {addressSalons.map((s, i) => (
                <Text key={i}>
                  {s.name} — <b>{s.address}</b>
                </Text>
              ))}
            </VStack>
          </Box>
        )
      )}
    </Box>
  );
};

export default CreateSocialCollection;
