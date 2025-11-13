"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  VStack,
  Badge,
  Progress,
  HStack,
  Spinner,
} from "@chakra-ui/react";
import { motion } from "framer-motion";

import useAteliersData from "@/hooks/useAteliersData";
import { getAteliersDuJourCalendar } from "@/components/containers/association/Formations/AteliersCalendarView";

const MotionBox = motion(Box);

const MiniCalendar = ({ onClick }: { onClick?: () => void }) => {
  const { enriched, onChainDataByMsgId } = useAteliersData();
  const [ateliers, setAteliers] = useState<any[]>([]);

  // Filtrer les ateliers du jour quand enriched change
  useEffect(() => {
    if (!enriched?.length) {
      setAteliers([]);
      return;
    }

    const findNextAteliers = () => {
      let date = new Date();
      for (let i = 0; i < 30; i++) { // limite de recherche à 30 jours
        const dayAteliers = getAteliersDuJourCalendar(enriched, date);
        if (dayAteliers.length > 0) return dayAteliers;
        date.setDate(date.getDate() + 1); // passer au jour suivant
      }
      return []; // aucun atelier trouvé dans les 30 jours
    };

    const nextAteliers = findNextAteliers();
    setAteliers(nextAteliers);
  }, [enriched]);


/*
  // Spinner si tout charge encore
  if (isLoading && ateliers.length === 0) {
    return (
      <MotionBox
        borderRadius="2xl"
        p={6}
        boxShadow="lg"
        minH="280px"
        bg="gray.900"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="lg" color="teal.300" />
      </MotionBox>
    );
  }
*/

  return (
    <MotionBox
      borderRadius="2xl"
      p={6}
      boxShadow="lg"
      cursor="pointer"
      whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(0,0,0,0.2)" }}
      transition={{ duration: 0.3 }}
      minH="280px"
      bg="gray.900"
      onClick={onClick}
    >
      <Text fontSize="xl" fontWeight="bold" mb={4} textAlign="center">
        🗓️ Ateliers du jour
      </Text>

      {ateliers.length === 0 ? (
        <Text textAlign="center" mt={6}>
          Aucun atelier aujourd’hui.
        </Text>
      ) : (
        <VStack spacing={3} align="stretch">
          {ateliers.map((a) => {
            const onChain = onChainDataByMsgId[a.id];

            // Spinner si onChain pas encore chargé
            if (!onChain) {
              return (
                <Box key={a.id} p={3} borderRadius="lg" bg="gray.800">
                  <Flex justify="space-between" align="center">
                    <Text fontSize="sm" fontWeight="bold">
                      {a.heure || "Heure non définie"} — {a.title}
                    </Text>
                    <Spinner size="sm" />
                  </Flex>
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Chargement des données on-chain…
                  </Text>
                </Box>
              );
            }

            // Calcul des places
            const placesTot =
              onChain.totalEditions ?? (a.rules?.maxEditions ?? a.cfg?.maxEditions ?? 0);
            const placesDIspo = onChain.remaining ?? placesTot;
            const placesRes = placesTot - placesDIspo;
            const percent = placesTot > 0 ? (placesRes / placesTot) * 100 : 0;

            return (
              <Box
                key={a.id}
                p={3}
                borderRadius="lg"
                bg="gray.800"
                _hover={{ bg: "gray.700" }}
                transition="background 0.2s ease"
              >
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
                    {a.heure || "Heure non définie"} — {a.title}
                  </Text>
                  <Badge colorScheme="teal" fontSize="0.7em">
                    {a.type}
                  </Badge>
                </Flex>

                {placesTot > 0 ? (
                  <Box mt={2}>
                    <Progress
                      value={percent}
                      size="xs"
                      colorScheme={
                        placesDIspo === 0
                          ? "red"
                          : placesDIspo <= Math.ceil(placesTot * 0.2)
                          ? "orange"
                          : "green"
                      }
                      borderRadius="md"
                      hasStripe
                      isAnimated
                    />
                    <HStack justify="space-between" mt={1}>
                      <Text fontSize="xs" color="gray.400">
                        {placesRes}/{placesTot} réservées
                      </Text>
                      <Text fontSize="xs" color="gray.400">
                        {placesDIspo === 0 ? "Complet" : `${placesDIspo} restantes`}
                      </Text>
                    </HStack>
                  </Box>
                ) : (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Places : illimitées
                  </Text>
                )}
              </Box>
            );
          })}
        </VStack>
      )}
    </MotionBox>
  );
};

export default MiniCalendar;
