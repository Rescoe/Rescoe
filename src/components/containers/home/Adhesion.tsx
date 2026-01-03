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
} from "@chakra-ui/react";
import { Canvas } from "@react-three/fiber";
import { FaAward, FaWallet, FaClock, FaUserShield, FaStar } from "react-icons/fa";

import ABI from "@/components/ABI/ABIAdhesionEvolve.json";
import getRandomInsectGif  from "@/utils/GenInsect25";
import useEthToEur from "@/hooks/useEuro";
import { useAuth } from "@/utils/authContext";
import { usePinataUpload } from "@/hooks/usePinataUpload";
import EvolutionSimulator from "@/utils/evolutionEngineSimulation";
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';



type FamilyKey = keyof typeof colorProfilesJson.families;

const RoleBasedNFTPage = () => {
  const { address: account, web3, isAuthenticated } = useAuth();
  const router = useRouter();
  const { convertEthToEur, loading: loadingEthPrice } = useEthToEur();
  const { ipfsUrl, isUploading, uploadToIPFS } = usePinataUpload();
  const { isOpen, onToggle } = useDisclosure();

  const Bananas = dynamic(() => import("@/components/modules/Bananas"), { ssr: false });

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [roleConfirmed, setRoleConfirmed] = useState<boolean>(false);

  const [name, setName] = useState<string>("");
  const [bio, setBio] = useState<string>("");

  const [mintPrice, setMintPrice] = useState<number>(0); // prix de base (annual manuel) en ETH
  const [baseEvolve, setBaseEvolve] = useState<[number, number, number] | null>(null);
  const [requiredPriceEth, setRequiredPriceEth] = useState<number>(0);
  const [priceEur, setEuroPrice] = useState<number>(0);

  const [isAnnual, setIsAnnual] = useState<boolean>(true);
  const [autoEvolve, setAutoEvolve] = useState<boolean>(false);

  const [showBananas, setShowBananas] = useState<boolean>(false);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [nftId, setNftId] = useState<string>("");

  const [isOnSepolia, setIsOnSepolia] = useState<boolean>(false);
  const [isReadyToMint, setIsReadyToMint] = useState<boolean>(false);

  const [insectData, setInsectData] = useState<any>(null);

  const {
  isOpen: isSimOpen,
  onToggle: onToggleSim,
} = useDisclosure();

const [simulatedInsect, setSimulatedInsect] = useState<any | null>(null);



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
    if (!account || !web3) return;

    const checkNetworkAndId = async () => {
      const chainId = await web3.eth.getChainId();
      setIsOnSepolia(Number(chainId) === 11155111);

      const contract = new web3.eth.Contract(ABI as any, contractAddress);
      const totalMinted = await contract.methods.getTotalMinted().call();
      setNftId(Number(totalMinted).toString());
    };

    checkNetworkAndId();
  }, [account, web3, contractAddress]);

  // Chargement des prix depuis le contrat
  useEffect(() => {
    if (!account || loadingEthPrice) return;
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, loadingEthPrice]);

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
      required = mintPrice / 10;
      autoFlag = false;
    } else {
      if (nextAutoEvolve) {
        const autoPremium = baseEvolve[0] + baseEvolve[1] + baseEvolve[2];
        required = mintPrice + autoPremium;
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

  const generateImage = () => {
  if (!selectedRole) return;

  try {
    const data = getRandomInsectGif(0);  // ✅ LVL0 uniquement
    setGeneratedImageUrl(data.imageUrl);
    setInsectData(data);  // attributes + family pour évolution
  } catch (error) {
    console.error("Erreur génération insecte:", error);
    alert("Erreur lors de la génération de l'insecte LVL0");
  }
};
const handleConfirmRole = async () => {
  if (!name || !bio || !selectedRole || !insectData) return alert("Champs incomplets");

  try {
    setRoleConfirmed(true);

    // 🔥 PROFIL COULEUR EXACT
    const spriteFilename = insectData.spriteName;
    const familyKey = (insectData.new_folder || insectData.key) as FamilyKey;

    const profiles = colorProfilesJson.families[familyKey];

    const colorProfile =
      profiles?.find(p => p.filename === spriteFilename) ??
      profiles?.[0];

    // ✅ ATTRIBUTS INSECTE + COULEUR COMPLÈTES
    const insectAttributes = [
      ...insectData.attributes,  // 15 traits morpho

      // 🔥 MÉTAS INSECTE
      { trait_type: "Famille", value: familyKey },
      { trait_type: "DisplayName", value: insectData.display_name },
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

    console.log(`🚀 ${fullAttributes.length} attributs OpenSea générés !`);

    await uploadToIPFS({
      imageUrl: generatedImageUrl!,
      name: insectData.display_name || name,
      bio,
      role: selectedRole,
      level: 0,
      attributes: fullAttributes,  // 30+ ATTRIBUTS !
      family: familyKey,
      sprite_name: spriteFilename,
      previousImage: null,
      evolutionHistory: [],
      color_profile: colorProfile  // Full backup
    });

    setIsReadyToMint(true);
  } catch (error) {
    console.error("IPFS:", error);
    setRoleConfirmed(false);
    setIsReadyToMint(false);
  }
};





  const mintNFT = async () => {
    if (!ipfsUrl || !selectedRole || !web3 || !account) {
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
          .safeMint(ipfsUrl, roleValue, name, bio, isAnnual, autoEvolve)
          .send({
            from: account,
            value: priceInWei,
            gasPrice: gasPrice.toString(),      // ✅ force string
            maxFeePerGas: null as any,           // ✅ TS ok
            maxPriorityFeePerGas: null as any    // ✅ legacy tx
          });

        console.log('✅ Mint OK - Gas utilisé:', tx.gasUsed);

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


  const handleMint = async () => {
    if (isReadyToMint) {
      await mintNFT();
    } else {
      alert("Les conditions ne sont pas remplies pour le mint.");
    }
  };

  const startLoadingAndRedirect = () => {
    const countdownInterval = setInterval(() => {
      router.push(`/AdhesionId/${contractAddress}/${nftId}`);
      clearInterval(countdownInterval);
    }, 5000);
  };

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
        <Image
          src="/gifs/chenille_noire.gif"
          alt="Badge d'adhésion animé"
          borderRadius="md"
          mb={4}
          boxSize="300px"
          objectFit="cover"
          mx="auto"
        />
        {/*
        <Image
          src="/OEUFS/OEUF1.gif"
          alt="Badge d'adhésion animé"
          borderRadius="md"
          mb={4}
          boxSize="300px"
          objectFit="cover"
          mx="auto"
        />
        */}
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

            <Text textAlign="center" mb={4}>
              Connectez-vous pour pouvoir adhérer.
            </Text>
          </VStack>

          <Divider mb="10" />
        </Collapse>

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
            borderColor="gray.200"
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

      </Box>

      {isAuthenticated && (
        <>
          <FormControl mb={3}>
            <FormLabel>Choisissez un rôle</FormLabel>
            <Select
              placeholder="Sélectionnez votre rôle"
              onChange={(e) => {
                setSelectedRole(e.target.value);
                generateImage();
              }}
              value={selectedRole}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>Nom</FormLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entrez votre nom"
            />
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>Biographie</FormLabel>
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Entrez votre biographie"
            />
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>Type d’adhésion</FormLabel>
            <RadioGroup
              onChange={(val) => recomputeRequiredPrice(val === "annual", autoEvolve)}
              value={isAnnual ? "annual" : "trial"}
            >
              <Stack direction="row">
                <Radio value="trial">Essai découverte</Radio>
                <Radio value="annual">Adhésion annuelle</Radio>
              </Stack>
            </RadioGroup>
          </FormControl>

          <FormControl mb={3}>
            <Checkbox
              isChecked={autoEvolve}
              isDisabled={!isAnnual}
              onChange={(e) =>
                recomputeRequiredPrice(isAnnual, e.target.checked)
              }
            >
              Activer l’évolution automatique
            </Checkbox>
          </FormControl>

          <Button
            colorScheme="blue"
            onClick={handleConfirmRole}
            isDisabled={!selectedRole || roleConfirmed || !generatedImageUrl}
            mb={3}
          >
            Confirmer le rôle et générer le badge
          </Button>

          {generatedImageUrl && (
            <Text mb={3}>
              Votre insecte animé est prêt, il sera associé à votre badge.
            </Text>
          )}

          <Text mb={3}>
            Prix de l'adhésion : {requiredPriceEth.toFixed(4)} ETH (~
            {priceEur.toFixed(2)} €)
          </Text>

          <Button
            colorScheme="teal"
            onClick={handleMint}
            isLoading={isMinting || isUploading}
            loadingText="Création du badge..."
            isDisabled={!ipfsUrl || !roleConfirmed}
          >
            Adhérer
          </Button>


        </>
      )}

      {showBananas && (
        <Box position="fixed" top={0} left={0} width="100%" height="100%" zIndex={-1}>
          <Canvas>
            <Bananas />
          </Canvas>
        </Box>
      )}
    </Box>
  );
};

export default RoleBasedNFTPage;
