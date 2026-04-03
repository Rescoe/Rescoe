import { useEffect, useState, useCallback, useRef } from 'react';
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
  Textarea,
  Badge,
} from '@chakra-ui/react';
import { FaCheckCircle } from 'react-icons/fa';
import { useRouter } from 'next/router';

import ABI from '@/components/ABI/ABIAdhesion.json';
import ABI_Management from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import { PublicProfile } from '@/components/containers/dashboard';
import { useHatchEgg } from '@/hooks/useHatchEgg';
import { useTokenEvolution, MembershipInfo } from '@/hooks/useTokenEvolution';
import { buildEvolutionHistory } from '@/utils/evolutionHistory';
import CopyableAddress from '@/hooks/useCopyableAddress';
import { useReproduction } from '@/hooks/useReproduction';
import { ReproductionPanel } from '@/components/Reproduction';
import EvolutionHistoryTimeline from '@/utils/EvolutionHistoryTimeline';
import { resolveIPFS } from '@/utils/resolveIPFS';
import { brandHover } from '@styles/theme';

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
  level?: number;
  uri?: string;
  tokenURI?: string;
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

const roles: Record<number, string> = {
  0: 'Artist',
  1: 'Poet',
  2: 'Contributor',
  3: 'Trainee',
};

const roleLabels: Record<string, string> = {
  Artist: 'Artiste',
  Poet: 'Poète',
  Contributor: 'Contributeur',
  Trainee: 'Formateur',
};

const contractAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

function formatSeconds(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}j ${hours}h ${minutes}m ${secs}s`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

const formatDateTime = (ts: number) =>
  new Date(ts * 1000).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

/* =========================================================
   DETAILS TAB
========================================================= */

interface DetailsTabProps {
  nftData: NFTData;
  membershipInfo: MembershipInfo;
  isOwner: boolean;
  isForSale: boolean;
  renewPriceEth: string | null;
  onRenew: () => void;
}

const DetailsTab = ({
  nftData,
  membershipInfo,
  isOwner,
  isForSale,
  renewPriceEth,
  onRenew,
}: DetailsTabProps) => {
  const [showProfile, setShowProfile] = useState(false);

  const evolutionHistory = buildEvolutionHistory({
    ...nftData,
    membershipInfo,
    tokenURI: nftData.uri,
    level: membershipInfo?.level ?? nftData.level,
  });

  return (
    <VStack spacing={6} alignItems="start" w="full">
      <VStack spacing={4} w="full" alignItems="start">
        <Text fontSize="lg" fontWeight="medium">
          <strong>Propriétaire :</strong> <CopyableAddress address={nftData.owner} />
        </Text>
        <Text fontSize="lg" fontWeight="medium">
          <strong>Rôle :</strong> {roleLabels[roles[nftData.role]] || 'Inconnu'}
        </Text>
        <Text fontSize="lg">
          <strong>Bio :</strong> {nftData.bio}
        </Text>
      </VStack>

      <VStack spacing={4} w="full" p={6} bg="whiteAlpha.50" borderRadius={4} alignItems="start">
        {isForSale && (
          <Text fontSize="lg" color="brand.gold" fontWeight="medium">
            💰 À vendre : {nftData.price} ETH
          </Text>
        )}
        <Text fontSize="lg">
          <strong>Durée restante :</strong> {nftData.remainingTime}
        </Text>
        <Text fontSize="lg">
          <strong>Fin :</strong> {nftData.fin}
        </Text>

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
            onClick={onRenew}
          >
            Renouveler l'adhésion : {renewPriceEth} ETH
          </Button>
        )}
      </VStack>

      {evolutionHistory.length > 0 && (
        <EvolutionHistoryTimeline evolutionHistory={evolutionHistory} />
      )}

      <Divider borderColor="rgba(255,255,255,0.2)" />

      {showProfile ? (
        <PublicProfile address={nftData.owner} />
      ) : (
        <Button size="sm" variant="ghost" colorScheme="brand" onClick={() => setShowProfile(true)}>
          Voir le profil public →
        </Button>
      )}
    </VStack>
  );
};

/* =========================================================
   EDIT PROFILE TAB
========================================================= */

interface EditProfileTabProps {
  initialName: string;
  initialBio: string;
  onSave: (name: string, bio: string) => Promise<void>;
}

const EditProfileTab = ({ initialName, initialBio, onSave }: EditProfileTabProps) => {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(name, bio);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VStack spacing={6} align="start">
      <FormControl>
        <FormLabel fontWeight="medium">Nom</FormLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} size="lg" />
      </FormControl>

      <FormControl>
        <FormLabel fontWeight="medium">Biographie</FormLabel>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} size="lg" rows={3} />
      </FormControl>

      <Button
        mt={4}
        w="full"
        size="lg"
        borderRadius="2xl"
        bgGradient="linear(to-r, brand.gold, brand.cream)"
        color="brand.navy"
        _hover={brandHover}
        onClick={handleSave}
        isLoading={isSaving}
      >
        Mettre à jour
      </Button>
    </VStack>
  );
};

/* =========================================================
   HATCH EGG PANEL
========================================================= */

const HatchEggPanel = ({ tokenId, hatch }: any) => {
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
      <Heading size="lg" mb={6}>
        🥚 ÉCLORE L'ŒUF #{tokenId}
      </Heading>

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
          ? 'Éclosion...'
          : `ÉCLORE INSECTE → ${hatch.selectedEvolution?.displayName || 'Choisir'}`}
      </Button>

      {hatch.txHash && (
        <HStack mt={6} p={4} bg="green.50" borderRadius="md">
          <Icon as={FaCheckCircle} color="green.500" boxSize={6} />
          <Text fontWeight="bold" color="green.700">
            Succès !
          </Text>
          <Link href={`https://basescan.org/tx/${hatch.txHash}`} isExternal>
            <Text fontSize="sm" color="blue.500" fontFamily="mono">
              {hatch.txHash.slice(0, 20)}...
            </Text>
          </Link>
        </HStack>
      )}
    </Box>
  );
};

