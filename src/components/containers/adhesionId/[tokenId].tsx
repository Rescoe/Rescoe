import { useEffect, useState, useCallback, useMemo } from 'react';
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
import type { AdhesionTokenMetadata, AdhesionTokenState } from '@/types/token';
import { PublicProfile } from '@/components/containers/dashboard';
import { useHatchEgg } from '@/hooks/useHatchEgg';
import { useTokenEvolution, MembershipInfo } from '@/hooks/useTokenEvolution';
import CopyableAddress from '@/hooks/useCopyableAddress';
import { useReproduction } from '@/hooks/useReproduction';
import { ReproductionPanel } from '@/components/Reproduction';
import { resolveIPFS } from '@/utils/resolveIPFS';
import { useEvolutionHistory } from '@/hooks/useEvolutionHistory';
import EvolutionTimeline from '@/components/modules/EvolutionTimeline';
import GenealogyTree from '@/components/modules/GenealogyTree';
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
  insectArtistAddress?: string | null;
  tokenId: number | string;
  pastSteps: import('@/hooks/useEvolutionHistory').EvolutionStep[];
  currentStep: import('@/hooks/useEvolutionHistory').EvolutionStep | null;
  genealogy: import('@/hooks/useEvolutionHistory').GenealogyInfo | null;
  evoLoading: boolean;
  contractAdhesion: string;
}

