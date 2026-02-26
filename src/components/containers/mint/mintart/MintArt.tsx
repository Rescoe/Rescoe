import React, { useState, useEffect, ChangeEvent } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract } from 'ethers';
import { ethers } from "ethers";


import detectEthereumProvider from "@metamask/detect-provider";
import { usePinataUpload } from '@/hooks/usePinataUpload';

import contractABI from '../../../ABI/ABI_ART.json';
import factoryABI from '../../../ABI/Factories/ABI_ART_FACTORY.json';
import ABIMasterFactory from '../../../ABI/Factories/ABI_MasterFactory.json';

import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import { useAuth } from '../../../../utils/authContext';
import { useRouter } from 'next/router';

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
} from "@styles/theme"


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
  useToast,
  Textarea,
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

  // 🆕 NOUVEAUX STATES pour le bouton unique
const [uploadAndMintStep, setUploadAndMintStep] = useState<'idle' | 'uploading' | 'minting' | 'success'>('idle');
const [countdown, setCountdown] = useState<number>(0);
const [currentIpfsForMint, setCurrentIpfsForMint] = useState<string | null>(null);


  const [isUploading, setIsUploading] = useState<boolean>(false);     // ← TON ÉTAT EXISTANT

  // Dans MintArt (comme dans Adhesion)
  const { uploadToIPFS, isUploading: ipfsUploading, metadataUri: ipfsUri } = usePinataUpload();

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
  const [editions, setEditions] = useState<number>(10);

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

  // 🔥 MISE À JOUR : Écoute l'IPFS upload automatique
  useEffect(() => {
    if (ipfsUri) {
      setIpfsUrl(ipfsUri);
      setCurrentIpfsForMint(ipfsUri); // 🔥 SAUVEGARDE pour mint
      toast({
        title: "Oeuvre uploadée",
        description: ipfsUri,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    }
  }, [ipfsUri, toast]);


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
      //console.log(artFactoryAddress);


      // 🔹 Récupère les détails de la collection via son ID
      const collectionDetails = await resCollections.getCollection(collectionId);
      const artiste = collectionDetails[3].toString();
      //console.log(artiste);
      const collectionAddress = collectionDetails.collectionAddress;
      setSelectedCollection(collectionAddress);

      const artFactory = new Contract(artFactoryAddress ,factoryABI, provider);
      const collaborateurs = await artFactory.getUserCollectionConfig(artiste, collectionDetails.name);
      //console.log(collaborateurs);

      if (!collectionAddress) {
        console.error("Adresse de collection introuvable");
        return;
      }

      // 🔹 Instancie le contrat de mint (ArtNFT)
      const mintContract = new Contract(collectionAddress, contractABI, provider);

      const asso = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879";
      const assoFees = 10; // % fixe
      //const artisteAddress = address; // l'artiste

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
      const finalCollabNames = [artiste, asso, ...collaborateursAddresses];
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

/*
const uploadFileToIPFS = async (): Promise<void> => {
  if (!file || !metadata.name || !metadata.description) {
    toast({
      title: "Erreur",
      description: "Veuillez sélectionner un fichier et remplir les métadonnées.",
      status: "error",
      duration: 3000,
      isClosable: true,
    });
    return;
  }

  setIsUploading(true);
  try {
    await uploadToIPFS({
      scope: "oeuvres",
      imageFile: file,
      name: metadata.name,
      description: metadata.description,
      artist: address!,
      tags: metadata.tags
    });

    // metadataUri sera set auto via useEffect
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    toast({
      title: "Erreur upload IPFS",
      description: "Échec de l'upload. Réessayez.",
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setIsUploading(false);
  }
};


*/

const mintNFT = async (): Promise<void> => {
  if (!ipfsUrl || selectedCollectionId === null) {
    throw new Error(`❌ IPFS manquant: ${ipfsUrl ? 'EXISTS' : 'NULL'} | Collection: ${selectedCollectionId}`);
  }

  if (!web3) {
    toast({
      title: "Erreur",
      description: "Wallet non connecté.",
      status: "error",
      duration: 3000,
      isClosable: true,
    });
    return;
  }

  if (!editions || editions <= 0) {
    toast({
      title: "Erreur",
      description: "Veuillez entrer un nombre d'éditions > 0.",
      status: "error",
      duration: 3000,
      isClosable: true,
    });
    return;
  }

  if (editions > 5) {
    toast({
      title: "Limite",
      description: "Max 5 éditions (limite gas).",
      status: "warning",
      duration: 4000,
      isClosable: true,
    });
    return;
  }

  setIsMinting(true);
  setError(null);

  try {
    const userAddress = address!;
    const gasPrice = await web3.eth.getGasPrice();

    // 1️⃣ Récup collection details
    const resCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
    const collectionDetails = await resCollection.methods
      .getCollection(selectedCollectionId)
      .call() as CollectionDetails;

    if (!collectionDetails || collectionDetails.collectionType !== "Art") {
      throw new Error("Collection Art introuvable.");
    }

    const collectionMintAddress = collectionDetails.collectionAddress;
    if (!web3.utils.isAddress(collectionMintAddress)) {
      throw new Error("Adresse contrat invalide.");
    }

    const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

    // 2️⃣ Vérification supply
    const maxSupply = await mintContract.methods._getCollectionMaxSupplyFallback().call();
    const totalSupply = await mintContract.methods.totalSupply().call();
    const remainingSlots = Number(maxSupply) - Number(totalSupply);

    if (editions > remainingSlots) {
      throw new Error(`❌ Slots restants: ${remainingSlots} (max: ${maxSupply})`);
    }

    // 3️⃣ ESTIMATION GAS
    toast({
      title: "💨 Estimation gas...",
      status: "info",
      duration: 2000,
      isClosable: false,
    });

    const gasEstimate = await mintContract.methods.mint(ipfsUrl, editions).estimateGas({
      from: userAddress,
    });

    if (gasEstimate > 4500000n) {
      throw new Error(`Gas trop élevé: ${gasEstimate} - réduisez éditions`);
    }

    const gasLimit = (gasEstimate * BigInt(130n) / 100n).toString(); // +30%

    // 4️⃣ MINT AVEC RETRY (3 tentatives)
    const mintWithRetry = async (retries = 3): Promise<any> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          toast({
            title: `⚡ Mint (essai ${attempt}/${retries})`,
            status: "loading",
            duration: 5000,
            isClosable: false,
          });

          return await mintContract.methods
            .mint(ipfsUrl, editions)  // ✅ ipfsUrl direct
            .send({
              from: userAddress,
              gas: gasLimit,
              gasPrice: (BigInt(gasPrice) * BigInt(110n) / 100n).toString(),
            });
        } catch (error: any) {
          console.warn(`Tentative ${attempt} échouée:`, error.message);

          if (attempt === retries) throw error;

          if (error.message.includes('gas') || error.message.includes('funds')) {
            await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
            continue;
          }
          throw error;
        }
      }
    };

    const mintResult = await mintWithRetry();

    // 5️⃣ SUCCÈS
    toast({
      title: "✅ Mint réussi !",
      description: `TX: ${mintResult.transactionHash.slice(0, 20)}...`,
      status: "success",
      duration: 5000,
      isClosable: true,
    });

    // 6️⃣ Token ID
    const lastTokenIdStr = await mintContract.methods.getLastMintedTokenId().call();
    const currentTokenId = Number(lastTokenIdStr);
    setTokenId(currentTokenId);

    // 7️⃣ LISTING AUTO si activé
    if (isSaleListing && salePrice && Number(salePrice) > 0) {
      toast({ title: "🏪 Listing auto...", status: "loading" });

      const priceWei = web3.utils.toWei(salePrice, "ether");
      const listGasEstimate = await mintContract.methods
        .listNFTForSale(currentTokenId, priceWei)
        .estimateGas({ from: userAddress });

      await mintContract.methods
        .listNFTForSale(currentTokenId, priceWei)
        .send({
          from: userAddress,
          gas: (listGasEstimate * BigInt(120n) / 100n).toString(),
          gasPrice: gasPrice.toString(),
        });

      toast({
        title: `✅ Listé ${salePrice} ETH !`,
        status: "success",
        duration: 3000,
      });
    }

    // 8️⃣ Toast succès
    publishSuccess(currentTokenId, collectionMintAddress);

  } catch (e: any) {
    console.error("❌ Mint error:", e);
    const msg = e.message || 'Erreur inconnue';
    setError(msg);

    toast({
      title: "❌ Mint échoué",
      description: msg.includes('gas')
        ? 'Gas élevé - réduisez éditions'
        : msg.slice(0, 80) + '...',
      status: "error",
      duration: 6000,
      isClosable: true,
    });
  } finally {
    setIsMinting(false);
    setUploadAndMintStep('success'); // Reset UI
  }
};