/* =========================================================
   EVOLUTION TAB
   Hook lourd monté seulement si l'onglet est ouvert
========================================================= */

interface EvolutionTabProps {
  tokenId: number;
  nftData: NFTData;
  contractAdhesion: string;
  onEvolutionSuccess: () => void;
}

const EvolutionTab = ({
  tokenId,
  nftData,
  contractAdhesion,
  onEvolutionSuccess,
}: EvolutionTabProps) => {
  const hatch = useHatchEgg(contractAdhesion, tokenId);
  const updateCurrentMetadata = useCallback((_metadata: any) => {}, []);

  const evolutionResult = useTokenEvolution({
    contractAddress: contractAdhesion,
    tokenId,
    currentImage: nftData?.image,
    currentName: nftData?.name || '',
    currentBio: nftData?.bio || '',
    currentRoleLabel: nftData ? roles[nftData.role] || 'Member' : 'Member',
    onMetadataLoaded: updateCurrentMetadata,
  }) as any;

  const rawMembershipInfo: MembershipInfo | null = evolutionResult.membershipInfo || null;
  const evolvePriceEth = evolutionResult.evolvePriceEth || '0';
  const isManualEvolveReady = evolutionResult.isManualEvolveReady || false;
  const isUploadingEvolve = evolutionResult.isUploadingEvolve || false;
  const isEvolving = evolutionResult.isEvolving || false;
  const prepareEvolution = evolutionResult.prepareEvolution || (() => {});
  const evolve = evolutionResult.evolve || (() => {});

  const membershipInfo: MembershipInfo = rawMembershipInfo || {
    level: Number(nftData?.level || 0),
    isEgg: nftData?.membershipInfo?.isEgg || false,
    autoEvolve: false,
    startTimestamp: 0,
    expirationTimestamp: 0,
    totalYears: 0,
    locked: false,
    isAnnual: false,
  };

  const [canEvolve, setCanEvolve] = useState(false);
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!membershipInfo || prevLevelRef.current === membershipInfo.level) return;
    prevLevelRef.current = membershipInfo.level;

    const computeCanEvolve = async () => {
      try {
        const cacheKey = `levelDurations_${contractAdhesion}`;
        let levelDurations: number[];

        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          levelDurations = JSON.parse(cached);
        } else {
          const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
          const contract = new EthersContract(contractAdhesion, ABI, provider);
          const durationsRaw = await Promise.all([
            contract.levelDurations(0),
            contract.levelDurations(1),
            contract.levelDurations(2),
          ]);
          levelDurations = durationsRaw.map((d) => Number(d));
          sessionStorage.setItem(cacheKey, JSON.stringify(levelDurations));
        }

        const now = Math.floor(Date.now() / 1000);

        setCanEvolve(
          !membershipInfo.isEgg &&
            membershipInfo.level < 3 &&
            !membershipInfo.locked &&
            now >= membershipInfo.startTimestamp + levelDurations[membershipInfo.level]
        );
      } catch (e) {
        console.error('computeCanEvolve error:', e);
        setCanEvolve(false);
      }
    };

    computeCanEvolve();
  }, [membershipInfo.level, membershipInfo.startTimestamp, membershipInfo.isEgg, membershipInfo.locked, contractAdhesion]);

  const handleSingleEvolve = async () => {
    if (!canEvolve) {
      alert('Insecte pas encore éligible.');
      return;
    }

    try {
      const result = await prepareEvolution();

      if (!result?.isReady || !result.metadataUri) {
        throw new Error('Upload IPFS échoué: ' + JSON.stringify(result));
      }

      await new Promise((r) => setTimeout(r, 500));
      await evolve();
      onEvolutionSuccess();
    } catch (e: any) {
      console.error('Evolve error:', e);
      alert(e.message);
    }
  };

  return (
    <VStack spacing={{ base: 4, md: 6 }} w="full" align="stretch">
      <Card
        variant="elevated"
        w="full"
        bgGradient="linear(to-r, brand.navy, #1a3a52)"
        color="brand.cream"
        shadow="lg"
        borderRadius={{ base: 'lg', md: 'xl' }}
      >
        <CardBody p={{ base: 4, md: 6 }}>
          <VStack align="start" spacing={{ base: 3, md: 4 }} w="full">
            <Heading size={{ base: 'md', md: 'lg' }} color="brand.gold" noOfLines={2}>
              {membershipInfo?.isEgg
                ? '🥚 Œuf prêt à éclore'
                : membershipInfo?.level === 0
                ? '🧬 Niveau 0 → 1'
                : membershipInfo?.level === 1
                ? '🧬 Niveau 1 → 2'
                : membershipInfo?.level === 2
                ? '🧬 Niveau 2 → 3'
                : '🐛 Niveau maximum'}
            </Heading>

            <Flex gap={2} flexWrap="wrap" w="full">
              <Badge
                colorScheme={membershipInfo?.locked ? 'red' : 'green'}
                fontSize={{ base: 'xs', md: 'sm' }}
                px={3}
                py={1}
                borderRadius="full"
              >
                {membershipInfo?.locked ? '🔒 Verrouillé' : '✅ Débloqué'}
              </Badge>

              <Badge
                colorScheme={membershipInfo?.autoEvolve ? 'purple' : 'gray'}
                fontSize={{ base: 'xs', md: 'sm' }}
                px={3}
                py={1}
                borderRadius="full"
              >
                {membershipInfo?.autoEvolve ? '🤖 Auto' : '✋ Manuel'}
              </Badge>

              {membershipInfo?.isAnnual && (
                <Badge
                  colorScheme="orange"
                  fontSize={{ base: 'xs', md: 'sm' }}
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  📅 {membershipInfo?.totalYears || 0} ans
                </Badge>
              )}
            </Flex>

            <HStack justify="space-between" w="full" pt={2}>
              <Text fontSize={{ base: 'sm', md: 'md' }} opacity={0.9}>
                Depuis {formatDateTime(membershipInfo?.startTimestamp || 0)}
              </Text>
              <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="extrabold" color="brand.gold">
                {membershipInfo?.level || 0}/3
              </Text>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      <SimpleGrid columns={{ base: 2, md: 2 }} spacing={{ base: 3, md: 4 }} w="full">
        <Card variant="outline" p={{ base: 3, md: 4 }} borderColor="brand.gold">
          <CardBody p={0}>
            <VStack align="start" spacing={1}>
              <Text fontWeight="600" color="brand.navy" fontSize={{ base: 'xs', md: 'sm' }}>
                État
              </Text>
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                fontWeight="bold"
                color={canEvolve ? 'green.600' : 'orange.600'}
              >
                {canEvolve ? '✅ PRÊT' : "Préparez l'évolution"}
              </Text>
            </VStack>
          </CardBody>
        </Card>

        {membershipInfo?.level < 3 && (
          <Card variant="outline" p={{ base: 3, md: 4 }} borderColor="brand.gold">
            <CardBody p={0}>
              <VStack align="start" spacing={1}>
                <Text fontWeight="600" color="brand.navy" fontSize={{ base: 'xs', md: 'sm' }}>
                  Coût
                </Text>
                <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="extrabold" color="brand.gold">
                  {Number(evolvePriceEth || 0).toFixed(4)} Ξ
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}
      </SimpleGrid>

      <Card
        w="full"
        variant="outline"
        borderWidth="1px"
        borderColor="brand.gold"
        borderRadius={{ base: 'lg', md: 'xl' }}
      >
        <CardBody p={{ base: 4, md: 6 }}>
          {membershipInfo?.isEgg ? (
            <HatchEggPanel tokenId={tokenId} hatch={hatch} />
          ) : membershipInfo?.level < 3 ? (
            <VStack spacing={{ base: 4, md: 6 }} w="full" align="center">
              <Button
                size={{ base: 'lg', md: 'lg' }}
                w="full"
                h={{ base: '48px', md: '56px' }}
                bgGradient="linear(to-r, brand.gold, #d4af37)"
                color="brand.navy"
                fontSize={{ base: 'md', md: 'lg' }}
                fontWeight="extrabold"
                borderRadius="lg"
                onClick={handleSingleEvolve}
                isDisabled={!canEvolve || isUploadingEvolve || isEvolving}
                isLoading={isUploadingEvolve || isEvolving}
                loadingText={isUploadingEvolve ? 'Génération...' : 'Transaction...'}
              >
                {isManualEvolveReady ? "Valider l'évolution" : 'Générer et évoluer'}
              </Button>
            </VStack>
          ) : null}
        </CardBody>
      </Card>
    </VStack>
  );
};

