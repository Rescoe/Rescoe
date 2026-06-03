// src/pages/Adhesion/RoleBasedNFTPage.tsx
import { useState, useEffect } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Heading,
  Text,
  Select,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Collapse,
  useDisclosure,
  Divider,
  List,
  ListItem,
  Icon,
  Image,
  RadioGroup,
  Radio,
  Stack,
  Checkbox,
  Alert, AlertIcon, AlertTitle,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
} from "@chakra-ui/react";
import { Canvas } from "@react-three/fiber";
import { FaAward, FaWallet, FaClock, FaUserShield, FaStar } from "react-icons/fa";
import { WarningIcon, LockIcon } from '@chakra-ui/icons';  // ✅ AJOUT ICI


import ABI from "@/components/ABI/ABIAdhesion.json";
import useEthToEur from "@/hooks/useEuro";
import { useAuth } from "@/utils/authContext";

const RoleBasedNFTPage = () => {
  const { address: account, web3, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { convertEthToEur, loading: loadingEthPrice } = useEthToEur();
  const { isOpen, onToggle } = useDisclosure();

  const Bananas = dynamic(() => import("@/components/modules/Bananas"), { ssr: false });

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [bio, setBio] = useState<string>("");

  const [mintPrice, setMintPrice] = useState<number>(0); // prix de base (annual manuel) en ETH
  const [baseEvolve, setBaseEvolve] = useState<[number, number, number] | null>(null);
  const [requiredPriceEth, setRequiredPriceEth] = useState<number>(0);
  const [priceEur, setEuroPrice] = useState<number>(0);

  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [autoEvolve, setAutoEvolve] = useState<boolean>(false);

  const [showBananas, setShowBananas] = useState<boolean>(false);
  const [nftId, setNftId] = useState<string>("");
  const [mintRestant, setMintRestant] = useState<number>(0);
  const [maxMint, setMaxMint] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCguModalOpen, setIsCguModalOpen] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);

  // ── Génération on-chain de l'insecte (3 options, l'utilisateur choisit) ─────

  type InsectOption = {
    tokenUri: string;
    imageUrl: string;
    imageDataUri: string;
    attrsFragment: string;
    family: string;
    insectName: string;
    displayName: string;
    lore: string;
    attributes: { trait_type: string; value: unknown }[];
    gifSizeKb: number;
    tokenUriSizeKb: number;
    isStoredOnChain: boolean;
  };

  const [insectOptions,  setInsectOptions]  = useState<InsectOption[] | null>(null);
  const [insectResult,   setInsectResult]   = useState<InsectOption | null>(null);
  const [isGeneratingInsect, setIsGeneratingInsect] = useState(false);
  const [isUploadingInsect,  setIsUploadingInsect]  = useState(false);
  const [insectError,    setInsectError]    = useState<string>("");

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

  const roles = [
    { value: "Artiste", label: "Artiste" },
    { value: "Poete", label: "Poète" },
  ];

  type RoleKey = "Artiste" | "Poete" | "Stagiaire" | "Contributeur";
  const roleMapping: { [key in RoleKey]: number } = {
    Artiste: 0,
    Poete: 1,
    Stagiaire: 2,
    Contributeur: 3,
  };

  // Vérif réseau + prochain tokenId
  useEffect(() => {
    if (!account || !web3 || isLoading) return;

    const checkNetworkAndId = async () => {
      const chainId = await web3.eth.getChainId();
     //console.log("chainId : ", chainId);

      const contract = new web3.eth.Contract(ABI as any, contractAddress);
      const totalMinted = await contract.methods.getTotalMinted().call();
      // même formule que dans le contrat
      const currentYearIndex = Math.floor(Date.now() / 1000 / (365 * 24 * 60 * 60)); //comme ans le contrat, on cheerche l'année a partir du genesis block d'eth
     //console.log(currentYearIndex);

      const maxMints = Number(await contract.methods.maxMintsPerYear().call());
     //console.log(maxMints);
      setMaxMint(maxMints);
      const adhesionRestantes: string = await contract.methods
        .mintsPerYear(account, currentYearIndex)
        .call();

      //console.log("mints this year:", adhesionRestantes);

      const used = Number(adhesionRestantes);
      const remaining = Number(maxMints) - used; // récupère maxMintsPerYear avec un call aussi
     //console.log(remaining);
      setMintRestant(remaining); // récupère maxMintsPerYear avec un call aussi

//console.log("mints restants:", mintRestant);

      setNftId(Number(totalMinted).toString());
    };

    if (loadingEthPrice) return;
    else{
    fetchPrices();
    }
    checkNetworkAndId();
  }, [account, web3, contractAddress, isLoading, loadingEthPrice]);


  const fetchPrices = async () => {
    try {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contract = new Contract(contractAddress, ABI, provider);

      const mintPriceWei: BigNumberish = await contract.mintPrice();
      const mintPriceEth = Number(mintPriceWei) / 1e18;

      const p0 = Number(await contract.baseEvolvePrice(0)) / 1e18;
      const p1 = Number(await contract.baseEvolvePrice(1)) / 1e18;
      const p2 = Number(await contract.baseEvolvePrice(2)) / 1e18;

      setMintPrice(mintPriceEth);
      setBaseEvolve([p0, p1, p2]);

      // Par défaut : adhésion annuelle sans auto-evolve
      const required = mintPriceEth;
      setRequiredPriceEth(required);
      const eur = await convertEthToEur(required);
      setEuroPrice(eur ?? 0);
    } catch (error) {
      console.error("Erreur lors de la récupération des prix:", error);
    }
  };

  const recomputeRequiredPrice = async (
    nextIsAnnual: boolean,
    nextAutoEvolve: boolean
  ) => {
    if (!baseEvolve) return;

    let required = 0;
    let autoFlag = nextAutoEvolve;

    if (!nextIsAnnual) {
      // Essai court manuel : mintPrice / 10, sans auto-evolve
      required = mintPrice / 2;
      autoFlag = false;
    } else {
      if (nextAutoEvolve) {
        //const autoPremium = baseEvolve[0] + baseEvolve[1] + baseEvolve[2];

        required = mintPrice;// + autoPremium;
      } else {
        required = mintPrice;
      }
    }

    setIsAnnual(nextIsAnnual);
    setAutoEvolve(autoFlag);
    setRequiredPriceEth(required);

    try {
      const eur = await convertEthToEur(required);
      setEuroPrice(eur ?? 0);
    } catch (e) {
      console.error("Erreur conversion EUR:", e);
    }
  };

