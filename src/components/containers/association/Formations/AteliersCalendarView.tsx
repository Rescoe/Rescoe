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
import CopyableAddress from "@/hooks/useCopyableAddress";
import useEthToEur from "@/hooks/useEuro";
import { useAdherentFullData } from '@/hooks/useListAdherentData';
import CollectionsVignettes from '@/utils/CollectionsVignettes';



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

const { data: adherentData, loading: loadingAdherent, error: adherentError } = useAdherentFullData(availableSplitAddresses);

// juste après les imports
const TYPE_COLORS: Record<string, string> = {
  atelier: "#22C55E",     // vert
  appel: "#EAB308",       // jaune
  defi: "#3B82F6",        // bleu
  evenement: "#F97316",   // orange
  default: "#94A3B8"      // gris clair
};



// Fonction pour vérifier si un event s'étend sur plusieurs jours
const isMultiDay = (ev: any) => {
  if (!ev.rules.startDate || !ev.rules.endDate) return false;
  const start = new Date(ev.rules.startDate);
  const end = new Date(ev.rules.endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) >= 1;
};

const { ethPrice, loading: ethLoading, error: ethError } = useEthToEur();

  // ---------- UI render ----------
  return (
      <Box maxW="1200px" mx="auto" p={4}>
      <Flex
    mb={6}
    direction={['column', 'row']} // colonne sur mobile, ligne sur desktop
    align={['center', 'center']}
    justify="space-between"
    gap={4} // espace entre les éléments
  >
    {/* Titre principal */}
    <Heading fontSize={['xl', '2xl']}>Ateliers & Formations</Heading>

    {/* Date sélectionnée + nombre d’ateliers */}
    <Box textAlign={['center', 'center']}>
      <Heading fontSize={['lg', 'xl']} fontWeight="bold">
        {selectedDate
          ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
          : 'Sélectionnez une date'}
      </Heading>
      <Text fontSize="sm" color="#99b">
        {selectedDate
          ? (calendarDays[new Date(selectedDate).toISOString().slice(0, 10)] || []).length
          : enriched.length}{' '}
        ateliers
      </Text>
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

            {/* Calendrier */}
            <Box
              display="grid"
              gridTemplateColumns="repeat(7,1fr)"
              gap={1}
              mb={3}
              overflowX="auto"
            >
              {["D", "L", "Mar", "Mer", "J", "V", "S"].map((d) => (
                <Box key={d} textAlign="center" fontWeight="bold" fontSize="xs">{d}</Box>
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
                    {events.slice(0, 4).map((ev: any, i: number) => {
                      const type = ev.cfg?.type || ev.rules?.type;
                      const color = ev.cfg?.color || TYPE_COLORS[type] || TYPE_COLORS.default;
                      const multi = isMultiDay(ev);
                      return (
                        <Box
                          key={`${ev.raw?.id || i}-${type}`}
                          w={multi ? "100%" : 2}
                          h={multi ? "4px" : 2}
                          borderRadius={multi ? "4px" : "50%"}
                          bg={color}
                          mt={multi ? 0.5 : 0}
                        />
                      );
                    })}
                  </Box>
                );
              })}
            </Box>

            <Divider my={3} />

            {/* Légende dynamique avec couleurs exactes */}
            <Stack direction="row" spacing={3} wrap="wrap">

              {Object.values(
                daysInMonthGrid
                  .flatMap((d) => {
                    const key = d.toISOString().slice(0, 10);
                    const events = calendarDays[key] || [];
                    return events.map((ev: any) => {
                      const type = ev.cfg?.type || ev.rules?.type || "default";
                      const color =
                        ev.cfg?.color ||
                        (ev.rules?.hashtag ? rulesCfg[ev.rules.hashtag]?.color : null) ||
                        TYPE_COLORS[type] ||
                        TYPE_COLORS.default;
                      return { type, color };
                    });
                  })
                  .reduce((acc, curr) => {
                    // Ne garder que le premier event par type
                    if (!acc[curr.type]) acc[curr.type] = curr;
                    return acc;
                  }, {} as Record<string, { type: string; color: string }>)
              ).map(({ type, color }) => (
                <HStack key={type} spacing={2}>
                  <Box w={3} h={3} borderRadius="50%" bg={color} />
                  <Text fontSize="xs" color="#cfecec">{type}</Text>
                </HStack>
              ))}
            </Stack>


          </Box>

        {/* details / day list */}
        <Box flex="3">
        <SimpleGrid minChildWidth="300px" gap={4}>

        <Stack
          direction={['column', 'row']} // column sur mobile, row sur md+
          spacing={4}                  // espace entre les éléments
          mb={4}
          align="flex-start"
        >
          <Select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            width={['100%', '220px']} // plein largeur sur mobile, fixe sur desktop
          >
            <option value="all">Tous types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select
            value={filters.splitAddress}
            onChange={(e) => setFilters((f) => ({ ...f, splitAddress: e.target.value }))}
            width={['100%', '260px']}
          >
            <option value="all">Tous les formateurs</option>
            {adherentData &&
              Object.entries(adherentData).map(([address, data]: [string, any]) => (
                <option key={address} value={address}>
                  {data.name || address}
                </option>
              ))}
          </Select>

          {/* Switch pour afficher les ateliers passés */}
          <Flex justify ='right' textAlign='right'>
            <Text as="span" mr={2}>Ateliers passés</Text>
            <Switch isChecked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          </Flex>

        </Stack>

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
                  const hashtagKey = rules.hashtag?.startsWith("#")
                    ? rules.hashtag
                    : `#${rules.hashtag ?? ""}`;

                    const typeColor = cfg?.color || TYPE_COLORS[rules.type] || TYPE_COLORS.default;

                    const leftColor = typeColor;
                    const onChain = onChainDataByMsgId[msg.id];
                    const placesRes = onChain?.totalEditions || 0;
                    const placesDIspo =  rules.maxEditions - placesRes;



                    // Juste après const dayEvents = ...