/* =========================================================
   REPRODUCTION TAB
========================================================= */

interface ReproductionTabProps {
  contractAdhesion: string;
  renewPriceEth: string | null;
}

const ReproductionTab = ({ contractAdhesion, renewPriceEth }: ReproductionTabProps) => {
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reproduction = useReproduction({
    contractAddress: contractAdhesion,
    roleLabelResolver: (role: number) => roleLabels[roles[role]] || 'Member',
    refreshKey: `${contractAdhesion}-${refreshKey}`,
  });

  if (!loaded) {
    return (
      <Center p={8}>
        <Button onClick={() => setLoaded(true)} colorScheme="brand" size="lg">
          🔄 Charger les données de reproduction
        </Button>
      </Center>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      <ReproductionPanel reproduction={reproduction as any} renewPriceEth={renewPriceEth} />
      <Button size="sm" variant="ghost" colorScheme="brand" onClick={() => setRefreshKey((k) => k + 1)}>
        ↺ Rafraîchir
      </Button>
    </VStack>
  );
};

/* =========================================================
   BURN TAB
========================================================= */

interface BurnTabProps {
  tokenId: number;
  isBurning: boolean;
  onBurn: () => Promise<void>;
}

const BurnTab = ({ tokenId, isBurning, onBurn }: BurnTabProps) => (
  <VStack spacing={6} align="start">
    <Alert status="warning" borderRadius="lg">
      <AlertIcon />
      Action <strong>&nbsp;IRREVERSIBLE&nbsp;</strong> : Le badge sera détruit à jamais.
    </Alert>

    <Button
      size="lg"
      w="full"
      borderRadius="2xl"
      bgGradient="linear(to-r, red.500, red.600)"
      color="white"
      fontWeight="extrabold"
      boxShadow="lg"
      isDisabled={isBurning}
      isLoading={isBurning}
      loadingText="Burn en cours..."
      onClick={onBurn}
    >
      🔥 Brûler NFT #{tokenId}
    </Button>
  </VStack>
);

/* =========================================================
   TOKEN PAGE
========================================================= */

const TokenPage = () => {
  const router = useRouter();
  const { tokenId } = router.query;

  const auth =
    typeof window !== 'undefined'
      ? (window as any).RESCOE_AUTH || {
          isAuthenticated: false,
          address: null,
          role: null,
          isAdmin: false,
          web3: null,
          provider: null,
        }
      : {
          isAuthenticated: false,
          address: null,
          role: null,
          isAdmin: false,
          web3: null,
          provider: null,
        };

  const { address: authAddress, web3: authWeb3 } = auth;

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForSale, setIsForSale] = useState(false);
  const [renewPriceEth, setRenewPriceEth] = useState<string | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [nftCache, setNftCache] = useState<Record<string, NFTData>>({});

  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo>({
    level: 0,
    isEgg: false,
    autoEvolve: false,
    startTimestamp: 0,
    expirationTimestamp: 0,
    totalYears: 0,
    locked: false,
    isAnnual: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreAuth = () => {
      if (!auth.isAuthenticated && (window as any).RESCOE_AUTH?.isAuthenticated) {
        (window as any).RESCOE_AUTH = {
          ...auth,
          ...(window as any).RESCOE_AUTH,
        };
      }
    };

    restoreAuth();
    window.addEventListener('focus', restoreAuth);
    return () => window.removeEventListener('focus', restoreAuth);
  }, [auth.isAuthenticated]);

  const fetchNFTData = useCallback(
    async (contractAdhesionAddress: string, tokenIdNumber: number): Promise<NFTData> => {
      const cacheKey = `${contractAdhesionAddress}_${tokenIdNumber}`;
      if (nftCache[cacheKey]) return nftCache[cacheKey];

      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
      const contract = new EthersContract(contractAdhesionAddress, ABI, provider);

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

      let metadata: Partial<EvolutionMetadata> = {};
      let imageUrl = '';

      try {
        const metadataUrl = resolveIPFS(uri, true);

        if (metadataUrl && metadataUrl.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
          imageUrl = metadataUrl;
        } else if (metadataUrl) {
          const res = await fetch(metadataUrl);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data) {
              metadata = data;
              if (data.image) {
                const resolved = resolveIPFS(data.image, true);
                if (resolved) imageUrl = resolved;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Metadata fetch échoué:', e);
      }

      const finAdhesion = new Date(
        (Number(mintTimestamp) + Number(remainingTime)) * 1000
      ).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

      const membershipInfoRaw = await contract.getMembershipInfo(tokenIdNumber);
      const mi: MembershipInfo = {
        level: Number(membershipInfoRaw.level),
        autoEvolve: Boolean(membershipInfoRaw.autoEvolve),
        startTimestamp: Number(membershipInfoRaw.startTimestamp),
        expirationTimestamp: Number(membershipInfoRaw.expirationTimestamp),
        totalYears: Number(membershipInfoRaw.totalYears),
        locked: Boolean(membershipInfoRaw.locked),
        isEgg: Boolean(membershipInfoRaw.isEgg),
        isAnnual: Boolean(membershipInfoRaw.isAnnual),
      };

      const result: NFTData = {
        ...(metadata as any),
        image: imageUrl,
        tokenURI: uri,
        uri,
        owner,
        role: Number(role),
        mintTimestamp: formatTimestamp(Number(mintTimestamp)),
        price: formatUnits(priceWei as BigNumberish, 'ether'),
        name: realName?.length > 0 ? realName : nameOnChain,
        bio: realBio?.length > 0 ? realBio : bioOnChain,
        remainingTime: formatSeconds(Number(remainingTime)),
        fin: finAdhesion,
        forSale: Boolean(forSale),
        membership,
        membershipInfo: mi,
      };

      setNftCache((prev) => ({ ...prev, [cacheKey]: result }));
      return result;
    },
    [nftCache]
  );

  useEffect(() => {
    if (!router.isReady || !contractAdhesion || tokenId === undefined) return;

    setIsLoading(true);

    fetchNFTData(contractAdhesion, Number(tokenId))
      .then((data) => {
        setNftData(data);
        setIsForSale(data.forSale);
        if (data.membershipInfo) setMembershipInfo(data.membershipInfo);
      })
      .catch(() => {
        setError('Erreur lors de la récupération des données.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router.isReady, tokenId, fetchNFTData]);

  useEffect(() => {
    if (!contractAdhesion || !router.isReady) return;

    const loadRenewPrice = async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
        const contract = new EthersContract(contractAdhesion, ABI, provider);
        const priceWei = await contract.mintPrice();
        setRenewPriceEth(formatUnits(priceWei, 'ether'));
      } catch {
        setRenewPriceEth(null);
      }
    };

    loadRenewPrice();
  }, [router.isReady]);

  const handleRenewMembership = async () => {
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
      if (updated.membershipInfo) setMembershipInfo(updated.membershipInfo);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du renouvellement. Voir console.');
    }
  };

  const handleUpdateInfo = async (name: string, bio: string) => {
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
      console.error(err);
      alert('Erreur lors de la mise à jour. Voir console.');
    }
  };

  const handleBurn = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter à MetaMask.');
      return;
    }

    setIsBurning(true);

    try {
      const web3 = new Web3(window.ethereum as any);
      const contract = new web3.eth.Contract(ABI as any, contractAdhesion);
      const gasPrice = await web3.eth.getGasPrice();

      const gas = await contract.methods.burnNFT(Number(tokenId)).estimateGas({
        from: authAddress,
      });

      await contract.methods.burnNFT(Number(tokenId)).send({
        from: authAddress,
        gas: Math.floor(Number(gas) * 1.2).toString(),
        gasPrice: gasPrice.toString(),
      });

      alert('NFT brûlé avec succès.');
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Erreur lors du burn. Voir console.');
    } finally {
      setIsBurning(false);
    }
  };

  const handleEvolutionSuccess = useCallback(async () => {
    const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
    setNftData(updated);
    if (updated.membershipInfo) setMembershipInfo(updated.membershipInfo);
    sessionStorage.removeItem(`levelDurations_${contractAdhesion}`);
  }, [fetchNFTData, tokenId]);

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
        <Spinner size="lg" color="orange.400" />
        <Text mt={4} fontSize="lg" color="gray.500">
          Chargement des données...
        </Text>
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

  const isOwner =
    !!authAddress && authAddress.toLowerCase() === nftData.owner.toLowerCase();

  const isLevel3 = membershipInfo.level >= 3 && !membershipInfo.isEgg;

  const evolutionTabLabel = membershipInfo?.isEgg
    ? '🥚 Éclosion'
    : membershipInfo?.level < 3
    ? `🧬 LVL${membershipInfo.level}`
    : '🐛 Reproduction';

  const tabColor =
    membershipInfo?.isEgg || membershipInfo?.level === 0
      ? 'yellow.500'
      : membershipInfo?.level === 1
      ? 'blue.500'
      : membershipInfo?.level === 2
      ? 'blue.600'
      : 'green.500';

  return (
    <Box textAlign="center" mt={10} p={{ base: 6, md: 8 }} maxW="100vw" mx="auto">
      <Box position="relative" mb={8} zIndex={1}>
        <Heading
          as="h1"
          size="xl"
          mb={4}
          bgGradient={useColorModeValue(
            'linear(to-r, brand.navy, brand.blue)',
            'linear(to-r, brand.gold, brand.cream)'
          )}
          bgClip="text"
        >
          Carte d'adhésion de {nftData.name}
        </Heading>

        <Box
          position="relative"
          mx="auto"
          maxW={{ base: '280px', sm: '340px', md: '360px' }}
          w="full"
          px={{ base: 2, md: 0 }}
        >
          <Image
            src={resolveIPFS(nftData.image, true) || '/fallback-image.png'}
            alt={nftData.name}
            w="full"
            maxW={{ base: '280px', sm: '340px', md: '360px' }}
            maxH={{ base: '280px', sm: '340px', md: '360px' }}
            mx="auto"
            borderRadius={{ base: 2, md: 4 }}
            boxShadow={useColorModeValue('lg', 'dark-lg')}
            objectFit="cover"
            transition="all 0.3s ease"
          />

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
            fontSize={{ base: 'xs', md: 'sm' }}
            fontWeight="semibold"
            boxShadow="md"
            whiteSpace="nowrap"
            minW="80px"
          >
            Niveau {membershipInfo.level}
          </Box>
        </Box>
      </Box>

      <Tabs variant="line" colorScheme="brand" isLazy lazyBehavior="keepMounted">
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
                color: 'brand.gold',
                borderBottomColor: 'brand.gold',
                borderBottomWidth: 3,
              }}
            >
              Détails
            </Tab>

            {isOwner && (
              <Tab
                px={6}
                py={3}
                _selected={{
                  color: 'brand.gold',
                  borderBottomColor: 'brand.gold',
                  borderBottomWidth: 3,
                }}
              >
                Modifier Profil
              </Tab>
            )}

            {isOwner && (
              <Tab
                color={tabColor}
                fontWeight="semibold"
                px={6}
                py={3}
                _selected={{ color: 'brand.gold', borderBottomColor: 'brand.gold' }}
              >
                {evolutionTabLabel}
              </Tab>
            )}

            {isOwner && <Tab px={6} py={3}>Brûler NFT</Tab>}
          </TabList>
        </Box>

        <TabPanels>
          <TabPanel p={0}>
            <DetailsTab
              nftData={nftData}
              membershipInfo={membershipInfo}
              isOwner={isOwner}
              isForSale={isForSale}
              renewPriceEth={renewPriceEth}
              onRenew={handleRenewMembership}
            />
          </TabPanel>

          {isOwner && (
            <TabPanel p={0}>
              <EditProfileTab
                initialName={nftData.name}
                initialBio={nftData.bio}
                onSave={handleUpdateInfo}
              />
            </TabPanel>
          )}

          {isOwner && (
            <TabPanel p={0}>
              {isLevel3 ? (
                <ReproductionTab
                  contractAdhesion={contractAdhesion}
                  renewPriceEth={renewPriceEth}
                />
              ) : (
                <EvolutionTab
                  tokenId={Number(tokenId)}
                  nftData={nftData}
                  contractAdhesion={contractAdhesion}
                  onEvolutionSuccess={handleEvolutionSuccess}
                />
              )}
            </TabPanel>
          )}

          {isOwner && (
            <TabPanel p={0}>
              <BurnTab
                tokenId={Number(tokenId)}
                isBurning={isBurning}
                onBurn={handleBurn}
              />
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default TokenPage;
