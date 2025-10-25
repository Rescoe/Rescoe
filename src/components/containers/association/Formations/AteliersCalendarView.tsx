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
  VStack,
  Checkbox,
  Stack,
  Image,
  Spinner,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";
import { SlArrowRight, SlArrowLeft } from "react-icons/sl";
import Web3 from "web3";
import MessageEditions from "@/components/ABI/MessageEditions.json";
import useAteliersData from "@/hooks/useAteliersData";


function AteliersCalendarView() {

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

  // ---------- UI render ----------
  return (
      <Box maxW="1200px" mx="auto" p={4}>
        <Flex mb={4} alignItems="center" justify="space-between">
          <Heading fontSize="2xl">Ateliers & Formations</Heading>
          <Box>
            <Text as="span" mr={2}>Afficher ateliers passés</Text>
            <Switch isChecked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          </Box>
        </Flex>

        {/* Conteneur principal responsive */}
        <Flex
          gap={6}
          alignItems="flex-start"
          flexDirection={['column', 'column', 'row']} // col on mobile, row on md+
        >
          {/* Calendrier */}
          <Box
            flex="2"
            border="1px solid #2c7a7b"
            borderRadius={8}
            p={3}
            width="100%" // s'assure prise pleine largeur sur mobile
            maxW={['100%', '100%', '600px']} // max width sur desktop
          >
            <Flex justify="space-between" align="center" mb={2}>
              <HStack>
                <IconButton aria-label="prev" onClick={() => setMonthOffset((o) => o - 1)} size="sm">
                  <SlArrowLeft />
                </IconButton>
                <Text fontWeight="bold" fontSize="md">
                  {currentMonthBase.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <IconButton aria-label="next" onClick={() => setMonthOffset((o) => o + 1)} size="sm">
                  <SlArrowRight />
                </IconButton>
              </HStack>

              <Select
                size="sm"
                w="150px"
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="all">Tous types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Flex>

            <Box
              display="grid"
              gridTemplateColumns="repeat(7,1fr)"
              gap={1}
              mb={3}
              overflowX="auto" // pour éviter débordement horizontal sur mobile
            >
              {["D", "L", "M", "M", "J", "V", "S"].map((d) => (
                <Box key={d} textAlign="center" fontWeight="bold" fontSize="xs">
                  {d}
                </Box>
              ))}

              {(() => {
                const startWeekday = new Date(currentMonthBase.getFullYear(), currentMonthBase.getMonth(), 1).getDay();
                return new Array(startWeekday).fill(0).map((_, i) => <Box key={`b-${i}`} />);
              })()}

              {daysInMonthGrid.map((d) => {
                const key = d.toISOString().slice(0, 10);
                const events = calendarDays[key] || [];
                return (
                  <Box
                    key={key}
                    textAlign="center"
                    p={1}
                    borderRadius={4}
                    cursor="pointer"
                    onClick={() => setSelectedDate(new Date(d))}
                    _hover={{ bg: "#014241" }}
                  >
                    <Text fontSize="xs">{d.getDate()}</Text>
                    <Flex justify="center" flexWrap="wrap" gap={0.5} mt={1}>
                      {events.slice(0, 4).map((ev: any, i: number) => {
                        const color = ev.cfg?.color || (ev.rules.hashtag ? rulesCfg[ev.rules.hashtag]?.color : null) || "#3182ce";
                        return <Box key={i} w={2} h={2} borderRadius="50%" bg={color} />;
                      })}
                    </Flex>
                  </Box>
                );
              })}
            </Box>

            <Divider my={3} />
            <Stack direction="row" spacing={3} wrap="wrap">
              {Object.entries(rulesCfg).map(([hashtag, cfg]: any) => (
                <HStack key={hashtag} spacing={2}>
                  <Box w={3} h={3} borderRadius="50%" bg={cfg?.color || "#ccc"} />
                  <Text fontSize="xs" color="#cfecec">
                    {cfg?.type || cfg?.label || hashtag}
                  </Text>
                </HStack>
              ))}
            </Stack>
          </Box>

        {/* details / day list */}
        <Box flex="3">
        <SimpleGrid minChildWidth="300px" gap={4}>

          <Flex mb={4} align="center" justify="space-between">
          <VStack>
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                {selectedDate
                  ? selectedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
                  : "Sélectionnez une date"}
              </Text>
              <Text fontSize="sm" color="#99b">
                {selectedDate ? (calendarDays[new Date(selectedDate).toISOString().slice(0, 10)] || []).length : enriched.length} ateliers
              </Text>
            </Box>

            <Box>
              <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} width="220px" mr={2}>
                <option value="all">Tous types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>

              <Select value={filters.splitAddress} onChange={(e) => setFilters((f) => ({ ...f, splitAddress: e.target.value }))} width="260px" mt={2}>
                <option value="all">Tous les formateurs</option>
                {availableSplitAddresses.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Box>
            </VStack>
          </Flex>

          <Box>
            {selectedDate ? (
              (() => {
                const key = new Date(selectedDate).toISOString().slice(0, 10);
                const dayEvents = (calendarDays[key] || [])
                  .filter((e: any) => {
                    if (filters.upcomingOnly && e.rules.datetime && (e.rules.datetime as Date).getTime() <= Date.now()) return false;
                    if (filters.type !== "all" && (e.rules.type || e.cfg?.type) !== filters.type) return false;
                    if (filters.splitAddress !== "all" && (e.rules.splitAddress || e.cfg?.splitAddress || "") !== filters.splitAddress) return false;
                    return true;
                  })
                  .sort((a: any, b: any) => (a.rules.datetime?.getTime() || 0) - (b.rules.datetime?.getTime() || 0));

                if (dayEvents.length === 0) return <Text color="#999">Aucun atelier ce jour-là.</Text>;

                return dayEvents.map((entry: any) => {
                  const { raw: msg, rules, cfg } = entry;
                  const isFuture = !!rules.datetime && (rules.datetime as Date).getTime() > Date.now();
                  const open = !!openPanels[msg.id];
                  //const leftColor = cfg?.color || (rules.hashtag ? rulesCfg[rules.hashtag]?.color : null) || "#2c7a7b";
                  const hashtagKey = rules.hashtag?.startsWith("#")
                    ? rules.hashtag
                    : `#${rules.hashtag ?? ""}`;

                    const leftColor =
                      cfg?.color ||
                      (rulesCfg && Object.keys(rulesCfg).length > 0
                        ? (hashtagKey && rulesCfg?.[hashtagKey]?.color)
                        : null) ||
                      "#2c7a7b";


                  console.log("🎨 leftColor:", leftColor, "for", hashtagKey);
                  const onChain = onChainDataByMsgId[msg.id];

                  return (
                    <Flex key={msg.id} border="1px solid #333" borderRadius="12px" overflow="hidden" mb={4} bg={isFuture ? "#023537" : "#2d2d2d"} color="#fff">
                      <Box w="6px" bg={leftColor} />
                      <Box flex="1" p={4}>
                        <Flex align="center" mb={2}>
                          <Box flex="1">
                            <Text fontWeight="bold">{rules.title || cfg?.title || rules.description?.slice(0, 60) || "Atelier sans titre"}</Text>
                            <Text fontSize="sm" color="#a7d7d7">{entry.hashtag || (cfg?.label || cfg?.hashtag)}</Text>
                            {cfg?.type && <Text fontSize="xs" color={leftColor}>{cfg.type}</Text>}
                          </Box>

                          <Box textAlign="right">
                            <Text fontSize="sm" color="#cfecec">{rules.datetime ? (rules.datetime as Date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Heure non définie"}</Text>
                            <Text fontSize="xs" color="#9dd">{rules.splitAddress || cfg?.splitAddress || "Formateur non défini"}</Text>
                          </Box>
                        </Flex>

                        <Collapse in={open} animateOpacity>
                          <Box whiteSpace="pre-wrap" mb={3} bg="#014241" p={3} borderRadius={6}>
                            {rules.description || cfg?.description || msg.content.split("\n").filter((line: string) => !line.startsWith("/")).join("\n")}
                          </Box>

                          <Box fontSize="sm" mb={3}>
                            <strong>Prix :</strong> {(rules.price ?? cfg?.price) ? `${rules.price ?? cfg?.price} ETH` : "Non défini"} <br />
                            <strong>Places :</strong> {rules.maxEditions ?? cfg?.maxEditions ?? "Illimité"} <br />
                            <strong>Durée :</strong> {rules.dureeAtelier ?? cfg?.defaultDuration ?? "Non précisée"} <br />
                            {rules.splitAddress && <><strong>Adresse du formateur :</strong> {rules.splitAddress}<br /></>}
                          </Box>

                          {/* On-chain box */}
                          <Box mb={3} p={3} borderRadius={6} bg="#071f1f" fontSize="sm">
                            <Text fontWeight="bold" mb={2}>Synthèse mint (on-chain)</Text>

                            { !onChain ? (
                              <Flex align="center" gap={2}><Spinner size="xs" /><Text fontSize="sm">Chargement données on-chain...</Text></Flex>
                            ) : !onChain.exists ? (
                              <Text fontSize="sm">Aucun haiku minté pour ce message (pas encore minté on-chain).</Text>
                            ) : (
                              <>
                                <Text>haikuId: <strong>{onChain.haikuId}</strong></Text>
                                <Text>firstTokenId: <strong>{onChain.firstTokenId ?? "—"}</strong></Text>
                                <Text>places totales (chain) : <strong>{onChain.totalEditions ?? "-"}</strong></Text>
                                <Text>places restantes : <strong>{onChain.remaining ?? "-"}</strong></Text>
                                <Text>prix (on-chain wei) : <strong>{onChain.currentPriceWei ?? "-"}</strong></Text>
                                {onChain.parsedImageUrl ? (
                                  <Box mt={2}>
                                    <Text fontWeight="bold" mb={1}>Image associée :</Text>
                                    <Image src={onChain.parsedImageUrl} alt="atelier image" maxH="260px" borderRadius="8px" objectFit="contain" />
                                  </Box>
                                ) : (
                                  // If no image on-chain but attachment found in discord message, show that
                                  (msg.attachments?.[0]?.url) && (
                                    <Box mt={2}>
                                      <Text fontWeight="bold" mb={1}>Image (Discord attachment) :</Text>
                                      <Image src={msg.attachments[0].url} alt="attachment" maxH="260px" borderRadius="8px" objectFit="contain" />
                                    </Box>
                                  )
                                )}
                              </>
                            )}
                          </Box>
                        </Collapse>

                        <Flex gap={3}>
                          <Button size="sm" colorScheme="teal" onClick={() => mintAtelierTicket(entry)} isLoading={mintingIds.includes(msg.id)}>
                            Réserver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => togglePanel(msg.id)}>{open ? "Fermer les détails" : "Voir les détails"}</Button>
                        </Flex>
                      </Box>
                    </Flex>
                  );
                });
              })()
            ) : (
              <Text color="#777">Sélectionne une date dans le calendrier pour voir les ateliers du jour.</Text>
            )}

          </Box>

          </SimpleGrid>

        </Box>
      </Flex>

      <Divider my={8} />

    </Box>
  );
};

export default AteliersCalendarView; // L'export se fait ici
