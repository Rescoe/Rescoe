import { useEffect, useState, useCallback } from 'react'; // ✅ ERREUR 1: useCallback ajouté
import { JsonRpcProvider, Contract as EthersContract, formatUnits, BigNumberish } from 'ethers';
import Web3 from 'web3';

import {
  Box,
  Button,
  Heading,
  Image,
  Text,
  VStack,
  HStack,
  Spinner,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Divider,
  SimpleGrid,
  Center,
  Alert,
  AlertIcon,
  Icon,
  Link,
  Card,
  CardBody,
  Flex,
  useColorModeValue,
  Textarea
} from '@chakra-ui/react';
import { FaCheckCircle } from 'react-icons/fa';

import { useRouter } from 'next/router';

import ABI from '@/components/ABI/ABIAdhesion.json';
import ABI_Management from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import { useAuth } from '@/utils/authContext';
import { PublicProfile } from "@/components/containers/dashboard";
import genInsect25 from '@/utils/GenInsect25';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import { useHatchEgg } from '@/hooks/useHatchEgg';
import { useTokenEvolution, MembershipInfo  } from '@/hooks/useTokenEvolution';
import { buildEvolutionHistory } from '@/utils/evolutionHistory';
import CopyableAddress from "@/hooks/useCopyableAddress";
import { useReproduction } from '@/hooks/useReproduction';
import { ReproductionPanel, ParentSelector } from '@/components/Reproduction';
import EvolutionHistoryTimeline from '@/utils/EvolutionHistoryTimeline'; // ✅ ERREUR 2: import corrigé (pas d'espace)
import { resolveIPFS } from '@/utils/resolveIPFS';

import { effects, gradients, animations, brandHover } from "@styles/theme";

interface NFTData {
  owner: string;
  role: number;
  mintTimestamp: string;
  price: string;
  name: string;
  bio: string;
  remainingTime: string;
  fin: string;
  forSale: boolean;
  membership: string;
  image?: string;
  membershipInfo?: MembershipInfo;
  level?: number; // ✅ AJOUTÉ pour compatibilité
  uri?: string; // ✅ AJOUTÉ pour compatibilité
  tokenURI?: string;  // ✅ AJOUT (source on-chain)

}


interface EvolutionMetadata {
  level: number;
  family?: string;
  sprite_name?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  evolution_history?: Array<{
    level: number;
    image: string;
    timestamp: number;
  }>;
  [key: string]: unknown;
}

interface TokenWithMeta {
  tokenId: number;
  owner: string;
  membershipInfo: MembershipInfo;
  metadata: EvolutionMetadata | null;
  tokenURI: string;
  image: string | undefined;
  name: string;
  roleLabel: string;
}

const roles: { [key: number]: string } = {
  0: "Artist",
  1: "Poet",
  2: "Contributor",
  3: "Trainee",
};

const roleLabels: Record<string, string> = {
  Artist: "Artiste",
  Poet: "Poète",
  Contributor: "Contributeur",
  Trainee: "Formateur",
};

const contractAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

