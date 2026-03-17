import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ABI from "../../../ABI/ABIAdhesion.json";
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
} from "@chakra-ui/react";
import NextLink from "next/link";
import DerniersAdherents from "./DerniersAdherents";
import { hoverStyles, brandHover } from "@styles/theme";
import { AspectRatio, Image } from "@chakra-ui/react";
import { useRouter } from 'next/router'; // ✅ Pour hash navigation
import { useAuth } from "@/utils/authContext";
import { resolveIPFS } from "@/utils/resolveIPFS";



//import MarketplaceBadges from "./MarketplaceBadges";


interface InsectURI {
  id: string;
  image: string;
  name?: string;
  bio: string;
}

interface MembersByRole {
  [key: string]: string[];
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

const Adherent: React.FC = () => {
  const [provider, setProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [membersByRole, setMembersByRole] = useState<MembersByRole>({});
  const [insectURIs, setInsectURIs] = useState<InsectURI[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalInsectsMinted, setTotalInsectsMinted] = useState<number>(0);

  const [activeTab, setActiveTab] = useState(0);
  const router = useRouter();

/*
  // ✅ Ouvre onglet marketplace si #marketplace dans URL
  useEffect(() => {
    if (router.asPath.includes('#marketplace')) {
      setActiveTab(1);
    }
  }, [router.asPath]);
*/

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  // Au début du composant
//const auth = (typeof window !== 'undefined' ? (window as any).RESCOE_AUTH : {});
const { isAuthenticated, address, role, isAdmin } = useAuth();

  // ✅ Initialise le provider et le contrat Moralis
  useEffect(() => {
    const initProvider = async () => {
      try {
        const jsonProvider = new ethers.JsonRpcProvider(RPC_URL);
        const adhesionContract = new ethers.Contract(contractAddress, ABI, jsonProvider);
        setProvider(jsonProvider);
        setContract(adhesionContract);
        //console.log("🟣 Lecture via Moralis RPC");
      } catch (error) {
        //console.error("Erreur init provider:", error);
      }
    };
    initProvider();
  }, [RPC_URL, contractAddress]);

  // ✅ Récupère les données principales
  useEffect(() => {
    if (!contract) return;
    if (activeTab !== 0) return;  // ✅ SKIP si pas Tab 1

    const fetchData = async () => {
      try {
        // --- Membres par rôle (INCHANGÉ)
        const roleData: MembersByRole = {};
        const uniqueMembers = new Set<string>();

        for (const role of Object.keys(roles)) {
          const members: string[] = await contract.getMembersByRole(role);
          roleData[roles[Number(role)]] = members;
          members.forEach((m) => uniqueMembers.add(m));
        }

        setMembersByRole(roleData);
        setTotalMembersCount(uniqueMembers.size);

        // --- Nombre d’insectes mintés (INCHANGÉ)
        const insectsCount = await contract.getTotalMinted();
        setTotalInsectsMinted(Number(insectsCount));

        // 🔑 Détails des insectes → SKIP BURNED + resolveIPFS
        const fetchedInsects: InsectURI[] = [];
        for (let i = 0; i < Number(insectsCount); i++) {
          try {
            // CHECK 1 : Token existe-t-il ? (owner non nul)
            const owner = await contract.ownerOf(i).catch(() => null);
            if (!owner || owner === "0x0000000000000000000000000000000000000000") {
              continue;
            }

            // CHECK 2 : TokenURI valide
            const tokenURI = await contract.tokenURI(i);

            // 🔑 Résoudre tokenURI pour fetch metadata
            const metadataUrl = resolveIPFS(tokenURI, true);
            if (!metadataUrl) {
              console.warn(`Skip token ${i}: pas d'URI IPFS valide`);
              continue;
            }

            const res = await fetch(metadataUrl);
            if (!res.ok) {
              console.warn(`Skip token ${i}: HTTP ${res.status}`);
              continue;
            }

            const meta = await res.json();

            fetchedInsects.push({
              id: i.toString(),
              image: resolveIPFS(meta.image, true) || "", // URL HTTP pour <Image />
              name: meta.name,
              bio: meta.bio || "",
            });
          } catch (err) {
            console.warn(`Skip token ${i}:`, err);
          }
        }

        setInsectURIs(fetchedInsects);
      } catch (error) {
        console.error("Erreur fetchData:", error);
      }
    };


    fetchData();
  }, [contract, activeTab]);

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
          <Heading
            as="h1"
            size="xl"
            bgClip="text"
            fontWeight="extrabold"
            pb={2}
          >
            Fonctionnement de l’Adhésion
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
            Rejoindre le RESCOE, c’est participer à un <b>réseau artistique solidaire</b> qui relie création, formation et innovation numérique.
            L’adhésion vous permet de prendre part à nos activités, d’exposer vos œuvres et de contribuer à la vie du collectif.
          </Text>
          <Text
            fontSize={{ base: "lg", md: "xl" }}
            lineHeight="tall"
            maxW="2xl"
            mx="auto"
            textAlign="center"
          >
            Chaque membre peut explorer plusieurs rôles : <b>Artiste</b>, <b>Poète</b>, <b>Contributeur</b> ou <b>Formateur</b>.
            <br />
            Ces rôles ouvrent l’accès à différents espaces et projets collaboratifs, sur le site et lors des événements physiques.
          </Text>
          <Text
            fontSize={{ base: "lg", md: "xl" }}
            lineHeight="tall"
            maxW="2xl"
            mx="auto"
            textAlign="center"
          >
            En participant aux ateliers, à la curation ou à la création, les membres accumulent des points de contribution, qui reflètent leur engagement et permettent de débloquer de nouvelles possibilités.
          </Text>
        </VStack>

        {/* ✅ TABS PRINCIPAL - Remplace tout le bordel */}
        <Tabs
          index={activeTab}
          onChange={setActiveTab}
          variant="enclosed"
          colorScheme="purple"
          isLazy  // ✅ MAGIC : NE CHARGE QUE LE TAB ACTIF
          lazyBehavior="unmount"  // ✅ DÉSMONTE au switch → refresh data
          id="adherent-tabs"
        >

          <TabList>
            <Tab>📊 Statistiques & Membres</Tab>
          {/*  <Tab>🛒 Badges en vente</Tab> */}
          </TabList>

          <TabPanels>
            <TabPanel>
        {/* Cartes principales (Statistiques, Filtres, Carte d’adhésion) */}
          <SimpleGrid
            columns={{ base: 1, md: 2 }}
            spacing={8}
            alignItems="stretch"
            mt={8}
            mb={12}
          >
            {/* 🧮 Statistiques */}
            <Card
              shadow="lg"
              rounded="2xl"
              p={6}
              bg="cardLight"
              _dark={{ bg: "cardDark" }}
              _hover={{
                ...hoverStyles.brandHover._hover,
                ...brandHover,
              }}
            >
              <CardHeader pb={3}>
                <Heading size="lg" fontWeight="bold" mb={2}>
                  Statut du Réseau
                </Heading>
              </CardHeader>
              <CardBody>
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
                    <StatLabel>Cartes créés</StatLabel>
                    <StatNumber>{totalInsectsMinted}</StatNumber>
                  </Stat>
                </StatGroup>
                <Text fontSize="sm" mt={4}>
                  Ces chiffres évoluent chaque jour grâce à l’engagement de la communauté.
                  Un adhérent peut avoir plusieures cartes. Les cartes peuvent être vendues a la fin de la durée d'adhésion.

                </Text>
              </CardBody>
            </Card>

            {/* 🔍 Filtres et participation */}
            <Card
              shadow="lg"
              rounded="2xl"
              p={6}
              bg="cardLight"
              _dark={{ bg: "cardDark" }}
              _hover={{ transform: "translateY(-3px)", transition: "0.3s", shadow: "xl" }}
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
                            }}                        >
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
                      <b>{getFilteredMembers().length}</b> adhérent(s) sélectionné(s)
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
                          <Tag colorScheme="purple" variant="subtle" rounded="full" px={2} py={1}>
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

