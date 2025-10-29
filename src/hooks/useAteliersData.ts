import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";

import Web3 from "web3";
import MessageEditions from "@/components/ABI/MessageEditions.json";

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string };
  timestamp: string; // ISO
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

// On-chain data we fetch per message (optional)
interface OnChainAtelierInfo {
  exists: boolean;
  haikuId?: string;
  firstTokenId?: number;
  totalEditions?: number; // totalEdition count
  remaining?: number; // remaining editions
  currentPriceWei?: string; // string wei
  tokenURI?: string;
  parsedImageUrl?: string;
  creator?: string;
  fetchedAt: number;
}

// CONTRACT: adjust to your deployed address (or keep the earlier one)
const CONTRACT_ADDRESS = "0x65abd40953Bb7BF88e188d158ae171835825bbd0";

// ---------- Helpers améliorés ----------
const extractHashtags = (content: string): string[] => {
  if (!content) return [];
  const matches = content.match(/#([\w-]+)/g);
  return matches ? matches.map((s) => s.trim()) : [];
};

const extractTitleFromText = (text: string): string | null => {
  if (!text) return null;
  const firstLine = text.trim().split("\n")[0];
  return firstLine?.trim() || null;
};

const extractTypeFromText = (text: string): string | null => {
  if (!text) return null;
  const typesList = ["atelier", "exposition", "expo", "formation", "stage", "conférence", "projection", "concert"];
  const lower = text.toLowerCase();
  const found = typesList.find((t) => lower.includes(t));
  return found || null;
};


// accepte "27/10/2025 à 15h30", "27/10/2025 15:30", "2025-10-27 15:30", "2025-10-27T15:30"
const extractDateTimeFromText = (text: string): Date | null => {
  if (!text) return null;
  // dd/mm/yyyy
  const rFR = text.match(/(\b\d{1,2}\/\d{1,2}\/\d{4}\b)(?:\s*[à@]?\s*(\d{1,2}[:h]\d{2}(?:\s?(?:am|pm))?))?/i);
  if (rFR) {
    const [_, datePart, timePart] = rFR;
    const parts = datePart.split("/");
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    let hhmm = "00:00";
    if (timePart) {
      let t = timePart.replace("h", ":").trim();
      // handle am/pm if present
      const pm = /pm$/i.test(t);
      t = t.replace(/\s?(am|pm)$/i, "");
      if (t.includes(":")) {
        let [hh, mm] = t.split(":");
        let hhNum = parseInt(hh, 10);
        if (pm && hhNum < 12) hhNum += 12;
        hh = String(hhNum).padStart(2, "0");
        hhmm = `${hh}:${mm}`;
      } else {
        hhmm = `${t}:00`;
      }
    }
    const iso = `${year}-${month}-${day}T${hhmm}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO style yyyy-mm-dd
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
  const rEth = text.match(/(\d+(?:[\.,]\d+)?)(?:\s*)?(?:eth)\b/i);
  if (rEth) return parseFloat(rEth[1].replace(",", "."));
  const rCmd = text.match(/\/prix\s+(\d+(?:[\.,]\d+)?)/i);
  if (rCmd) return parseFloat(rCmd[1].replace(",", "."));
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
  const r = text.match(/dur(é|e)e?\s*(?:de|:)?\s*(\d+\s*(?:h|heures?|m|min))/i);
  return r ? r[2].trim() : null;
};


const extractImageUrlFromText = (text: string): string | null => {
  if (!text) return null;
  // naive URL match for common image extensions
  const r = text.match(/(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp))/i);
  return r ? r[1] : null;
};

const sanitizeDescription = (text: string) =>
  (text || "")
    .replace(/#([\w-]+)/g, "")
    .replace(/\/(prix|places|duree|datetime|split|description)\s*[^\n]*/gi, "")
    .trim();

const computeMintDurationSeconds = (messageTimestamp: number, atelierDate?: Date | null) => {
  if (!atelierDate) return 7 * 24 * 3600;
  const atelierTs = Math.floor(atelierDate.getTime() / 1000);
  return atelierTs > messageTimestamp ? atelierTs - messageTimestamp : 7 * 24 * 3600;
};

const isAtelierKeyword = (content: string) => {
  if (!content) return false;
  const low = content.toLowerCase();
  return /atelier|formation|stage|cours|défi|expo|exposition|evenement/.test(low);
};

// helper to parse base64 tokenURI JSON
const parseTokenURIForImage = (tokenURI: string): string | null => {
  if (!tokenURI) return null;
  try {
    if (tokenURI.startsWith("data:application/json;base64,")) {
      const b64 = tokenURI.replace("data:application/json;base64,", "");
      const json = JSON.parse(atob(b64));
      return json.image || null;
    }
    // If tokenURI is a URL, we return it (some projects store image link directly)
    if (/^https?:\/\//.test(tokenURI)) {
      // tokenURI may be JSON url or direct image; we assume image for now.
      return tokenURI;
    }
    return null;
  } catch (err) {
    console.warn("parseTokenURIForImage failed", err);
    return null;
  }
};

// Récupère l'image la plus pertinente (Discord > on-chain > texte > null)
const getMessageImage = (msg: DiscordMessage, onChain?: OnChainAtelierInfo): string | null => {
  if (!msg) return null;

  // Cas 1 : attachements Discord (nouveau format tableau)
  if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
    return msg.attachments[0].url;
  }

  // Cas 2 : attachement unique (ancien format)
  if ((msg as any).attachments?.url) {
    return (msg as any).attachments.url;
  }

  // Cas 3 : lien d'image directement dans le texte du message
  const fromText = extractImageUrlFromText(msg.content);
  if (fromText) return fromText;

  // Cas 4 : image on-chain (NFT metadata)
  if (onChain?.parsedImageUrl) {
    // Gestion IPFS → gateway publique
    if (onChain.parsedImageUrl.startsWith("ipfs://")) {
      return onChain.parsedImageUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return onChain.parsedImageUrl;
  }

  // Cas 5 : aucune image trouvée
  return null;
};


const useAteliersData = () => {

  const toast = useToast();

  // local states
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [rulesCfg, setRulesCfg] = useState<Record<string, any>>({});
  const [authorAddressMap, setAuthorAddressMap] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState<number>(50);

  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const [showPast, setShowPast] = useState<boolean>(false);
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [filters, setFilters] = useState<{ type: string; splitAddress: string; upcomingOnly: boolean }>({
    type: "all",
    splitAddress: "all",
    upcomingOnly: true,
  });

  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});

  // On-chain cache map by messageId
  const [onChainDataByMsgId, setOnChainDataByMsgId] = useState<Record<string, OnChainAtelierInfo>>({});

  const channelId = "1430956664936468540";

  // web3 instance used for reading contract
  const [web3Instance, setWeb3Instance] = useState<Web3 | null>(null);
  const [contractInstance, setContractInstance] = useState<any>(null);

  // ----- fetch messages & JSON config -----
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [rulesRes, mapRes] = await Promise.all([fetch("/config/ateliers.json"), fetch("/api/discord-author-addresses")]);
        const rulesJson = rulesRes.ok ? await rulesRes.json() : {};

        const mapJson = mapRes.ok ? await mapRes.json() : {};
        setRulesCfg(rulesJson || {});
        setAuthorAddressMap(mapJson || {});
      } catch (err) {
        console.error("fetchConfigs error", err);
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
        console.error("Erreur fetch messages", err);
        toast({ title: "Erreur de chargement des ateliers", status: "error", duration: 4000, isClosable: true });
      }
    };

    fetchConfigs();
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // instantiate web3 and contract for reads
  useEffect(() => {
    try {
      const provider = (window as any).ethereum ? (window as any).ethereum : null;
      const w3 = new Web3(provider || Web3.givenProvider || "https://cloudflare-eth.com"); // fallback public provider
      setWeb3Instance(w3);
      const contract = new w3.eth.Contract((MessageEditions as any).abi ?? MessageEditions, CONTRACT_ADDRESS);
      setContractInstance(contract);
    } catch (err) {
      console.error("web3 init failed", err);
    }
  }, []);

  // ---------- parse message to rules (message > JSON) ----------
  const parseMessageToRules = useCallback(
  (msg: DiscordMessage): AtelierRulesParsed | null => {
    const text = msg.content || "";
    if (!text.trim()) return null;

    // --- Extraction des hashtags ---
    const tags = extractHashtags(text);
    const hasKnownTag = tags.some((t) => Object.prototype.hasOwnProperty.call(rulesCfg, t));

    // --- Vérifie si le message correspond à un mot-clé connu (atelier, expo, stage, etc.) ---
    const isRelevant = hasKnownTag || isAtelierKeyword(text);
    if (!isRelevant) return null;

    // --- Tag principal (s'il existe) ---
    const chosenTag = tags.find((t) => Object.prototype.hasOwnProperty.call(rulesCfg, t)) || tags[0] || null;

    // --- Type déduit depuis le contenu (atelier, exposition, conférence...) ---
    let type = extractTypeFromText(text);

    // --- Config associée au tag ---
    let cfg = chosenTag && rulesCfg[chosenTag] ? rulesCfg[chosenTag] : null;

    // --- Si le type est inconnu, on crée dynamiquement une config temporaire ---
    if (type && !Object.values(rulesCfg).some((c: any) => c?.type === type)) {
      cfg = {
        label: type.charAt(0).toUpperCase() + type.slice(1),
        type,
        price: null,
        maxEditions: null,
        splitAddress: null,
        defaultDurationHuman: null,
      };
    }

    // --- Extraction des données du message ---
    const datetime = extractDateTimeFromText(text) ?? null;
    const price = extractPrice(text) ?? cfg?.price ?? null;
    const maxEditions = extractPlaces(text) ?? cfg?.maxEditions ?? null;
    const durationHuman = extractDurationHuman(text) ?? cfg?.defaultDurationHuman ?? null;
    const split = extractSplit(text) ?? cfg?.splitAddress ?? null;
    const title = extractTitleFromText(text) ?? cfg?.label ?? cfg?.title ?? null;
    const description = sanitizeDescription(text) || cfg?.descriptionTemplate || cfg?.description || null;

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

    return parsed;
  },
  [rulesCfg]
);



  // ---------- enriched list (merge message + cfg rules) ----------
  const enriched = useMemo(() => {
    const now = Date.now();
    const arr = messages
      .map((m) => {
        const parsed = parseMessageToRules(m);
        if (!parsed) return null;
        const cfg = parsed.hashtag ? rulesCfg[parsed.hashtag] ?? null : null;
        return {
          raw: m,
          rules: parsed,
          cfg,
          hashtag: parsed.hashtag,
          messageTimestamp: Math.floor(new Date(m.timestamp).getTime() / 1000),
        };
      })
      .filter(Boolean) as any[];

    // fill types from cfg if missing
    arr.forEach((e) => {
      if (!e.rules.type && e.cfg?.type) e.rules.type = e.cfg.type;
    });

    // sort by datetime or put undated at the end
    arr.sort((a, b) => {
      const ta = a.rules.datetime ? (a.rules.datetime as Date).getTime() : Infinity;
      const tb = b.rules.datetime ? (b.rules.datetime as Date).getTime() : Infinity;
      return ta - tb;
    });

    // default filter to future unless showPast true
    return arr.filter((e) => {
      const dt = e.rules.datetime;
      if (!dt) return true; // keep undated (they'll be in "en création")
      if (!showPast && dt.getTime() <= now) return false;
      return true;
    });
  }, [messages, parseMessageToRules, rulesCfg, showPast]);

  // ---------- calendar map ----------
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

  // ---------- filteredByDate ----------
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

  // ---------- available filters data ----------
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    Object.values(rulesCfg || {}).forEach((c: any) => {
      if (c?.type) set.add(c.type);
      if (c?.label) set.add(c.label);
    });
    enriched.forEach((e) => {
      if (e.rules?.type) set.add(e.rules.type);
      if (e.cfg?.label) set.add(e.cfg.label);
    });
    return Array.from(set);
  }, [rulesCfg, enriched]);

  const availableSplitAddresses = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((e) => {
      const addr = e.rules.splitAddress ?? e.cfg?.splitAddress ?? null;
      if (addr) set.add(addr);
    });
    // also include authorAddressMap values
    Object.values(authorAddressMap || {}).forEach((a) => {
      if (a) set.add(a);
    });
    return Array.from(set);
  }, [enriched, authorAddressMap]);

  // ---------- month helpers ----------
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

  // ---------- on-chain helpers ----------
  const computeKeccakForMessageId = (web3: Web3, messageId: string): string | null => {
    try {
      // contract expects bytes32 of the message id string (like soliditySha3(string))
      const k = web3.utils.soliditySha3({ type: "string", value: messageId }) as string;
      return k || null;
    } catch (err) {
      console.error("computeKeccak error", err);
      return null;
    }
  };

  // fetch on-chain data for one entry
  const fetchOnChainForEntry = useCallback(
    async (entry: any): Promise<OnChainAtelierInfo | null> => {
      const web3 = web3Instance;
      const contract = contractInstance;
      if (!web3 || !contract) return null;

      const msgId = entry.raw.id;
      // prevent re-fetch if cached recent (30s)
      const cached = onChainDataByMsgId[msgId];
      if (cached && Date.now() - cached.fetchedAt < 30 * 1000) return cached;

      try {
        const keccak = computeKeccakForMessageId(web3, msgId);
        if (!keccak) return null;
        // messageIdToHaikuId returns uint256; mapping default 0 for not set
        const haikuIdRaw = await contract.methods.messageIdToHaikuId(keccak).call();
        const haikuId = typeof haikuIdRaw === "string" ? haikuIdRaw : String(haikuIdRaw);
        const exists = haikuIdRaw && haikuIdRaw !== "0";
        if (!exists) {
          const info: OnChainAtelierInfo = { exists: false, fetchedAt: Date.now() };
          setOnChainDataByMsgId((p) => ({ ...p, [msgId]: info }));
          return info;
        }

        // read getHaikuInfoUnique(uint256 haikuId)
        const haikuIdNum = Number(haikuIdRaw);
        const haikuInfo = await contract.methods.getHaikuInfoUnique(haikuIdNum).call();
        // returns (firstTokenId, editionsCount)
        const firstTokenId = parseInt(haikuInfo.firstTokenId || haikuInfo[0] || 0, 10);
        const totalEditions = parseInt(haikuInfo.editionsCount || haikuInfo[1] || 0, 10);

        // remaining editions
        let remaining = 0;
        try {
          const remRaw = await contract.methods.getRemainingEditions(haikuIdNum).call();
          remaining = parseInt(remRaw || remRaw?.toString() || "0", 10);
        } catch (err) {
          console.warn("getRemainingEditions failed", err);
        }

        // token details (if token exists)
        let tokenURI = "";
        let parsedImageUrl = "";
        let currentPriceWei = "";
        let creator = "";
        try {
          if (firstTokenId && firstTokenId > 0) {
            // getTokenFullDetails(tokenId)
            const details = await contract.methods.getTokenFullDetails(firstTokenId).call();
            // getTokenFullDetails returns (owner, mintDate, currentPrice, forSale, priceHistory, transactions, haiku_, creator_)
            currentPriceWei = (details.currentPrice && details.currentPrice.toString) ? details.currentPrice.toString() : details.currentPrice ?? "";
            creator = details.creator_ || details[7] || "";
            // tokenURI via ERC721 tokenURI
            try {
              tokenURI = await contract.methods.tokenURI(firstTokenId).call();
            } catch (err) {
              console.warn("tokenURI fetch failed", err);
            }
            if (tokenURI) {
              parsedImageUrl = parseTokenURIForImage(tokenURI) || "";
            }
          }
        } catch (err) {
          console.warn("token details fetch failed", err);
        }

        const info: OnChainAtelierInfo = {
          exists: true,
          haikuId: String(haikuIdNum),
          firstTokenId,
          totalEditions,
          remaining,
          currentPriceWei,
          tokenURI,
          parsedImageUrl,
          creator,
          fetchedAt: Date.now(),
        };

        setOnChainDataByMsgId((p) => ({ ...p, [msgId]: info }));
        return info;
      } catch (err) {
        console.error("fetchOnChainForEntry error", err);
        return null;
      }
    },
    [web3Instance, contractInstance, onChainDataByMsgId]
  );

  // batch fetch on-chain data for visible entries
  useEffect(() => {
    // we fetch for entries that have a hashtag or are identified as atelier
    const toFetch = enriched.slice(0, 80); // limit to first 80 to avoid heavy calls
    if (!contractInstance || !web3Instance) return;
    let mounted = true;
    (async () => {
      for (const e of toFetch) {
        if (!mounted) break;
        try {
          await fetchOnChainForEntry(e);
        } catch (err) {
          // continue
        }
      }
    })();
    return () => { mounted = false; };
  }, [enriched, fetchOnChainForEntry, contractInstance, web3Instance]);

  // ---------- mint function (existing behaviour, improved) ----------
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

      // Gas estimate & send
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

      // After mint, refresh on-chain info for this entry
      try {
        await fetchOnChainForEntry(entry);
      } catch (err) {
        // ignore
      }
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({ title: "Erreur mint", description: err?.message || "Erreur inconnue", status: "error", duration: 6000, isClosable: true });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };

  // ---------- toggles ----------
  const togglePanel = (id: string) => setOpenPanels((p) => ({ ...p, [id]: !p[id] }));
  const toggleDetails = (id: string) => setOpenDetails((p) => ({ ...p, [id]: !p[id] }));

  return {
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
  getMessageImage,
}

};

  export default useAteliersData;
