// src/components/containers/association/Formations/Ateliers.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  useToast,
  Switch,
  Flex,
  Text,
  IconButton,
  Select,
  Collapse,
  Heading,
  Divider,
  HStack,
  Checkbox,
  Stack,
  Image,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { SlArrowRight, SlArrowLeft } from "react-icons/sl";
import Web3 from "web3";
import MessageEditions from "@/components/ABI/MessageEditions.json";
import useAteliersData from "@/hooks/useAteliersData";
import AteliersCalendarView from "./AteliersCalendarView";


function Formations() {

const [showAll, setShowAll] = useState(false);

const {
  messages,          // Raw messages (pour debug, affichage brut, etc.)
  enriched,          // Array d’ateliers enrichis (pour liste détaillée)
  filteredByDate,
  calendarDays,
  availableTypes,
  availableSplitAddresses,
  currentMonthBase,
  daysInMonthGrid,
  onChainDataByMsgId,
  mintingIds,
  showPast,
  setShowPast,
  monthOffset,
  setMonthOffset,
  selectedDate,
  setSelectedDate,
  filters,
  setFilters,
  openPanels,
  setOpenPanels,
  openDetails,
  setOpenDetails,
  mintAtelierTicket,
  togglePanel,
  toggleDetails,
  rulesCfg,
  computeMintDurationSeconds,
} = useAteliersData();

return (
  <Box mt={6}>
    {/* --- Vue calendrier --- */}
    <AteliersCalendarView />

    {/* --- Bouton pour afficher/masquer les anciens ateliers --- */}
    <Flex justify="center" my={6}>
      <Button
        colorScheme="teal"
        variant="solid"
        onClick={() => setShowPast((prev) => !prev)}
      >
        {showPast ? "Masquer les anciens ateliers" : "Afficher les anciens ateliers"}
      </Button>
      <Button
        colorScheme="teal"
        variant="solid"
        onClick={() => setShowAll((prev) => !prev)}
      >
        {showAll ? "Masquer tous les ateliers" : "Afficher tous les ateliers"}
      </Button>
    </Flex>

    {/* --- Ateliers à venir --- */}
    <Collapse in={showAll} animateOpacity>

    <Box>
      {enriched
        .filter((entry) => {
          if (!entry.rules.datetime) return true;
          return entry.rules.datetime.getTime() > Date.now();
        })
        .map((entry) => {
          const { raw: msg, rules, cfg } = entry;
          const open = !!openDetails[msg.id];
          const leftColor =
            cfg?.color ||
            (rules.hashtag ? rulesCfg[rules.hashtag]?.color : null) ||
            "#2c7a7b";
          const onChain = onChainDataByMsgId[msg.id];

          return (
            <Flex
              key={msg.id}
              border="1px solid #333"
              borderRadius="12px"
              overflow="hidden"
              mb={4}
              bg="#023537"
              color="#fff"
              flexDir="column"
            >
              <Box w="100%" p={4}>
                <Flex align="center" mb={2}>
                  <Box flex="1">
                    <Text fontWeight="bold" fontSize="lg">
                      {rules.title || cfg?.title || "Atelier sans titre"}
                    </Text>
                    <Text fontSize="sm" color="#a7d7d7">
                      {entry.hashtag || cfg?.label}
                    </Text>
                    {cfg?.type && (
                      <Badge
                        ml={2}
                        colorScheme="gray"
                        backgroundColor={leftColor}
                        color="#fff"
                      >
                        {cfg.type}
                      </Badge>
                    )}
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="sm" color="#cfecec">
                      {rules.datetime
                        ? rules.datetime.toLocaleString()
                        : "Date non définie"}
                    </Text>
                    <Text fontSize="xs" color="#9dd">
                      {rules.splitAddress ||
                        cfg?.splitAddress ||
                        "Formateur non défini"}
                    </Text>
                  </Box>
                </Flex>

                <Text mb={3}>
                  {rules.description ||
                    cfg?.description ||
                    msg.content
                      .split("\n")
                      .filter((line: string) => !line.startsWith("/"))
                      .join("\n")
}
                </Text>

                <Flex gap={3} mt={2}>
                  <Button
                    size="sm"
                    colorScheme="teal"
                    onClick={() => mintAtelierTicket(entry)}
                    isLoading={mintingIds.includes(msg.id)}
                  >
                    Réserver un ticket
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleDetails(msg.id)}
                  >
                    {open ? "Masquer les détails" : "Afficher les détails"}
                  </Button>
                </Flex>

                <Collapse in={open}>
                  <Box
                    mt={3}
                    p={3}
                    bg="#071f1f"
                    borderRadius={6}
                    fontSize="sm"
                  >
                    <Text fontWeight="bold" mb={2}>
                      Détails techniques du mint
                    </Text>
                    <Text>
                      messageIdDiscord: <em>{msg.id}</em>
                    </Text>
                    <Text>
                      salonRoyaltyAddress:{" "}
                      {rules.splitAddress ?? cfg?.splitAddress ?? "MANQUANTE"}
                    </Text>
                    <Text>messageTimestamp: {entry.messageTimestamp}</Text>
                    <Text>
                      Durée de mint :{" "}
                      {computeMintDurationSeconds(
                        entry.messageTimestamp,
                        rules.datetime
                      )}{" "}
                      sec
                    </Text>

                    <Text mt={2}>
                      <strong>On-chain :</strong>
                    </Text>
                    {!onChain ? (
                      <Flex align="center" gap={2}>
                        <Spinner size="xs" />
                        <Text fontSize="sm">
                          Chargement données on-chain...
                        </Text>
                      </Flex>
                    ) : !onChain.exists ? (
                      <Text fontSize="sm">
                        Aucun haiku lié on-chain pour ce message.
                      </Text>
                    ) : (
                      <>
                        <Text>haikuId: {onChain.haikuId}</Text>
                        <Text>firstTokenId: {onChain.firstTokenId}</Text>
                        <Text>totalEditions: {onChain.totalEditions}</Text>
                        <Text>remaining: {onChain.remaining}</Text>
                        <Text>
                          currentPrice (wei): {onChain.currentPriceWei}
                        </Text>
                        {onChain.parsedImageUrl ? (
                          <Image
                            src={onChain.parsedImageUrl}
                            alt="image"
                            maxH="200px"
                            mt={2}
                            borderRadius="6px"
                          />
                        ) : msg.attachments?.[0]?.url ? (
                          <Image
                            src={msg.attachments[0].url}
                            alt="attachment"
                            maxH="200px"
                            mt={2}
                            borderRadius="6px"
                          />
                        ) : null}
                      </>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </Flex>
          );
        })}
    </Box>
    </Collapse>

    {/* --- GROS COLLAPSE pour les anciens ateliers --- */}
    <Collapse in={showPast} animateOpacity>
      <Box mt={10}>
        <Heading as="h3" fontSize="xl" mb={4} textAlign="center">
          Anciennes formations & ateliers
        </Heading>

        {enriched
          .filter(
            (entry) =>
              entry.rules.datetime &&
              entry.rules.datetime.getTime() <= Date.now()
          )
          .map((entry) => {
            const { raw: msg, rules, cfg } = entry;
            const leftColor =
              cfg?.color ||
              (rules.hashtag ? rulesCfg[rules.hashtag]?.color : null) ||
              "#2c7a7b";

            return (
              <Flex
                key={msg.id}
                border="1px solid #333"
                borderRadius="12px"
                overflow="hidden"
                mb={4}
                bg="#2d2d2d"
                color="#fff"
              >
                <Box w="6px" bg={leftColor} />
                <Box flex="1" p={4}>
                  <Text fontWeight="bold" fontSize="lg">
                    {rules.title || cfg?.title || "Atelier sans titre"}
                  </Text>
                  <Text fontSize="sm" color="#a7d7d7">
                    {entry.hashtag || cfg?.label}
                  </Text>
                  <Text fontSize="sm" color="#cfecec">
                    {rules.datetime
                      ? rules.datetime.toLocaleString()
                      : "Date non définie"}
                  </Text>
                </Box>
              </Flex>
            );
          })}
      </Box>
    </Collapse>
  </Box>
);

};

export default Formations; // L'export se fait ici