          {/* 🃏 Cartes d’adhésion (insectes) */}
          {insectURIs.length > 0 && (
            <Box mt={12}>
              <Center>
                <Heading
                  as="h2"
                  size={{ base: "md", md: "lg" }}
                  bgClip="text"
                  fontWeight="bold"
                  mb={6}
                >
                  Cartes d’adhésion
                </Heading>
              </Center>

              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={8} mb={8}>
                {insectURIs.map((insect) => (
                  <NextLink
                    key={insect.id}
                    href={`/AdhesionId/${contractAddress}/${insect.id}`}
                    passHref
                  >
                    <Box
                      as="a"
                      role="group" // ✅ pour que _groupHover fonctionne
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
                      _hover={{
                        transform: "translateY(-3px)",
                        shadow: "xl",
                      }}
                    >
                    <AspectRatio ratio={1} w={{ base: "120px", md: "160px" }}>
                      <Box position="relative" rounded="lg" overflow="hidden">
                        <Image
                          src={insect.image || "/fallback-image.png"}
                          alt={`Insecte ${insect.id}`}
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

                      {/* ✅ Info-bulle affichée au hover */}
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
            </Box>
          )}

          {/* 👥 Derniers adhérents */}
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


          {/* ✅ TAB 2 : Marketplace
          <TabPanel p={{ base: 4, md: 0 }}>
            <MarketplaceBadges
              contractAddress={contractAddress}
              rpcUrl={RPC_URL}
              isVisible={activeTab === 1}  // ✅ TRUE seulement si Tab 2
            />
          </TabPanel>

          */}

        </TabPanels>
    </Tabs>
</Box>
);
};

export default Adherent;
