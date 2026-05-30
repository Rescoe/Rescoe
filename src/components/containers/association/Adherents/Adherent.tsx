import { useState, useEffect, useCallback } from "react";
import { invalidatePublicCache } from "@/utils/cacheInvalidation";
import {
  Box,
  Heading,
  Text,
  Card,
  CardBody,
  CardHeader,
  StatGroup,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  CheckboxGroup,
  Checkbox,
  Wrap,
  WrapItem,
  Center,
  List,
  ListItem,
  Tag,
  VStack,
  Tabs,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Button,
  Spinner,
} from "@chakra-ui/react";
import NextLink from "next/link";
import DerniersAdherents from "./DerniersAdherents";
import { hoverStyles, brandHover } from "@styles/theme";
import { AspectRatio, Image } from "@chakra-ui/react";
import { useAuth } from "@/utils/authContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsectCard {
  id: string;
  image: string;
  name: string;
  bio: string;
}

interface MembersByRole {
  [key: string]: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Cache localStorage client ────────────────────────────────────────────────

const LS_STATS_KEY = "adherent_stats_v2";
const LS_INSECTS_KEY = "adherent_insects_v2";
// 24h : données rarement mutables, invalidées manuellement après transaction
const LS_TTL = 24 * 60 * 60 * 1000;

function readLS<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function writeLS<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}


// ─── Composant ───────────────────────────────────────────────────────────────