const TokenPage = () => {
  const router = useRouter();
  const { tokenId } = router.query;


  //const { address: authAddress, web3: authWeb3 } = useAuth();
  // Au début du composant
  const auth = typeof window !== 'undefined' ?
    (window as any).RESCOE_AUTH || {
      isAuthenticated: false, address: null, role: null,
      isAdmin: false, web3: null, provider: null
    } : { isAuthenticated: false, address: null, role: null, isAdmin: false, web3: null, provider: null };

  const { isAuthenticated, address : authAddress, role, web3: authWeb3, provider, connectWallet, logout } = auth;

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isForSale, setIsForSale] = useState<boolean>(false);
  const [nftCache, setNftCache] = useState<{ [key: string]: NFTData }>({}); // ✅ ERREUR 3: setNFTCache → setNftCache
  const [renewPriceEth, setRenewPriceEth] = useState<string | null>(null);

  const [evolutionRefreshFlag, setEvolutionRefreshFlag] = useState<number>(0);
  const [reproRefreshFlag, setReproRefreshFlag] = useState<number>(0);


  useEffect(() => {
    // ✅ RESTAURE AUTH APRÈS NAVIGATION
    if (typeof window !== 'undefined') {
      const restoreAuth = () => {
        if (!auth.isAuthenticated && (window as any).RESCOE_AUTH?.isAuthenticated) {
          //console.log('🔄 Restauration auth...');
          // Force refresh de l'objet global
          (window as any).RESCOE_AUTH = {
            ...auth,
            ...(window as any).RESCOE_AUTH
          };
        }
      };

      restoreAuth();

      // Listener pour reconnexion
      const handleFocus = () => restoreAuth();
      window.addEventListener('focus', handleFocus);

      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [auth.isAuthenticated]);


  const reproduction = useReproduction({
    contractAddress: contractAdhesion,
    roleLabelResolver: (role: number) => roleLabels[roles[role]] || "Member",
  });


  const effectiveTokenId = tokenId ? Number(tokenId) : 0;
  const hatch = useHatchEgg(contractAdhesion, effectiveTokenId);



  function formatSeconds(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;
    return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  const formatDateTime = (ts: number) =>
    new Date(ts * 1000).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  useEffect(() => {
    if (!contractAdhesion || !router.isReady) return;

    const loadRenewPrice = async () => {
      try {
        const provider = new JsonRpcProvider(
          process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!
        );
        const contract = new EthersContract(contractAdhesion, ABI, provider);
        const priceWei = await contract.mintPrice();
        setRenewPriceEth(formatUnits(priceWei, "ether"));
      } catch (err) {
        console.error("Erreur chargement prix renouvellement", err);
        setRenewPriceEth(null);
      }
    };

    loadRenewPrice();
  }, [contractAdhesion, router.isReady]);

  useEffect(() => {
    if (!router.isReady || !contractAdhesion || tokenId === undefined) return;

    setIsLoading(true);

    const fetchNFT = async () => {
      try {
        const data = await fetchNFTData(contractAdhesion as string, Number(tokenId));
        setNftData(data);
        setIsForSale(data.forSale);
        const remainingTimeInSeconds = Number(data.remainingTime);
        setMembershipStatus(remainingTimeInSeconds > 0 ? 'actif' : 'expiré');
        setName(data.name);
        setBio(data.bio);
        setPrice(data.price);
      } catch (err) {
        console.error('Erreur lors de la récupération du NFT:', err);
        setError('Erreur lors de la récupération des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [router.isReady, contractAdhesion, tokenId]);

  // ✅ CORRECTION: useCallback pour éviter les re-renders infinis
  const updateCurrentMetadata = useCallback((metadata: any) => {
    // Cette fonction sera passée au hook useTokenEvolution
  }, []);

  // ✅ REMPLACE TOUT ÇA (du début du hook jusqu'à membershipInfo) PAR ÇA EN ENTIER :
  const evolutionResult = useTokenEvolution({
    contractAddress: contractAdhesion,
    tokenId: Number(tokenId || 0),
    currentImage: nftData?.image,
    currentName: nftData?.name || "",
    currentBio: nftData?.bio || "",
    currentRoleLabel: nftData ? (roles[nftData.role] || "Member") : "Member",
    onMetadataLoaded: updateCurrentMetadata,
  }) as any;  // ← Force le type

  const rawMembershipInfo: MembershipInfo | null = evolutionResult.membershipInfo || null;
  const evolvePriceEth = evolutionResult.evolvePriceEth || "0";
  const isManualEvolveReady = evolutionResult.isManualEvolveReady || false;
  const previewImageUrl = evolutionResult.previewImageUrl || "";
  const evolveIpfsUrl = evolutionResult.evolveIpfsUrl || "";
  const isUploadingEvolve = evolutionResult.isUploadingEvolve || false;
  const isEvolving = evolutionResult.isEvolving || false;
  const prepareEvolution = evolutionResult.prepareEvolution || (() => {});
  const evolve = evolutionResult.evolve || (() => {});
  const refreshEvolution = evolutionResult.refreshEvolution || (() => {});

  const membershipInfo = rawMembershipInfo || {
    level: Number(nftData?.level || 0),
    isEgg: nftData?.membershipInfo?.isEgg || false,
    autoEvolve: false,
    startTimestamp: 0,
    expirationTimestamp: 0,
    totalYears: 0,
    locked: false,
    isAnnual: false,
  };

  const fetchNFTData = useCallback(async (
    contractAdhesionAddress: string,
    tokenIdNumber: number
  ): Promise<NFTData> => {
    const cacheKey = `${contractAdhesionAddress}_${tokenIdNumber}`;
    if (nftCache[cacheKey]) return nftCache[cacheKey];

    try {
      const rpcProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
      const contract = new EthersContract(contractAdhesionAddress, ABI, rpcProvider);
      const contractManagement = new EthersContract(contractAdhesionManagement, ABI_Management, rpcProvider);

      const [
        owner,
        role,
        mintTimestamp,
        priceWei,
        nameOnChain,
        bioOnChain,
        remainingTime,
        forSale,
      ] = await contract.getTokenDetails(tokenIdNumber);

      const [membership, realName, realBio] = await contract.getUserInfo(owner);
      const uri = await contract.tokenURI(tokenIdNumber);


      const metadataUrl = resolveIPFS(uri, true);

      if (!metadataUrl) {
        throw new Error("metadataUrl is undefined");
      }

      const res = await fetch(metadataUrl);
      const metadata: EvolutionMetadata = await res.json();

      const finAdhesion = new Date(
        (Number(mintTimestamp) + Number(remainingTime)) * 1000
      ).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });



      const membershipInfoRaw = await contract.getMembershipInfo(tokenIdNumber);

              const membershipInfo: MembershipInfo = {  // ✅ AJOUT
              level: Number(membershipInfoRaw.level),
              autoEvolve: Boolean(membershipInfoRaw.autoEvolve),
              startTimestamp: Number(membershipInfoRaw.startTimestamp),
              expirationTimestamp: Number(membershipInfoRaw.expirationTimestamp),
              totalYears: Number(membershipInfoRaw.totalYears),
              locked: Boolean(membershipInfoRaw.locked),
              isEgg: Boolean(membershipInfoRaw.isEgg),      // ✅
              isAnnual: Boolean(membershipInfoRaw.isAnnual),
            };



      const nftData: NFTData = {
        ...metadata,
        tokenURI: uri,
        uri: uri,
        owner,
        role: Number(role),
        mintTimestamp: formatTimestamp(Number(mintTimestamp)),
        price: formatUnits(priceWei as BigNumberish, 'ether'),
        name: (realName && realName.length > 0) ? realName : nameOnChain,
        bio: (realBio && realBio.length > 0) ? realBio : bioOnChain,
        remainingTime: formatSeconds(Number(remainingTime)),
        fin: finAdhesion,
        forSale: Boolean(forSale),
        membership,
        membershipInfo,
      };
     //console.log(nftData);

      setNftCache(prev => ({ ...prev, [cacheKey]: nftData })); // ✅ CORRECTION: setNftCache

      updateCurrentMetadata({
        level: Number(metadata.level || 0),
        family: metadata.family,
        sprite_name: metadata.sprite_name,
        attributes: metadata.attributes || [],
        evolution_history: metadata.evolution_history || [],
        image: metadata.image
      });

      return nftData;
    } catch (err) {
      console.error('Erreur lors de la récupération des données NFT:', err);
      throw new Error('Erreur lors de la récupération des données NFT.');
    }
  }, [nftCache, updateCurrentMetadata]); // ✅ Dépendances ajoutées

  // Reste des fonctions handle... (inchangées)
  const handleRenewMembership = async () => {
    if (!contractAdhesion || Array.isArray(contractAdhesion)) {
      console.error('Adresse de contrat invalide');
      return;
    }
    if (!authWeb3 || !authAddress) {
      alert('Veuillez vous connecter à MetaMask.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const mintPriceWei: string = await contract.methods.mintPrice().call();
      const gas = await contract.methods
        .renewMembership(Number(tokenId))
        .estimateGas({
          from: authAddress,
          value: mintPriceWei,
        });

      await contract.methods.renewMembership(Number(tokenId)).send({
        from: authAddress,
        value: mintPriceWei,
        gas: Math.floor(Number(gas) * 1.2).toString(),
      });

      alert('Adhésion renouvelée avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);
      refreshEvolution();
      setEvolutionRefreshFlag(prev => prev + 1);
    } catch (err) {
      console.error('Erreur lors du renouvellement de l\'adhésion:', err);
      alert('Erreur lors du renouvellement. Voir console.');
    }
  };


  const handleUpdateInfo = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      await contract.methods.setNameAndBio(Number(tokenId), name, bio).send({ from: authAddress });
      alert('Informations mises à jour avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);
    } catch (err) {
      console.error('Erreur lors de la mise à jour des informations:', err);
      alert('Erreur lors de la mise à jour. Voir console.');
    }
  };

  const handleListForSale = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert('Prix invalide.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const priceWei = (authWeb3 as Web3).utils.toWei(price, 'ether');
      await contract.methods.listTokenForSale(Number(tokenId), priceWei).send({ from: authAddress });

      setIsForSale(true);
      alert('NFT mis en vente avec succès.');
    } catch (err) {
      console.error('Erreur lors de la mise en vente du NFT:', err);
      alert('Erreur lors de la mise en vente. Voir console.');
    }
  };

  const handlePurchase = async () => {
    if (!nftData) {
      console.error('nftData is not available.');
      return;
    }
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const valueWei = (authWeb3 as Web3).utils.toWei(nftData.price, 'ether');
      await contract.methods.buyNFT(Number(tokenId)).send({ from: authAddress, value: valueWei });
      alert('NFT acheté avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);

      refreshEvolution();

      setIsForSale(updated.forSale);
      setEvolutionRefreshFlag(prev => prev + 1);
    } catch (err) {
      console.error('Erreur lors de l\'achat du NFT:', err);
      alert('Erreur lors de l\'achat. Voir console.');
    }
  };


  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl" color="red.500">Une erreur est survenue... Tentez de recharger la page</Text>
      </Box>
    );
  }

  if (!nftData) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl">NFT non trouvé.</Text>
      </Box>
    );
  }

  const isOwner = authAddress && authAddress.toLowerCase() === nftData.owner.toLowerCase();
  const isVendable = nftData.remainingTime.startsWith('0j');
  const canPurchase = !isOwner && isForSale;
  const isready = nftData.remainingTime.startsWith('0j');

  const evolutionHistory = nftData ? buildEvolutionHistory({
    ...nftData,
    membershipInfo,
    tokenURI: nftData.uri,
    level: membershipInfo?.level ?? nftData.level
  }) : [];

  const currentImage =
    evolutionHistory.length > 0
      ? evolutionHistory[evolutionHistory.length - 1].image
      : nftData.image;

  const HatchEggPanel = ({ tokenId, hatch, contractAddress }: any) => {
    // Composant inchangé
    if (hatch.error) {
      return (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          {hatch.error}
        </Alert>
      );
    }

  return (
    <Box p={6} bg="yellow.50" borderRadius="lg">
      <Heading size="lg" mb={6}>🥚 ÉCLORE L'ŒUF #{tokenId}</Heading>

      {/*
      <SimpleGrid columns={3} spacing={6} mb={8}>
        {hatch.evolutionOptions.map((opt: any) => (
          <Box key={opt.id}
            borderWidth={3}
            borderColor={hatch.selectedEvolution?.id === opt.id ? "green.400" : "gray.300"}
            borderRadius="lg"
            p={6}
            cursor="pointer"
            _hover={{ shadow: "xl", transform: "scale(1.05)" }}
            transition="all 0.2s"
            onClick={() => hatch.setSelectedEvolution(opt)}
            bg="white"
          >
            <Image
              src={opt.imageUrl}
              w="full"
              h={28}
              objectFit="cover"
              borderRadius="md"
              mb={3}
            />
            <Heading size="sm" noOfLines={1}>{opt.displayName}</Heading>
            <Text fontSize="xs" color="gray.500">{opt.family}</Text>
          </Box>
        ))}
      </SimpleGrid>

   */}


      <Button
        colorScheme="green"
        size="xl"
        h={16}
        fontSize="lg"
        isLoading={hatch.isHatching}
        loadingText="Éclosion en cours..."
        onClick={hatch.hatchEgg}
        disabled={!hatch.isReady}
        w="full"
        boxShadow="lg"
      >
        {hatch.isHatching
          ? "Éclosion..."
          : `ÉCLORE INSECTE → ${hatch.selectedEvolution?.displayName || "Choisir"}`
        }
      </Button>

      {hatch.txHash && (
        <HStack mt={6} p={4} bg="green.50" borderRadius="md">
          <Icon as={FaCheckCircle} color="green.500" boxSize={6} />
          <Text fontWeight="bold" color="green.700">Succès !</Text>
          <Link href={`https://sepolia.etherscan.io/tx/${hatch.txHash}`} isExternal>
            <Text fontSize="sm" color="blue.500" fontFamily="mono">
              {hatch.txHash.slice(0,20)}...
            </Text>
          </Link>
        </HStack>
      )}
    </Box>
  );
};


return (
  <Box
    textAlign="center"
    mt={10}
    p={{ base: 6, md: 8 }}
    maxW="100vw"
    mx="auto"
    position="relative"
  //  borderRadius={6}
    minH="auto"
  /*  boxShadow={useColorModeValue(effects.glowLight, effects.glowDark)}
    bg={useColorModeValue("brand.cream", "brand.navy")}
    overflow="hidden"
    _before={{
      content: '""',
      position: "absolute",
      inset: 0,
      padding: "1px",
      background: useColorModeValue(
        gradients.cardBorderLight,
        gradients.cardBorderDark
      ),
      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
      WebkitMaskComposite: "xor",
      maskComposite: "exclude",
      animation: animations.borderGlow,
      borderRadius: 6
    }}
    */
  >
    {/* HEADER RESCOE */}
    <Box position="relative" mb={8} zIndex={1}>
      <Heading
        as="h1"
        size="xl"
        mb={4}
        bgGradient={useColorModeValue(
          "linear(to-r, brand.navy, brand.blue)",
          "linear(to-r, brand.gold, brand.cream)"
        )}
        bgClip="text"
      >
        Carte d'adhésion de {nftData.name}
      </Heading>

      <Box
         position="relative"
         mx="auto"
         maxW={{ base: "280px", sm: "340px", md: "360px" }}
         w="full"
         px={{ base: 2, md: 0 }}
       >
         <Image
           src={resolveIPFS(nftData.image, true) || '/fallback-image.png'}
           alt={nftData.name}
           w="full"
           maxW={{ base: "280px", sm: "340px", md: "360px" }}
           maxH={{ base: "280px", sm: "340px", md: "360px" }}
           mx="auto"
           borderRadius={{ base: 2, md: 4 }}
           boxShadow={useColorModeValue("lg", "dark-lg")}
           objectFit="cover"
           transition="all 0.3s ease"
           _hover={{
             transform: { base: "scale(1.01)", md: "scale(1.02)" },
             boxShadow: useColorModeValue("2xl", "2xl")
           }}
         />

         {/* Badge responsive */}
         {membershipInfo && (
           <Box
             position="absolute"
             bottom={{ base: 2, md: 4 }}
             left="50%"
             transform="translateX(-50%)"
             bg="brand.gold"
             color="brand.navy"
             px={{ base: 3, md: 4 }}
             py={{ base: 1, md: 1 }}
             borderRadius="full"
             fontSize={{ base: "xs", md: "sm" }}
             fontWeight="semibold"
             boxShadow="md"
             whiteSpace="nowrap"
             minW="80px"
           >
             Niveau {membershipInfo.level}
           </Box>
         )}
       </Box>
     </Box>

    {/* TABS ÉPURÉS RESCOE */}
    <Tabs variant="line" colorScheme="brand">
      <Box
        overflowX="auto"
        pb={2}
        sx={{ '::-webkit-scrollbar': { display: 'none' } }}
        mb={6}
      >
        <TabList gap={1}>
          <Tab
            px={6}
            py={3}
            _selected={{
              color: "brand.gold",
              borderBottomColor: "brand.gold",
              borderBottomWidth: 3
            }}
            _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
          >
            Détails
          </Tab>

          {isOwner && isVendable && (
            <Tab
              px={6}
              py={3}
              _selected={{
                color: "brand.gold",
                borderBottomColor: "brand.gold",
                borderBottomWidth: 3
              }}
              _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
            >
            Mise en vente</Tab>
          )}
          {isOwner &&
            <Tab
              px={6}
              py={3}
              _selected={{
                color: "brand.gold",
                borderBottomColor: "brand.gold",
                borderBottomWidth: 3
              }}
              _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
            >
            Modifier Profil</Tab>}
          {!isOwner && canPurchase && (

            <Tab
              px={6}
              py={3}
              _selected={{
                color: "brand.gold",
                borderBottomColor: "brand.gold",
                borderBottomWidth: 3
              }}
              _hover={{ bg: useColorModeValue("gray.50", "whiteAlpha.50") }}
            >
            Achat</Tab>
          )}

          {/* Onglet dynamique discret */}
          {isOwner && (
            <Tab
              color={
                nftData?.membershipInfo?.isEgg ? "yellow.500" :
                membershipInfo?.level === 0 ? "yellow.500" :
                membershipInfo?.level === 1 ? "blue.500" :
                membershipInfo?.level === 2 ? "blue.600" : "green.500"
              }
              fontWeight="semibold"
              _selected={{ color: "brand.gold", borderBottomColor: "brand.gold" }}
              px={6}
              py={3}
            >
              {nftData?.membershipInfo?.isEgg ? "🥚 Éclosion" :
               membershipInfo?.level < 3 ? `🧬 LVL${membershipInfo.level}` : "🐛 Reproduction"}
            </Tab>
          )}
        </TabList>
      </Box>

      <TabPanels>
        {/* DÉTAILS - Layout propre */}
        <TabPanel p={0}>
          <VStack spacing={6} alignItems="start" w="full">
            {/* Infos principales */}
            <VStack spacing={4} w="full" alignItems="start">
              <Text fontSize="lg" fontWeight="medium">
                <strong>Propriétaire :</strong> <CopyableAddress address={nftData.owner}/>
              </Text>
              <Text fontSize="lg" fontWeight="medium">
                <strong>Rôle :</strong> {roleLabels[roles[nftData.role]] || 'Inconnu'}
              </Text>
              <Text fontSize="lg"><strong>Bio :</strong> {nftData.bio}</Text>
            </VStack>

            {/* Statut adhésion */}
            <VStack spacing={4} w="full" p={6} bg="whiteAlpha.50" borderRadius={4} alignItems="start">
              {isForSale && (
                <Text fontSize="lg" color="brand.gold" fontWeight="medium">
                  💰 À vendre : {nftData.price} ETH
                </Text>
              )}
              <Text fontSize="lg"><strong>Durée restante :</strong> {nftData.remainingTime}</Text>
              <Text fontSize="lg"><strong>Fin :</strong> {nftData.fin}</Text>
              {isOwner && (
                <Button
                  size="sm"
                  px={4}
                  py={2}
                  borderRadius="full"
                  bgGradient="linear(to-r, brand.gold, brand.cream)"
                  color="brand.navy"
                  fontSize="xs"
                  fontWeight="semibold"
                  boxShadow="sm"
                  _hover={brandHover}
                  onClick={handleRenewMembership}
                >
                  Renouveler l'adhésion : {renewPriceEth} ETH
                </Button>
              )}
            </VStack>

            {evolutionHistory.length > 0 && (
              <EvolutionHistoryTimeline evolutionHistory={evolutionHistory} />
            )}

            <Divider borderColor="rgba(255,255,255,0.2)" />
            {nftData && nftData.owner && <PublicProfile address={nftData.owner} />}
          </VStack>
        </TabPanel>

        {/* Autres panels - même structure épurée */}
        {isOwner && isVendable && (
          <TabPanel p={0}>
            <VStack spacing={6} align="start">
              <FormControl>
                <FormLabel fontWeight="medium">Prix (ETH)</FormLabel>
                <Input
                  type="number"
                  step="0.001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  size="lg"
                  bg="whiteAlpha.100"
                />
                <Button
                  mt={4}
                  w="full"
                  size="lg"
                  borderRadius="2xl"
                  bgGradient="linear(to-r, brand.gold, brand.cream)"
                  color="brand.navy"
                  _hover={brandHover}
                  isDisabled={!rawMembershipInfo?.expirationTimestamp}
                  onClick={handleListForSale}
                >
                  Mettre en vente
                </Button>
              </FormControl>
            </VStack>
          </TabPanel>
        )}

        {isOwner && (
          <TabPanel p={0}>
            <VStack spacing={6} align="start">
              <FormControl>
                <FormLabel fontWeight="medium">Nom</FormLabel>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  size="lg"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontWeight="medium">Biographie</FormLabel>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  size="lg"
                  rows={3}
                />
              </FormControl>
              {/* ✅ Bouton après les deux FormControl */}
              <Button
                mt={4}
                w="full"
                size="lg"
                borderRadius="2xl"
                bgGradient="linear(to-r, brand.gold, brand.cream)"
                color="brand.navy"
                _hover={brandHover}
                onClick={handleUpdateInfo}
              >
                Mettre à jour
              </Button>
            </VStack>
          </TabPanel>
        )}


        {!isOwner && canPurchase && (
          <TabPanel py={12}>
            <Button
              size="lg"
              w="full"
              h="16"
              borderRadius="3xl"
              bgGradient="linear(to-r, brand.gold, brand.mauve)"
              color="brand.navy"
              fontSize="lg"
              fontWeight="extrabold"
              boxShadow={useColorModeValue(effects.glowLight, effects.glowDark)}
              _hover={brandHover}
              onClick={handlePurchase}
            >
              Acheter ({nftData.price} ETH)
            </Button>
          </TabPanel>
        )}

        {/* Onglet dynamique */}
        {isOwner && (
          <TabPanel p={0}>
            <Heading
              as="h2"
              size="md"
              mb={6}
              color={
                nftData?.membershipInfo?.isEgg ? "yellow.600" :
                membershipInfo?.level < 3 ? "blue.600" : "green.600"
              }
            >
              {nftData?.membershipInfo?.isEgg ? "🥚 Éclosion" :
               membershipInfo?.level < 3 ? `🧬 Évolution LVL${membershipInfo.level}` :
               "🐛 Reproduction"}
            </Heading>

            {nftData?.membershipInfo?.isEgg ? (
              <HatchEggPanel tokenId={Number(tokenId)} hatch={hatch} contractAddress={contractAdhesion} />
            ) : membershipInfo?.level < 3 ? (
              <VStack spacing={6} align="start">
                <VStack spacing={3} align="start">
                  <Text fontWeight="medium">Niveau actuel : {membershipInfo.level}</Text>
                  <Text>Auto-évolution : {membershipInfo.autoEvolve ? "Oui" : "Non"}</Text>
                  <Text>Années : {membershipInfo.totalYears}</Text>
                </VStack>

                <Divider />

                <VStack spacing={3} align="start">
                  <Text fontWeight="medium">Prochaine étape : Niveau {membershipInfo.level + 1}</Text>
                  <Text>Prêt : {isready ? "Oui" : "Non"}</Text>
                  <Text>Coût : {evolvePriceEth} ETH</Text>
                </VStack>

                <Button
                  mt={2}
                  onClick={prepareEvolution}
                  isLoading={isUploadingEvolve}
                  colorScheme="purple"
                >
                  Préparer image
                </Button>

                <Button
                  size="lg"
                  w="full"
                  colorScheme="teal"
                  onClick={evolve}
                  isDisabled={!isManualEvolveReady || !evolveIpfsUrl}
                  isLoading={isEvolving}
                >
                  Faire évoluer
                </Button>
              </VStack>
            ) : (
              <ReproductionPanel reproduction={reproduction as any} renewPriceEth={renewPriceEth} />
            )}
          </TabPanel>
        )}
      </TabPanels>
    </Tabs>
  </Box>
);

};

export default TokenPage;
