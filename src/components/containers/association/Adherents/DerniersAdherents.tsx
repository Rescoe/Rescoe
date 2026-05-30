import { useState, useEffect } from "react";
import {
  Box, Heading, Text, Grid, Center, Image, useColorModeValue, useColorMode, Badge, Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  SimpleGrid,
  useBreakpointValue,
  Button,
} from "@chakra-ui/react";

import Link from "next/link";
import { gradients, animations, styles, Backgrounds } from "@/styles/theme";
import { Tooltip } from "@chakra-ui/react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsectURI {
  id: string;
  image: string;
  name?: string;
  family?: string;
  level?: string;
}

interface UserInfo {
  membershipValid: boolean;
  name: string;
  bio: string;
  address: string;
  tokens: number[];
  insects: InsectURI[];
}

// ─── Cache localStorage client (30 min) ──────────────────────────────────────

const LS_KEY = "deradh_api_v2";
const LS_TTL = 30 * 60 * 1000;

function readCache(): UserInfo[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) {
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: UserInfo[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ─── Composant ───────────────────────────────────────────────────────────────

const DerniersAdherents: React.FC = () => {
  const [dernierAdherentsInfo, setDernierAdherentsInfo] = useState<UserInfo[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const { colorMode } = useColorMode();
  const bgColor = useColorModeValue(
    Backgrounds.cardBorderLight,
    Backgrounds.cardBorderDark
  );
  const cardBg = useColorModeValue("brand.cream", "brand.navy");
  const cardBorder = useColorModeValue("brand.cream", "brand.cream");

  useEffect(() => {
    const load = async () => {
      // 1. Cache localStorage (30 min) — évite tout appel réseau
      const cached = readCache();
      if (cached) {
        setDernierAdherentsInfo(cached);
        setLoading(false);
        return;
      }

      // 2. Appel unique au serveur (lui-même en cache CDN 10 min)
      try {
        const resp = await fetch("/api/data/members");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const members: UserInfo[] = json.lastFour ?? [];
        setDernierAdherentsInfo(members);
        writeCache(members);
      } catch (err) {
        console.error("[DerniersAdherents] Erreur fetch /api/data/members:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ─── InsectCard ─────────────────────────────────────────────────────────

  const InsectCard = ({ insect }: { insect: InsectURI }) => {
    const isMobile = useBreakpointValue({ base: true, md: false });
    const cardBgLocal = useColorModeValue("brand.cream", "brand.navy");
    const borderColorLocal = useColorModeValue("brand.navy", "brand.cream");
    const popBg = useColorModeValue("brand.cream", "brand.navy");

    const CardVisual = (
      <Box
        borderRadius="xl"
        overflow="hidden"
        bg={cardBgLocal}
        border="1px solid"
        borderColor={borderColorLocal}
        transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
        _hover={{
          transform: "translateY(-6px) rotate(1deg) scale(1.08)",
          boxShadow: "0 25px 600px rgba(238,212,132,0.4)",
          borderWidth: "1px",
          borderColor: "brand.gold",
        }}
        _active={{ transform: "scale(0.95)" }}
        sx={{
          "&:hover": {
            animation: "spin 0.6s ease-in-out infinite alternate",
          },
          "@keyframes spin": {
            "0%": { transform: "translateY(-6px) rotate(0deg) scale(1.08)" },
            "100%": { transform: "translateY(-6px) rotate(2deg) scale(1.08)" },
          },
        }}
      >
        <Image
          src={insect.image || "/fallback-image.png"}
          boxSize="80px"
          objectFit="cover"
        />
      </Box>
    );

    const InfoContent = (
      <Box>
        <Heading size="sm" mb={1}>
          {insect.name}
        </Heading>
        <Heading fontSize="xs" opacity={0.7} mb={2}>
          {insect.family}
        </Heading>
        <Badge colorScheme="yellow" variant="solid">
          Niveau {insect.level ?? "?"}
        </Badge>
      </Box>
    );

    if (isMobile) {
      return (
        <Popover trigger="click" placement="auto" isLazy>
          <PopoverTrigger>{CardVisual}</PopoverTrigger>
          <PopoverContent
            bg={popBg}
            border="1px solid"
            borderColor="brand.gold"
            borderRadius="xl"
            _focus={{ boxShadow: "none" }}
          >
            <PopoverBody p={4}>{InfoContent}</PopoverBody>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Tooltip
        label={InfoContent}
        hasArrow
        placement="top"
        bg={popBg}
        borderRadius="lg"
        p={3}
      >
        {CardVisual}
      </Tooltip>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 10, md: 14 }}>
      <Heading mb={10} textAlign="center" bgClip="text">
        Derniers adhérents
      </Heading>

      {loading ? (
        <Center py={20}>
          <Text opacity={0.6}>Chargement des adhérents...</Text>
        </Center>
      ) : dernierAdherentsInfo.length === 0 ? (
        <Center py={20}>
          <Text opacity={0.6}>Aucun adhérent trouvé</Text>
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
          {dernierAdherentsInfo.map((info) => (
            <Box
              key={info.address}
              borderRadius="2xl"
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              p={6}
              transition="all 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
              _hover={{
                transform: "translateY(-8px) scale(1.02)",
                boxShadow: "0 25px 60px rgba(238,212,132,0.4)",
                borderColor: "brand.gold",
                background:
                  "linear-gradient(135deg, brand.cream 0%, rgba(238,212,132,0.1) 100%)",
              }}
              _active={{ transform: "translateY(-4px) scale(1.01)" }}
              sx={{
                animation: "pulse 2s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
                  "50%": { boxShadow: "0 8px 30px rgba(238,212,132,0.2)" },
                },
              }}
            >
              {/* HEADER */}
              <Box
                flex={1}
                mb={4}
                position="relative"
                height="140px"
                display="flex"
                flexDirection="column"
              >
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  noOfLines={1}
                  mb={2}
                  height="28px"
                >
                  {info.name || "Utilisateur"}
                </Text>
                <Text
                  fontSize="sm"
                  opacity={0.65}
                  noOfLines={2}
                  height="40px"
                  display="flex"
                  alignItems="flex-start"
                >
                  {info.bio || "Aucune description"}
                </Text>
                <Box height="28px" mt="auto">
                  {info.membershipValid && (
                    <Badge colorScheme="green" size="sm">
                      Membre actif
                    </Badge>
                  )}
                </Box>
              </Box>

              {/* NFT GRID */}
              {info.insects.length > 0 ? (
                <SimpleGrid columns={2} spacing={3} mb={6}>
                  {info.insects.slice(0, 4).map((insect) => (
                    <InsectCard key={insect.id} insect={insect} />
                  ))}
                </SimpleGrid>
              ) : (
                <Center py={8}>
                  <Text fontSize="sm" opacity={0.5}>
                    Aucun NFT
                  </Text>
                </Center>
              )}

              {/* CTA */}
              <Button
                as={Link}
                href={`/u/${info.address}`}
                size="sm"
                w="full"
                borderRadius="full"
                fontWeight="bold"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                }}
                _active={{ transform: "scale(0.97)" }}
                transition="all 0.2s ease"
              >
                Voir le profil
              </Button>
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default DerniersAdherents;
