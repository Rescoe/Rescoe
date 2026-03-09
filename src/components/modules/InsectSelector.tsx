// Code Insect Selector - VERSION OPTIMISÉE

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
import { JsonRpcProvider, Contract } from "ethers";
import ABI from "../ABI/ABIAdhesion.json";
import { resolveIPFS } from "@/utils/resolveIPFS";
import { BigNumberish } from "ethers";

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

const SelectInsect = ({ onSelect }: { onSelect: (insect: Insect) => void }) => {

  const { address } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [insects, setInsects] = useState<Insect[]>([]);
  const [selectedInsect, setSelectedInsect] = useState<Insect | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
  const contract = new Contract(contractAddress, ABI, provider);
  const LEVEL_MAX = 3;

  // =========================
  // STEP 1 — LOAD BASIC DATA
  // =========================

  const loadBasicInsects = async () => {

    if (!address) return;

    setIsLoading(true);

    try {

      const tokenIds: BigNumberish[] = await contract.getTokensByOwner(address);

      const basicInsects = await Promise.all(
        tokenIds.map(async (tokenId: BigNumberish) => {

          try {

            const tokenURI = await contract.tokenURI(tokenId);
            if (!tokenURI) {
              console.warn("tokenURI invalide pour tokenId:", tokenId);
              return null; // ou continuer sans cet insecte
            }

            const metadataUrl = resolveIPFS(tokenURI, true);
            if (!metadataUrl) {
              console.warn("metadataUrl invalide pour tokenId:", tokenId, "tokenURI:", tokenURI);
              return null;
            }

            const res = await fetch(metadataUrl);
            const metadata = await res.json();

            return {
              id: Number(tokenId),
              name: metadata.name || `Insecte #${tokenId}`,
              image: resolveIPFS(metadata.image, true) || ""
            };

          } catch (e) {

            console.error("Metadata error", e);
            return null;

          }

        })
      );

      const valid = basicInsects.filter((i): i is Insect => i !== null);
      setInsects(valid);

      // ensuite charger les données blockchain
      loadMembershipData(valid);

    } catch (error) {

      console.error("Erreur loadBasicInsects:", error);

    } finally {

      setIsLoading(false);

    }

  };

  // =========================
  // STEP 2 — LOAD ONCHAIN DATA
  // =========================

  const loadMembershipData = async (baseInsects: Insect[]) => {
    // ✅ FETCH DURATIONS DYNAMIQUES (une seule fois)
    const durationsRaw = await Promise.all([
      contract.levelDurations(0),  // LVL0: 30 jours
      contract.levelDurations(1),  // LVL1: 60 jours
      contract.levelDurations(2)   // LVL2: 90 jours
    ]);
    const levelDurations = durationsRaw.map(d => Number(d));  // [2592000, 5184000, 7776000]

    const updated = await Promise.all(
      baseInsects.map(async (insect) => {
        try {
          const membershipInfoRaw = await contract.getMembershipInfo(insect.id);
          const membershipInfo: MembershipInfo = {
            level: Number(membershipInfoRaw.level),
            autoEvolve: Boolean(membershipInfoRaw.autoEvolve),
            startTimestamp: Number(membershipInfoRaw.startTimestamp),
            expirationTimestamp: Number(membershipInfoRaw.expirationTimestamp),
            totalYears: Number(membershipInfoRaw.totalYears),
            locked: Boolean(membershipInfoRaw.locked),
            isEgg: Boolean(membershipInfoRaw.isEgg),
            isAnnual: Boolean(membershipInfoRaw.isAnnual),
          };

          const now = Math.floor(Date.now() / 1000);

          // ✅ ALIGNÉ SUR CONTRACT canEvolve()
          const canEvolve =
            !membershipInfo.isEgg &&
            membershipInfo.level < LEVEL_MAX &&
            !membershipInfo.locked &&
            now >= membershipInfo.startTimestamp + levelDurations[membershipInfo.level];

          return {
            ...insect,
            level: membershipInfo.level,
            membershipInfo,
            canEvolve,
            isEgg: membershipInfo.isEgg
          };
        } catch (e) {
          console.error("membership error", e);
          return insect;
        }
      })
    );

    setInsects(updated);

    // Count inchangé (œufs + canEvolve)
    const evolutionCount = updated.filter(i => i.canEvolve || i.isEgg).length;
    window.dispatchEvent(new CustomEvent("RESCOE_EVOLUTION_COUNT", { detail: evolutionCount }));
  };

  // =========================

  useEffect(() => {

    if (address) {
      loadBasicInsects();
    }

  }, [address]);

  // =========================

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

  // =========================
  // UI
  // =========================

  return (
    <VStack spacing={3} w="100%" align="stretch" px={1}>
      {insects.length === 0 ? (
        <Box textAlign="center" py={6} color="brand.gold" fontSize="sm">
          Aucun insecte
        </Box>
      ) : (
        insects.map((insect) => {
          const hasAction = insect.isEgg || insect.canEvolve
          const isSelected = selectedInsect?.id === insect.id

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
                  {/* ACTION EMOJI */}
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

              {/* FOOTER LIGNE */}
              <HStack
                justify="space-between"
                align="center"
                mt={2}
                fontSize="0.65rem"
              >
                {/* TOKEN ID */}
                <Box opacity={0.45} color="brand.cream">
                  #{insect.id}
                </Box>

                {/* ACTIONS */}
                <HStack spacing={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="brand.gold"
                    fontSize="0.70rem"
                    px={2}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenPage(insect)
                    }}
                  >
                    Page
                  </Button>
                </HStack>
              </HStack>
            </Box>
          )
        })
      )}
    </VStack>
  )

};

export default SelectInsect;