const addresses = dayEvents
  .map((e: any) => e.rules?.splitAddress || e.cfg?.splitAddress)
  .filter((addr: any) => typeof addr === "string" && addr.startsWith("0x") && addr.length === 42);

  const priceEth = rules.price ?? cfg?.price;
  const priceEur = priceEth && ethPrice ? (priceEth * ethPrice).toFixed(2) : null;

  // récupération formateur + collections
  const addr = rules.splitAddress || cfg?.splitAddress;
  const adherent = addr ? adherentData?.[addr] : null;
  const collectionsArray = Array.isArray(adherent?.collections) ? adherent.collections : [];
  const lastCollections = [...collectionsArray.slice(-5)].reverse();

  console.log(lastCollections);
  return (
    <Flex
      key={`${msg.id}-${rules.datetime?.toISOString() || Math.random()}`}
      direction="column"
      border="1px solid #333"
      borderRadius="16px"
      borderColor={typeColor}
      overflow="hidden"
      mb={4}
      bg={isFuture ? "#" : "#2d2d2d"}
      _hover={{ transform: "scale(1.01)", transition: "0.2s" }}
    >
      <Box w="6px" mb={4} />
      <Text fontWeight="bold">{rules.title || cfg?.title || rules.description?.slice(0, 60) || "Atelier sans titre"}</Text>

      <Box flex="1" p={4}>
        <Flex align="center" mb={2}>
          <Box flex="1">
            <Text fontSize="sm">{entry.hashtag || (cfg?.label || cfg?.hashtag)}</Text>
            {cfg?.type && <Badge ml={2} backgroundColor={leftColor} color="#fff">{cfg.type}</Badge>}
          </Box>

          <Box textAlign="right">
            <Text fontSize="sm" color="#cfecec">{rules.datetime ? (rules.datetime as Date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Heure non définie"}</Text>
            <Badge
              fontSize="xs"
              color={typeColor}
            >
            {adherent?.name || addr || "Formateur non défini"}
          </Badge>
          <Flex mt={2} gap={2} wrap="wrap">
            {/* Affichez uniquement le composant CollectionsVignettes, sans boucle */}
            {adherent?.name && <CollectionsVignettes creator={addr} />}
          </Flex>
            <strong>Prix :</strong> {priceEur ? `${priceEur} €` : "—"} <br />
          </Box>
        </Flex>

{/*
                          <Box whiteSpace="pre-wrap" mb={3} bg="#014241" p={3} borderRadius={6}>
                            {rules.description || cfg?.description || msg.content.split("\n").filter((line: string) => !line.startsWith("/")).join("\n")}
                          </Box>
*/}

                          <Box bg="#012" borderRadius={6} p={2} fontSize="xs" color="#9ed"><pre style={{ whiteSpace: "pre-wrap" }}>{msg.content}</pre></Box>

                          <Divider my={8} />

                          <Collapse in={open} animateOpacity>

                          <Box fontSize="sm" mb={3}>

                            <strong>Equivalent :</strong> {(rules.price ?? cfg?.price) ? `${rules.price ?? cfg?.price} ETH` : "Non défini"} <br />

                            <strong>Places :</strong> { rules.maxEditions ?? cfg?.maxEditions ?? "Illimité"} <br />
                            <strong>Places déjà reservées :</strong> {placesRes} {placesRes === rules.maxEditions && <Badge colorScheme="red" ml={2}>Complet</Badge>} <br />

                            <strong>Places restantes :</strong> {placesDIspo} {placesDIspo === 0 && <Badge colorScheme="red" ml={2}>Complet</Badge>} <br />
                            <strong>Durée :</strong> {rules.dureeAtelier ?? cfg?.defaultDuration ?? "Non précisée"} <br />
                            {rules.splitAddress && <><strong>Formateur :</strong> {rules.splitAddress}<br /></>}
                            <Box mt={2}>
                              <Text fontWeight="bold" mb={1}>Image associée :</Text>
                              <Image
                                src={onChain?.parsedImageUrl || msg.attachments.url}
                                alt="atelier image"
                                maxH="260px"
                                borderRadius="8px"
                                objectFit="contain"
                                mx="auto"
                              />
                            </Box>
                            </Box>
                            </Collapse>


{/* On-chain box */}

{/*
<Collapse in={open} animateOpacity>

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
*/}

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
    </Box>
  );
};

export default AteliersCalendarView; // L'export se fait ici
