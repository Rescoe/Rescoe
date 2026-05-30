import { useState, useEffect } from "react";
import {
  Box, Grid, Text, Image, useColorMode, useColorModeValue, Center, Heading, SimpleGrid, Button,
} from "@chakra-ui/react";
import Link from "next/link";

import { gradients, animations, Backgrounds } from "@/styles/theme";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsectURI {
  id: string;
  image: string;
  name?: string;
  family?: string;
}

interface UserInfo {
  membershipValid: boolean;
  name: string;
  bio: string;
  address: string;
  tokens: number[];
  insects: InsectURI[];
}

interface FeaturedMembersProps {
  addresses: string[];
}

// ─── Cache localStorage client (30 min) ──────────────────────────────────────

// 24h : données rarement mutables, partagées depuis CDN (même TTL que le CDN SWR)
const LS_TTL = 24 * 60 * 60 * 1000;

function readCache(key: string): UserInfo[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: UserInfo[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ─── Composant ───────────────────────────────────────────────────────────────

const FeaturedMembers: React.FC<FeaturedMembersProps> = ({ addresses }) => {
  const [featuredMembersInfo, setFeaturedMembersInfo] = useState<UserInfo[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const { colorMode } = useColorMode();
  const cardBg = useColorModeValue("brand.cream", "brand.navy");
  const cardBorder = useColorModeValue("brand.cream", "brand.cream");
  const borderColor = useColorModeValue("brand.navy", "brand.cream");
  const bgColor = useColorModeValue(
    Backgrounds.cardBorderLight,
    Backgrounds.cardBorderDark
  );

  useEffect(() => {
    if (!addresses || addresses.length === 0) {
      setLoading(false);
      return;
    }

    const cacheKey = `featured_api_v2_${[...addresses].sort().join(",")}`;

    const load = async () => {
      // 1. Cache localStorage (30 min)
      const cached = readCache(cacheKey);
      if (cached) {
        setFeaturedMembersInfo(cached);
        setLoading(false);
        return;
      }

      // 2. Appel unique au serveur (CDN 10 min)
      try {
        const resp = await fetch("/api/data/members");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();

        // L'API retourne featured[] correspondant aux adresses hardcodées côté serveur.
        // On filtre pour ne garder que celles demandées par le composant.
        const addrSet = new Set(addresses.map((a) => a.toLowerCase()));
        const members: UserInfo[] = (json.featured ?? []).filter((m: UserInfo) =>
          addrSet.has(m.address.toLowerCase())
        );

        setFeaturedMembersInfo(members);
        writeCache(cacheKey, members);
      } catch (err) {
        console.error("[FeaturedMembers] Erreur fetch /api/data/members:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [addresses]);

  // ─── InsectCardCompact ──────────────────────────────────────────────────

  const InsectCardCompact = ({
    insect,
    isExtra = false,
  }: {
    insect: InsectURI;
    isExtra?: boolean;
  }) => (
    <Box
      borderRadius="lg"
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      p={0.45}
      textAlign="center"
      transition="all 0.2s ease"
      bgGradient={
        colorMode === "light" ? gradients.cardBorderLight : gradients.cardBorderDark
      }
      backgroundSize="300% 300%"
      animation={animations.borderGlow}
      _hover={{
        animation: animations.borderGlow.replace("6s", "2s"),
        transform: "scale(1.05)",
        boxShadow:
          colorMode === "light"
            ? "0 0 25px rgba(180, 166, 213, 0.6)"
            : "0 0 25px rgba(238, 212, 132, 0.6)",
      }}
      justifySelf="center"
      mx="auto"
      position="relative"
    >
      <Box borderRadius="lg" height="100%" p={4} textAlign="center" bg={bgColor}>
        <Image
          src={insect.image || "/fallback-image.png"}
          boxSize={isExtra ? "32px" : "80px"}
          objectFit="cover"
          borderRadius="md"
          mb={0.5}
        />
        <Text
          fontSize={isExtra ? "3xs" : "2xs"}
          color="gray.500"
          noOfLines={1}
          fontWeight="medium"
        >
          {insect.name?.slice(0, isExtra ? 6 : 10) || "Insecte"}
        </Text>
        {isExtra || (
          <Text fontSize="3xs" color="gray.400" noOfLines={1}>
            {insect.family?.slice(0, 8) || "#"}
          </Text>
        )}
      </Box>
    </Box>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  const innerBg = useColorModeValue("whiteAlpha.900", "gray.800");

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 1, md: 4 }}>
      <Heading
        textAlign="center"
        bgGradient="linear(to-r, brand.cream, cream.400)"
        bgClip="text"
        fontSize={{ base: "2xl", md: "3xl" }}
      >
        Membres en résidence
      </Heading>

      {loading ? (
        <Center py={20}>
          <Text opacity={0.6}>Chargement des membres...</Text>
        </Center>
      ) : featuredMembersInfo.length === 0 ? (
        <Center py={20}>
          <Text opacity={0.6}>Aucun membre trouvé</Text>
        </Center>
      ) : (
        <Grid
          templateColumns={{
            base: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          }}
          gap={8}
        >
          {featuredMembersInfo.map((info) => (
            <Box
              key={info.address}
              borderRadius="2xl"
              position="relative"
              p="2px"
              bgGradient={
                colorMode === "light"
                  ? gradients.cardBorderLight
                  : gradients.cardBorderDark
              }
              backgroundSize="300% 300%"
              animation={animations.borderGlow}
              transition="all 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
              _hover={{
                animation: animations.borderGlow.replace("6s", "2s"),
                transform: "translateY(-8px) scale(1.02)",
                boxShadow:
                  colorMode === "light"
                    ? "0 0 25px rgba(180, 166, 213, 0.6), 0 25px 60px rgba(238,212,132,0.4)"
                    : "0 0 25px rgba(238, 212, 132, 0.6), 0 25px 60px rgba(238,212,132,0.4)",
              }}
              _active={{ transform: "translateY(-4px) scale(1.01)" }}
              minH={{ base: "290px", md: "330px" }}
              display="flex"
              flexDirection="column"
            >
              <Box
                borderRadius="2xl"
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                flex={1}
                p={{ base: 4, md: 5 }}
                display="flex"
                flexDirection="column"
              >
                <Box mb={4} flexShrink={0}>
                  <Text
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="bold"
                    color="brand.cream"
                    noOfLines={1}
                    mb={2}
                  >
                    {info.name || "Membre anonyme"}
                  </Text>
                  <Text
                    fontSize="sm"
                    opacity={0.65}
                    noOfLines={2}
                    minH="40px"
                    lineHeight="1.3"
                  >
                    {info.bio || "Aucune description"}
                  </Text>
                </Box>

                <Box flex={1} mb={4} position="relative">
                  {info.insects.length > 0 ? (
                    <SimpleGrid columns={2} spacing={2}>
                      {info.insects.slice(0, 4).map((insect, idx) => (
                        <InsectCardCompact
                          key={insect.id}
                          insect={insect}
                          isExtra={idx >= 2}
                        />
                      ))}
                      {info.insects.length > 4 && (
                        <Box
                          position="absolute"
                          top={1}
                          right={1}
                          bg="brand.cream"
                          color="white"
                          borderRadius="full"
                          w={5}
                          h={5}
                          fontSize="xs"
                          fontWeight="bold"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          boxShadow="0 2px 8px rgba(0,0,0,0.3)"
                          zIndex={10}
                        >
                          +{info.insects.length - 4}
                        </Box>
                      )}
                    </SimpleGrid>
                  ) : (
                    <Center py={8} flex={1}>
                      <Text fontSize="sm" opacity={0.5}>
                        Aucun NFT
                      </Text>
                    </Center>
                  )}
                </Box>

                <Button
                  as={Link}
                  href={`/u/${info.address}`}
                  size="sm"
                  w="full"
                  borderRadius="full"
                  fontWeight="bold"
                  colorScheme="cream"
                  bgGradient="linear(to-r, brand.cream, cream.400)"
                  color="white"
                  boxShadow="0 4px 15px rgba(244,143,177,0.3)"
                  _hover={{
                    transform: "translateY(-3px)",
                    boxShadow:
                      colorMode === "light"
                        ? "0 8px 35px rgba(244,143,177,0.6)"
                        : "0 8px 35px rgba(238,212,132,0.7)",
                    background:
                      "linear-gradient(135deg, brand.cream 0%, cream.500 100%)",
                  }}
                  transition="all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
                >
                  Voir le profil
                </Button>
              </Box>
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default FeaturedMembers;
