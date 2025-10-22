import { useState, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import ABI from "../../../ABI/ABIAdhesion.json";
import {
  Box,
  Button,
  Heading,
  Text,
  List,
  ListItem,
  Card,
  CardHeader,
  CardBody,
  VStack,
  Center,
  CheckboxGroup,
  Checkbox,
  SimpleGrid,
  Divider,
  HStack,
  StatGroup,
  Stat,
  StatNumber,
  StatLabel,
  Wrap,
  WrapItem,
  AspectRatio,
  Image,
  Tag,
} from "@chakra-ui/react";
import NextLink from "next/link";
import DerniersAdherents from "./DerniersAdherents";

//Style
import { brandHover, hoverStyles } from "@styles/theme";
import { pulse } from "@styles/theme";


import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";

import FeaturedMembers from './FeaturedMembers'; // Votre ABI de contrat ici.



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

// Dictionnaire de traduction pour l’affichage
const roleLabels: Record<string, string> = {
  Artist: "Artiste",
  Poet: "Poète",
  Contributor: "Contributeur",
  Trainee: "Formateur",
};

const Adherent: React.FC = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [membersByRole, setMembersByRole] = useState<MembersByRole>({});
  const [insectURIs, setInsectURIs] = useState<InsectURI[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [totalInsectsMinted, setTotalInsectsMinted] = useState<number>(0);

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const RPC_URL = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string; // ✅ Fallback RPC public

  // ✅ Initialisation de Web3 : MetaMask si dispo, sinon RPC public (lecture seule)
  useEffect(() => {
    const initWeb3 = async () => {
      let web3Instance: Web3;
      try {
        const provider = await detectEthereumProvider();
        if (provider) {
          web3Instance = new Web3(provider as any);
          console.log("✅ Utilisation du provider MetaMask");

          const accounts = await web3Instance.eth.getAccounts();
          setAccount(accounts[0] || null);

          // Écoute des changements d’adresse et de réseau
          (provider as any).on("accountsChanged", (accounts: string[]) => {
            setAccount(accounts[0] || null);
          });
          (provider as any).on("chainChanged", () => window.location.reload());
        } else {
          // Fallback : lecture seule via RPC public
          web3Instance = new Web3(new Web3.providers.HttpProvider(RPC_URL));
          console.log("🌐 Utilisation du provider RPC public (lecture seule)");
        }

        setWeb3(web3Instance);
      } catch (error) {
        console.error("Erreur d’initialisation Web3:", error);
      }
    };

    initWeb3();
  }, [RPC_URL]);

  // ✅ Récupération du nombre total d’adhérents
  useEffect(() => {
    const fetchTotalMembersCount = async () => {
      if (!web3) return;
      try {
        const contract = new web3.eth.Contract(ABI as any, contractAddress);
        const uniqueMembers = new Set<string>();

        for (let role in roles) {
          const members: string[] = await contract.methods
            .getMembersByRole(role)
            .call();
          members.forEach((m) => uniqueMembers.add(m));
        }

        setTotalMembersCount(uniqueMembers.size);
      } catch (error) {
        console.error("Erreur récupération total adhérents:", error);
      }
    };

    fetchTotalMembersCount();
  }, [web3]);

  // ✅ Récupération des membres et des insectes mintés
  useEffect(() => {
    if (web3) {
      fetchMembersByRole();
      fetchInsectURIs();
    }
  }, [web3]);

  const fetchMembersByRole = async () => {
    try {
      const contract = new web3!.eth.Contract(ABI as any, contractAddress);
      const roleData: MembersByRole = {};

      for (let role in roles) {
        const members: string[] = await contract.methods
          .getMembersByRole(role)
          .call();
        roleData[roles[role]] = members;
      }

      setMembersByRole(roleData);
    } catch (error) {
      console.error("Erreur récupération membres par rôle:", error);
    }
  };

  const fetchInsectURIs = async () => {
    try {
      const contract = new web3!.eth.Contract(ABI as any, contractAddress);
      const insectsCount: string = await contract.methods.getTotalMinted().call();
      setTotalInsectsMinted(Number(insectsCount));

      const fetchedInsects: (InsectURI | null)[] = await Promise.all(
        Array.from({ length: parseInt(insectsCount) }, async (_, i) => {
          try {
            const tokenURI: string = await contract.methods.tokenURI(i).call();
            const response = await fetch(tokenURI);
            if (!response.ok) throw new Error(response.statusText);

            const metadata = await response.json();
            return { id: i.toString(), image: metadata.image, name: metadata.name, bio: metadata.bio };
          } catch (error) {
            console.error("Erreur récupération insecte:", error);
            return null;
          }
        })
      );

      setInsectURIs(fetchedInsects.filter(Boolean) as InsectURI[]);
    } catch (error) {
      console.error("Erreur récupération URIs:", error);
    }
  };

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
                  src={insect.image}
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

        {/* Bouton d’appel à l’action (CTA) */}
        <Center mt={10}>
          <Button
            as={NextLink}
            href="/adhesion"
            size="lg"
            px={12}
            py={6}
            fontWeight="bold"
            rounded="full"
            _hover={{
              ...hoverStyles.brandHover._hover,
              ...brandHover,
              transform: "scale(1.05)",
              transition: "all 0.3s ease",
            }}
            animation={`${pulse} 2s infinite`}
            boxShadow="0 8px 32px rgba(168, 85, 247, 0.25)"
          >
            🚀 Rejoindre le réseau
          </Button>
        </Center>
      </Box>

    );
};

export default Adherent;
