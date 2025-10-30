"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Text,
  VStack,
  Badge,
  Spinner,
} from "@chakra-ui/react";
import { motion } from "framer-motion";

import useAteliersData from "@/hooks/useAteliersData";
import { getAteliersDuJourCalendar } from "@/components/containers/association/Formations/AteliersCalendarView";

const MotionBox = motion(Box);

const MiniCalendar = ({ onClick }: { onClick?: () => void }) => {
  const { enriched } = useAteliersData();
  const [ateliers, setAteliers] = useState<any[]>([]);

  useEffect(() => {
    if (enriched?.length) {
      const todayAteliers = getAteliersDuJourCalendar(enriched);
      setAteliers(todayAteliers);
    }
  }, [enriched]);

  return (
    <MotionBox
      borderRadius="2xl"
      p={6}
      boxShadow="lg"
      cursor="pointer"
      whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(0,0,0,0.2)" }}
      transition={{ duration: 0.3 }}
      minH="280px"
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
        <VStack spacing={2} align="stretch">
          {ateliers.map((a) => (
            <Box
              key={a.id}
              p={2}
              borderRadius="md"
              bg="gray.800"
              _hover={{ bg: "gray.700" }}
            >
              <Text fontSize="sm" fontWeight="bold">
                {a.heure || "Heure non définie"} — {a.title}
              </Text>
              <Badge colorScheme="teal" mt={1}>
                {a.type}
              </Badge>
            </Box>
          ))}
        </VStack>
      )}
    </MotionBox>
  );
};

export default MiniCalendar;