// ── Génère 3 options d'insectes (reroll 0, 1, 2) — l'utilisateur choisit ────
//
// Les 3 options sont déterministes par wallet+nonce+reroll.
// Elles sont calculées en parallèle, puis affichées sous forme de cartes.
// Une fois le choix fait, il est verrouillé — aucune possibilité de rechoisir.
const generateInsect = async () => {
  if (!selectedRole || !name || !bio) {
    alert("⚠️ Remplissez d'abord le rôle, le nom et la bio");
    return;
  }
  setIsGeneratingInsect(true);
  setInsectError("");
  setInsectOptions(null);
  setInsectResult(null);
  try {
    // ── 1. Seed déterministe : keccak256(address ‖ mintNonce) ─────────────────
    let onChainSeed = "";
    if (web3 && account) {
      try {
        const contract = new web3.eth.Contract(ABI as any, contractAddress);
        const nonce: string = await contract.methods.mintNonce(account).call();
        const seed = web3.utils.soliditySha3(
          { type: "address", value: account },
          { type: "uint256", value: nonce }
        );
        if (seed) onChainSeed = seed;
      } catch {
        console.warn("mintNonce non disponible, fallback wallet seed");
      }
    }

    const insectStorageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE as string;
    const HAS_IMAGE_ABI = [{
      inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
      name: "hasInsectImage",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    }];

    // ── 2. Fetch 3 options en parallèle ──────────────────────────────────────
    const options = await Promise.all([0, 1, 2].map(async (reroll) => {
      const params = new URLSearchParams({
        wallet:     account ?? "",
        role:       selectedRole,
        name,
        bio,
        isAnnual:   isAnnual.toString(),
        autoEvolve: autoEvolve.toString(),
        reroll:     String(reroll),
      });
      if (onChainSeed) params.set("seed", onChainSeed);

      const res = await fetch(`/api/token/generate-onchain-uri?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();

      // Vérif on-chain en parallèle — non-bloquant si erreur
      let isStoredOnChain = false;
      if (web3 && insectStorageAddress) {
        try {
          const sc = new web3.eth.Contract(HAS_IMAGE_ABI as any, insectStorageAddress);
          isStoredOnChain = await sc.methods.hasInsectImage(data.insectName).call();
        } catch {}
      }
      return { ...data, isStoredOnChain } as InsectOption;
    }));

    setInsectOptions(options);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    setInsectError(msg);
    console.error("❌ generate-onchain-uri:", e);
  } finally {
    setIsGeneratingInsect(false);
  }
};

// ── Upload de l'insecte on-chain via le RELAYER (le relayer paie le gas) ────────
// Le serveur lit le GIF depuis disk, l'encode en data:image/gif;base64, et appelle
// contributeInsectMeta avec sa propre clé privée. L'adhérent ne paie rien ici.
const uploadInsectViaRelayer = async (): Promise<boolean> => {
  if (!insectResult) return false;
  if (insectResult.isStoredOnChain) return true;

  setIsUploadingInsect(true);
  try {
    const res = await fetch("/api/token/upload-insect-relayer-v3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insectKey: insectResult.insectName }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }

    // "uploaded" ou "exists" → dans les deux cas l'image est on-chain
    setInsectResult(prev => prev ? { ...prev, isStoredOnChain: true } : prev);
    return true;
  } catch (e: any) {
    const msg: string = e?.message ?? String(e);
    console.error("❌ upload-insect-relayer:", e);
    alert(`❌ Erreur lors de l'enregistrement de l'image on-chain : ${msg}`);
    return false;
  } finally {
    setIsUploadingInsect(false);
  }
};

const handleAdhere = async () => {
  if (!name || !bio || !selectedRole) {
    alert("⚠️ Remplissez nom, bio et rôle");
    return;
  }
  if (!insectResult?.insectName) {
    alert("⚠️ Générez d'abord votre badge insecte");
    return;
  }
  if (mintRestant <= 0) { alert("❌ Quota annuel épuisé"); return; }
  if (!web3 || !account) { alert("Wallet non connecté"); return; }

  try {
    setIsProcessing(true);

    // ── Étape 1 : stocker l'image on-chain via le relayer (sans MetaMask) ────
    // Le serveur exécute contributeInsectMeta avec son propre wallet.
    // L'adhérent ne paie pas le gas d'upload — seulement le mint.
    if (insectResult && !insectResult.isStoredOnChain) {
      const uploaded = await uploadInsectViaRelayer();
      if (!uploaded) { setIsProcessing(false); return; }
    }

    // ── Étape 2 : mint ───────────────────────────────────────────────────────
    const contract  = new web3.eth.Contract(ABI as any, contractAddress);
    const priceInWei = web3.utils.toWei(requiredPriceEth.toString(), "ether");
    const gasPrice  = await web3.eth.getGasPrice();
    const roleValue = roleMapping[selectedRole as RoleKey];

    // Nouvelle signature : insectKey, displayName, insectFamily, role, name, bio, isAnnual, autoEvolveChoice
    // L'image est stockée on-chain dans le contrat (setInsectImage) — zéro URI en paramètre.
    await contract.methods
      .safeMint(
        insectResult.insectName,   // insectKey → clé du mapping _insectImages
        insectResult.displayName,  // displayName → stocké par token
        insectResult.family,       // insectFamily → stocké par token
        roleValue,
        name,
        bio,
        isAnnual,
        autoEvolve
      )
      .send({
        from: account,
        value: priceInWei,
        gasPrice: gasPrice.toString(),
        maxFeePerGas: null as any,
        maxPriorityFeePerGas: null as any,
      });

    setShowBananas(true);
    // Purge cache InsectSelector + notification globale
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith("insect_data_"))
        .forEach(k => sessionStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent("RESCOE_DATA_CHANGED"));
    } catch {}
    startLoadingAndRedirect();
  } catch (error: any) {
    console.error("❌ Erreur adhésion:", error);
    alert(`❌ Erreur : ${error.message || "Vérifiez console"}`);
  } finally {
    setIsProcessing(false);
  }
};



/*

  const handleConfirmRole = async () => {
    if (!name || !bio || !selectedRole || !insectData) return alert("Champs incomplets");

    try {
      setRoleConfirmed(true);

      // 🔥 PROFIL COULEUR EXACT
      const spriteFilename = insectData.spriteName;
      const familyKey = (insectData.folder) as FamilyKey;

      const profiles = colorProfilesJson.families[familyKey];

      const colorProfile =
        profiles?.find(p => p.filename === spriteFilename) ??
        profiles?.[0];

      // ✅ ATTRIBUTS INSECTE + COULEUR COMPLÈTES
      const insectAttributes = [
        ...insectData.attributes,  //  15 traits morpho

        // 🔥 MÉTAS INSECTE
        { trait_type: "Famille", value: familyKey },
        { trait_type: "1er Propriétaire", value: name },
        { trait_type: "Insect name", value: insectData.display_name },
        { trait_type: "Lore", value: insectData.lore },
        { trait_type: "TotalFamille", value: insectData.total_in_family },
        { trait_type: "Sprite", value: spriteFilename }
      ];

      // 🔥 COULEURS MAX (OpenSea adore !)
      const colorAttributes = colorProfile ? [
        // 🎨 COULEURS DOMINANTES (Top 5)
        { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
        { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
        { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
        { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
        { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },

        // 🌈 HSV COMPLET
        { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
        { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
        { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },

        // 📊 MÉTRIQUES TECHNIQUES
        { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
        { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
        { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness) },
        { trait_type: "Entropie", value: Math.round(colorProfile.metrics.entropy * 10) / 10 },

        // 🎬 TECH GIF
        { trait_type: "Frames", value: colorProfile.frame_count },
        { trait_type: "Pixels", value: colorProfile.total_pixels_analyzed.toLocaleString() },
        { trait_type: "TailleBytes", value: (colorProfile.gif_info.size_bytes / 1000).toFixed(1) + "KB" }
      ] : [];

      const fullAttributes = [
        ...insectAttributes.filter(attr => !["Niveau"].includes(attr.trait_type)),
        { trait_type: "Niveau", value: 0 },
        ...colorAttributes  // 🔥 20+ couleur traits
      ];

      //console.log(`🚀 ${insectAttributes} attributs générés !`);
      //const data = getRandomInsectGif(0);
      //console.log("INSECT DATA =", data);
      //console.log(`🚀 ${fullAttributes.length} attributs OpenSea générés !`);

      //console.log("UPLOAD IMAGE =", insectData.imageUrl)


      await uploadToIPFS({
        scope: "badges",
        imageUrl: insectData.imageUrl,
        name,
        bio,
        role: selectedRole,
        level: 0,
        attributes: fullAttributes,
        family: familyKey,
        sprite_name: spriteFilename,
        previousImage: null,
        evolutionHistory: [],
        color_profile: colorProfile
      });


      //console.log("METADATA URI =", metadataUri);

      setIsReadyToMint(true);

     //console.log(metadataUri, selectedRole, web3, account);
    } catch (error) {
      console.error("IPFS:", error);
      setRoleConfirmed(false);
      setIsReadyToMint(false);
    }
  };





    const mintNFT = async () => {

      if (!metadataUri || !selectedRole || !web3 || !account){
        alert("Assurez-vous d'être connecté, d'avoir généré l'IPFS et d'avoir sélectionné un rôle.");
        return;
      }

      try {
        setIsMinting(true);

        const contract = new web3.eth.Contract(ABI as any, contractAddress);
        const priceInWei = web3.utils.toWei(requiredPriceEth.toString(), "ether");

        const gasPrice = await web3.eth.getGasPrice(); // ✅ IDENTIQUE

        if (roleMapping.hasOwnProperty(selectedRole)) {
          const roleValue = roleMapping[selectedRole as RoleKey];

          // ✅ COPIE EXACTE de ton code qui marche
          const tx = await contract.methods
          .safeMint(metadataUri, roleValue, name, bio, isAnnual, autoEvolve)
            .send({
              from: account,
              value: priceInWei,
              gasPrice: gasPrice.toString(),      // ✅ force string
              maxFeePerGas: null as any,           // ✅ TS ok
              maxPriorityFeePerGas: null as any    // ✅ legacy tx
            });

          //console.log('✅ Mint OK - Gas utilisé:', tx.gasUsed);

          setShowBananas(true);
          startLoadingAndRedirect();

        } else {
          console.error(`Rôle "${selectedRole}" non trouvé`);
        }
      } catch (error) {
        console.error("❌ Erreur minting:", error);
        alert("Erreur minting. Vérifiez console.");
      } finally {
        setIsMinting(false);
      }
    };


*/

/*
  const handleMint = async () => {
    if (isReadyToMint) {
      await mintNFT();
    } else {
      alert("Les conditions ne sont pas remplies pour le mint.");
    }
  };
*/

  const startLoadingAndRedirect = () => {
    const countdownInterval = setInterval(() => {
      router.push(`/AdhesionId/${contractAddress}/${nftId}`);
      clearInterval(countdownInterval);
    }, 5000);
  };

  const handleConfirmAdhesion = async () => {
  if (!cguAccepted) {
    alert("⚠️ Vous devez accepter les CGU");
    return;
  }
  setIsCguModalOpen(false);  // Ferme modale
  await handleAdhere();  // Lance mint
};


/*
  const switchToSepolia = async () => {
    if (web3 && (web3.currentProvider as any)) {
      try {
        await (web3.currentProvider as any).request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a74" }],
        });
        window.location.reload();
      } catch (error) {
        console.error(error);
        alert(
          "Impossible de switch vers Base Sepolia. Ajoutez-le dans MetaMask."
        );
      }
    } else {
      alert("Web3 non disponible.");
    }
  };
*/
  // ✅ CALCUL autoPremium pour évolution automatique
  const autoPremiumEth = baseEvolve
    ? baseEvolve.reduce((sum, price) => sum + price, 0)
    : 0;



  return (
    <Box p={5} textAlign="center">
      <Box p={5} borderRadius="lg" boxShadow="md" mb={4} maxWidth="800px" mx="auto">
        <Heading size="lg" mb={4} textAlign="center">
          Adhésion
        </Heading>
        <Text fontSize="md" mb={4} textAlign="center">
          En tant que membre, vous rejoignez une communauté d'artistes et de
          collectionneurs engagés dans l'innovation et la créativité.
        </Text>

        <Heading size="md" mb={4} textAlign="center">
          Recevez un badge d'adhérent unique !
        </Heading>
        {/* Aperçu insecte : placeholder, sélection en cours, ou insecte choisi */}
        <Box mx="auto" mb={4} w="300px" h="300px" position="relative">
          <Image
            src={insectResult?.imageUrl ?? insectOptions?.[0]?.imageUrl ?? "/gifs/chenille_noire.gif"}
            alt={insectResult ? `Badge — ${insectResult.displayName}` : "Badge d'adhésion animé"}
            borderRadius="md"
            boxSize="300px"
            objectFit="cover"
            mx="auto"
            opacity={insectResult ? 1 : insectOptions ? 0.6 : 0.4}
            transition="opacity 0.4s"
          />
          {!insectResult && !insectOptions && (
            <Text
              position="absolute"
              bottom="10px"
              left="50%"
              transform="translateX(-50%)"
              fontSize="xs"
              color="whiteAlpha.700"
              bg="blackAlpha.700"
              px={2}
              py={1}
              borderRadius="md"
              whiteSpace="nowrap"
            >
              Votre insecte sera révélé ici
            </Text>
          )}
          {insectOptions && !insectResult && (
            <Text
              position="absolute"
              bottom="10px"
              left="50%"
              transform="translateX(-50%)"
              fontSize="xs"
              color="brand.gold"
              bg="blackAlpha.800"
              px={2}
              py={1}
              borderRadius="md"
              whiteSpace="nowrap"
            >
              ↓ Choisissez ci-dessous
            </Text>
          )}
        </Box>
        {(insectResult ?? insectOptions?.[0]) && (
          <Box mb={4} textAlign="center">
            <Text fontWeight="bold" fontSize="sm" color="brand.gold">
              {(insectResult ?? insectOptions![0]).displayName}
            </Text>
            <Text fontSize="xs" color="whiteAlpha.600">
              Famille {(insectResult ?? insectOptions![0]).family}
            </Text>
            {(insectResult ?? insectOptions?.[0])?.lore && (
              <Text fontSize="xs" color="whiteAlpha.500" mt={1} noOfLines={2} maxW="400px" mx="auto">
                {(insectResult ?? insectOptions![0]).lore}
              </Text>
            )}
          </Box>
        )}
        <Button onClick={onToggle} width="full" mb={4}>
          {isOpen ? "Masquer les détails" : "Voir les détails de l'adhésion"}
        </Button>


        <Collapse in={isOpen}>
          <VStack align="start" spacing={4} mb={5}>
            <Box>
              <List spacing={3}>
                <ListItem display="flex" alignItems="center">
                  <Icon as={FaClock} boxSize={5} />
                  <Text ml={2}>
                    <strong>Durée de l'adhésion :</strong> jusqu'à 1 an selon la
                    formule choisie.
                  </Text>
                </ListItem>
                <ListItem display="flex" alignItems="center">
                  <Icon as={FaWallet} boxSize={5} />
                  <Text ml={2}>
                    <strong>Prix :</strong> dépend de la formule (essai / annuel /
                    auto-évolution).
                  </Text>
                </ListItem>
                <ListItem display="flex" alignItems="center">
                  <Icon as={FaAward} boxSize={5} />
                  <Text ml={2}>
                    <strong>Points de récompense :</strong> 15 points attribués à
                    chaque mint.
                  </Text>
                </ListItem>
                <ListItem display="flex" alignItems="center">
                  <Icon as={FaUserShield} boxSize={5} />
                  <Text ml={2}>
                    <strong>Rôles disponibles :</strong> Artiste, Poète.
                  </Text>
                </ListItem>
                <ListItem display="flex" alignItems="center">
                  <Icon as={FaStar} boxSize={5} />
                  <Text ml={2}>
                    <strong>Création :</strong> votre badge est un NFT unique avec
                    visuel animé.
                  </Text>
                </ListItem>

              </List>
            </Box>

            <Text textAlign="center" color="brand.gold" mb={4}>
              Connectez-vous pour pouvoir adhérer.
            </Text>

                <Text fontSize="s" color="brand.cream" mb={4}>
                <strong>Assurez vous d'avoir lu les conditions générales d'utilisation</strong>{' '}
                <Link href="/CGU" color="brand.gold" isExternal>
                  Voir les CGU complètes
                </Link>
              </Text>
          </VStack>

          <Divider mb="10" />
        </Collapse>

{/*
        <Button
onClick={onToggleSim}
variant="outline"
width="full"
mb={4}
>
{isSimOpen
  ? "Masquer le simulateur d’évolution"
  : "Découvrir les évolutions possibles"}
</Button>

        <Collapse in={isSimOpen} animateOpacity>
          <Box
            p={4}
            mb={6}
            border="1px solid"
            borderRadius="md"
          >
            <Heading size="sm" mb={3}>
              Simulateur d’évolution
            </Heading>

            <Text fontSize="sm" mb={4}>
              Ce simulateur vous permet d’explorer les différentes évolutions possibles
              d’un insecte adhérent, sans impact sur votre futur NFT.
            </Text>



                <EvolutionSimulator insect={simulatedInsect} />

          </Box>
        </Collapse>
*/}
      </Box>



      {isAuthenticated ? (
        <>
          {/* INFO MINTS RESTANTS - TOUJOURS VISIBLE */}
          <Alert status={mintRestant > 0 ? "success" : "warning"} mb={4} borderRadius="md">
            <AlertIcon />
            <AlertTitle mr={2}>
              {mintRestant > 0
                ? `🎉 ${mintRestant} adhésion${mintRestant > 1 ? 's' : ''} restante${mintRestant > 1 ? 's' : ''} cette année !`
                : "❌ Quota annuel atteint"
              }
            </AlertTitle>
          </Alert>

          {/* FORMULAIRE UNIQUEMENT si mints disponibles */}
          {mintRestant > 0 && (
            <>
              <FormControl mb={4}>
                <FormLabel>👤 Rôle d’adhésion</FormLabel>
                <Select
                  placeholder="Choisissez votre rôle..."
                  value={selectedRole || ""}
                  onChange={(e) => {
                    const newRole = e.target.value || "";
                    setSelectedRole(newRole);
                    setInsectOptions(null); setInsectResult(null); // reset si rôle change
                  }}
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>✏️ Nom complet</FormLabel>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setInsectOptions(null); setInsectResult(null); }}
                  placeholder="Votre nom d'adhérent"
                />
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>📝 Biographie</FormLabel>
                <Input
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Décrivez votre parcours..."
                />
              </FormControl>

              <FormControl mb={4}>
                <FormLabel>📅 Type d’adhésion</FormLabel>
                <RadioGroup
                  onChange={(val) => recomputeRequiredPrice(val === "annual", autoEvolve)}
                  value={isAnnual ? "annual" : "trial"}
                >
                  <Stack direction="row" spacing={6}>
                    <Radio value="trial">
                      <Text fontSize="sm">🧪 Essai découverte <Text as="span" fontSize="xs">(prix / 2)</Text></Text>
                    </Radio>
                    <Radio value="annual">
                      <Text fontSize="sm">📆 Annuel complet <Text as="span" fontSize="xs">(365 jours)</Text></Text>
                    </Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>

              <FormControl mb={6}>
                <Checkbox
                  isChecked={autoEvolve}
                  isDisabled={!isAnnual}
                  onChange={(e) => recomputeRequiredPrice(isAnnual, e.target.checked)}
                >
                  🚀 Activer l’évolution automatique
                  <Text as="span" fontSize="sm" ml={2}>
                    (+ {autoPremiumEth.toFixed(4)} ETH)
                  </Text>
                </Checkbox>
              </FormControl>

              {/* ── Génération du badge on-chain — 3 options ── */}
              <Box
                border="1px solid"
                borderColor={insectResult ? "brand.gold" : "whiteAlpha.200"}
                borderRadius="xl"
                p={4}
                mb={4}
                transition="border-color 0.3s"
              >
                {/* État 1 : rien encore → bouton tirage */}
                {!insectOptions && !insectResult && (
                  <VStack spacing={2}>
                    <Text fontSize="sm" color="whiteAlpha.700" textAlign="center">
                      🦋 Tirez 3 badges — choisissez le vôtre. Ce choix sera définitif.
                    </Text>
                    <Button
                      w="full"
                      colorScheme="yellow"
                      variant="outline"
                      onClick={() => generateInsect()}
                      isLoading={isGeneratingInsect}
                      loadingText="Tirage en cours…"
                      isDisabled={!selectedRole || !name || !bio}
                    >
                      🎲 Révéler mes 3 options
                    </Button>
                    {insectError && (
                      <Text fontSize="xs" color="red.300">{insectError}</Text>
                    )}
                    {(!selectedRole || !name || !bio) && (
                      <Text fontSize="xs" color="whiteAlpha.400">
                        ↑ Remplissez d'abord rôle, nom et bio
                      </Text>
                    )}
                  </VStack>
                )}

                {/* État 2 : options chargées → sélection parmi 3 cartes */}
                {insectOptions && !insectResult && (
                  <VStack spacing={3}>
                    <Text fontSize="sm" color="brand.gold" fontWeight="bold" textAlign="center">
                      🎨 Cliquez sur l'insecte que vous souhaitez — ce choix est définitif
                    </Text>
                    <Stack direction={{ base: "column", md: "row" }} spacing={3} w="full">
                      {insectOptions.map((opt, i) => (
                        <Box
                          key={i}
                          flex={1}
                          border="2px solid"
                          borderColor="whiteAlpha.300"
                          borderRadius="lg"
                          p={3}
                          cursor="pointer"
                          _hover={{ borderColor: "brand.gold", transform: "scale(1.03)" }}
                          transition="all 0.2s"
                          onClick={() => {
                            setInsectResult(opt);
                            setInsectOptions(null);
                          }}
                        >
                          <Image
                            src={opt.imageUrl}
                            alt={opt.displayName}
                            borderRadius="md"
                            objectFit="cover"
                            w="full"
                            h="110px"
                            mb={2}
                          />
                          <Text fontSize="xs" fontWeight="bold" color="brand.gold" textAlign="center" noOfLines={1}>
                            {opt.displayName}
                          </Text>
                          <Text fontSize="9px" color="whiteAlpha.500" textAlign="center">
                            Famille {opt.family}
                          </Text>
                          {opt.isStoredOnChain && (
                            <Text fontSize="9px" color="green.400" textAlign="center">
                              🔗 Déjà on-chain
                            </Text>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </VStack>
                )}

                {/* État 3 : insecte choisi et verrouillé */}
                {insectResult && (
                  <VStack spacing={1}>
                    <Text fontSize="sm" color="green.300" fontWeight="bold" textAlign="center">
                      ✅ Votre insecte est déterminé — prêt à minter !
                    </Text>
                    <Text fontSize="xs" color="whiteAlpha.600" fontFamily="mono" textAlign="center">
                      {insectResult.family} · {insectResult.insectName}
                    </Text>
                    <Text fontSize="9px" color="whiteAlpha.400" fontFamily="mono" textAlign="center">
                      GIF {insectResult.gifSizeKb}KB animé · data URI on-chain
                    </Text>
                    {insectResult.isStoredOnChain ? (
                      <Text fontSize="9px" color="green.400" textAlign="center">
                        🔗 Image déjà stockée on-chain — 1 seule transaction requise
                      </Text>
                    ) : (
                      <Text fontSize="9px" color="yellow.400" textAlign="center">
                        ⚡ Première adhésion avec cet insecte — l'image sera enregistrée
                        on-chain avant le mint (sans frais supplémentaires pour vous).
                      </Text>
                    )}
                    <Text fontSize="9px" color="whiteAlpha.300" textAlign="center" fontStyle="italic">
                      Ce choix est définitif — aucun retirage possible.
                    </Text>
                  </VStack>
                )}
              </Box>

              {/* PRIX AFFICHÉ */}
              <Box p={4} borderRadius="lg" mb={6}>
                <Text fontSize="lg" fontWeight="bold" mb={1}>
                  💰 {requiredPriceEth.toFixed(4)} ETH (~{priceEur.toFixed(2)} €)
                </Text>
              </Box>

              <VStack spacing={3}>
                <Button
                  w="full"
                  colorScheme="teal"
                  size="lg"
                  onClick={() => setIsCguModalOpen(true)}
                  isLoading={isProcessing || isUploadingInsect}
                  loadingText={isUploadingInsect ? "🖼️ Enregistrement image…" : "🔨 Mint en cours…"}
                  isDisabled={
                    !selectedRole || !name || !bio || mintRestant <= 0 || !insectResult
                  }
                >
                  {mintRestant > 1
                    ? `🎉 Adhérer (${mintRestant} restantes)`
                    : "🎉 Adhérer (dernière !)"
                  }
                </Button>
              </VStack>


            </>
          )}

          {/* QUOTA ÉPUISÉ - ACHAT SECONDAIRE */}
          {mintRestant <= 0 && (
            <Box p={6} borderRadius="xl" textAlign="center" border="2px solid" borderColor="orange.200">
              <Icon as={WarningIcon} boxSize={12}mb={3} />
              <Heading size="md" color="orange.100" mb={2}>
                Quota annuel atteint
              </Heading>
              <Text fontSize="lg" mb={4}>
                Vous avez épuisé vos {maxMint} adhésions possibles cette année.
              </Text>
              {/*
              <Text fontSize="md" mb={6}>
                💡 Solution : Achetez un badge d’adhésion mis en vente par un autre membre sur le marché secondaire.
              </Text>
              <Button
                as={Link}
                href="/association/adherent#marketplace"  // ✅ Hash #marketplace
                colorScheme="orange"
                size="lg"
                variant="outline"
              >
                🛒 Explorer le marché
              </Button>
*/}

            </Box>
          )}
        </>
      ) : (
        <Box p={8} borderRadius="xl" textAlign="center" border="2px solid" borderColor="red.200">
          <Icon as={LockIcon} boxSize={16} mb={4} />
          <Heading size="lg" mb={3}>
          Connectez votre wallet
          </Heading>
          <Text fontSize="lg" >
            Authentifiez-vous avec MetaMask pour adhérer à ResCoe.
          </Text>
        </Box>
      )}


      {showBananas && (
        <Box position="fixed" top={0} left={0} width="100%" height="100%" zIndex={-1}>
          <Canvas>
            <Bananas />
          </Canvas>
        </Box>
      )}


      <Modal isOpen={isCguModalOpen} onClose={() => setIsCguModalOpen(false)} isCentered size="lg">
        <ModalOverlay />
        <ModalContent maxH="90vh" overflowY="auto">
          <ModalHeader>📜 Conditions d'adhésion ResCoe</ModalHeader>
          <ModalBody p={6}>
            <Alert status="warning" mb={6}>
              <AlertIcon />
              En adhérant à l'association ResCoe, vous reconnaissez avoir lu et accepté intégralement :
            </Alert>

            <VStack align="start" spacing={4} fontSize="sm">
              <Box>
                <strong>✅ Les Conditions Générales d'Utilisation (CGU)</strong>
                <Text>Statut associatif loi 1901, anti-spéculation, blockchain Base uniquement.</Text>
              </Box>
              <Box>
                <strong>✅ Politique anti-spéculation</strong>
                <Text>Pas de trading, pas d'investissement, soutien artistique exclusif.</Text>
              </Box>
              <Box>
                <strong>✅ Licence des NFT</strong>
                <Text>Usage personnel uniquement, pas de droits d'auteur transférés.</Text>
              </Box>
              <Box>
                <strong>✅ Risques blockchain</strong>
                <Text>Transactions irréversibles, pas de support clés privées perdues.</Text>
              </Box>
              <Box>
                <strong>✅ RGPD & paiements Stripe</strong>
                <Text>Données sécurisées, KYC si <strong>&gt;1000€</strong>, déclarations TRACFIN si nécessaire.</Text>
              </Box>
            </VStack>

            <Divider my={6} />

            <Text fontSize="s" mb={4}>
              <strong>Texte intégral :</strong>{' '}
              <Link href="/CGU" color="brand.gold" isExternal>
                Voir les CGU complètes
              </Link>
            </Text>

            <Checkbox
              isChecked={cguAccepted}
              onChange={(e) => setCguAccepted(e.target.checked)}
              mb={4}
            >
              <strong>J'accepte les CGU et adhère à ResCoe</strong>
            </Checkbox>
          </ModalBody>

          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => {
                setIsCguModalOpen(false);
                setCguAccepted(false);
              }}
            >
              Annuler
            </Button>
            <Button
              colorScheme="teal"
              onClick={handleConfirmAdhesion}
              isDisabled={!cguAccepted}
            >
              ✅ Accepter et adhérer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>


    </Box>
  );
};

export default RoleBasedNFTPage;
