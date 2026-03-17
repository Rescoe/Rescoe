import React, { useState, useEffect } from "react";
import { Box, Heading, VStack, Divider, Flex, HStack, Input, Button, Text, FormLabel, useToast, Image, Select, Progress, useColorModeValue, useColorMode, useTheme } from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import { useAuth } from '@/utils/authContext';
import { handleMessageTransactions } from '@/utils/handleMessageTransactions';
import ABIRESCOLLECTION from '@/components/ABI/ABI_Collections.json';
import ABIMasterFactory from '@/components/ABI/Factories/ABI_MasterFactory.json';
import ABI_ART_FACTORY from '@/components/ABI/Factories/ABI_ART_FACTORY.json';
import ABI_POESIE_FACTORY from '@/components/ABI/Factories/ABI_POESIE_FACTORY.json';
import ABI_Adhesion from '@/components/ABI/ABIAdhesion.json';
import { usePinataUpload } from "@/hooks/usePinataUpload"; // ✅ NOUVEAU
import {
  config,
  colors,
  styles,
  components,
  hoverStyles,
  gradients,
  effects,
  animations,
brandHover,
 } from "@styles/theme"; //Style


import Web3 from "web3";

const CreateCollection: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
  const contratAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

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

  const { metadataUri, imageUri, isUploading: pinataUploading, uploadToIPFS } = usePinataUpload();
  // Supprime : [isUploading, setIsUploading]
  const [isUploading, setIsUploading] = useState(false); // Garde pour configureCollection

  const [userCollections, setUserCollections] = useState<number>(0);
  const [remainingCollections, setRemainingCollections] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [collectionType, setCollectionType] = useState<string>('');
  const [splitRoyalties, setSplitRoyalties] = useState<boolean>(true);
  const [royaltyData, setRoyaltyData] = useState<{ address: string; value: string }[]>([{ address: "", value: "" }]);
  const [maxEditions, setMaxEditions] = useState<number>(1);

  const { colorMode } = useColorMode();  // ✅ AJOUTEZ CETTE LIGNE
  const theme = useTheme();

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
      if (!file || !metadata.name || !collectionType) {
        alert("Champs incomplets");
        return;
      }

      if (!address || !web3) return;

      setIsUploading(true);

      try {
        // 1. Factory + configureCollection (INCHANGÉ)
        const factoryAddress = await fetchFactoryAddress(collectionType!);
        const factoryABI = collectionType === "Art" ? ABI_ART_FACTORY : ABI_POESIE_FACTORY;
        const factoryContract = new web3.eth.Contract(factoryABI as any, factoryAddress);

        const collaborators = splitRoyalties
          ? royaltyData.map(r => r.address)
          : [address!];

        const percents = splitRoyalties
          ? royaltyData.map(r => Number(r.value))
          : [90];

          // Estimate gas (simulation sans exécution complète)
          const gasEstimate = await factoryContract.methods.configureCollection(
            metadata.name,
            Number(maxEditions),
            collaborators,
            percents
          ).estimateGas({ from: address });

          const gasPrice = await web3.eth.getGasPrice();

        await handleMessageTransactions(
          factoryContract.methods.configureCollection(
            metadata.name,
            Number(maxEditions),
            collaborators,
            percents
          ).send({
            from: address,
            gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
            gasPrice: gasPrice.toString()
          }),
          toast,
          "Configuration appliquée"
        );

        // 2. ✅ UPLOAD IPFS VIA HOOK (comme badges)
        const fullMetadata = {
          name: metadata.name,
          description: metadata.description,
          tags: metadata.tags.split(',').map(t => t.trim()),
          maxEditions,
          attributes: [
            { trait_type: "CollectionType", value: collectionType },
            { trait_type: "Creator", value: address },
            // Ajoute color_profile si image analysée
          ]
        };

        await uploadToIPFS({
          scope: "oeuvres",
          imageFile: file,
          name: metadata.name,
          description: metadata.description,
          tags: metadata.tags,
          attributes: fullMetadata.attributes || [],  // Optionnel
          custom_data: {
            maxEditions,
            collectionType,
            royalties: royaltyData  // Si besoin
          }
          // ✅ OMIT level/family/evolution (optionnels dans hook)
        });


        // 3. metadataUri prêt (comme badges)
        if (!metadataUri) throw new Error("Upload IPFS échoué");
        setIpfsUrl(metadataUri);

        toast({
          title: "✅ Collection configurée",
          description: `IPFS: ${metadataUri.slice(0, 50)}...`,
          status: "success"
        });
       //console.log(metadataUri);

    // Remplace le try/catch final :
  } catch (err: any) {
    console.error("Upload échoué:", err);
    toast({ title: "❌ Erreur", description: err.message, status: "error" });
  } finally {
    setIsUploading(false);

    // ✅ FORCE setIpfsUrl même si hook state lag
    if (metadataUri) {
      setIpfsUrl(metadataUri);
     //console.log("✅ FORCÉ ipfsUrl:", metadataUri);
    }
  }
  };


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
    if (!address || !web3) throw new Error("Web3 non disponible");

    const rescoeContract = new web3.eth.Contract(ABIRESCOLLECTION as any, contractRESCOLLECTION);
    const adhesionContract = new web3.eth.Contract(ABI_Adhesion as any, contratAdhesion);
    const toastPrefix = "🚨 [handleCreateCollection]";

    const artFactoryAddr = await fetchFactoryAddress("Art");
