// src/components/containers/association/Formations/Ateliers.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  Badge,
} from "@chakra-ui/react";
import { SlArrowRight, SlArrowLeft } from "react-icons/sl";
import Web3 from "web3";
import MessageEditions from "../../../ABI/MessageEditions.json";

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

interface AtelierRulesParsed {
  price?: number | null;
  maxEditions?: number | null;
  dureeAtelier?: string | null;
  datetime?: Date | null;
  splitAddress?: string | null;
  description?: string | null;
  hashtag?: string | null;
  title?: string | null;
  type?: string | null;
}

const CONTRACT_ADDRESS = "0x65abd40953Bb7BF88e188d158ae171835825bbd0";

// ---------- Helpers améliorés ----------
const extractHashtags = (content: string): string[] => {
  const matches = content.match(/#([\w-]+)/g);
  return matches ? matches.map((s) => s.trim()) : [];
};

// accepte "27/10/2025 à 15h30", "27/10/2025 15:30", "2025-10-27 15:30", "2025-10-27T15:30"
const extractDateTimeFromText = (text: string): Date | null => {
  if (!text) return null;
  // dd/mm/yyyy
  const rFR = text.match(/(\b\d{1,2}\/\d{1,2}\/\d{4}\b)(?:\s*[à@]?\s*(\d{1,2}[:h]\d{2}))?/i);
  if (rFR) {
    const [_, datePart, timePart] = rFR;
    const parts = datePart.split("/");
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    let hhmm = "00:00";
    if (timePart) {
      // time may be "15h30" or "15:30"
      const t = timePart.replace("h", ":");
      hhmm = t.includes(":") ? t : `${t}:00`;
    }
    const iso = `${year}-${month}-${day}T${hhmm}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  // iso style yyyy-mm-dd
  const rISO = text.match(/(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (rISO) {
    const datePart = rISO[1];
    const timePart = rISO[2] || "00:00";
    const iso = `${datePart}T${timePart}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// extract price: "0.001ETH" "0.001 ETH" or "/prix 0.001"
const extractPrice = (text: string): number | null => {
  if (!text) return null;
  const rEth = text.match(/(\d+(?:\.\d+)?)(?:\s*)?(?:eth)\b/i);
  if (rEth) return parseFloat(rEth[1]);
  const rCmd = text.match(/\/prix\s+(\d+(?:\.\d+)?)/i);
  if (rCmd) return parseFloat(rCmd[1]);
  return null;
};

// extract places: "10 places" or "/places 10"
const extractPlaces = (text: string): number | null => {
  if (!text) return null;
  const r = text.match(/(\d+)\s+places\b/i);
  if (r) return parseInt(r[1], 10);
  const rCmd = text.match(/\/places\s+(\d+)/i);
  if (rCmd) return parseInt(rCmd[1], 10);
  return null;
};

const extractSplit = (text: string): string | null => {
  if (!text) return null;
  const r = text.match(/(0x[a-fA-F0-9]{40})/);
  return r ? r[1] : null;
};

const extractDurationHuman = (text: string): string | null => {
  if (!text) return null;
  const r = text.match(/(\d+\s*(?:h|heure|heures|m|min))/i);
  return r ? r[1] : null;
};

const sanitizeDescription = (text: string) =>
  text
    .replace(/#([\w-]+)/g, "")
    .replace(/\/(prix|places|duree|datetime|split|description)\s*[^\n]*/gi, "")
    .trim();

// compute mint duration
const computeMintDurationSeconds = (messageTimestamp: number, atelierDate?: Date | null) => {
  if (!atelierDate) return 7 * 24 * 3600;
  const atelierTs = Math.floor(atelierDate.getTime() / 1000);
  return atelierTs > messageTimestamp ? atelierTs - messageTimestamp : 7 * 24 * 3600;
};

// check keywords
const isAtelierKeyword = (content: string) => {
  if (!content) return false;
  const low = content.toLowerCase();
  return /atelier|formation|stage|cours/.test(low);
};
// ---------- end helpers ----------

const Ateliers: React.FC = () => {
  const toast = useToast();

  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [rulesCfg, setRulesCfg] = useState<Record<string, any>>({});
  const [authorAddressMap, setAuthorAddressMap] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(50);

  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [filters, setFilters] = useState({ type: "all", splitAddress: "all", upcomingOnly: true });

  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  const channelId = "1430956664936468540";

  // fetch
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [rulesRes, mapRes] = await Promise.all([
          fetch("/api/ateliers.json"),
          fetch("/api/discord-author-addresses"),
        ]);
        const rulesJson = rulesRes.ok ? await rulesRes.json() : {};
        const mapJson = mapRes.ok ? await mapRes.json() : {};
        setRulesCfg(rulesJson || {});
        setAuthorAddressMap(mapJson || {});
      } catch (err) {
        console.error(err);
        toast({ title: "Erreur chargement configs", status: "warning", duration: 4000, isClosable: true });
      }
    };

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/channel/${channelId}?limit=${limit}`);
        const data = await res.json();
        const messagesArray = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
        setMessages(messagesArray);
      } catch (err) {
        console.error(err);
        toast({ title: "Erreur de chargement des ateliers", status: "error", duration: 4000, isClosable: true });
      }
    };

    fetchConfigs();
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // parse message to rules (message > JSON)
  const parseMessageToRules = (msg: DiscordMessage): AtelierRulesParsed | null => {
    const text = msg.content || "";
    const tags = extractHashtags(text); // ['#peinture', ...]
    const hasKnownTag = tags.some((t) => Object.prototype.hasOwnProperty.call(rulesCfg, t));
    if (!hasKnownTag && !isAtelierKeyword(text)) return null;

    const chosenTag = tags.find((t) => Object.prototype.hasOwnProperty.call(rulesCfg, t)) || tags[0] || null;
    const cfg = chosenTag ? rulesCfg[chosenTag] : null;

    // extracted fields (support french formats)
    const datetime = extractDateTimeFromText(text) ?? null;
    const price = extractPrice(text) ?? (cfg ? cfg.price ?? null : null);
    const maxEditions = extractPlaces(text) ?? (cfg ? cfg.maxEditions ?? null : null);
    const durationHuman = extractDurationHuman(text) ?? (cfg ? cfg.defaultDuration ?? null : null);
    const split = extractSplit(text) ?? (cfg ? cfg.splitAddress ?? null : null);
    const description = sanitizeDescription(text) || cfg?.description || null;
    const title = cfg?.title ?? cfg?.label ?? null;
    const type = cfg?.type ?? null;

    const parsed: AtelierRulesParsed = {
      title,
      price,
      maxEditions,
      dureeAtelier: durationHuman,
      datetime,
      splitAddress: split,
      description,
      hashtag: chosenTag,
      type,
    };

    // ensure that if type exists in cfg we populate rules.type so filters work
    if (!parsed.type && cfg?.type) parsed.type = cfg.type;

    return parsed;
  };

  // enriched list
  const enriched = useMemo(() => {
    const now = Date.now();
    const arr = messages
      .map((m) => {
        const parsed = parseMessageToRules(m);
        if (!parsed) return null;
        return {
          raw: m,
          rules: parsed,
          cfg: parsed.hashtag ? rulesCfg[parsed.hashtag] ?? null : null,
          hashtag: parsed.hashtag,
          messageTimestamp: Math.floor(new Date(m.timestamp).getTime() / 1000),
        };
      })
      .filter(Boolean) as any[];

    // ensure rules.type is set from cfg when missing
    arr.forEach((e) => {
      if (!e.rules.type && e.cfg?.type) e.rules.type = e.cfg.type;
    });

    // sort by datetime
    arr.sort((a, b) => {
      const ta = a.rules.datetime ? (a.rules.datetime as Date).getTime() : Infinity;
      const tb = b.rules.datetime ? (b.rules.datetime as Date).getTime() : Infinity;
      return ta - tb;
    });

    // filter to future by default (unless showPast true)
    return arr.filter((e) => {
      const dt = e.rules.datetime;
      if (!dt) return false;
      if (!showPast && dt.getTime() <= now) return false;
      return true;
    });
  }, [messages, rulesCfg, showPast]);

  // calendar map
  const calendarDays = useMemo(() => {
    const map: Record<string, any[]> = {};
    enriched.forEach((e) => {
      const d = e.rules.datetime ? new Date(e.rules.datetime.getTime()) : null;
      if (!d) return;
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [enriched]);

  // filteredByDate
  const filteredByDate = useMemo(() => {
    if (!selectedDate) return enriched;
    const sel = new Date(selectedDate);
    sel.setHours(0, 0, 0, 0);
    const key = sel.toISOString().slice(0, 10);
    const list = (calendarDays[key] || []).slice().sort((a: any, b: any) => {
      const ta = a.rules.datetime ? (a.rules.datetime as Date).getTime() : 0;
      const tb = b.rules.datetime ? (b.rules.datetime as Date).getTime() : 0;
      return ta - tb;
    });
    return list.filter((entry: any) => {
      if (filters.upcomingOnly && entry.rules.datetime && entry.rules.datetime.getTime() <= Date.now()) return false;
      if (filters.type !== "all" && (entry.rules.type || entry.cfg?.type) !== filters.type) return false;
      if (filters.splitAddress !== "all" && (entry.rules.splitAddress || entry.cfg?.splitAddress || "") !== filters.splitAddress) return false;
      return true;
    });
  }, [selectedDate, calendarDays, filters, enriched]);

  // available types (merge JSON + enriched)
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    Object.values(rulesCfg || {}).forEach((c: any) => { if (c?.type) set.add(c.type); });
    enriched.forEach((e) => { if (e.rules?.type) set.add(e.rules.type); });
    return Array.from(set);
  }, [rulesCfg, enriched]);

  const availableSplitAddresses = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((e) => {
      const addr = e.rules.splitAddress ?? e.cfg?.splitAddress ?? null;
      if (addr) set.add(addr);
    });
    return Array.from(set);
  }, [enriched]);

  // month helpers
  const currentMonthBase = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const daysInMonthGrid = useMemo(() => {
    const start = new Date(currentMonthBase.getFullYear(), currentMonthBase.getMonth(), 1);
    const end = new Date(currentMonthBase.getFullYear(), currentMonthBase.getMonth() + 1, 0);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return days;
  }, [currentMonthBase]);

  // toggle maps
  const togglePanel = (id: string) => setOpenPanels((p) => ({ ...p, [id]: !p[id] }));
  const toggleDetails = (id: string) => setOpenDetails((p) => ({ ...p, [id]: !p[id] }));

  // mint (kept behavior, but uses fallbacks properly)
  const mintAtelierTicket = async (entry: any) => {
    const { raw: msg, rules, cfg } = entry;
    if (!(window as any).ethereum) {
      toast({ title: "Wallet non détecté", status: "error", duration: 4000, isClosable: true });
      return;
    }
    const authorAddr = authorAddressMap[msg.author.id];
    const cfgSplit = cfg?.splitAddress ?? null;
    const splitAddress = rules.splitAddress || authorAddr || cfgSplit || null;
    if (!splitAddress) {
      toast({ title: "Adresse de split manquante", description: "Le formateur doit posséder une adresse ETH (via message ou mapping)", status: "error", duration: 6000, isClosable: true });
      return;
    }
    try {
      setMintingIds((prev) => [...prev, msg.id]);
      const ethereum = (window as any).ethereum;
      await ethereum.request({ method: "eth_requestAccounts" });
      const web3 = new Web3(ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      const contract = new web3.eth.Contract((MessageEditions as any).abi ?? MessageEditions, CONTRACT_ADDRESS);
      const keccak = web3.utils.soliditySha3({ type: "string", value: msg.id }) as string | null;
      if (!keccak) throw new Error("Impossible de calculer le keccak du message id");
      const priceInEth = rules.price ?? cfg?.price ?? 0.001;
      const priceInWei = web3.utils.toWei(priceInEth.toString(), "ether");
      const maxEditions = rules.maxEditions ?? cfg?.maxEditions ?? 10;
      const isOpenEdition = maxEditions === 0;
      const messageTimestamp = entry.messageTimestamp;
      const mintDurationSeconds = computeMintDurationSeconds(messageTimestamp, rules.datetime);
      const imageUrl = msg.attachments?.[0]?.url || "";
      const gasEstimate = await contract.methods
        .mint(
          keccak,
          rules.description || msg.content,
          priceInWei,
          splitAddress,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          maxEditions,
          isOpenEdition
        )
        .estimateGas({ from: account, value: priceInWei });
      await contract.methods
        .mint(
          keccak,
          rules.description || msg.content,
          priceInWei,
          splitAddress,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          maxEditions,
          isOpenEdition
        )
        .send({ from: account, value: priceInWei, gas: gasEstimate.toString() });
      toast({ title: "Ticket réservé", description: `Atelier minté avec succès !`, status: "success", duration: 4000, isClosable: true });
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({ title: "Erreur mint", description: err?.message || "Erreur inconnue", status: "error", duration: 6000, isClosable: true });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };

  // ---------- UI ----------
  return (
    <Box maxW="1100px" mx="auto" p={4}>
      <Flex mb={4} alignItems="center" justify="space-between">
        <Heading fontSize="2xl">Ateliers & Formations</Heading>
        <Box>
          <Text as="span" mr={2}>Afficher ateliers passés</Text>
          <Switch isChecked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
        </Box>
      </Flex>

      <Flex gap={6}>
        {/* calendar */}
        <Box flex="2" border="1px solid #2c7a7b" borderRadius={8} p={3}>
          <Flex justify="space-between" align="center" mb={2}>
            <HStack>
              <IconButton aria-label="prev" onClick={() => setMonthOffset((o) => o - 1)} size="sm"><SlArrowLeft /></IconButton>
              <Text fontWeight="bold" fontSize="md">{currentMonthBase.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
              <IconButton aria-label="next" onClick={() => setMonthOffset((o) => o + 1)} size="sm"><SlArrowRight /></IconButton>
            </HStack>
            <Box />
          </Flex>

          <Box display="grid" gridTemplateColumns="repeat(7,1fr)" gap={1}>
            {['D','L','M','M','J','V','S'].map((d) => <Box key={d} textAlign="center" fontWeight="bold" fontSize="xs">{d}</Box>)}
            {(() => { const startWeekday = new Date(currentMonthBase.getFullYear(), currentMonthBase.getMonth(), 1).getDay(); return new Array(startWeekday).fill(0).map((_, i) => <Box key={`b-${i}`} />); })()}
            {daysInMonthGrid.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const events = calendarDays[key] || [];
              return (
                <Box key={key} textAlign="center" p={1} borderRadius={4} cursor="pointer" onClick={() => setSelectedDate(new Date(d))} _hover={{ bg: '#014241' }}>
                  <Text fontSize="xs">{d.getDate()}</Text>
                  <Flex justify="center" flexWrap="wrap" gap={0.5} mt={1}>
                    {events.slice(0,4).map((ev: any, i:number) => {
                      const color = ev.cfg?.color || (ev.rules.hashtag ? rulesCfg[ev.rules.hashtag]?.color : null) || '#3182ce';
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
                <Text fontSize="xs" color="#cfecec">{cfg?.type || cfg?.label || hashtag}</Text>
              </HStack>
            ))}
          </Stack>
        </Box>

        {/* details */}
        <Box flex="3">
          <Flex mb={4} align="center" justify="space-between">
            <Box>
              <Text fontSize="lg" fontWeight="bold">{selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' }) : 'Sélectionnez une date'}</Text>
              <Text fontSize="sm" color="#99b">{selectedDate ? (calendarDays[new Date(selectedDate).toISOString().slice(0,10)] || []).length : enriched.length} ateliers</Text>
            </Box>

            <Box>
              <Select value={filters.type} onChange={(e) => setFilters((f)=>({...f, type: e.target.value}))} width="220px" mr={2}>
                <option value="all">Tous types</option>
                {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>

              <Select value={filters.splitAddress} onChange={(e) => setFilters((f)=>({...f, splitAddress: e.target.value}))} width="260px" mt={2}>
                <option value="all">Tous les formateurs</option>
                {availableSplitAddresses.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </Box>
          </Flex>

          <Box>
            {selectedDate ? (() => {
              const key = new Date(selectedDate).toISOString().slice(0,10);
              const dayEvents = (calendarDays[key] || []).filter((e:any) => {
                if (filters.upcomingOnly && e.rules.datetime && (e.rules.datetime as Date).getTime() <= Date.now()) return false;
                if (filters.type !== "all" && (e.rules.type || e.cfg?.type) !== filters.type) return false;
                if (filters.splitAddress !== "all" && (e.rules.splitAddress || e.cfg?.splitAddress || "") !== filters.splitAddress) return false;
                return true;
              }).sort((a:any,b:any)=> (a.rules.datetime?.getTime()||0) - (b.rules.datetime?.getTime()||0));

              if (dayEvents.length === 0) return <Text color="#999">Aucun atelier ce jour-là.</Text>;

              return dayEvents.map((entry:any) => {
                const { raw: msg, rules, cfg } = entry;
                const isFuture = !!rules.datetime && (rules.datetime as Date).getTime() > Date.now();
                const open = !!openPanels[msg.id];
                const leftColor = cfg?.color || (rules.hashtag ? rulesCfg[rules.hashtag]?.color : null) || "#2c7a7b";

                return (
                  <Flex key={msg.id} border="1px solid #333" borderRadius="12px" overflow="hidden" mb={4} bg={isFuture ? "#023537" : "#2d2d2d"} color="#fff">
                    <Box w="6px" bg={leftColor} />
                    <Box flex="1" p={4}>
                      <Flex align="center" mb={2}>
                        <Box flex="1">
                          <Text fontWeight="bold">{rules.title || cfg?.title || rules.description?.slice(0,60) || "Atelier sans titre"}</Text>
                          <Text fontSize="sm" color="#a7d7d7">{entry.hashtag || (cfg?.label || cfg?.hashtag)}</Text>
                          {cfg?.type && <Text fontSize="xs" color={leftColor}>{cfg.type}</Text>}
                        </Box>
                        <Box textAlign="right">
                          <Text fontSize="sm" color="#cfecec">{rules.datetime ? (rules.datetime as Date).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit'}) : "Heure non définie"}</Text>
                          <Text fontSize="xs" color="#9dd">{rules.splitAddress || cfg?.splitAddress || "Formateur non défini"}</Text>
                        </Box>
                      </Flex>

                      <Collapse in={open} animateOpacity>
                        <Box whiteSpace="pre-wrap" mb={3} bg="#014241" p={3} borderRadius={6}>
                        {rules.description ||
                          cfg?.description ||
                          msg.content
                            .split("\n")
                            .filter((line: string) => !line.startsWith("/"))
                            .join("\n")}
                          </Box>

                        <Box fontSize="sm" mb={3}>
                          <strong>Prix :</strong> {(rules.price ?? cfg?.price) ? `${rules.price ?? cfg?.price} ETH` : "Non défini"} <br />
                          <strong>Places :</strong> {rules.maxEditions ?? cfg?.maxEditions ?? "Illimité"} <br />
                          <strong>Durée :</strong> {rules.dureeAtelier ?? cfg?.defaultDuration ?? "Non précisée"} <br />
                          {rules.splitAddress && <><strong>Adresse du formateur :</strong> {rules.splitAddress}<br /></>}
                        </Box>

                        <Box mb={3} p={3} borderRadius={6} bg="#071f1f" fontSize="sm">
                          <Text fontWeight="bold" mb={2}>Synthèse mint</Text>
                          <Text>messageIdDiscord: <em>{msg.id}</em></Text>
                          <Text>pricePerEdition: {rules.price ?? cfg?.price ?? 0.001} ETH</Text>
                          <Text>salonRoyaltyAddress: {rules.splitAddress ?? cfg?.splitAddress ?? 'MANQUANTE'}</Text>
                          <Text>messageTimestamp: {entry.messageTimestamp}</Text>
                          <Text>mintDurationSeconds: {computeMintDurationSeconds(entry.messageTimestamp, rules.datetime)}</Text>
                        </Box>
                      </Collapse>

                      <Flex gap={3}>
                        <Button size="sm" colorScheme="teal" onClick={() => mintAtelierTicket(entry)} isLoading={mintingIds.includes(msg.id)}>Réserver</Button>
                        <Button size="sm" variant="outline" onClick={() => togglePanel(msg.id)}>{open ? "Fermer les détails" : "Voir les détails"}</Button>
                      </Flex>
                    </Box>
                  </Flex>
                );
              });
            })() : (
              <Text color="#777">Sélectionne une date dans le calendrier pour voir les ateliers du jour.</Text>
            )}
          </Box>
        </Box>
      </Flex>

      <Divider my={8} />

      <Box my={4}>
        <Heading as="span" mr={2} fontSize="2xl">Toutes les formations & ateliers</Heading>

        <Flex mt={3} gap={3} flexWrap="wrap">
          <Select width="220px" value={filters.type} onChange={(e)=>setFilters({...filters, type: e.target.value})}>
            <option value="all">Tous les types</option>
            {availableTypes.map((t)=> <option key={t} value={t}>{t}</option>)}
          </Select>

          <Select width="260px" value={filters.splitAddress} onChange={(e)=>setFilters({...filters, splitAddress: e.target.value})}>
            <option value="all">Tous les formateurs</option>
            {availableSplitAddresses.map((addr)=> <option key={addr} value={addr}>{addr}</option>)}
          </Select>

          <Checkbox isChecked={filters.upcomingOnly} onChange={(e)=>setFilters({...filters, upcomingOnly: e.target.checked})}>N’afficher que les ateliers à venir</Checkbox>
        </Flex>
      </Box>

      <Box mt={6}>
        {enriched
          .filter((entry)=> {
            if (filters.upcomingOnly && entry.rules.datetime && entry.rules.datetime.getTime() <= Date.now()) return false;
            if (filters.type !== "all" && (entry.rules.type || entry.cfg?.type) !== filters.type) return false;
            if (filters.splitAddress !== "all" && (entry.rules.splitAddress || entry.cfg?.splitAddress || "") !== filters.splitAddress) return false;
            return true;
          })
          .map((entry)=> {
            const { raw: msg, rules, cfg } = entry;
            const isFuture = !!rules.datetime && (rules.datetime as Date).getTime() > Date.now();
            const open = !!openDetails[msg.id];
            const leftColor = cfg?.color || (rules.hashtag ? rulesCfg[rules.hashtag]?.color : null) || "#2c7a7b";

            return (
              <Flex key={msg.id} border="1px solid #333" borderRadius="12px" overflow="hidden" mb={4} bg={isFuture? "#023537":"#2d2d2d"} color="#fff">
                <Box w="6px" bg={leftColor} />
                <Box flex="1" p={4}>
                  <Flex align="center" mb={2}>
                    <Box flex="1">
                      <Text fontWeight="bold" fontSize="lg">{rules.title || cfg?.title || "Atelier sans titre"}</Text>
                      <Text fontSize="sm" color="#a7d7d7">{entry.hashtag || cfg?.label}</Text>
                      {cfg?.type && <Text fontSize="xs" color={leftColor}>{cfg.type}</Text>}
                    </Box>
                    <Box textAlign="right">
                      <Text fontSize="sm" color="#cfecec">{rules.datetime ? (rules.datetime as Date).toLocaleString() : "Date non définie"}</Text>
                      <Text fontSize="xs" color="#9dd">{rules.splitAddress || cfg?.splitAddress || "Formateur non défini"}</Text>
                    </Box>
                  </Flex>

                  <Text mb={3}>
                  {rules.description ||
                    cfg?.description ||
                    msg.content
                      .split("\n")
                      .filter((line: string) => !line.startsWith("/"))
                      .join("\n")}
                  </Text>

                  <Flex gap={3} mt={2}>
                    <Button size="sm" colorScheme="teal" onClick={()=>mintAtelierTicket(entry)} isLoading={mintingIds.includes(msg.id)}>Réserver un ticket</Button>
                    <Button size="sm" variant="outline" onClick={()=>toggleDetails(msg.id)}>{open ? "Masquer les détails" : "Afficher les détails"}</Button>
                  </Flex>

                  <Box mt={3}>
                    <Collapse in={open}>

                    <Box mt={3} p={3} bg="#071f1f" borderRadius={6} fontSize="sm">
                      <Text fontWeight="bold" mb={2}>Détails techniques du mint</Text>
                      <Text>messageIdDiscord: <em>{msg.id}</em></Text>
                      <Text>salonRoyaltyAddress: {rules.splitAddress ?? cfg?.splitAddress ?? 'MANQUANTE'}</Text>
                      <Text>messageTimestamp: {entry.messageTimestamp}</Text>
                      <Text>Durée de mint: {computeMintDurationSeconds(entry.messageTimestamp, rules.datetime)} sec</Text>
                      <Text>Image: {msg.attachments?.[0]?.url ? "✅ Oui" : "❌ Aucune"}</Text>

                      <Divider my={2} />
                      <Text fontWeight="bold" mb={1}>Contenu brut du message Discord :</Text>
                      <Box bg="#012" borderRadius={6} p={2} fontSize="xs" color="#9ed"><pre style={{whiteSpace:"pre-wrap"}}>{msg.content}</pre></Box>
                    </Box>
                  </Collapse>
                  </Box>

                </Box>
              </Flex>
            );
          })}
      </Box>
    </Box>
  );
};

export default Ateliers;
