import React, { useState, useEffect } from "react";
import {
  Box, Heading, VStack, Divider, Flex, HStack, Input, Button, Text,
  FormLabel, useToast, Image, Checkbox, Select
} from "@chakra-ui/react";
import axios from "axios";
import Web3 from "web3";
import { useAuth } from "@/utils/authContext";
import { handleMessageTransactions } from "@/utils/handleMessageTransactions"; // ← AJOUTÉ !

import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";
import ABI_MasterFactory from "@/components/ABI/Factories/ABI_MasterFactory.json";
import ABI_SOCIAL_FACTORY from "@/components/ABI/Factories/ABI_SOCIAL_FACTORY.json";

const CreateSocialCollection: React.FC = () => {
  const toast = useToast();
  const { web3, address } = useAuth();

  const RESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const MASTER_FACTORY = process.env.NEXT_PUBLIC_MASTERFACTORY_CONTRACT!;

  // États (même structure)
  const [salonName, setSalonName] = useState("");
  const [description, setDescription] = useState("Salon Social RESCOE");
  const [requiresMembership, setRequiresMembership] = useState(false);
  const [royaltyAddress, setRoyaltyAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [salonConfigured, setSalonConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [userCollections, setUserCollections] = useState(0);
  const [remainingCollections, setRemainingCollections] = useState(0);
  const [isResident, setIsResident] = useState(false);

  const RESIDENTS_ADDRESSES = [
    "0x552C63E3B89ADf749A5C1bB66fE574dF9203FfB4".toLowerCase(),
  ];

  useEffect(() => {
    if (address) {
      setIsResident(RESIDENTS_ADDRESSES.includes(address.toLowerCase()));
      setRoyaltyAddress(address || "");
      initialize(address);
    }
  }, [address]);

  const initialize = async (userAddress: string) => {
    await fetchStatsCollection(userAddress);
  };

  const fetchStatsCollection = async (userAddress: string) => {
    if (!web3) return;
    const rescoeContract = new web3.eth.Contract(ABIRESCOLLECTION as any, RESCOLLECTION);
    try {
      const userCollections: any = await rescoeContract.methods.getNumberOfCollectionsByUser(userAddress).call();
      const remainingCollections: any = await rescoeContract.methods.getRemainingCollections(userAddress).call();
      setUserCollections(Number(userCollections));
      setRemainingCollections(Number(remainingCollections));
    } catch (err) {
      console.error("Erreur stats:", err);
    }
  };

  // 🚀 CORRIGÉ: Même pattern que Art/Poesie
  const configureSalon = async () => {
    if (!web3 || !address || !salonName || !royaltyAddress) {
      toast({ title: "Champs manquants", status: "warning" });
      return false;
    }

    try {
      // 1. Récup factory (comme Art/Poesie)
      const master = new web3.eth.Contract(ABI_MasterFactory as any, MASTER_FACTORY!);
      const factoryAddr = await master.methods.collectionFactories("Social").call();
      //console.log("🏭 Social Factory:", factoryAddr);

      const factory = new (web3 as any).eth.Contract(ABI_SOCIAL_FACTORY as any, factoryAddr)
      // 2. Vérif existe déjà
      const configExists = await factory.methods.salonConfigs(salonName).call();
      if (configExists.exists) {
        //console.log("✅ Déjà configuré");
        setSalonConfigured(true);
        return true;
      }

      // 3. ESTIMATION GAS + handleMessageTransactions (COMME ART !)
      //console.log("⚙️ Config:", salonName, requiresMembership, royaltyAddress);

      const gasEstimate = await factory.methods
        .configureSalon(salonName, requiresMembership, royaltyAddress)
        .estimateGas({ from: address! });

      //console.log("⛽ Gas estimé:", gasEstimate.toString());

      const tx = await handleMessageTransactions(
        factory.methods
          .configureSalon(salonName, requiresMembership, royaltyAddress)
          .send({
            from: address!,
            gas: Math.floor(Number(gasEstimate) * 1.2).toString() // +20% marge
          }),
        toast,
        "✅ Salon configuré",
        "❌ Erreur configuration"
      );

      //console.log("✅ TX Config:", tx.transactionHash);
      setSalonConfigured(true);
      toast({ title: "Salon configuré !", status: "success" });
      return true;

    } catch (e: any) {
      console.error("❌ Config échouée:", e.message);
      toast({ title: "Erreur config", description: e.message, status: "error" });
      return false;
    }
  };

  const createPinataHeaders = (isJson = false) => ({
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT_OEUVRES}`,
      "Content-Type": isJson ? "application/json" : "multipart/form-data",
    },
  });

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, createPinataHeaders());
    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  };

  // ✅ MODIFIÉ: Upload + configure (comme Art/Poesie)
  const uploadMetadataToIPFS = async () => {
    if (!file || !salonName || !address || !royaltyAddress) {
      toast({ title: "Champs manquants", status: "warning" });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Image IPFS
      const imageUrl = await uploadFile(file);

      // 2. Metadata IPFS
      const metadata = {
        name: salonName,
        description,
        image: imageUrl,
        requiresMembership,
        royaltyAddress,
      };

      const metaResponse = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadata,
        createPinataHeaders(true)
      );

      const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metaResponse.data.IpfsHash}`;
      setIpfsUrl(metadataUrl);
      toast({ title: "IPFS prêt", status: "success" });

      // 3. AUTO-CONFIGURE (comme Art/Poesie)
      await configureSalon();

    } catch (err: any) {
      toast({ title: "Erreur IPFS", description: err.message, status: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ SIMPLIFIÉ: Juste create (comme Art/Poesie)
  const createSalon = async () => {
    if (!ipfsUrl || !salonName) return;

    setLoading(true);
    try {
      const rescol = new web3!.eth.Contract(ABIRESCOLLECTION as any, RESCOLLECTION);

      // Estimate gas
      const gasEstimate = await rescol.methods
        .createCollection(salonName, ipfsUrl, "Social")
        .estimateGas({ from: address! });

      const tx = await handleMessageTransactions(
        rescol.methods.createCollection(salonName, ipfsUrl, "Social").send({
          from: address!,
          gas: Math.floor(Number(gasEstimate) * 1.2).toString()
        }),
        toast,
        "✅ Salon créé !",
        "❌ Erreur création"
      );

      toast({
        title: "🎉 Succès",
        description: `TX: ${tx.transactionHash}`,
        status: "success"
      });

      // Reset
      setSalonName("");
      setIpfsUrl(null);
      setFile(null);
      setPreviewUrl(null);
      setSalonConfigured(false);

    } catch (e: any) {
      toast({ title: e.message, status: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setPreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  const canUpload = file && salonName.trim() && royaltyAddress;

  return (
    <Box
      maxW="700px"
      mx="auto"
      mt={10}
      p={{ base: 6, md: 10 }}
      borderRadius="2xl"
      boxShadow="dark-lg"
      border="1px solid"
      borderColor="brand.gold"
      bg="rgba(1,28,57,0.8)"
    >
      <Heading size={{ base: "xl", md: "2xl" }} mb={6} textAlign="center" fontWeight="black" bgClip="text">
        Créer un Salon Social RESCOE
      </Heading>

      <HStack mx="auto" mb={6} fontWeight="bold" color="brand.gold">
        <Text>Collections: {userCollections}</Text>
        <Text>— Restantes: {remainingCollections}</Text>
      </HStack>

      <FormLabel fontWeight="bold" color="brand.cream">Image</FormLabel>
      <Input
        type="file"
        onChange={handleFileChange}
        mb={5}
        border="2px dashed"
        borderColor="brand.gold"
        color="brand.cream"
        _hover={{ borderColor: "brand.cream" }}
      />
      {previewUrl && (
        <Image src={previewUrl} alt="Preview" boxSize="300px" objectFit="cover" mx="auto" mb={6} borderRadius="xl" />
      )}

      <VStack spacing={4} align="stretch">
        <Input placeholder="Nom salon *" value={salonName} onChange={e => setSalonName(e.target.value)} focusBorderColor="brand.gold" />
        <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} focusBorderColor="brand.gold" />
        <Checkbox isChecked={requiresMembership} onChange={e => setRequiresMembership(e.target.checked)} colorScheme="yellow">
          <Text ml={2} color="brand.cream">Adhésion requise</Text>
        </Checkbox>
      </VStack>

      <Box mt={6} p={4} border="1px solid" borderColor="whiteAlpha.200" borderRadius="xl">
        <Heading size="md" mb={4} color="brand.gold">Adresse Royalties (100%)</Heading>
        <Select value={royaltyAddress} onChange={e => setRoyaltyAddress(e.target.value)} bg="blackAlpha.300">
          <option value={address || ""}>Créateur ({address?.slice(0,6)}...)</option>
        </Select>
      </Box>

      {salonConfigured && <Text color="green.400" fontWeight="bold">✅ Salon configuré: {salonName}</Text>}

      <Button
        mt={6} w="full" bgGradient="linear(to-r, teal.500, green.400)"
        onClick={uploadMetadataToIPFS} isLoading={isUploading} isDisabled={!canUpload || !isResident}
      >
        🚀 1. IPFS + Configurer
      </Button>
      {ipfsUrl && <Text fontSize="xs" color="whiteAlpha.500">{ipfsUrl}</Text>}

      <Divider my={8} borderColor="whiteAlpha.200" />
      <Button
        w="full"
        px={10}
        py={6}
        fontSize="lg"
        bg="brand.gold"
        color="brand.navy"
        fontWeight="bold"
        _hover={{ bg: "brand.cream" }}
        onClick={createSalon}
        isLoading={loading}
        isDisabled={!ipfsUrl || !salonConfigured || !isResident}
      >
        🎉 2. Créer Salon
      </Button>
    </Box>
  );
};

export default CreateSocialCollection;
