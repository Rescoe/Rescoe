import React, { useState, useEffect, ChangeEvent } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract } from 'ethers';

import detectEthereumProvider from "@metamask/detect-provider";
import axios from "axios";
import contractABI from '../../../ABI/ABI_ART.json';
import factoryABI from '../../../ABI/Factories/ABI_ART_FACTORY.json';
import ABIMasterFactory from '../../../ABI/Factories/ABI_MasterFactory.json';

import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import { useAuth } from '../../../../utils/authContext';
import { useRouter } from 'next/router';

import CollaboratorsChart from "@/utils/ColabChart"

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
  Checkbox,
  Stack,
  CloseButton,
  Divider,
  Flex,
  useToast
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

interface PublishToastProps {
  tokenId: number;
  collectionMintAddress: string;
  onClose: () => void;
  router: any; // ici je mets any si tu n'as pas le type précis, sinon précise-le
  listForSale: (price: string) => Promise<void>;
  isSaleListing: boolean;
}

const Bananas = dynamic(() => import('../../../modules/Bananas'), { ssr: false });

const MintArt: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
  const masterFactoryAddress = process.env.NEXT_PUBLIC_MASTERFACTORY_CONTRACT as string;


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
  const [tokenId, setTokenId] = useState<number>(0);
  const [collectionMint, setCollectionMint] = useState<string>("");
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [editions, setEditions] = useState<number>(1);

  const [selectedCollection, setSelectedCollection] = useState<string>("");
const [maxSupply, setMaxSupply] = useState<number | null>(null);
const [totalSupply, setTotalSupply] = useState<number | null>(null);
const [remaining, setRemaining] = useState<number | null>(null);
const [loadingInfo, setLoadingInfo] = useState(false);