const Adherent: React.FC = () => {
  const [membersByRole, setMembersByRole] = useState<MembersByRole>({});
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalInsectsMinted, setTotalInsectsMinted] = useState<number>(0);

  const [insectCards, setInsectCards] = useState<InsectCard[]>([]);
  const [hasMoreInsects, setHasMoreInsects] = useState(false);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingInsects, setLoadingInsects] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState(0);

  const { isAuthenticated, address, role, isAdmin } = useAuth();

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;

  // ─── Chargement stats & filtres (depuis /api/data/members) ───────────────

  const loadStats = useCallback(async (force = false) => {
    setLoadingStats(true);
    try {
      if (!force) {
        const cached = readLS<{
          membersByRole: MembersByRole;
          totalMembersCount: number;
          totalInsectsMinted: number;
        }>(LS_STATS_KEY);
        if (cached) {
          setMembersByRole(cached.membersByRole);
          setTotalMembersCount(cached.totalMembersCount);
          setTotalInsectsMinted(cached.totalInsectsMinted);
          setLoadingStats(false);
          return;
        }
      }

      const resp = await fetch("/api/data/members");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      const statsData = {
        membersByRole: json.membersByRole ?? {},
        totalMembersCount: json.totalMembersCount ?? 0,
        totalInsectsMinted: json.totalInsectsMinted ?? 0,
      };

      setMembersByRole(statsData.membersByRole);
      setTotalMembersCount(statsData.totalMembersCount);
      setTotalInsectsMinted(statsData.totalInsectsMinted);
      writeLS(LS_STATS_KEY, statsData);
    } catch (err) {
      console.error("[Adherent] Erreur chargement stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ─── Chargement galerie insectes (depuis /api/data/insects) ──────────────

  const loadInsects = useCallback(async (force = false) => {
    setLoadingInsects(true);
    try {
      if (!force) {
        const cached = readLS<{ insects: InsectCard[]; hasMore: boolean }>(
          LS_INSECTS_KEY
        );
        if (cached) {
          setInsectCards(cached.insects);
          setHasMoreInsects(cached.hasMore);
          setLoadingInsects(false);
          return;
        }
      }

      const resp = await fetch("/api/data/insects");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      const insectsData = {
        insects: json.insects ?? [],
        hasMore: json.hasMore ?? false,
      };

      setInsectCards(insectsData.insects);
      setHasMoreInsects(insectsData.hasMore);
      writeLS(LS_INSECTS_KEY, insectsData);
    } catch (err) {
      console.error("[Adherent] Erreur chargement insectes:", err);
    } finally {
      setLoadingInsects(false);
    }
  }, []);

  // ─── Montage (charge uniquement si Tab 0) ────────────────────────────────

  useEffect(() => {
    if (activeTab !== 0) return;
    loadStats();
    loadInsects();
  }, [activeTab, loadStats, loadInsects]);

  // ─── Rafraîchir manuellement ─────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidatePublicCache(["members", "insects"]);
    await Promise.all([loadStats(true), loadInsects(true)]);
    setRefreshing(false);
  }, [loadStats, loadInsects]);

  // ─── Filtrage par rôle ───────────────────────────────────────────────────

  const handleRoleChange = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const getFilteredMembers = () => {
    if (selectedRoles.length === 0) return [];
    const filtered = new Set<string>(membersByRole[selectedRoles[0]] || []);
    selectedRoles.forEach((role) => {
      const members = new Set<string>(membersByRole[role] || []);
      for (const addr of Array.from(filtered)) {
        if (!members.has(addr)) filtered.delete(addr);
      }
    });
    return Array.from(filtered);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box
      maxW="7xl"
      mx="auto"
      px={{ base: 4, md: 8, lg: 12 }}
      py={10}
      bgGradient="linear(to-b, brandStartLight, brandEndLight)"
      _dark={{ bgGradient: "linear(to-b, brandStartDark, brandEndDark)" }}
      color="textLight"
      rounded="2xl"
      shadow="xl"
      transition="all 0.3s ease"
    >
      {/* Titre section Adhésion */}
      <Center mb={8}>
        <Heading as="h1" size="xl" bgClip="text" fontWeight="extrabold" pb={2}>
          Fonctionnement de l'Adhésion
        </Heading>
      </Center>

      <VStack spacing={6} mb={10}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          lineHeight="tall"
          maxW="2xl"
          mx="auto"
          textAlign="center"
        >
          Rejoindre le RESCOE, c'est participer à un{" "}
          <b>réseau artistique solidaire</b> qui relie création, formation et
          innovation numérique. L'adhésion vous permet de prendre part à nos
          activités, d'exposer vos œuvres et de contribuer à la vie du collectif.
        </Text>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          lineHeight="tall"
          maxW="2xl"
          mx="auto"
          textAlign="center"
        >
          Chaque membre peut explorer plusieurs rôles : <b>Artiste</b>,{" "}
          <b>Poète</b>, <b>Contributeur</b> ou <b>Formateur</b>.
          <br />
          Ces rôles ouvrent l'accès à différents espaces et projets
          collaboratifs, sur le site et lors des événements physiques.
        </Text>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          lineHeight="tall"
          maxW="2xl"
          mx="auto"
          textAlign="center"
        >
          En participant aux ateliers, à la curation ou à la création, les
          membres accumulent des points de contribution, qui reflètent leur
          engagement et permettent de débloquer de nouvelles possibilités.
        </Text>
      </VStack>

      {/* Bouton rafraîchir */}
      <Center mb={4}>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          isLoading={refreshing}
          loadingText="Rafraîchissement..."
          leftIcon={refreshing ? <Spinner size="xs" /> : undefined}
          opacity={0.7}
          _hover={{ opacity: 1 }}
        >
          🔄 Rafraîchir les données
        </Button>
      </Center>

      {/* TABS */}
      <Tabs
        index={activeTab}
        onChange={setActiveTab}
        variant="enclosed"
        colorScheme="purple"
        isLazy
        lazyBehavior="unmount"
        id="adherent-tabs"
      >
        <TabList>
          <Tab>📊 Statistiques & Membres</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            {/* ── Statistiques & Filtres ── */}
            <SimpleGrid
              columns={{ base: 1, md: 2 }}
              spacing={8}
              alignItems="stretch"
              mt={8}
              mb={12}
            >
              {/* Statistiques */}
              <Card
                shadow="lg"
                rounded="2xl"
                p={6}
                bg="cardLight"
                _dark={{ bg: "cardDark" }}
                _hover={{ ...hoverStyles.brandHover._hover, ...brandHover }}
              >
                <CardHeader pb={3}>
                  <Heading size="lg" fontWeight="bold" mb={2}>
                    Statut du Réseau
                  </Heading>
                </CardHeader>
                <CardBody>
                  {loadingStats ? (
                    <Center py={4}>
                      <Spinner size="sm" />
                    </Center>
                  ) : (
                    <StatGroup
                      display="flex"
                      flexDirection={{ base: "column", sm: "row" }}
                      alignItems={{ base: "flex-start", sm: "center" }}
                      gap={{ base: 4, sm: 8 }}
                    >
                      <Stat>
                        <StatLabel>Adhérents actifs</StatLabel>
                        <StatNumber display="flex" alignItems="center">
                          {totalMembersCount}
                        </StatNumber>
                      </Stat>
                      <Stat>
                        <StatLabel>Cartes créées</StatLabel>
                        <StatNumber>{totalInsectsMinted}</StatNumber>
                      </Stat>
                    </StatGroup>
                  )}
                  <Text fontSize="sm" mt={4}>
                    Ces chiffres évoluent chaque jour grâce à l'engagement de la
                    communauté. Un adhérent peut avoir plusieurs cartes. Les
                    cartes peuvent être vendues à la fin de la durée d'adhésion.
                  </Text>
                </CardBody>
              </Card>

              {/* Filtres */}
              <Card
                shadow="lg"
                rounded="2xl"
                p={6}
                bg="cardLight"
                _dark={{ bg: "cardDark" }}
                _hover={{
                  transform: "translateY(-3px)",
                  transition: "0.3s",
                  shadow: "xl",
                }}
              >
                <CardHeader pb={3}>
                  <Heading size="lg" fontWeight="bold">
                    Découvrez les membres
                  </Heading>
                </CardHeader>
                <CardBody>
                  <CheckboxGroup colorScheme="purple">
                    <Text fontSize="lg" mb={4}>
                      Choisissez un ou plusieurs rôles :
                    </Text>
                    <Wrap spacing={4} mb={4}>
                      {Object.keys(roles).map((key) => {
                        const roleKey = Number(key);
                        return (
                          <WrapItem key={key}>
                            <Checkbox
                              value={roles[roleKey]}
                              isChecked={selectedRoles.includes(roles[roleKey])}
                              onChange={() => handleRoleChange(roles[roleKey])}
                              rounded="lg"
                              px={3}
                              py={2}
                              borderWidth={1}
                              _hover={{
                                ...hoverStyles.brandHover._hover,
                                ...brandHover,
                              }}
                            >
                              {roleLabels[roles[roleKey]]}
                            </Checkbox>
                          </WrapItem>
                        );
                      })}
                    </Wrap>
                  </CheckboxGroup>

                  {getFilteredMembers().length > 0 && (
                    <Box mt={5}>
                      <Text fontSize="md" mb={2}>
                        <b>{getFilteredMembers().length}</b> adhérent(s)
                        sélectionné(s)
                      </Text>
                      <List
                        spacing={2}
                        fontSize="sm"
                        p={3}
                        rounded="lg"
                        maxH="200px"
                        overflowY="auto"
                        shadow="inner"
                      >
                        {getFilteredMembers().map((address, idx) => (
                          <ListItem key={idx}>
                            <Tag
                              colorScheme="purple"
                              variant="subtle"
                              rounded="full"
                              px={2}
                              py={1}
                            >
                              {address}
                            </Tag>
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* ── Galerie des cartes d'adhésion ── */}
            <Box mt={12}>
              <Center>
                <Heading
                  as="h2"
                  size={{ base: "md", md: "lg" }}
                  bgClip="text"
                  fontWeight="bold"
                  mb={6}
                >
                  Cartes d'adhésion
                </Heading>
              </Center>

              {loadingInsects ? (
                <Center py={16}>
                  <VStack spacing={3}>
                    <Spinner size="lg" />
                    <Text opacity={0.6} fontSize="sm">
                      Chargement des cartes...
                    </Text>
                  </VStack>
                </Center>
              ) : insectCards.length === 0 ? (
                <Center py={12}>
                  <Text opacity={0.5}>Aucune carte trouvée</Text>
                </Center>
              ) : (
                <>
                  <SimpleGrid
                    columns={{ base: 1, md: 2, lg: 3 }}
                    spacing={8}
                    mb={8}
                  >
                    {insectCards.map((insect) => (
                      <NextLink
                        key={insect.id}
                        href={`/AdhesionId/${contractAddress}/${insect.id}`}
                        passHref
                      >
                        <Box
                          as="a"
                          role="group"
                          display="flex"
                          flexDir="column"
                          alignItems="center"
                          bg="cardLight"
                          _dark={{ bg: "cardDark" }}
                          p={6}
                          rounded="2xl"
                          shadow="md"
                          transition="all 0.3s ease"
                          cursor="pointer"
                          _hover={{ transform: "translateY(-3px)", shadow: "xl" }}
                        >
                          <AspectRatio ratio={1} w={{ base: "120px", md: "160px" }}>
                            <Box
                              position="relative"
                              rounded="lg"
                              overflow="hidden"
                            >
                              <Image
                                src={insect.image || "/fallback-image.png"}
                                alt={`Carte ${insect.id}`}
                                objectFit="cover"
                                w="100%"
                                h="100%"
                                transition="all 0.3s ease"
                                _hover={{
                                  ...hoverStyles.brandHover._hover,
                                  ...brandHover,
                                  transform: "scale(1.05)",
                                  shadow: "xl",
                                }}
                              />
                            </Box>
                          </AspectRatio>

                          <Text
                            mt={4}
                            fontSize="lg"
                            fontWeight="semibold"
                            textAlign="center"
                          >
                            {insect.name}
                          </Text>

                          <Text
                            mt={2}
                            fontSize="sm"
                            color="gray.500"
                            textAlign="center"
                          >
                            {insect.bio}
                          </Text>

                          <Box
                            position="absolute"
                            bottom="0"
                            w="100%"
                            textAlign="center"
                            py={2}
                            bg="rgba(0, 0, 0, 0.6)"
                            color="white"
                            opacity={0}
                            transition="opacity 0.3s ease"
                            _groupHover={{ opacity: 1 }}
                            fontSize="sm"
                          >
                            Cliquer pour accéder à la carte
                          </Box>
                        </Box>
                      </NextLink>
                    ))}
                  </SimpleGrid>

                  {hasMoreInsects && (
                    <Center mt={4} mb={8}>
                      <Text fontSize="sm" opacity={0.6}>
                        Affichage limité aux 50 premières cartes. Utilisez le
                        bouton rafraîchir pour forcer le rechargement.
                      </Text>
                    </Center>
                  )}
                </>
              )}
            </Box>

            {/* ── Derniers adhérents ── */}
            <Center mt={12} mb={8}>
              <Heading
                as="h2"
                size={{ base: "md", md: "lg" }}
                bgClip="text"
                fontWeight="bold"
              >
                Derniers adhérents
              </Heading>
            </Center>
            <Text
              fontSize="lg"
              mb={4}
              textAlign="center"
              maxW="2xl"
              mx="auto"
            >
              Voici les quatre derniers adhérents ayant rejoint le réseau :
            </Text>
            <Box
              bg="cardLight"
              _dark={{ bg: "cardDark" }}
              py={6}
              px={{ base: 4, md: 8 }}
              rounded="2xl"
              shadow="md"
              mb={10}
            >
              <DerniersAdherents />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Adherent;