const mintNFTWithIpfs = async (ipfsUrl: string): Promise<void> => {
  // TEMPORAIREMENT override pour ce mint
  const originalIpfs = ipfsUrl;
  setIpfsUrl(ipfsUrl); // Force la vérif

  try {
    await mintNFT();
  } finally {
    setIpfsUrl(originalIpfs); // Restore
  }
};

/* FONCTION QUI UPLOAD ET MINT ! */
const handleUploadAndMint = async (): Promise<void> => {
  if (!file || !metadata.name || !metadata.description || !selectedCollectionId) {
    toast({
      title: "Erreur",
      description: "Fichier, métadonnées et collection obligatoires.",
      status: "error",
      duration: 3000,
      isClosable: true,
    });
    return;
  }

  setUploadAndMintStep('uploading');

  try {
    // 1️⃣ UPLOAD IPFS + ATTENTE FORCÉE 3s (temps suffisant)
    toast({
      title: "⏳ Upload IPFS...",
      status: "loading",
      duration: 4000,
      isClosable: false,
    });

    await uploadToIPFS({
      scope: "oeuvres",
      imageFile: file,
      name: metadata.name,
      description: metadata.description,
      artist: address!,
      tags: metadata.tags
    });

    // 2️⃣ ATTENTE 2s ADDITIONNELLE pour useEffect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3️⃣ VÉRIF + MINT DIRECT (pas de countdown compliqué)
    if (!ipfsUrl) {
      throw new Error("IPFS timeout - réessayez");
    }

    setUploadAndMintStep('minting');

    toast({
      title: "🚀 Mint automatique...",
      status: "loading",
      duration: 5000,
      isClosable: false,
    });

    // 4️⃣ MINT DIRECT
    await mintNFT();

    setUploadAndMintStep('success');

    toast({
      title: "🎉 Upload & Mint parfait !",
      description: `IPFS: ${ipfsUrl.slice(0, 40)}...`,
      status: "success",
      duration: 4000,
      isClosable: true,
    });

  } catch (error: any) {
    console.error('Erreur:', error);
    setUploadAndMintStep('idle');
    toast({
      title: "❌ Échec",
      description: error.message || "Réessayez.",
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  }
};

// 🆕 RESET après succès
useEffect(() => {
  if (uploadAndMintStep === 'success') {
    setTimeout(() => {
      setUploadAndMintStep('idle');
      setCountdown(0);
    }, 2000);
  }
}, [uploadAndMintStep]);



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
        position="relative"
      >
        <CloseButton position="absolute" top="2" right="2" onClick={onClose} />

        <Text fontSize="xl" fontWeight="bold" mb={2}>
          🎉 Félicitations !
        </Text>
        <Text mb={4}>
          Votre œuvre est publiée
          {isSaleListing ? " et listée à la vente !" : " !"}
        </Text>

        <Stack direction="column" spacing={4} justify="center">
          <Button
            colorScheme="blue"
            onClick={() => {
              onClose();
              mintAgain();
            }}
          >
            Mint une autre
          </Button>

          <Button
            colorScheme="green"
            variant="outline"
            onClick={() =>
              router.push(`/oeuvresId/${collectionMintAddress}/${tokenId}`)
            }
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
              <Button
                colorScheme="teal"
                onClick={async () => {
                  try {
                    await listForSale(customPrice);
                    onClose(); // Ne se ferme que si la vente réussit
                  } catch (error) {
                    console.error("Erreur lors de la mise en vente :", error);
                  }
                }}
              >
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
    maxW="720px"
    mx="auto"
    mt={10}
    p={10}
    borderRadius="3xl"
    boxShadow="dark-lg"
    border="1px solid"
    borderColor="brand.cream"
  >
    {/* HEADER */}
    <VStack spacing={8} align="stretch">
      <Heading
        size="2xl"
        textAlign="center"
        fontWeight="black"
        bgGradient="linear(to-r, brand.gold, brand.cream)"
        bgClip="text"
        letterSpacing="tight"
      >
        Mintez
      </Heading>

      {/* ================= UPLOAD ================= */}
      <VStack align="stretch" spacing={3}>
        <FormLabel fontWeight="bold" color="brand.cream">
          Fichier
        </FormLabel>

        <Input
          type="file"
          onChange={handleFileChange}
          border="2px dashed"
          borderColor="brand.cream"
          bg="blackAlpha.300"
          _hover={{ bg: "blackAlpha.400" }}
          _focus={{
            borderColor: "brand.gold",
            boxShadow: "0 0 0 2px rgba(238,212,132,0.35)",
          }}
          py={2}
        />

        {previewUrl && (
          <Box
            borderRadius="xl"
            overflow="hidden"
            border="1px solid"
            borderColor="brand.cream"
            boxShadow="md"
          >
            <Image
              src={previewUrl}
              alt="Preview"
              boxSize="320px"
              objectFit="cover"
              mx="auto"
              transition="0.25s"
              _hover={{ transform: "scale(1.05)" }}
            />
          </Box>
        )}
      </VStack>

      {/* ================= METADATA ================= */}
      <VStack align="stretch" spacing={5}>
        <FormLabel fontWeight="bold" color="brand.cream">
          Titre
        </FormLabel>
        <Input
          placeholder="Nom de l’œuvre"
          name="name"
          value={metadata.name}
          onChange={handleMetadataChange}
          bg="blackAlpha.300"
          borderColor="brand.cream"
        />

        <FormLabel fontWeight="bold" color="brand.cream">
          Description
        </FormLabel>
        <Textarea
          placeholder="Décrivez votre œuvre (avec votre nom d’artiste)…"
          name="description"
          value={metadata.description}
          onChange={(e) =>
            setMetadata((prev) => ({ ...prev, description: e.target.value }))
          }
          bg="blackAlpha.300"
          borderColor="brand.cream"
          minH="130px"
          resize="vertical"
        />

        <FormLabel fontWeight="bold" color="brand.cream">
          Tags
        </FormLabel>
        <Input
          placeholder="tags, séparés par des virgules"
          name="tags"
          value={metadata.tags}
          onChange={handleMetadataChange}
          bg="blackAlpha.300"
          borderColor="brand.cream"
        />

        <FormLabel fontWeight="bold" color="brand.cream">
          Éditions
        </FormLabel>
        <Input
          type="number"
          value={editions}
          max={remaining ?? undefined}
          onChange={(e) => setEditions(Number(e.target.value))}
          isDisabled={remaining !== null && remaining <= 0}
          bg="blackAlpha.300"
          borderColor="brand.cream"
        />
      </VStack>

      {/* ================= COLLECTION ================= */}
      <VStack align="stretch" spacing={4}>
        <FormLabel fontWeight="bold" color="brand.cream">
          Collection
        </FormLabel>

        <Select
          placeholder="Sélectionnez une collection"
          onChange={(e) => setSelectedCollectionId(e.target.value)}
          bg="blackAlpha.300"
          borderColor="brand.cream"
        >
          {collections.map((c) => (
            <option
              key={c.id}
              value={c.id.toString()}
              style={{ background: "#1A202C", color: "white" }}
            >
              {c.name}
            </option>
          ))}
        </Select>

        <Button
          onClick={handleFetchCollection}
          isDisabled={!selectedCollectionId || loadingInfo}
        >
          {loadingInfo ? <Spinner size="sm" /> : "Voir détails"}
        </Button>

        {maxSupply !== null && totalSupply !== null && remaining !== null && (
          <Box p={4} borderWidth="1px" rounded="lg" borderColor="brand.cream">
            <Text>Max Supply : <b>{maxSupply}</b></Text>
            <Text>Minté : <b>{totalSupply}</b></Text>
            <Text>
              Restant :
              <b style={{ color: remaining > 0 ? "lightgreen" : "red" }}>
                {" "}{remaining}
              </b>
            </Text>

            <CollaboratorsChart collab={collab} percent={percent} />

            <Text fontSize="sm" mt={2}>
              🔗{" "}
              <a
                href={`${ETHERSCAN_PREFIX}${selectedCollection}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#9F7AEA", fontWeight: "bold" }}
              >
                Etherscan
              </a>
            </Text>
          </Box>
        )}
      </VStack>

      {/* ================= SALE ================= */}
      <VStack align="stretch" spacing={3}>
        <Checkbox
          isChecked={isSaleListing}
          onChange={(e) => setIsSaleListing(e.target.checked)}
          colorScheme="brand.cream"
        >
          Mettre en vente
        </Checkbox>

        {isSaleListing && (
          <Input
            type="number"
            placeholder="Prix (ETH)"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            bg="blackAlpha.300"
            borderColor="brand.cream"
          />
        )}
      </VStack>

      <Divider borderColor="brand.cream" />

      {/* ================= ACTION ================= */}
      <Flex direction="column" align="center" gap={4}>
        <Button
          px={12}
          py={6}
          fontSize="lg"
          borderRadius="full"
          borderWidth="1px"
          borderColor="brand.cream"
          bgGradient="linear(to-r, brand.navy, brand.navy)"
          color="brand.gold"
          isDisabled={uploadAndMintStep !== "idle"}
          onClick={handleUploadAndMint}
        >
          {uploadAndMintStep === "idle" && "🚀 Upload & Mint"}
          {uploadAndMintStep === "uploading" && "⏳ Upload IPFS…"}
          {uploadAndMintStep === "minting" && "⚡ Mint…"}
          {uploadAndMintStep === "success" && "✅ Terminé"}
        </Button>

        {countdown > 0 && (
          <Box
            px={4}
            py={2}
            bg="brand.navy"
            borderRadius="full"
            border="2px solid"
            borderColor="brand.cream"
          >
            <Text fontWeight="bold">
              Mint auto dans {countdown}s
            </Text>
          </Box>
        )}

        {ipfsUrl && (
          <Box
            p={3}
            border="1px solid"
            borderColor="green.400"
            borderRadius="md"
          >
            <Text fontSize="sm">
              IPFS : <code>{ipfsUrl.slice(0, 50)}...</code>
            </Text>
          </Box>
        )}
      </Flex>

      <Text textAlign="center" fontSize="sm" color="gray.400">
        Wallet : <b>{address}</b>
      </Text>
    </VStack>
  </Box>
);

};

export default MintArt;