const [collab, setCollab] = useState<string[]>([]);
const [percent, setPercent] = useState<number[]>([]);


  const { address, web3, provider } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const ETHERSCAN_PREFIX = "https://sepolia.basescan.org/address/"; // remplace par le réseau que tu utilises


  useEffect(() => {
    //console.log(address);
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


  const fetchCollectionSupplyInfo = async (collectionId: string) => {
    try {
      setLoadingInfo(true);

      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const resCollections = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

      if (!masterFactoryAddress) {
        throw new Error("NEXT_PUBLIC_MASTERFACTORY_CONTRACT non défini dans .env");
      }

      const masterFactory = new Contract(masterFactoryAddress, ABIMasterFactory, provider);

      const artFactoryAddress = await masterFactory.collectionFactories("Art");
      console.log(artFactoryAddress);


      // 🔹 Récupère les détails de la collection via son ID
      const collectionDetails = await resCollections.getCollection(collectionId);
      console.log(collectionDetails);
      const collectionAddress = collectionDetails.collectionAddress;
      setSelectedCollection(collectionAddress);

      const artFactory = new Contract(artFactoryAddress ,factoryABI, provider);
      const collaborateurs = await artFactory.getCollectionConfig(collectionDetails.name);
      console.log(collaborateurs);

      if (!collectionAddress) {
        console.error("Adresse de collection introuvable");
        return;
      }

      // 🔹 Instancie le contrat de mint (ArtNFT)
      const mintContract = new Contract(collectionAddress, contractABI, provider);

      const asso = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879";
      const assoFees = 10; // % fixe
      const artisteAddress = address; // l'artiste

      // Pourcentages des collaborateurs récupérés (raw)
      const collaborateursPercentsRaw = collaborateurs[2].map(Number); // ex: [50] si un seul collaborateur
      const collaborateursAddresses = collaborateurs[1];

      // On convertit ces pourcentages en fraction des 45% de l’artiste
      const totalCollabRaw = collaborateursPercentsRaw.reduce((acc: number, p: number) => acc + p, 0);
      const collabFactor = 45 / 100; // on veut que le pool soit sur 45% de l’artiste

      // Pour chaque collaborateur, sa part finale = % du pool * 45
      const collaborateursPercents = collaborateursPercentsRaw.map((p: number) => (p / 100) * 45);


      // L’artiste récupère le reste : 45% de base - ce qui est déjà pris par les collaborateurs
      const artistePercent = 45 - collaborateursPercents.reduce((acc: number, p: number) => acc + p, 0);

      // Tableau final pour l’affichage
      const finalCollabNames = [artisteAddress, asso, ...collaborateursAddresses];
      const finalCollabPercents = [artistePercent + 45, assoFees, ...collaborateursPercents];
      // Remarque : artistePercent + 45 car l’artiste a toujours 45% minimum

      setCollab(finalCollabNames);
      setPercent(finalCollabPercents);

      // Appel correct en Ethers v6
      const max = await mintContract._getCollectionMaxSupplyFallback();
      const total = await mintContract.totalSupply();

      setMaxSupply(Number(max));
      setTotalSupply(Number(total));
      setRemaining(Number(max) - Number(total));



    } catch (err) {
      console.error("Erreur récupération supply :", err);
      setMaxSupply(null);
      setTotalSupply(null);
      setRemaining(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleFetchCollection = async () => {
  if (!selectedCollectionId) return;

  setLoadingInfo(true);

  try {
    await fetchCollectionSupplyInfo(selectedCollectionId); // ta fonction existante
  } catch (err) {
    console.error("Erreur récupération supply :", err);
  }

  setLoadingInfo(false);
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

        const imageUrl = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
        const metadataJson = {
          artist: address,
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

        setIpfsUrl(`https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);

        toast({
          title: "Oeuvre uploadée",
          description: ipfsUrl,
          status: "success",
          duration: 1000,
          isClosable: true,
          position: "top",
        });


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
      alert("Veuillez uploader les métadonnées sur IPFS et choisir une collection.");
      return;
    }

    if (!web3) {
      alert("Wallet non connecté.");
      return;
    }

    if (!editions || editions <= 0) {
      alert("Veuillez entrer un nombre d’éditions supérieur à 0.");
      return;
    }

    setIsMinting(true);

    try {
      const userAddress = address;
      const gasPrice = await web3.eth.getGasPrice();

      if (!userAddress) throw new Error("Adresse utilisateur invalide.");

      const resCollection = new web3.eth.Contract(
        ABIRESCOLLECTION,
        contractRESCOLLECTION
      );

      const collectionDetails = await resCollection.methods
        .getCollection(selectedCollectionId)
        .call() as CollectionDetails;

      if (!collectionDetails) throw new Error("Collection introuvable.");

      if (collectionDetails.collectionType !== "Art") {
        alert("Impossible de minter une poésie ici.");
        return;
      }

      const collectionMintAddress = collectionDetails.collectionAddress;
      if (!web3.utils.isAddress(collectionMintAddress)) {
        throw new Error("Adresse de contrat invalide.");
      }

      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

      // =============================
      // 🔍 1 — Vérification supply
      // =============================
      const maxSupply = await mintContract.methods._getCollectionMaxSupplyFallback().call();
      const totalSupply = await mintContract.methods.totalSupply().call();

      const remaining = Number(maxSupply) - Number(totalSupply);

      if (editions > remaining) {
        alert(
          `Impossible : il ne reste que ${remaining} mint possible dans cette collection (maxSupply=${maxSupply}).`
        );
        return;
      }

      // =============================
      // 2 — Mint
      // =============================
      const mintResult = await mintContract.methods
        .mint(ipfsUrl, editions)
        .send({ from: userAddress,
          gasPrice: gasPrice.toString(),  // <-- force string
          maxFeePerGas: null as any,       // TS ok
          maxPriorityFeePerGas: null as any
        });

      const lastTokenIdStr = await mintContract.methods
        .getLastMintedTokenId()
        .call();

      const currentTokenId = Number(lastTokenIdStr);
      setTokenId(currentTokenId);

      // =============================
      // 3 — Listing (optionnel)
      // =============================
      if (isSaleListing && salePrice && Number(salePrice) > 0) {
        const priceWei = web3.utils.toWei(salePrice, "ether");

        await mintContract.methods
          .listNFTForSale(currentTokenId, priceWei)
          .send({
              from: userAddress,
              gasPrice: gasPrice.toString(),  // <-- force string
              maxFeePerGas: null as any,       // TS ok
              maxPriorityFeePerGas: null as any
              });
      }

      publishSuccess(currentTokenId, collectionMintAddress);
    } catch (e) {
      console.error("Erreur mint:", e);
      alert("Erreur lors du mint. Vérifiez la console.");
    } finally {
      setIsMinting(false);
    }
  };



  const listForSale = async (salePrice: string): Promise<void> => {
    if (!web3) {
      alert("Web3 non initialisé. Veuillez vous reconnecter.");
      return;
    }
    try {
      //fetchLastTokenId();
      const gasPrice = await web3.eth.getGasPrice();

      const userAddress: string | null = address;

      if (!userAddress) throw new Error("Adresse utilisateur non définie");

      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

      const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId!).call();

      const collectionMintAddress: string = collectionDetails.collectionAddress;

      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

/*
      const lastTokenIdStr: string = await mintContract.methods.getLastMintedTokenId().call();
      const currentTokenId: number = Number(lastTokenIdStr);

      setTokenId(currentTokenId);

      //console.log("tokenId lors du sale : ", currentTokenId);
*/
      if (salePrice && parseFloat(salePrice) > 0) {
        const priceWei: string = web3.utils.toWei(salePrice, "ether");
        //console.log(priceWei);

        await mintContract.methods.listNFTForSale(tokenId, priceWei).send({
            from: userAddress,
            gasPrice: gasPrice.toString(),  // <-- force string
            maxFeePerGas: null as any,       // TS ok
            maxPriorityFeePerGas: null as any
           })

        toast({
          title: "✅ NFT listé à la vente !",
          description: `Token #${tokenId} à ${salePrice} ETH`,
          status: "success",
          duration: 2000,
          isClosable: true,
          position: "top",
        });

        // setIsSaleListing(true); // garder ton état à jour si nécessaire

        publishSuccess(tokenId, collectionMintAddress);
      }
    } catch (err: any) {
      console.error("Erreur lors du listing", err);
      toast({
        title: "Erreur lors du listing",
        description: err.message || "Vérifiez la console.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    }
  };

  const fetchLastTokenId = async (): Promise<void> => {
    const userAddress: string | null = address;

    if (!web3 || !selectedCollectionId) return;

    const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

    const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

    const collectionMintAddress: string = collectionDetails.collectionAddress;

    const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

    if (!mintContract) return;

    try {
      const lastTokenIdStr: string = await mintContract.methods.getLastMintedTokenId().call();
      const currentTokenId: number = Number(lastTokenIdStr);

//Peut être mettre en commentaire ca si ca ne marche pas
      if (isNaN(currentTokenId) || currentTokenId <= 0) {
        console.warn("TokenId invalide, tentative de re-fetch...");
        setTimeout(fetchLastTokenId, 1000);
        return;
      }

      setTokenId(currentTokenId);
      //console.log("✅ Nouveau tokenId : ", currentTokenId);
    } catch (err) {
      console.error("Erreur lors du fetch du tokenId :", err);
    }
  };

  const publishSuccess = (tokenId: number, collectionMintAddress: string): void => {
    toast({
      duration: null,
      isClosable: true,
      position: 'top',
      render: ({ onClose }: { onClose: () => void }) => (
        <PublishToast
          tokenId={tokenId}
          collectionMintAddress={collectionMintAddress}
          onClose={onClose}
          router={router}
          listForSale={listForSale}
          isSaleListing={isSaleListing}
        />
      ),
    });
  };


  const PublishToast = ({
    tokenId,
    collectionMintAddress,
    onClose,
    router,
    listForSale,
    isSaleListing
  }: PublishToastProps) => {
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [customPrice, setCustomPrice] = useState("");

  return (
    <Box
  bg="white"
  color="black"
  p={6}
  borderRadius="xl"
  boxShadow="xl"
  textAlign="center"
  maxW="sm"
  mx="auto"
  mt={10}
  position="relative" // 👈 important pour positionner le bouton de fermeture
>
  {/* 🔹 Bouton de fermeture en haut à droite */}
  <CloseButton
    position="absolute"
    top="2"
    right="2"
    onClick={onClose}
  />

  <Text fontSize="xl" fontWeight="bold" mb={2}>🎉 Félicitations !</Text>
  <Text mb={4}>Votre œuvre est publiée{ isSaleListing ? " et listée à la vente!" : " !" }</Text>

  <Stack direction="column" spacing={4} justify="center">
    <Button colorScheme="blue" onClick={() => { onClose(); mintAgain(); }}>
      Mint une autre
    </Button>
    <Button
      colorScheme="green"
      variant="outline"
      onClick={() => router.push(`/oeuvresId/${collectionMintAddress}/${tokenId}`)}
    >
      Voir l'œuvre
    </Button>

    {!isSaleListing && !showPriceInput && (
      <Button colorScheme="blue" onClick={() => setShowPriceInput(true)}>
        Mettre en vente
      </Button>
    )}

    {!isSaleListing && showPriceInput && (
      <>
        <Input
          type="number"
          placeholder="Prix en ETH"
          value={customPrice}
          variant="outline"
          onChange={(e) => setCustomPrice(e.target.value)}
        />
        <Button colorScheme="teal"
        onClick={async () => { //Ne se ferme que si la vente réussi !
              try {
                await listForSale(customPrice);
                onClose();
              } catch (error) {
                console.error("Erreur lors de la mise en vente :", error);
                // Optionnel : afficher une alerte ou un message d’erreur ici
              }
            }}>
          Confirmer la vente
        </Button>
      </>
    )}
  </Stack>
</Box>

  );
};


  const mintAgain = () => {
    setFile(null);
    setPreviewUrl(null);
    setMetadata({ name: "", description: "", tags: "" });
    setCustomFee(10); // Réinitialiser la valeur si nécessaire
    setIpfsUrl(null);
    setSelectedCollectionId("");
    setSalePrice(""); // Réinitialiser si elle a été utilisée
    setIsSaleListing(false); // Réinitialiser si elle a été choisie
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
      Mintez
    </Heading>

    <FormLabel fontWeight="bold" color="gray.200">
      Choisir un fichier à minter
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
        placeholder="Nom de l’œuvre"
        name="name"
        value={metadata.name}
        onChange={handleMetadataChange}
        bg="blackAlpha.300"
        color="white"
        _placeholder={{ color: "gray.400" }}
        borderColor="purple.300"
      />
      <Input
        placeholder="Description (avec votre nom d'artiste)"
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

      <Input
        mt={4}
        type="number"
        placeholder="Nombre d’éditions"
        value={editions}
        max={remaining ?? undefined}     // 🔥 AJOUT
        onChange={(e) => setEditions(Number(e.target.value))}
        isDisabled={remaining !== null && remaining <= 0}
        bg="blackAlpha.300"
        color="white"
        borderColor="purple.300"
        _placeholder={{ color: "gray.400" }}
      />



    </VStack>

    <Flex justify="center" mt={8}>
      <Button
        px={8}
        py={5}
        fontSize="md"
        fontWeight="semibold"
        borderRadius="full"
        bgGradient="linear(to-r, purple.700, pink.600)"
        color="white"
        boxShadow="lg"
        _hover={{
          transform: "scale(1.05)",
          boxShadow: "xl",
        }}
        _active={{
          transform: "scale(0.97)",
        }}
        onClick={uploadFileToIPFS}
        isLoading={isUploading}
      >
        🧾 Upload vers IPFS
      </Button>
    </Flex>

    <FormLabel mt={8} color="gray.300" fontWeight="bold">
      Choisir une collection
    </FormLabel>
    <Select
      placeholder="Sélectionnez une collection"
      onChange={(e) => {
        const id = e.target.value;
        setSelectedCollectionId(id);
      }}
      bg="blackAlpha.300"
      color="white"
      borderColor="purple.300"
      mb={4}
    >
    {loadingInfo && (
      <Flex align="center" mt={2}>
        <Spinner size="sm" mr={2} />
        <Text color="gray.300">Chargement des informations…</Text>
      </Flex>
    )}

      {collections.map((collection) => (
        <option
          key={collection.id}
          value={collection.id.toString()}
          style={{ backgroundColor: "#1A202C", color: "white" }}
        >
          {collection.name}
        </option>
      ))}
    </Select>

    <Box>
      <Button
        onClick={handleFetchCollection}
        isDisabled={!selectedCollectionId || loadingInfo}
        colorScheme="purple"
        mb={4}
      >
        {loadingInfo ? <Spinner size="sm" /> : "Voir détails de la collection"}
      </Button>

      {maxSupply !== null && totalSupply !== null && remaining !== null && (
        <Box mt={3} p={3} borderWidth="1px" rounded="md" borderColor="purple.400">
          <Text color="gray.200">
            💠 Max Supply : <b>{maxSupply}</b>
          </Text>
          <Text color="gray.200">
            🧮 Déjà minté : <b>{totalSupply}</b>
          </Text>
          <Text color="gray.200">
            🟣 Éditions restantes :{" "}
            <b style={{ color: remaining > 0 ? "lightgreen" : "red" }}>
              {remaining}
            </b>
          </Text>

          <CollaboratorsChart collab={collab} percent={percent} />

          <Text fontSize="sm" mb={4}>
                🔗 <a
                  href={`${ETHERSCAN_PREFIX}${selectedCollection}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#9F7AEA", fontWeight: "bold" }}
                >
                  Voir sur Etherscan
                </a>
              </Text>

        </Box>
      )}
    </Box>


    <Checkbox
      mt={4}
      isChecked={isSaleListing}
      onChange={(e) => setIsSaleListing(e.target.checked)}
      colorScheme="purple"
    >
      Mettre en vente
    </Checkbox>

    {isSaleListing && (
      <Input
        mt={3}
        type="number"
        placeholder="Prix de vente (ETH)"
        value={salePrice}
        onChange={(e) => setSalePrice(e.target.value)}
        bg="blackAlpha.300"
        color="white"
        _placeholder={{ color: "gray.400" }}
        borderColor="purple.300"
      />
    )}

    <Divider my={10} borderColor="purple.300" />

    <Flex justify="center" mt={8}>
      <Button
        px={10}
        py={6}
        fontSize="lg"
        fontWeight="bold"
        borderRadius="full"
        bgGradient="linear(to-r, purple.700, pink.600)"
        color="white"
        boxShadow="lg"
        _hover={{
          transform: "scale(1.05)",
          boxShadow: "2xl",
        }}
        _active={{
          transform: "scale(0.98)",
        }}
        transition="all 0.25s ease"
        isLoading={isMinting}
        isDisabled={!ipfsUrl || !selectedCollectionId}
        onClick={mintNFT}
      >
        💾 Créer l'œuvre
      </Button>
    </Flex>

    <Text mt={6} textAlign="center" color="gray.400" fontSize="sm">
      Wallet connecté : <b>{address}</b>
    </Text>
  </Box>
);

};

export default MintArt;