const DetailsTab = ({
  nftData,
  membershipInfo,
  isOwner,
  isForSale,
  renewPriceEth,
  onRenew,
  insectArtistAddress,
  tokenId,
  pastSteps,
  currentStep,
  genealogy,
  evoLoading,
  contractAdhesion,
}: DetailsTabProps) => {
  const [showProfile, setShowProfile] = useState(false);

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
        {insectArtistAddress && (
          <Text fontSize="sm" color="brand.gold" opacity={0.85}>
            🎨 <strong>Design :</strong>{" "}
            <CopyableAddress address={insectArtistAddress} />
          </Text>
        )}
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

      {/* ── Sous-onglets Frise / Généalogie ─────────────────────────────── */}
      <Box w="full" mt={2}>
        <Tabs variant="soft-rounded" colorScheme="yellow" size="sm" isLazy>
          <TabList mb={3}>
            <Tab fontSize="xs" px={3} py={1}>🕐 Frise</Tab>
            <Tab fontSize="xs" px={3} py={1}>🌳 Généalogie</Tab>
          </TabList>
          <TabPanels>
            <TabPanel p={0}>
              <EvolutionTimeline
                pastSteps={pastSteps}
                currentStep={currentStep}
                isLoading={evoLoading}
              />
            </TabPanel>
            <TabPanel p={0}>
              <GenealogyTree
                tokenId={tokenId}
                genealogy={genealogy}
                isLoading={evoLoading}
                contractAddress={contractAdhesion}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

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

// Remplace uniquement le composant HatchEggPanel dans [tokenId].tsx

const HatchEggPanel = ({ tokenId, hatch }: { tokenId: number; hatch: ReturnType<typeof useHatchEgg> }) => {
  // Pendant la préparation silencieuse (upload IPFS en arrière-plan)
  if (hatch.isPreparing) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="lg" color="yellow.400" mb={4} />
        <Text fontWeight="medium" color="yellow.700">
          Génération de l'insecte en cours…
        </Text>
      </Box>
    );
  }

  if (hatch.error) {
    return (
      <Alert status="warning" mb={4} borderRadius="md">
        <AlertIcon />
        {hatch.error}
      </Alert>
    );
  }

  return (
    <Box p={6} bg="yellow.50" borderRadius="lg">
      <Heading size="lg" mb={4}>
        🥚 ÉCLORE L'ŒUF #{tokenId}
      </Heading>

      {/* Aperçu de l'insecte généré */}
      {hatch.previewImageUrl && (
        <Box mb={6} textAlign="center">
          <Image
            src={hatch.previewImageUrl}
            alt="Insecte à éclore"
            maxH="160px"
            mx="auto"
            borderRadius="md"
            boxShadow="md"
          />
          <Text mt={2} fontSize="sm" color="gray.500">
            Votre insecte éclos
          </Text>
        </Box>
      )}

      <Button
        colorScheme="green"
        size="lg"
        h={16}
        fontSize="lg"
        isLoading={hatch.isHatching}
        loadingText="Éclosion en cours…"
        onClick={hatch.hatchEgg}
        isDisabled={!hatch.isReady || hatch.isHatching}
        w="full"
        boxShadow="lg"
      >
        {hatch.isHatching ? 'Éclosion…' : '🐛 ÉCLORE'}
      </Button>

      {hatch.txHash && (
        <HStack mt={6} p={4} bg="green.50" borderRadius="md">
          <Icon as={FaCheckCircle} color="green.500" boxSize={6} />
          <Text fontWeight="bold" color="green.700">Succès !</Text>
          <Link href={`https://basescan.org/tx/${hatch.txHash}`} isExternal>
            <Text fontSize="sm" color="blue.500" fontFamily="mono">
              {hatch.txHash.slice(0, 20)}…
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
  /** Famille de l'insecte actuel — extraite du tokenURI on-chain */
  currentFamily?: string | null;
}

const EvolutionTab = ({
  tokenId,
  nftData,
  contractAdhesion,
  onEvolutionSuccess,
  currentFamily,
}: EvolutionTabProps) => {
  const hatch = useHatchEgg(contractAdhesion, tokenId);
  const updateCurrentMetadata = useCallback((_metadata: any) => {}, []);

  const evolutionResult = useTokenEvolution({
    contractAddress: contractAdhesion,
    tokenId,
    currentFamily: currentFamily ?? undefined,
    currentImage: nftData?.image,
    currentName: nftData?.name || '',
    currentBio: nftData?.bio || '',
    currentRoleLabel: nftData ? roles[nftData.role] || 'Member' : 'Member',
    onMetadataLoaded: updateCurrentMetadata,
  }) as any;

  const rawMembershipInfo: MembershipInfo | null = evolutionResult.membershipInfo || null;
  const evolvePriceEth   = evolutionResult.evolvePriceEth   || '0';
  const isEvolving       = evolutionResult.isEvolving       || false;
  const evolve           = evolutionResult.evolve           || (() => {});
  // isEvolutionReady : calculé dans le hook avec startTimestamp + levelDuration réels
  // → jamais "true" par défaut (pas de startTimestamp=0 fantôme)
  const isEvolutionReady: boolean = evolutionResult.isEvolutionReady ?? false;
  const levelDuration: number     = evolutionResult.levelDuration    ?? 0;

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

  // Calcul du délai restant avant évolution (affiché quand pas encore prêt)
  const readyAt = membershipInfo.startTimestamp > 0 && levelDuration > 0
    ? membershipInfo.startTimestamp + levelDuration
    : null;
  const secondsLeft = readyAt ? Math.max(0, readyAt - Math.floor(Date.now() / 1000)) : null;
  const daysLeft    = secondsLeft !== null ? Math.ceil(secondsLeft / 86400) : null;

  const handleSingleEvolve = async () => {
    try {
      // evolve() lance déjà une erreur lisible si le délai n'est pas écoulé.
      // Pas besoin de guard supplémentaire ici.
      await evolve();
      onEvolutionSuccess();
    } catch (e: any) {
      console.error('Evolve error:', e);
      alert(e.message ?? 'Erreur lors de l\'évolution');
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
              {/* BUG 2 FIX — ne pas afficher la date si le timestamp est 0 (epoch) */}
              <Text fontSize={{ base: 'sm', md: 'md' }} opacity={0.9}>
                Depuis{' '}
                {membershipInfo?.startTimestamp
                  ? formatDateTime(membershipInfo.startTimestamp)
                  : '—'}
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
              {/* BUG 3 FIX — cas œuf traité séparément pour ne pas afficher "Préparez l'évolution" */}
              <Text
                fontSize={{ base: 'md', md: 'lg' }}
                fontWeight="bold"
                color={
                  membershipInfo?.isEgg
                    ? hatch.isReady
                      ? 'yellow.500'
                      : 'orange.400'
                    : isEvolutionReady
                    ? 'green.600'
                    : rawMembershipInfo
                    ? 'orange.600'
                    : 'gray.400'
                }
              >
                {membershipInfo?.isEgg
                  ? hatch.isReady
                    ? '🥚 Prêt à éclore'
                    : '⏳ Attente éclosion'
                  : !rawMembershipInfo
                  ? '⏳ Chargement…'
                  : isEvolutionReady
                  ? '✅ PRÊT'
                  : daysLeft !== null && daysLeft > 0
                  ? `⏳ Dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`
                  : '⏳ Bientôt disponible'}
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
              {/* Aperçu du prochain insecte (pré-chargé si InsectStorage configuré) */}
              {evolutionResult.previewImageUrl && (
                <Box textAlign="center">
                  <Image
                    src={evolutionResult.previewImageUrl}
                    alt="Prochain insecte"
                    maxH="140px"
                    mx="auto"
                    borderRadius="md"
                    boxShadow="md"
                  />
                  <Text mt={1} fontSize="xs" color="gray.500">
                    Prochain insecte (niveau {(membershipInfo?.level ?? 0) + 1})
                  </Text>
                </Box>
              )}

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
                isDisabled={!isEvolutionReady || isEvolving}
                isLoading={isEvolving}
                loadingText="Transaction..."
              >
                🧬 Évoluer
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
  const [metaWarning, setMetaWarning] = useState<string | null>(null);

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

  /** Famille de l'insecte courant (extraite du tokenURI on-chain) */
  const [insectFamily, setInsectFamily] = useState<string | null>(null);
  /** Adresse wallet de l'artiste qui a créé ce design (attribut "Artiste" du tokenURI) */
  const [insectArtistAddress, setInsectArtistAddress] = useState<string | null>(null);
  /** Clé incrémentée pour forcer le rechargement de l'historique après évolution */
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // ─── Cache localStorage pour les métadonnées (24h, invalidé post-évolution) ──

  const META_LS_KEY = `adhesion_meta_v1_${contractAdhesion}_${tokenId}`;
  const META_LS_TTL = 24 * 60 * 60 * 1000;

  const loadMetaFromLS = (): AdhesionTokenMetadata | null => {
    try {
      const raw = localStorage.getItem(META_LS_KEY);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > META_LS_TTL) return null;
      return data as AdhesionTokenMetadata;
    } catch { return null; }
  };

  const saveMetaToLS = (data: AdhesionTokenMetadata) => {
    try {
      localStorage.setItem(META_LS_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  };

  const evictMetaFromLS = () => {
    try { localStorage.removeItem(META_LS_KEY); } catch {}
  };

  // ─── Chargement des données token (2 appels parallèles : metadata + state) ──

  const loadTokenData = useCallback(async (force = false) => {
    if (!router.isReady || tokenId === undefined) return;
    setIsLoading(true);
    setError(null);

    try {
      // Metadata : localStorage d'abord (24h), API ensuite
      const cachedMeta = force ? null : loadMetaFromLS();
      const metaPromise: Promise<AdhesionTokenMetadata> = cachedMeta
        ? Promise.resolve(cachedMeta)
        : fetch(`/api/token/adhesion-metadata?tokenId=${tokenId}`)
            .then((r) => {
              if (!r.ok) throw new Error(`metadata HTTP ${r.status}`);
              return r.json();
            })
            .then((d: AdhesionTokenMetadata): AdhesionTokenMetadata => {
              saveMetaToLS(d);
              return d;
            });

      // State : toujours depuis l'API (CDN 60s, pas de localStorage)
      const statePromise: Promise<AdhesionTokenState> = fetch(
        `/api/token/adhesion-state?tokenId=${tokenId}`
      ).then((r) => {
        if (!r.ok) throw new Error(`state HTTP ${r.status}`);
        return r.json();
      });

      const [meta, state] = await Promise.all([metaPromise, statePromise]);

      const nft: NFTData = {
        owner: state.owner,
        role: state.role,
        mintTimestamp: state.mintTimestamp,
        price: state.price,
        name: state.name,
        bio: state.bio,
        remainingTime: state.remainingTime,
        fin: state.fin,
        forSale: state.forSale,
        membership: state.membership,
        membershipInfo: state.membershipInfo as MembershipInfo,
        image: meta.image || '',
        uri: meta.tokenURI,
        tokenURI: meta.tokenURI,
      };
      // Famille et artiste de l'insecte — présents dans le tokenURI on-chain après setup InsectStorage
      setInsectFamily(meta.insectFamily ?? null);
      setInsectArtistAddress(meta.insectArtistAddress ?? null);

      // Si l'InsectStorage n'est pas encore configuré, on affiche un bandeau admin
      if (meta.warning) {
        console.warn('[TokenPage] metadata warning:', meta.warning);
        setMetaWarning(meta.warning);
      } else {
        setMetaWarning(null);
      }

      setNftData(nft);
      setIsForSale(state.forSale);
      if (state.membershipInfo) setMembershipInfo(state.membershipInfo as MembershipInfo);
      setRenewPriceEth(state.mintPrice ?? null);
    } catch (err) {
      console.error('[TokenPage] loadTokenData error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la récupération des données : ${msg}`);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, tokenId]);

  // BONUS FIX — useColorModeValue appelé inconditionnellement au top-level,
  // jamais à l'intérieur d'un if/callback/return conditionnel.
  const headingGradient = useColorModeValue(
    'linear(to-r, brand.navy, brand.blue)',
    'linear(to-r, brand.gold, brand.cream)'
  );
  const imageShadow = useColorModeValue('lg', 'dark-lg');

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

  // Charge les données au montage (et lors du changement de tokenId)
  useEffect(() => {
    loadTokenData();
  }, [loadTokenData]);

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
      await loadTokenData(true);
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
      await loadTokenData(true);
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
    // L'image change après évolution → invalider tous les caches concernés
    evictMetaFromLS();
    sessionStorage.removeItem(`levelDurations_${contractAdhesion}`);
    // InsectSelector cache
    Object.keys(sessionStorage)
      .filter(k => k.startsWith("insect_data_"))
      .forEach(k => sessionStorage.removeItem(k));
    // Notifier les autres composants (InsectSelector, etc.)
    try { window.dispatchEvent(new CustomEvent("RESCOE_DATA_CHANGED")); } catch {}
    // Forcer rechargement de l'historique on-chain
    setHistoryRefreshKey(k => k + 1);
    await loadTokenData(true);
  }, [loadTokenData]);

  // ─── Historique on-chain + généalogie ────────────────────────────────────
  // DOIT être appelé AVANT tout return conditionnel (règle des hooks React).
  // Le hook appelle tokenURI() directement sur la chaîne pour le step courant
  // → contourne le cache 24h de l'API adhesion-metadata.
  const { pastSteps, currentStep, genealogy, isLoading: evoLoading } = useEvolutionHistory(
    contractAdhesion,
    tokenId as string | number | undefined,
    historyRefreshKey
  );

  // Correction des attributs du step courant :
  //   1. Role : le contrat V3 déployé mappe role=0 → "Membre" au lieu de "Artiste"
  //      → on utilise nftData.role (uint8 brut de getTokenDetails) avec notre propre mapping
  //   2. Date d'adhésion : injectée depuis membershipInfo.startTimestamp (non disponible dans tokenURI)
  const ROLE_LABELS_FR: Record<number, string> = {
    0: "Artiste",
    1: "Poète",
    2: "Contributeur",
    3: "Photographe",
  };
  const correctedCurrentStep = useMemo(() => {
    if (!currentStep) return null;
    const startTs = nftData?.membershipInfo?.startTimestamp;
    const dateAdhesion = startTs
      ? new Date(startTs * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
      : null;
    const annee = startTs ? new Date(startTs * 1000).getFullYear() : null;
    const type = nftData?.membershipInfo?.isAnnual ? "Annuel" : "Essai";

    const correctedAttrs = currentStep.attributes.map(a => {
      if (a.trait_type === "Role" && nftData?.role !== undefined) {
        return { ...a, value: ROLE_LABELS_FR[nftData.role] ?? a.value };
      }
      if (a.trait_type === "Adhesion" && annee) {
        return { ...a, value: `${type} - ${annee}` };
      }
      return a;
    });

    // Injecter date d'adhésion si absente
    const hasDate = correctedAttrs.some(a => a.trait_type === "Date adhesion");
    if (dateAdhesion && !hasDate) {
      correctedAttrs.push({ trait_type: "Date adhesion", value: dateAdhesion });
    }

    return { ...currentStep, attributes: correctedAttrs };
  }, [currentStep, nftData?.role, nftData?.membershipInfo]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={10} maxW="620px" mx="auto" p={6}>
        <Alert status="error" borderRadius="lg" mb={5} textAlign="left">
          <AlertIcon />
          <Text fontSize="sm" fontFamily="mono" whiteSpace="pre-wrap" wordBreak="break-word">
            {error}
          </Text>
        </Alert>
        <Button
          colorScheme="brand"
          size="md"
          onClick={() => loadTokenData(true)}
          borderRadius="xl"
          bgGradient="linear(to-r, brand.gold, brand.cream)"
          color="brand.navy"
          _hover={brandHover}
        >
          ↺ Réessayer
        </Button>
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
      {/* Bandeau admin : InsectStorage pas encore configuré */}
      {metaWarning && (
        <Alert status="warning" mb={6} borderRadius="lg" fontSize="sm">
          <AlertIcon />
          <Text>
            <strong>Image non disponible</strong> — {metaWarning}
          </Text>
        </Alert>
      )}

      <Box position="relative" mb={8} zIndex={1}>
        <Heading
          as="h1"
          size="xl"
          mb={4}
          // BONUS FIX — valeur issue du hook appelé au top-level, pas inline ici
          bgGradient={headingGradient}
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
            // BONUS FIX — valeur issue du hook appelé au top-level, pas inline ici
            boxShadow={imageShadow}
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
              insectArtistAddress={insectArtistAddress}
              tokenId={tokenId as number | string}
              pastSteps={pastSteps}
              currentStep={correctedCurrentStep}
              genealogy={genealogy}
              evoLoading={evoLoading}
              contractAdhesion={contractAdhesion}
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
                  currentFamily={insectFamily}
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
