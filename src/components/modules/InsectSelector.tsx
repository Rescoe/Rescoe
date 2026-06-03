// Code Insect Selector - API-backed (no direct RPC)

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Image,
  VStack,
  HStack,
  Badge,
  useToast
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useAuth } from "../../utils/authContext";

const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

export interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
  isAnnual: boolean;
}

export type Insect = {
  id: number;
  name: string;
  image: string;
  level?: number;
  membershipInfo?: MembershipInfo;
  canEvolve?: boolean;
  isEgg?: boolean;
};

const SESSION_TTL = 5 * 60 * 1000; // 5 min (aligne sur le cache API)

const SelectInsect = ({ onSelect }: { onSelect: (insect: Insect) => void }) => {

  const { address } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [insects, setInsects] = useState<Insect[]>([]);
  const [selectedInsect, setSelectedInsect] = useState<Insect | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Compteur de refresh : incrémenter force un rechargement complet (ignore le cache)
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Écouter RESCOE_DATA_CHANGED → purge cache + re-fetch
  useEffect(() => {
    const handler = () => {
      try {
        Object.keys(sessionStorage)
          .filter(k => k.startsWith("insect_data_"))
          .forEach(k => sessionStorage.removeItem(k));
      } catch {}
      setRefreshTick(t => t + 1);
    };
    window.addEventListener("RESCOE_DATA_CHANGED", handler);
    return () => window.removeEventListener("RESCOE_DATA_CHANGED", handler);
  }, []);

  useEffect(() => {
    if (!address) return;

    const sessionKey = `insect_data_${address}`;

    // Check sessionStorage cache (seulement si pas de refresh forcé)
    if (refreshTick === 0) {
      try {
        const raw = sessionStorage.getItem(sessionKey);
        if (raw) {
          const { data, ts } = JSON.parse(raw);
          if (Date.now() - ts < SESSION_TTL) {
            setInsects(data);
            const evolutionCount = data.filter((i: Insect) => i.canEvolve || i.isEgg).length;
            window.dispatchEvent(new CustomEvent("RESCOE_EVOLUTION_COUNT", { detail: evolutionCount }));
            return;
          }
          sessionStorage.removeItem(sessionKey);
        }
      } catch {}
    }

    const controller = new AbortController();
    setIsLoading(true);

    // bust=1 → bypass du cache serveur (utilisé après RESCOE_DATA_CHANGED)
    const bust = refreshTick > 0 ? "&bust=1" : "";
    fetch(`/api/token/insects?address=${encodeURIComponent(address)}${bust}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: Insect[]) => {
        setInsects(data);
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ data, ts: Date.now() }));
        } catch {}
        const evolutionCount = data.filter((i) => i.canEvolve || i.isEgg).length;
        window.dispatchEvent(new CustomEvent("RESCOE_EVOLUTION_COUNT", { detail: evolutionCount }));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Erreur chargement insectes:", err);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [address, refreshTick]);

  const handleOpenPage = (insect: Insect) => {
    router.push(`/AdhesionId/${contractAddress}/${insect.id}`);
  };

  const handleSelect = (insect: Insect) => {
    setSelectedInsect(insect);
    onSelect(insect);
    localStorage.setItem("savedInsect", JSON.stringify(insect));
    toast({
      title: "Insecte sélectionné",
      description: insect.name,
      status: "success",
      duration: 1500
    });
  };

  const getActionLabel = (insect: Insect) => {
    if (insect.isEgg) return "🥚 Éclore";
    if (insect.canEvolve) return "🧬 Évoluer";
    if (insect.membershipInfo?.locked) return "🔒 Bloqué";
    if (insect.level !== undefined) return "Niv. max";
    return "...";
  };

  return (
    <VStack spacing={3} w="100%" align="stretch" px={1}>
      {insects.length === 0 ? (
        <Box textAlign="center" py={6} color="brand.gold" fontSize="sm">
          {isLoading ? "Chargement…" : "Aucun insecte"}
        </Box>
      ) : (
        insects.map((insect) => {
          const hasAction = insect.isEgg || insect.canEvolve;
          const isSelected = selectedInsect?.id === insect.id;

          return (
            <Box
              key={insect.id}
              px={3}
              py={3}
              borderRadius="lg"
              bg="rgba(1,28,57,0.65)"
              border="1px solid"
              borderColor={isSelected ? "brand.gold" : "rgba(255,237,166,0.12)"}
              cursor="pointer"
              _hover={{
                borderColor: "brand.gold",
                bg: "rgba(1,28,57,0.85)"
              }}
              transition="all .18s ease"
              onClick={() => handleSelect(insect)}
            >
              <HStack align="center" spacing={3} w="100%">
                {/* IMAGE + ACTION */}
                <Box position="relative" flexShrink={0}>
                  <Image
                    src={insect.image || "/fallback-image.png"}
                    alt={insect.name}
                    boxSize={{ base: "56px", md: "60px" }}
                    borderRadius="md"
                    pointerEvents="none"
                  />
                  {hasAction && (
                    <Box
                      position="absolute"
                      top="-6px"
                      right="-6px"
                      fontSize="16px"
                      animation="pulseInsect 1.2s infinite"
                      pointerEvents="none"
                    >
                      {insect.isEgg ? "🥚" : "🧬"}
                    </Box>
                  )}
                </Box>

                {/* INFOS */}
                <Box flex="1" minW={0}>
                  <Box
                    fontSize="sm"
                    fontWeight="semibold"
                    color="brand.cream"
                    lineHeight="1.25"
                    noOfLines={2}
                  >
                    {insect.name}
                  </Box>

                  {insect.membershipInfo && (
                    <HStack
                      spacing={2}
                      fontSize="0.72rem"
                      color="brand.gold"
                      opacity={0.9}
                      mt="2px"
                      flexWrap="wrap"
                    >
                      <Box>Niv.{insect.level}</Box>
                      <Box opacity={0.5}>•</Box>
                      <Box>{insect.membershipInfo.totalYears} ans</Box>
                      {insect.membershipInfo.isAnnual && (
                        <>
                          <Box opacity={0.5}>•</Box>
                          <Box>annuel</Box>
                        </>
                      )}
                      {insect.membershipInfo.locked && (
                        <>
                          <Box opacity={0.5}>•</Box>
                          <Box>🔒</Box>
                        </>
                      )}
                    </HStack>
                  )}
                </Box>
              </HStack>

              {/* FOOTER */}
              <HStack
                justify="space-between"
                align="center"
                mt={2}
                fontSize="0.65rem"
              >
                <Box opacity={0.45} color="brand.cream">
                  #{insect.id}
                </Box>
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="brand.gold"
                    fontSize="0.70rem"
                    px={2}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPage(insect);
                    }}
                  >
                    Page
                  </Button>
                </HStack>
              </HStack>
            </Box>
          );
        })
      )}
    </VStack>
  );
};

export default SelectInsect;