const artFactoryContract = new web3.eth.Contract(ABI_ART_FACTORY as any, artFactoryAddr);
const resCollectionsAuth = await artFactoryContract.methods.resCollectionsAuthorized().call();
const masterFactoryAuth = await artFactoryContract.methods.masterFactoryAuthorized().call();
//console.log("📍 ArtFactory autorisations attendues:", resCollectionsAuth, masterFactoryAuth);
//console.log("📍 ResCoellectionManager réelle:", contractRESCOLLECTION.toLowerCase());
//console.log("✅ Match ResCollections?", resCollectionsAuth.toLowerCase() === contractRESCOLLECTION.toLowerCase());

    //console.log("=== 🔍 DEBUG COMPLET createCollection ===");
    //console.log("1. collectionName:", metadata.name);
    //console.log("2. ipfsUrl:", ipfsUrl);
    //console.log("3. collectionType:", collectionType);
    //console.log("4. address:", address);
    //console.log("5. ResCollections:", contractRESCOLLECTION);

    // 🔍 QUI EST APPELÉ ?
    const rescoeFactory = await rescoeContract.methods.factoryContractAddress().call();
    //console.log("📍 ResCoellectionManager.factoryContractAddress =", rescoeFactory);

    const masterFactory = new web3.eth.Contract(ABIMasterFactory as any, masterFactoryAddress);
    const artFactoryFromMaster = await masterFactory.methods.collectionFactories("Art").call();
    //console.log("🎨 ArtFactory VIA Master =", artFactoryFromMaster);

    const authorized1 = await artFactoryContract.methods.resCollectionsAuthorized().call();
    const authorized2 = await artFactoryContract.methods.masterFactoryAuthorized().call();
    //console.log("🔑 ArtFactory autorisés:", { resCollectionsAuthorized: authorized1, masterFactoryAuthorized: authorized2 });
    //console.log("❌ Master OK?", authorized2.toLowerCase() === masterFactoryAddress.toLowerCase());

    try {
      // 🔹 1. VÉRIF ADHÉSION EXTERNE (via getUserInfo direct)
      //console.log("🔹 1. ADHÉSION EXTERNE...");
      const userInfo: [boolean, any, any] = await adhesionContract.methods.getUserInfo(address).call() as any;

      //console.log("✅ getUserInfo:", userInfo[0]);
      if (!userInfo[0]) throw new Error("❌ NO ADHESION");

      // 🔹 2. VÉRIF COMPTEURS EXACTS (fonctions PUBLIQUES)
      //console.log("🔹 2. COMPTEURS PUBLICS...");
      const balance = await rescoeContract.methods.checkUserAdhesionNumber(address).call();
      const count = await rescoeContract.methods.getNumberOfCollectionsByUser(address).call();
      const remaining = await rescoeContract.methods.getRemainingCollections(address).call();


      //console.log("💰 checkUserAdhesionNumber:", balance);
      //console.log("📊 getNumberOfCollectionsByUser:", count);
      //console.log("🎯 getRemainingCollections:", remaining);
      //console.log("✅ balance > count?", Number(balance) > Number(count));

      if (Number(balance) <= Number(count)) throw new Error(`❌ NO REMAINING: ${balance} <= ${count}`);

      // 🔹 3. VÉRIF TYPE (PUBLIC mapping)
      const typeOK = await rescoeContract.methods.allowedCollectionTypes(collectionType).call();
      //console.log("✅ allowedCollectionTypes:", typeOK);
      if (!typeOK) throw new Error("❌ INVALID TYPE");

      // 🔹 4. VÉRIF FACTORY + CONFIG (Art seulement)
      let artFactoryAddr: string;
      // 🔹 4. VÉRIF FACTORY + CONFIG (Art seulement)
  if (collectionType === "Art") {
    artFactoryAddr = await fetchFactoryAddress("Art");
    //console.log("🏭 MasterFactory:", masterFactoryAddress);
    //console.log("🎨 ArtFactory:", artFactoryAddr);

    const artFactory = new web3.eth.Contract(ABI_ART_FACTORY as any, artFactoryAddr);

    // 🔍 NOM EXACT
    const exactName = metadata.name.trim();
    //console.log("📝 NOM POUR CHECK:", `"${exactName}"`, "length:", exactName.length);

    try {
      const cfg: any = await artFactory.methods.getUserCollectionConfig(address, exactName).call();
      /*//console.log("🔍 FULL CFG:", {
        exists: cfg[3],
        maxSupply: cfg[0]?.toString() || "0",
        collaboratorsLen: cfg[1]?.length || 0,
        percentsLen: cfg[2]?.length || 0,
        lengthsMatch: (cfg[1]?.length || 0) === (cfg[2]?.length || 0),
        totalPercentOK: cfg[2]?.reduce((a: any, b: any) => Number(a) + Number(b), 0) <= 100
      });*/

      if (!cfg[3]) throw new Error("❌ CFG EXISTS=false");
      if ((cfg[1]?.length || 0) !== (cfg[2]?.length || 0)) throw new Error("❌ LENGTHS MISMATCH");
    } catch (cfgErr: any) {
      console.error("💥 CFG FAIL:", cfgErr.message);
      throw new Error(`❌ getUserCollectionConfig FAIL: ${exactName}`);
    }
  }


      // 🔹 5. FACTORY DANS RESCOE (CRITIQUE !)
      const rescoeFactoryAddr: string = await rescoeContract.methods.factoryContractAddress().call() as string;


      if (!metadata.name || !ipfsUrl) throw new Error("❌ Nom et IPFS requis");

      // 🔹 6. SIMULATION CALL (seulement les fonctions PUBLIQUES)
      web3.eth.handleRevert = true;

      // Estimate gas (simulation sans exécution complète)
      const gasEstimate = await rescoeContract.methods.createCollection(metadata.name, ipfsUrl, collectionType)
        .estimateGas({ from: address });
      //console.log("⛽ Gas estimate:", gasEstimate.toString());

      //console.log(`${toastPrefix} ✅ ALL PRE-CHECKS PASSED → CREATE COLLECTION`);
      setLoading(true);

      const gasPrice = await web3.eth.getGasPrice();

//console.log("💡 TX PARAMS:");
//console.log("- From (EOA):", address);
//console.log("- ResCollections:", contractRESCOLLECTION);
//console.log("- MasterFactory:", masterFactoryAddress);
//console.log("- Gas:", Math.floor(Number(gasEstimate) * 1.2));
//console.log("- Gas price:", gasPrice.toString());

// 🔹 DEBUG CALLER ATTENDU
//console.log("🔍 QUI EST APPELÉ PAR QUI ?");
//console.log("1. EOA (toi) → ResCollections.createCollection()");
//console.log("2. ResCollections →", await rescoeContract.methods.factoryContractAddress().call());
//console.log("3. ???? → ArtFactory.createDynamicCollection()");
//console.log("   ↓ msg.sender dans ArtFactory sera ÇA");

//console.log("\n🎯 Dans ArtFactory, require(msg.sender == X):");
//console.log("✅ X = ResCollections:", contractRESCOLLECTION);
//console.log("❌ X ≠ EOA:", address);
//console.log("❌ X ≠ MasterFactory:", masterFactoryAddress);





// 🔹 7. TRANSACTION REELLE
const tx = await handleMessageTransactions(
  rescoeContract.methods.createCollection(metadata.name, ipfsUrl, collectionType)
    .send({
      from: address,
      gas: Math.floor(Number(gasEstimate) * 1.2).toString(),
      gasPrice: gasPrice.toString()
    }),
  toast,
  "Collection créée ✅"
);


      //console.log("🎉 TX SUCCESS:", tx.transactionHash);
      toast({
        title: "🎉 Succès",
        description: `Collection "${metadata.name}" créée ! TX: ${tx.transactionHash.slice(0, 10)}...`,
        status: "success",
      });

      // 🔹 8. REFRESH
      await Promise.all([fetchCollections(address), fetchStatsCollection(address)]);
      setIpfsUrl(null);
      setMetadata({ name: "", description: "", tags: "" });

    } catch (err: any) {
      console.error(`${toastPrefix} ❌ FULL ERROR STACK:`);
      console.error("- message:", err.message);
      console.error("- reason:", err.reason);
      console.error("- code:", err.code);
      console.error("- data:", err.data);

      toast({
        title: "❌ Erreur création",
        description: err.reason || err.message || "Erreur inconnue",
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Render UI
  return (
    <Box
      maxW="700px"
      mx="auto"
      mt={10}
      p={10}
      borderRadius="3xl"
      boxShadow="dark-lg"
      bg={
        colorMode === "light"
          ? "rgba(253, 251, 212, 0.9)"  // cream avec transparence
          : "rgba(1, 28, 57, 0.95)"     // navy avec transparence
      }
      border="1px solid"
      borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
      backdropFilter="blur(12px)"
    >
      <Heading
        size="2xl"
        mb={6}
        textAlign="center"
        {...(colorMode === "light" ?
          { bgGradient: "linear(to-r, brand.navy, brand.navy)" } :
          { bgGradient: "linear(to-r, brand.cream, brand.cream)" }
        )}
      >
        Créez une collection
      </Heading>

      <HStack mx="auto" mb={6} textAlign="center" fontWeight="black">
        <Text mt={4} color={colorMode === "light" ? "brand.navy" : "brand.cream"}>
          Collections crées : {userCollections}
        </Text>
        <Text mt={4} color={colorMode === "light" ? "brand.navy" : "brand.cream"}>
          Collections restantes : {remainingCollections}
        </Text>
      </HStack>

      {/* 🔥 File Input + Feedback PRO */}
      <FormLabel fontWeight="bold" color={colorMode === "light" ? "brand.navy" : "brand.textLight"}>
        Image de la collection
      </FormLabel>

      <Box>
        {/* Input principal */}
        <Input
          type="file"
          onChange={handleFileChange}
          mb={file ? 3 : 2}
          border="2px dashed"
          borderColor={
            file?.size! > 8*1024*1024
              ? "orange.400"
              : colorMode === "light" ? "brand.navy" : "brand.cream"
          }
          bg={colorMode === "light" ? "brand.cream" : "blackAlpha.400"}
          py={2}
          accept="image/jpeg,image/png,image/webp"
          _hover={{
            borderColor: colorMode === "light" ? "brand.blue" : "brand.mauve",
            ...hoverStyles.brandHover._hover
          }}
        />

        {/* Feedback si fichier sélectionné */}
        {file && (
          <Box
            mt={3}
            p={4}
            borderRadius="xl"
            border="1px solid"
            boxShadow={colorMode === "light" ? effects.glowLight : effects.glowDark}
          >
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" color={colorMode === "light" ? "brand.navy" : "brand.textLight"}>
                📁 <b>{file.name}</b>
              </Text>
              <Text
                fontSize="sm"
                fontWeight="bold"
              >
                {(file.size / 1024 / 1024).toFixed(1)} Mo
              </Text>
            </HStack>

            {/* Barre progression */}
            <Progress
              value={Math.min((file.size / (3 * 1024 * 1024)) * 100, 100)}
              size="xs"
              colorScheme={
                file.size < 2 * 1024 * 1024 ? "green" :
                file.size < 3 * 1024 * 1024 ? "yellow" : "orange"
              }
              mb={2}
            />

            {/* Temps estimé */}
            <Text fontSize="xs" color={colorMode === "light" ? "brand.navy" : "gray.400"}>
              ⏱️ Estimé :
              <span style={{
                color: file.size < 5*1024*1024 ? "#10b981" : "#f59e0b",
                fontWeight: "bold"
              }}>
                {(file.size / 1024 / 1024 * 4).toFixed(0)}s
              </span>
            </Text>

            {/* Avertissement volumineux */}
            {file.size > 3 * 1024 * 1024 && (
              <Text
                fontSize="xs"
                color="orange.400"
                fontWeight="bold"
                mt={1}
              >
                ⚠️ Volumineux : patience 45s+
              </Text>
            )}
          </Box>
        )}

        {/* Placeholder vide */}
        {!file && (
          <Text
            fontSize="xs"
            color={colorMode === "light" ? "brand.navy" : "gray.500"}
            mt={2}
            textAlign="center"
          >
            📸 JPG/PNG/WebP &lt;3Mo (1-2Mo optimal)
          </Text>
        )}
      </Box>

      {/* Preview (après feedback) */}
      {previewUrl && (
        <Box
          mt={6}
          borderRadius="2xl"
          overflow="hidden"
          boxShadow={colorMode === "light" ? "md" : "dark-lg"}
          mb={6}
          border="1px solid"
          borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
          bgGradient={gradients.cardBorderLight}
          animation={animations.borderGlow}
        >
          <Image
            src={previewUrl}
            alt="Preview"
            boxSize="300px"
            objectFit="cover"
            mx="auto"
            transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
            _hover={{
              transform: "scale(1.05)",
              boxShadow: colorMode === "light" ? effects.glowLight : effects.glowDark
            }}
          />
        </Box>
      )}

      <VStack spacing={4} align="stretch">
        <Input
          placeholder="Nom de la collection"
          name="name"
          value={metadata.name}
          onChange={handleMetadataChange}
          bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
          color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
          borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
          _hover={{
            borderColor: colorMode === "light" ? "brand.blue" : "brand.mauve",
            boxShadow: colorMode === "light" ? effects.glowLight : effects.glowDark
          }}
          _focus={{
            borderColor: "brand.cream",
            boxShadow: "0 0 0 3px rgba(238, 212, 132, 0.1)"
          }}
        />
        <Input
          placeholder="Description"
          name="description"
          value={metadata.description}
          onChange={handleMetadataChange}
          bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
          color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
          borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
          _hover={{
            borderColor: colorMode === "light" ? "brand.blue" : "brand.mauve",
            boxShadow: colorMode === "light" ? effects.glowLight : effects.glowDark
          }}
        />
        <Input
          placeholder="Tags (séparés par des virgules)"
          name="tags"
          value={metadata.tags}
          onChange={handleMetadataChange}
          bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
          color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
          borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
          _hover={{
            borderColor: colorMode === "light" ? "brand.blue" : "brand.mauve",
            boxShadow: colorMode === "light" ? effects.glowLight : effects.glowDark
          }}
        />
      </VStack>

      <FormLabel mt={6} color={colorMode === "light" ? "brand.navy" : "brand.textLight"} fontWeight="bold">
        Type de collection
      </FormLabel>
      <Select
        placeholder="Sélectionnez un type"
        value={collectionType}
        onChange={(e) => setCollectionType(e.target.value)}
        bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
        color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
        borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
        mb={4}
        _hover={{
          borderColor: colorMode === "light" ? "brand.blue" : "brand.mauve",
        }}
      >
        <option style={{ backgroundColor: colorMode === "light" ? "#FDFBD4" : "#011C39" }} value="Art">
          Art
        </option>
        <option style={{ backgroundColor: colorMode === "light" ? "#FDFBD4" : "#011C39" }} value="Poesie">
          Poésie
        </option>
      </Select>

      {/* Royalties */}
      <Box
        mt={6}
        p={6}
        border="1px solid"
        borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
        borderRadius="2xl"
        bg={colorMode === "light" ? "whiteAlpha.600" : "blackAlpha.500"}
        boxShadow={colorMode === "light" ? "md" : "dark-lg"}
      >
        <Heading size="md" mb={4} color={colorMode === "light" ? "brand.navy" : "brand.gold"}>
          Royalties sur la collection :
        </Heading>

        <FormLabel color={colorMode === "light" ? "brand.navy" : "brand.textLight"} fontWeight="bold">
          Nombre maximum d'éditions
        </FormLabel>
        <Input
          type="number"
          min={1}
          value={maxEditions}
          onChange={(e) => setMaxEditions(Number(e.target.value))}
          bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
          color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
          borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
          mb={4}
        />

        <HStack mb={4} spacing={3}>
          <input
            type="checkbox"
            checked={!splitRoyalties}
            onChange={() => {
              if (!splitRoyalties) {
                setRoyaltyData([{ address: address || "", value: "90" }]);
              }
              setSplitRoyalties(!splitRoyalties);
            }}
            style={{
              width: "20px",
              height: "20px",
              accentColor: colorMode === "light" ? "#00416A" : "#EED484"
            }}
          />
          <Text color={colorMode === "light" ? "brand.navy" : "brand.textLight"}>
            Ne pas split (royalties 100% créateur)
          </Text>
        </HStack>

        {splitRoyalties && (
          <VStack spacing={4} align="stretch">
            {royaltyData.map((row, index) => (
              <HStack key={index} spacing={3}>
                <Input
                  placeholder="Adresse"
                  value={row.address}
                  onChange={e => handleRoyaltyChange(index, "address", e.target.value)}
                  bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
                  color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
                  borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
                  flex={1}
                />
                <Input
                  placeholder="%"
                  type="number"
                  value={row.value}
                  onChange={e => handleRoyaltyChange(index, "value", e.target.value)}
                  bg={colorMode === "light" ? "whiteAlpha.800" : "blackAlpha.400"}
                  color={colorMode === "light" ? "brand.navy" : "brand.textLight"}
                  borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
                  w="100px"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => removeRoyaltyLine(index)}
                  _hover={{ bg: "red.500/20" }}
                >
                  −
                </Button>
              </HStack>
            ))}
            <Button
              size="sm"
              variant="outline"
              colorScheme="brand"
              onClick={addRoyaltyLine}
              borderColor={colorMode === "light" ? "brand.navy" : "brand.cream"}
            >
              + Ajouter une adresse
            </Button>
          </VStack>
        )}
      </Box>

      <Button
        w="full"
        variant="solid"
        mt={6}
        onClick={uploadFileToIPFS}
        isLoading={isUploading || pinataUploading}
        isDisabled={!canUpload}
        {...hoverStyles.brandHover}
      >
        {isUploading && !pinataUploading ? "Factory..." :
         pinataUploading ? "IPFS..." : "🚀 Config + IPFS"}
      </Button>

      <Divider my={10} borderColor={colorMode === "light" ? "brand.navy" : "brand.gold"} />

      <Flex justify="center">
        <VStack>
          <Button
            onClick={handleCreateCollection}
            px={4}
            py={2}
            fontSize="l"
            fontWeight="extrabold"
            borderRadius="full"
            bgGradient={
              colorMode === "light"
                ? "linear(to-r, brand.blue, brand.blue)"
                : "linear(to-r, brand.cream, brand.cream)"
            }
            color="brand.navy"
            boxShadow="l"
            h="auto"
            minH="60px"
            _hover={{
              transform: brandHover.transform,
              boxShadow: "xl",
              animation: "none"
            }}
            transition="all 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
            isLoading={loading}
            isDisabled={!ipfsUrl}
          >
            🎨 Créer la collection
          </Button>
        </VStack>
      </Flex>
    </Box>
  );

};

export default CreateCollection;
