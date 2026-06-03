import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Heading,
  Text,
  Spinner,
  Button,
  Switch,
  Flex,
  Stack,
  SimpleGrid,
  Badge,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Center,
  Divider,
  Tooltip,
  useToast,
  useColorModeValue,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  InputGroup,
  InputRightAddon,
  FormControl,
  FormLabel,
  FormHelperText,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Alert,
  AlertIcon,
  Link,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import ABIRESCOLLECTION from "@/components/ABI/ABI_Collections.json";

const TRANSACTIONS_ENDPOINT = (address: string) =>
  `https://deep-index.moralis.io/api/v2.2/${address}?chain=base&verbose=true&include=internal_transactions&limit=100`;
const EUR_RATE = 0.92;

const TX_FEED_TTL     = 10 * 60 * 1000; // 10 min — transactions
const BALANCE_TTL     =  2 * 60 * 1000; //  2 min — solde on-chain
const COLLECTIONS_TTL = 10 * 60 * 1000; // 10 min — contrats Rescoe

function txCacheRead<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) { localStorage.removeItem(key); return null; }
    return data as T;
  } catch { return null; }
}
function txCacheWrite<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

type Props = {
  address?: string;
  walletAddress?: string;
};

type RawTx = {
  hash: string;
  value: string;
  transaction_fee?: string;
  block_timestamp: string;
  from_address: string;
  to_address?: string;
  token_address?: string;
};

type TransactionCategory =
  | "SALE_NFT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "MINT_COST"
  | "GAS_ONLY"
  | "SALE_NFT_ETH"  // ✅ Nouveau
  | "CONTRACT_OUT"; // ✅ Nouveau


type Direction = "Entrant" | "Sortant" | "Neutre";

type LedgerEntry = {
  hash: string;
  timestamp: Date;
  displayDate: string;
  type: TransactionCategory;
  direction: Direction;
  amountETH: number;
  amountEUR: number | null;
  balanceEth: number;
  balanceEur: number | null;
  isRescoe: boolean;
  contract?: string;
  comment: string;
  tokenAddress?: string;
};

type PriceState = {
  usdPrice: number | null;
  eurPrice: number | null;
  status: "idle" | "loading" | "available" | "unavailable";
};

type PriceHistory = Record<string, number>;

const formatDateFR = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

const formatNumberFR = (value: number, digits = 2) =>
  value.toFixed(digits).replace(".", ",");

const fetchViaProxy = async (url: string) => {
  try {
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      throw new Error(`Proxy error (${response.status})`);
    }
    return response.json();
  } catch (error) {
    console.error("[fetchViaProxy] Error:", error);
    throw error;
  }
};

// Hook pour récupérer les prix historiques ETH/EUR
// Hook pour récupérer les prix historiques ETH/EUR via BaseScan
const useEthPriceHistory = (transactions: RawTx[]) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (transactions.length === 0) return;

    const fetchPrices = async () => {
      setLoading(true);
      const priceMap: PriceHistory = {};

      // Récupérer les blocs uniques avec leurs timestamps
      const blockTimestamps = new Map<number, string>();
      transactions.forEach((tx) => {
        const timestamp = tx.block_timestamp;
        const dateKey = new Date(timestamp).toISOString().slice(0, 10);

        // Récupérer le block number via BaseScan pour chaque transaction
        if (!blockTimestamps.has(parseInt(dateKey))) {
          blockTimestamps.set(parseInt(dateKey), dateKey);
        }
      });

      // Utiliser CoinGecko pour obtenir les prix historiques par date
      await Promise.allSettled(
        Array.from(blockTimestamps.values()).map(async (dateKey) => {
          try {
            // Format: YYYY-MM-DD
            const [year, month, day] = dateKey.split("-");
            const response = await fetch(
              `https://api.coingecko.com/api/v3/coins/ethereum/history?date=${day}-${month}-${year}&localization=false`
            );

            if (!response.ok) throw new Error("CoinGecko error");

            const data = await response.json();
            const eurPrice =
              data.market_data?.current_price?.eur ||
              data.market_data?.current_price?.usd * 0.92 ||
              null;

            if (eurPrice) {
              priceMap[dateKey] = eurPrice;
            }
          } catch (error) {
            console.warn(
              `[useEthPriceHistory] Error for date ${dateKey}:`,
              error
            );
            // Fallback: prix par défaut
            priceMap[dateKey] = 2926.4;
          }
        })
      );

      setPriceHistory(priceMap);
      setLoading(false);
    };

    const timer = setTimeout(fetchPrices, 500);
    return () => clearTimeout(timer);
  }, [transactions]);

  return { priceHistory, loading };
};


const classifyTransaction = (
  tx: RawTx,
  userLower: string,
  rescoeContracts: Set<string>
): {
  type: TransactionCategory | "SALE_NFT_ETH" | "CONTRACT_OUT";  // Étendu
  direction: Direction;
  comment: string;
  isRescoe: boolean;
} => {
  const amountEth = Number(tx.value ?? "0") / 1e18;
  const tokenAddress = tx.token_address?.toLowerCase() ?? "";
  const from = tx.from_address?.toLowerCase() || '';
  const to = tx.to_address?.toLowerCase() || '';
  const hasToken = Boolean(tx.token_address);
  const isRescoe = rescoeContracts.has(tokenAddress);
  const isIncoming = to === userLower;
  const isOutgoing = from === userLower;

  // DEBUG (retire après)
  //console.log(`[classify] ${tx.hash.slice(0,10)}: from=${from.slice(0,8)}… to=${to.slice(0,8)}… amt=${amountEth.toFixed(6)} token=${hasToken?'YES':'NO'}`);

  // ✅ PRIORITÉ 1: ETH internal > gas (ventes NFT du contrat)
  if (tx.hash.includes('_internal_') && !hasToken && amountEth > 0.0001) {
    return {
      type: "SALE_NFT_ETH",
      direction: "Entrant",
      comment: `ETH vente NFT (internal ${amountEth.toFixed(4)}Ξ)`,
      isRescoe: true
    };
  }

  // ✅ PRIORITÉ 2: NFT entrant (token transfer)
  if (amountEth === 0 && hasToken && isIncoming) {
    return {
      type: "SALE_NFT",
      direction: "Entrant",
      comment: "Vente NFT (internal tx)",
      isRescoe
    };
  }

  // ✅ PRIORITÉ 3: NFT sortant
  if (amountEth === 0 && hasToken && isOutgoing) {
    return {
      type: "TRANSFER_OUT",
      direction: "Sortant",
      comment: "Transfert NFT",
      isRescoe
    };
  }

  // ✅ PRIORITÉ 4: Gas only
  if (amountEth === 0) {
    return {
      type: "GAS_ONLY",
      direction: isIncoming ? "Entrant" : "Sortant",
      comment: "Frais réseau",
      isRescoe: false
    };
  }

  // ✅ PRIORITÉ 5: ETH normal + NFT (rare)
  if (hasToken && amountEth > 0) {
    if (isIncoming) {
      return {
        type: "SALE_NFT",
        direction: "Entrant",
        comment: "Vente NFT",
        isRescoe
      };
    }
    if (isOutgoing && isRescoe) {
      return {
        type: "MINT_COST",
        direction: "Sortant",
        comment: "Coût mint RESCOE",
        isRescoe: true
      };
    }
    if (isOutgoing) {
      return {
        type: "TRANSFER_OUT",
        direction: "Sortant",
        comment: "Transfert NFT",
        isRescoe
      };
    }
  }

  // ✅ PRIORITÉ 6: ETH pur normal
  if (!hasToken && amountEth > 0) {
    if (isIncoming) {
      return {
        type: "TRANSFER_IN",
        direction: "Entrant",
        comment: "Transfert ETH entrant",
        isRescoe: false
      };
    }
    if (isOutgoing) {
      return {
        type: "TRANSFER_OUT",
        direction: "Sortant",
        comment: "Transfert ETH sortant",
        isRescoe: false
      };
    }
  }

  // Fallback
  return {
    type: "GAS_ONLY",
    direction: amountEth > 0 ? (isIncoming ? "Entrant" : "Sortant") : "Sortant",
    comment: amountEth > 0 ? "ETH interne" : "Frais divers",
    isRescoe: false
  };
};


const UserFinanceDashboard: React.FC<Props> = ({
  address,
  walletAddress,
}) => {
  const effectiveAddress = address ?? walletAddress ?? "";
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<RawTx[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [rescoeContracts, setRescoeContracts] = useState<Set<string>>(
    new Set()
  );
  const [priceState, setPriceState] = useState<PriceState>({
    usdPrice: null,
    eurPrice: null,
    status: "idle",
  });
  const [showEUR, setShowEUR] = useState(false);
  const [filters, setFilters] = useState({
    rescoeOnly: false,
    salesOnly: false,
    transfersOnly: false,
    period: "all" as "all" | "month" | "year",
  });
  const toast = useToast();
  const isMounted = useRef(true);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // État panneau Envoyer / Bridge
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  // Hook pour prix historiques
  const { priceHistory } = useEthPriceHistory(transactions);

  const provider = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_URL_SERVER_MORALIS) return null;
    return new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  }, []);

  const contract = useMemo(() => {
    if (
      !provider ||
      !process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT
    )
      return null;
    return new Contract(
      process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT,
      ABIRESCOLLECTION,
      provider
    );
  }, [provider]);

  const fetchNativePriceEUR = useCallback(async () => {
    try {
      setPriceState((prev) => ({ ...prev, status: "loading" }));
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur,usd"
      );
      const data = await response.json();
      const eurPrice = Number(data?.ethereum?.eur ?? 0);
      const usdPrice = Number(data?.ethereum?.usd ?? 0);

      if (eurPrice > 0 && usdPrice > 0) {
        setPriceState({
          eurPrice,
          usdPrice,
          status: "available",
        });
        return eurPrice;
      }
      setPriceState({
        eurPrice: null,
        usdPrice: null,
        status: "unavailable",
      });
      return null;
    } catch (error) {
      console.error("[UserFinanceDashboard] price fetch error", error);
      setPriceState({
        eurPrice: null,
        usdPrice: null,
        status: "unavailable",
      });
      return null;
    }
  }, []);

  const fetchRescoeCollections = useCallback(
    async (userAddress: string) => {
      if (!contract) return;
      const cacheKey = `rescoe_txcollections_${userAddress.toLowerCase()}`;
      const cached = txCacheRead<string[]>(cacheKey, COLLECTIONS_TTL);
      if (cached !== null) {
        if (isMounted.current) setRescoeContracts(new Set(cached));
        return;
      }
      try {
        const raw = await contract.getCollectionsByUser(userAddress);
        if (!Array.isArray(raw)) return;
        const addresses = new Set<string>(
          raw
            .map((collection: any) =>
              collection?.mintContractAddress?.toLowerCase()
            )
            .filter(Boolean)
        );
        txCacheWrite(cacheKey, Array.from(addresses));
        if (isMounted.current) {
          setRescoeContracts(addresses);
        }
      } catch (error) {
        console.error("[UserFinanceDashboard] collections error", error);
        toast({
          title: "Collections RESCOE",
          description:
            "Impossible de récupérer les contrats RESCOE pour cette adresse.",
          status: "warning",
        });
        if (isMounted.current) {
          setRescoeContracts(new Set());
        }
      }
    },
    [contract, toast]
  );

  const fetchCurrentBalance = useCallback(
    async (userAddress: string) => {
      const cacheKey = `rescoe_balance_${userAddress.toLowerCase()}`;
      const cached = txCacheRead<number>(cacheKey, BALANCE_TTL);
      if (cached !== null) {
        if (isMounted.current) setCurrentBalance(cached);
        return cached;
      }
      try {
        if (!provider) return 0;
        const balanceWei = await provider.getBalance(userAddress);
        const balanceEth = parseFloat(formatUnits(balanceWei, 18));
        const rounded = Math.max(0, parseFloat(balanceEth.toFixed(6)));
        txCacheWrite(cacheKey, rounded);
        if (isMounted.current) {
          setCurrentBalance(rounded);
        }
        return rounded;
      } catch (error) {
        console.error("[UserFinanceDashboard] Balance fetch error", error);
        toast({
          title: "Solde",
          description: "Impossible de récupérer le solde Base.",
          status: "warning",
        });
        if (isMounted.current) {
          setCurrentBalance(0);
        }
        return 0;
      }
    },
    [provider, toast]
  );
  const fetchAllTransactions = useCallback(
    async (userAddress: string) => {
      const txCacheKey = `rescoe_txfeed_${userAddress.toLowerCase()}`;
      const cachedTxs = txCacheRead<RawTx[]>(txCacheKey, TX_FEED_TTL);
      if (cachedTxs !== null) return cachedTxs;

      let cursor: string | null = null;
      const all: RawTx[] = [];
      const lowerUserAddress = userAddress.toLowerCase();

      try {
        do {
          const url = new URL(TRANSACTIONS_ENDPOINT(userAddress));
          if (cursor) {
            url.searchParams.set("cursor", cursor);
          }
          // ✅ Paramètre correct pour Moralis
          url.searchParams.set("include", "internal_transactions");

          const payload = await fetchViaProxy(url.toString());
          //console.log("[fetchAllTransactions] Payload sample:", payload.result?.slice(0, 2)); // Debug
          const page = payload.result ?? [];

          // ✅ Étendre TOUS les internal tx (ETH ou NFT, entrant/sortant)
          const enrichedPage = page.flatMap((tx: any) => {
            const transactions: RawTx[] = [{ ...tx }]; // Tx principale

            // Chercher sous les deux noms possibles
            const internals = tx.internal_transactions || tx.internaltransactions || [];
            /*//console.log(`Tx ${tx.hash.slice(0,10)} internals (${internals.length}):`, internals.slice(0,3).map(i => ({
              from: i.from_address?.slice(0,10), to: i.to_address?.slice(0,10),
              value: i.value, token: i.token_address ? 'YES' : 'NO'
            })));
*/
            if (Array.isArray(internals)) {
              internals.forEach((internal: any, idx: number) => {
                const internalValue = Number(internal.value ?? "0") / 1e18;
                const internalFrom = (internal.from_address || internal.fromaddress || "").toLowerCase();
                const internalTo = (internal.to_address || internal.toaddress || "").toLowerCase();
                const hasTokenInternal = Boolean(internal.token_address || internal.tokenaddress);

                // ✅ FIX 1: TOUS internals avec VALUE > 0 (ETH NFT sales) OU NFT TO/FROM user
                if (internalValue > 0 ||
                    (hasTokenInternal && (internalTo === lowerUserAddress || internalFrom === lowerUserAddress))) {

                      transactions.push({
                        hash: `${tx.hash}_internal_${idx}`,
                        value: internal.value ?? "0",
                        transaction_fee: internal.transaction_fee ?? "0",
                        block_timestamp: tx.block_timestamp,
                        from_address: internal.from_address || internal.fromaddress || tx.from_address || '0xcontrat',
                        to_address: internal.to_address || internal.toaddress || tx.to_address || lowerUserAddress,
                        token_address: internal.token_address || internal.tokenaddress || "",
                      });

                  //console.log(`✅ [ADDED] ${tx.hash.slice(0,10)}_internal_${idx}: from ${internalFrom.slice(0,8)}→${internalTo.slice(0,8)} value ${internalValue.toFixed(6)}Ξ token:${hasTokenInternal?'YES':'NO'}`);
                }
              });
            }

            return transactions;
          });

          all.push(...enrichedPage);
          cursor = payload.cursor ?? null;
        } while (cursor);

        //console.log(`[fetchAllTransactions] Total tx Moralis: ${all.length} (dont internals)`);

        // 🔥 BASESCAN FALLBACK: Top 100 récents ETH > 0.001
        try {
          const { result } = await (await fetch('/api/basescan?address=' + userAddress)).json();
          const basescanTxs = result
            .filter((tx: any) =>
              !tx.isError &&
              Number(tx.value) >= 1e15 &&  // > 0.001 ETH
              tx.to.toLowerCase() === lowerUserAddress
            )
            .map((tx: any) => {
              if (all.some(existing => existing.hash === tx.hash)) return null;
              return {
                hash: tx.hash,
                value: tx.value,
                transaction_fee: tx.gasPrice ? (Number(tx.gasUsed) * Number(tx.gasPrice)).toString() : "0",
                block_timestamp: new Date(tx.timeStamp * 1000).toISOString(),
                from_address: tx.from,
                to_address: tx.to,
                token_address: "",
              };
            })
            .filter(Boolean);

          all.unshift(...basescanTxs);
          //console.log(`🔍 Basescan ajouté ${basescanTxs.length} tx (ex: ${basescanTxs[0]?.hash?.slice(0,10)})`);
        } catch (e: unknown) {
          if (e instanceof Error) {
            console.warn("[Basescan] Skip:", e.message);
          } else {
            console.warn("[Basescan] Skip:", e);
          }
        }

        // ✅ Trie final récent → ancien
        const sorted = all.sort((a, b) =>
          new Date(b.block_timestamp).getTime() - new Date(a.block_timestamp).getTime()
        );
        txCacheWrite(txCacheKey, sorted);
        return sorted;

      } catch (error) {
        console.error("[UserFinanceDashboard] transactions error", error);
        toast({
          title: "Transactions",
          description: "Erreur lors de la récupération des transactions Base.",
          status: "error",
        });
        return [];
      }
    },
    [toast]
  );



  const loadData = useCallback(
    async (addr: string) => {
      if (!addr) return;
      if (!contract) {
        toast({
          title: "Contrat RESCOE manquant",
          description: "Le contrat RESCOE n'est pas configuré.",
          status: "error",
        });
        return;
      }

      setLoading(true);
      isMounted.current = true;

      try {
        await fetchNativePriceEUR();
        await fetchCurrentBalance(addr);
        await fetchRescoeCollections(addr);
        const txs = await fetchAllTransactions(addr);
        if (isMounted.current) {
          setTransactions(txs);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [
      contract,
      fetchNativePriceEUR,
      fetchCurrentBalance,
      fetchRescoeCollections,
      fetchAllTransactions,
      toast,
    ]
  );

  useEffect(() => {
    if (!effectiveAddress) return;
    loadData(effectiveAddress);

    return () => {
      isMounted.current = false;
    };
  }, [effectiveAddress, loadData]);

  // 1. NOUVEAU HOOK pour récupérer le solde historique à une date donnée
  const useHistoricalBalance = (address: string, provider: JsonRpcProvider | null) => {
    const [balanceByDate, setBalanceByDate] = useState<Record<string, number>>({});

    useEffect(() => {
      if (!address || !provider) return;

      const fetchHistoricalBalance = async () => {
        try {
          // Récupérer le block le plus proche d'une date donnée
          // On utilise BaseScan pour ça
          const response = await fetch(
            `/api/proxy?url=https://api.basescan.org/api?module=account&action=balance&address=${address}&tag=latest`
          );
          const data = await response.json();
          const currentBalance = Number(data.result) / 1e18;

          setBalanceByDate((prev) => ({
            ...prev,
            current: currentBalance,
          }));
        } catch (error) {
          console.error("[useHistoricalBalance] Error:", error);
        }
      };

      fetchHistoricalBalance();
    }, [address, provider]);

    return balanceByDate;
  };

  // 2. normalizedLedger — reconstruction arrière correcte depuis le solde actuel
  const normalizedLedger = useMemo<LedgerEntry[]>(() => {
    if (!effectiveAddress || !transactions.length) return [];

    const lowerAddress = effectiveAddress.toLowerCase();

    // Trier du PLUS RÉCENT au PLUS ANCIEN (on remonte le temps)
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(b.block_timestamp).getTime() -
        new Date(a.block_timestamp).getTime()
    );

    // Partir du solde actuel et remonter
    let runningBalance = currentBalance;
    const eurAvailable = priceState.status === "available";

    const ledger = sorted.map((tx) => {
      const amountETH = Number(tx.value ?? "0") / 1e18;
      // Les frais de gas ne s'appliquent qu'aux transactions sortantes
      const gasFeeETH = Number(tx.transaction_fee ?? "0") / 1e18;

      const classification = classifyTransaction(tx, lowerAddress, rescoeContracts);

      // Prix à la date de la transaction
      const dateKey = new Date(tx.block_timestamp).toISOString().slice(0, 10);
      const priceForDate = priceHistory[dateKey] || priceState.eurPrice || 0;
      const eur = eurAvailable && priceForDate > 0 ? amountETH * priceForDate : null;

      // On enregistre le solde APRÈS cette transaction (avant de l'annuler)
      // C'est le solde réel du wallet au moment où la tx s'est confirmée
      const balanceAfterTx = runningBalance;

      // Annuler cette transaction pour retrouver le solde d'avant
      if (classification.direction === "Entrant") {
        // On avait reçu de l'ETH → le solde avant était plus bas
        runningBalance -= amountETH;
      } else {
        // On avait envoyé de l'ETH (+ gas) → le solde avant était plus haut
        runningBalance += amountETH + gasFeeETH;
      }

      const date = new Date(tx.block_timestamp);

      return {
        hash: tx.hash,
        timestamp: date,
        displayDate: formatDateFR(date),
        type: classification.type,
        direction: classification.direction,
        amountETH,
        amountEUR: eur,
        balanceEth: Math.max(0, balanceAfterTx),
        balanceEur: eurAvailable && priceForDate > 0
          ? Math.max(0, balanceAfterTx * priceForDate)
          : null,
        isRescoe: classification.isRescoe,
        contract: tx.token_address ?? undefined,
        comment: classification.comment,
        tokenAddress: tx.token_address,
      };
    });

    // Inverser pour avoir du plus ancien au plus récent dans l'affichage
    return ledger.reverse();
  }, [
    transactions,
    effectiveAddress,
    rescoeContracts,
    priceState,
    priceHistory,
    currentBalance,
  ]);

  // 3. filteredLedger — filtre uniquement, les balances viennent de normalizedLedger
  const filteredLedger = useMemo(() => {
    if (!normalizedLedger.length) return [];

    const now = new Date();
    const start = new Date();

    if (filters.period === "month") {
      start.setMonth(now.getMonth());
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (filters.period === "year") {
      start.setFullYear(now.getFullYear());
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setTime(0);
    }

    // On filtre mais on conserve les balances calculées en arrière depuis le solde actuel
    // Chaque entry.balanceEth = solde réel après cette transaction
    return normalizedLedger.filter((entry) => {
      if (filters.rescoeOnly && !entry.isRescoe) return false;
      if (filters.salesOnly && entry.type !== "SALE_NFT") return false;
      if (
        filters.transfersOnly &&
        !["TRANSFER_IN", "TRANSFER_OUT"].includes(entry.type)
      )
        return false;
      if (entry.timestamp < start || entry.timestamp > now) return false;
      return true;
    });
  }, [normalizedLedger, filters]);

  // 4. REMPLACER le useMemo summary pour utiliser filteredLedger
  const summary = useMemo(() => {
    const entrant = filteredLedger
      .filter((entry) => entry.direction === "Entrant")
      .reduce((acc, entry) => acc + entry.amountETH, 0);

    const sortant = filteredLedger
      .filter((entry) => entry.direction === "Sortant")
      .reduce((acc, entry) => acc + entry.amountETH, 0);

    const netEth = entrant - sortant;

    const entrantEur = filteredLedger
      .filter(
        (entry) => entry.direction === "Entrant" && entry.amountEUR !== null
      )
      .reduce((acc, entry) => acc + (entry.amountEUR ?? 0), 0);

    const sortantEur = filteredLedger
      .filter(
        (entry) => entry.direction === "Sortant" && entry.amountEUR !== null
      )
      .reduce((acc, entry) => acc + (entry.amountEUR ?? 0), 0);

    const netEur =
      priceState.status === "available" ? entrantEur - sortantEur : null;

      const salesCount = filteredLedger.filter(entry =>
        entry.type === "SALE_NFT" || entry.type === "SALE_NFT_ETH"
      ).length;


    const transfersCount = filteredLedger.filter((entry) =>
      ["TRANSFER_IN", "TRANSFER_OUT"].includes(entry.type)
    ).length;

    // Ajouter le solde final du graphique
    const finalBalance =
      filteredLedger.length > 0
        ? filteredLedger[filteredLedger.length - 1].balanceEth
        : currentBalance;

    return {
      totalEntrant: entrant,
      totalSortant: sortant,
      netEth,
      netEur,
      salesCount,
      transfersCount,
      finalBalance, // Nouveau
    };
  }, [filteredLedger, priceState.status, currentBalance]);


  // Données du graphique basées sur le ledger filtré
  const chartData = useMemo(
    () =>
      filteredLedger.map((entry) => ({
        date: entry.displayDate,
        balance: entry.balanceEth,
      })),
    [filteredLedger]
  );

  const handleExportCSV = () => {
    const header =
      "Date;Type;Hash;Montant ETH;Montant EUR;Sens;Contrat;Commentaire\n";
    const rows = filteredLedger
      .map((entry) => {
        const eurCell =
          entry.amountEUR != null ? formatNumberFR(entry.amountEUR, 2) : "—";
        return [
          entry.displayDate,
          entry.type,
          entry.hash,
          formatNumberFR(entry.amountETH, 6),
          eurCell,
          entry.direction,
          entry.contract ?? entry.tokenAddress ?? "—",
          entry.comment,
        ].join(";");
      })
      .join("\n");

    const blob = new Blob(["\uFEFF" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rescoe_financial_export.csv";
    link.click();
    link.remove();
  };

  // Envoi ETH via MetaMask / wallet connecté
  const handleSendETH = async () => {
    if (!sendTo || !sendAmount) return;
    const eth = (window as any).ethereum;
    if (!eth) {
      toast({ title: 'Wallet non détecté', description: 'Ouvrez MetaMask ou connectez votre wallet.', status: 'error' });
      return;
    }
    setSendLoading(true);
    try {
      const { BrowserProvider, parseEther } = await import('ethers');
      const browserProvider = new BrowserProvider(eth);
      const signer = await browserProvider.getSigner();
      const tx = await signer.sendTransaction({
        to: sendTo.trim(),
        value: parseEther(sendAmount),
      });
      toast({ title: '⏳ Transaction envoyée', description: `Hash: ${tx.hash.slice(0, 14)}…`, status: 'info', duration: 5000 });
      await tx.wait();
      toast({ title: '✅ Transfert confirmé', description: `${sendAmount} ETH envoyé à ${sendTo.slice(0, 10)}…`, status: 'success', duration: 8000 });
      setSendTo('');
      setSendAmount('');
      // Invalider le cache de solde pour refresh
      if (effectiveAddress) {
        localStorage.removeItem(`rescoe_balance_${effectiveAddress.toLowerCase()}`);
        await fetchCurrentBalance(effectiveAddress);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.split('(')[0] : 'Erreur inconnue';
      toast({ title: '❌ Échec du transfert', description: msg, status: 'error', duration: 8000 });
    } finally {
      setSendLoading(false);
    }
  };

  const boxBg = useColorModeValue("rgba(255,255,255,0.06)", "rgba(1,28,57,0.8)");

  if (loading) {
    return (
      <Center py={16}>
        <Stack align="center">
          <Spinner size="xl" color="brand.gold" />
          <Text color="brand.cream">Chargement des flux financiers...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      bg={boxBg}
      border="1px solid rgba(238,212,132,0.2)"
      borderRadius="2xl"
      p={{ base: 4, md: 6 }}
      boxShadow="0 20px 40px rgba(0,0,0,0.45)"
      color="brand.cream"
      mx="auto"
      maxW="1200px"
    >
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Tableau de Bord Financier</Heading>
        <Button
          size="sm"
          colorScheme="yellow"
          variant="outline"
          onClick={() => setShowEUR(!showEUR)}
          leftIcon={showEUR ? <ChevronUpIcon /> : <ChevronDownIcon />}
        >
          {showEUR ? "💶 Masquer EUR" : "💶 Afficher EUR"}
        </Button>
      </Flex>

      {/* Prix et statistiques globales */}
      <Stack spacing={4} mb={6}>
        <Flex justify="space-between" flexWrap="wrap" gap={4} align="flex-start">
          <Box flex="1" minW="240px">
            <Text fontSize="sm" color="gray.300">
              Prix ETH actuel
            </Text>
            <Flex align="center" gap={2}>
              <Text fontSize="2xl" fontWeight="bold">
                {priceState.status === "available" && priceState.eurPrice
                  ? `€${priceState.eurPrice.toFixed(2)}`
                  : "—"}
              </Text>
              {priceState.status === "unavailable" && (
                <Badge
                  colorScheme="orange"
                  variant="subtle"
                  color="brand.navy"
                  px={2}
                >
                  Indisponible
                </Badge>
              )}
            </Flex>
          </Box>
          <Box flex="1" minW="240px">
            <Text fontSize="sm" color="gray.300">
              Solde actuel
            </Text>
            <Badge
              colorScheme="yellow"
              px={3}
              py={1}
              fontSize="lg"
              textAlign="center"
            >
              {formatNumberFR(currentBalance, 4)} Ξ
            </Badge>
            {showEUR && priceState.eurPrice && (
              <Text fontSize="xs" color="gray.400" mt={1}>
                ≈ €{formatNumberFR(
                  currentBalance * priceState.eurPrice,
                  2
                )}
              </Text>
            )}
          </Box>
          <Box flex="1" minW="240px">
            <Text fontSize="sm" color="gray.300">
              Transactions
            </Text>
            <Text fontSize="md">
              {transactions.length
                ? `${transactions.length} mouvements`
                : "Aucun mouvement"}
            </Text>
          </Box>
        </Flex>

        <SimpleGrid columns={[1, 2, 3]} gap={4}>
          <Box
            p={4}
            borderRadius="xl"
            border="1px solid rgba(238,212,132,0.3)"
            bg="rgba(255,255,255,0.02)"
          >
            <Text fontSize="xs" color="gray.400">
              Entrées totales
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {formatNumberFR(summary.totalEntrant, 4)} Ξ
            </Text>
            {showEUR && summary.totalEntrant > 0 && (
              <Text fontSize="xs" color="gray.400">
                ≈ €
                {formatNumberFR(
                  filteredLedger
                    .filter((e) => e.direction === "Entrant")
                    .reduce((acc, e) => acc + (e.amountEUR ?? 0), 0),
                  2
                )}
              </Text>
            )}
          </Box>
          <Box
            p={4}
            borderRadius="xl"
            border="1px solid rgba(1,28,57,0.5)"
            bg="rgba(1,28,57,0.3)"
          >
            <Text fontSize="xs" color="gray.400">
              Sorties totales
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {formatNumberFR(summary.totalSortant, 4)} Ξ
            </Text>
            {showEUR && summary.totalSortant > 0 && (
              <Text fontSize="xs" color="gray.400">
                ≈ €
                {formatNumberFR(
                  filteredLedger
                    .filter((e) => e.direction === "Sortant")
                    .reduce((acc, e) => acc + (e.amountEUR ?? 0), 0),
                  2
                )}
              </Text>
            )}
          </Box>
          <Box
            p={4}
            borderRadius="xl"
            border="1px solid rgba(238,212,132,0.3)"
            bg="rgba(238,212,132,0.08)"
          >
            <Text fontSize="xs" color="gray.400">
              Résultat net
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {formatNumberFR(summary.netEth, 4)} Ξ
            </Text>
            {showEUR && summary.netEur != null && (
              <Text fontSize="xs" color="gray.400">
                ≈ €{formatNumberFR(summary.netEur, 2)}
              </Text>
            )}
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={[1, 2]} spacing={4}>
          <Box
            p={4}
            borderRadius="xl"
            border="1px solid rgba(238,212,132,0.2)"
            bg="rgba(1,28,57,0.5)"
          >
            <Text fontSize="xs" color="gray.400">
              Ventes NFT
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {summary.salesCount}
            </Text>
          </Box>
          <Box
            p={4}
            borderRadius="xl"
            border="1px solid rgba(238,212,132,0.3)"
            bg="rgba(180,166,213,0.08)"
          >
            <Text fontSize="xs" color="gray.400">
              Transferts
            </Text>
            <Text fontSize="2xl" fontWeight="bold">
              {summary.transfersCount}
            </Text>
          </Box>
        </SimpleGrid>
      </Stack>

      <Divider borderColor="rgba(255,255,255,0.1)" mb={6} />

      {/* Filtres */}
      <Stack spacing={4} mb={6}>
        <Flex
          align="center"
          justify="space-between"
          flexWrap="wrap"
          gap={4}
          color="brand.cream"
        >
          <Flex align="center" gap={2}>
            <Switch
              isChecked={filters.rescoeOnly}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  rescoeOnly: event.target.checked,
                }))
              }
              colorScheme="yellow"
            />
            <Text fontSize="sm">RESCOE only</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Switch
              isChecked={filters.salesOnly}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  salesOnly: event.target.checked,
                }))
              }
              colorScheme="yellow"
            />
            <Text fontSize="sm">Ventes uniquement</Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Switch
              isChecked={filters.transfersOnly}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  transfersOnly: event.target.checked,
                }))
              }
              colorScheme="yellow"
            />
            <Text fontSize="sm">Transferts uniquement</Text>
          </Flex>
          <Box>
            <Text fontSize="xs" color="gray.400" mb={1}>
              Période
            </Text>
            <Select
              size="sm"
              value={filters.period}
              bg="rgba(0,0,0,0.4)"
              borderColor="rgba(255,255,255,0.15)"
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  period: event.target.value as "all" | "month" | "year",
                }))
              }
            >
              <option value="all">Tous</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
            </Select>
          </Box>
          <Button
            colorScheme="yellow"
            variant="solid"
            onClick={handleExportCSV}
            isDisabled={!filteredLedger.length}
            size="sm"
          >
            📥 Export CSV
          </Button>
        </Flex>
      </Stack>

      {/* Graphique */}
      <Box
        height={{ base: "280px", md: "400px" }}
        mb={6}
        px={4}
        py={4}
        borderRadius="xl"
        border="1px solid rgba(238,212,132,0.2)"
        bg="rgba(0,0,0,0.2)"
        minWidth="0"
      >
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                interval={Math.max(0, Math.floor(chartData.length / 6))}
              />
              <YAxis
                tickFormatter={(value) => formatNumberFR(value, 2)}
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                domain={[0, "auto"]}
              />
              <RechartsTooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.9)",
                  borderColor: "rgba(238,212,132,0.5)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                }}
                formatter={(value?: number) => [
                  `${formatNumberFR(value ?? 0, 5)} ETH`, // fallback 0 si undefined
                  "Solde cumulatif"
                ]}
                labelStyle={{ color: "rgba(255,255,255,0.8)" }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#EED484"
                strokeWidth={3}
                dot={false}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Center h="100%">
            <Text color="gray.400">
              Aucun solde disponible pour les filtres sélectionnés.
            </Text>
          </Center>
        )}
      </Box>

      {/* Table avec scroll horizontal */}
      <Box
        overflowX="auto"
        borderRadius="lg"
        border="1px solid rgba(238,212,132,0.2)"
        bg="rgba(0,0,0,0.2)"
      >
        <TableContainer minW="100%">
          <Table variant="simple" size="sm">
            <Thead bg="rgba(255,255,255,0.08)">
              <Tr>
                <Th color="gray.300" whiteSpace="nowrap">
                  Date
                </Th>
                <Th color="gray.300" whiteSpace="nowrap">
                  Type
                </Th>
                <Th color="gray.300" whiteSpace="nowrap">
                  Hash
                </Th>
                <Th color="gray.300" isNumeric whiteSpace="nowrap">
                  ETH
                </Th>
                {showEUR && (
                  <Th color="gray.300" isNumeric whiteSpace="nowrap">
                    EUR
                  </Th>
                )}
                <Th color="gray.300" whiteSpace="nowrap">
                  Sens
                </Th>
                <Th color="gray.300" whiteSpace="nowrap">
                  Contrat
                </Th>
                <Th color="gray.300" whiteSpace="nowrap">
                  Commentaire
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredLedger.length ? (
                filteredLedger.map((entry) => (
                  <Tr
                    key={entry.hash + entry.timestamp.getTime()}
                    _hover={{ bg: "rgba(238,212,132,0.05)" }}
                  >
                    <Td whiteSpace="nowrap">{entry.displayDate}</Td>
                    <Td whiteSpace="nowrap">
                    <Badge
                      colorScheme={
                        entry.type === "SALE_NFT" || entry.type === "SALE_NFT_ETH" ? "yellow" :
                        ["TRANSFER_IN", "TRANSFER_OUT"].includes(entry.type) ? "purple" :
                        entry.type === "CONTRACT_OUT" ? "orange" :
                        entry.type === "MINT_COST" ? "green" : "gray"
                      }
                      variant="subtle"
                      fontSize="xs"
                    >
                      {entry.type}
                    </Badge>

                    </Td>
                    <Td whiteSpace="nowrap">
                      <Tooltip label={entry.hash} fontSize="xs" hasArrow>
                        <Text fontSize="xs" color="brand.cream" fontFamily="mono">
                          {entry.hash.slice(0, 8)}...
                        </Text>
                      </Tooltip>
                    </Td>
                    <Td isNumeric whiteSpace="nowrap" fontSize="xs">
                      {formatNumberFR(entry.amountETH, 6)}
                    </Td>
                    {showEUR && (
                      <Td isNumeric whiteSpace="nowrap" fontSize="xs">
                        {entry.amountEUR != null
                          ? `€${formatNumberFR(entry.amountEUR, 2)}`
                          : "—"}
                      </Td>
                    )}
                    <Td whiteSpace="nowrap">
                      <Badge
                        colorScheme={
                          entry.direction === "Entrant" ? "green" : "red"
                        }
                        variant="solid"
                        fontSize="xs"
                      >
                        {entry.direction}
                      </Badge>
                    </Td>
                    <Td whiteSpace="nowrap">
                      <Text
                        fontSize="xs"
                        color="gray.300"
                        textOverflow="ellipsis"
                        overflow="hidden"
                        maxW="120px"
                      >
                        {entry.contract ?? entry.tokenAddress ?? "—"}
                      </Text>
                    </Td>
                    <Td whiteSpace="nowrap">
                      <Text fontSize="xs" color="gray.300">
                        {entry.comment}
                      </Text>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={showEUR ? 8 : 7}>
                    <Center py={4}>
                      <Text color="gray.500">
                        Aucun mouvement ne correspond aux filtres sélectionnés.
                      </Text>
                    </Center>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      {/* ─── Envoyer & Pont / Échange ─── */}
      <Divider borderColor="rgba(255,255,255,0.1)" my={6} />

      <Tabs variant="soft-rounded" colorScheme="yellow" size="sm">
        <TabList mb={4} gap={2}>
          <Tab
            _selected={{ bg: 'rgba(238,212,132,0.2)', color: 'brand.gold' }}
            color="gray.400"
          >
            ✈️ Envoyer ETH
          </Tab>
          <Tab
            _selected={{ bg: 'rgba(238,212,132,0.15)', color: 'brand.gold' }}
            color="gray.400"
          >
            🌉 Pont & Échange
          </Tab>
        </TabList>

        <TabPanels>
          {/* ── Envoyer ETH ── */}
          <TabPanel px={0}>
            <Box
              p={5}
              borderRadius="xl"
              border="1px solid rgba(238,212,132,0.2)"
              bg="rgba(0,0,0,0.2)"
            >
              <Heading size="sm" mb={4} color="brand.cream">
                Envoyer des ETH (Base)
              </Heading>

              <Alert status="info" variant="left-accent" borderRadius="md" mb={4} bg="rgba(0,80,200,0.15)" borderColor="rgba(100,160,255,0.4)">
                <AlertIcon color="blue.300" />
                <Text fontSize="xs" color="gray.300">
                  Utilisez cette fonction pour envoyer de l'ETH sur le réseau Base à une autre adresse.
                  MetaMask (ou votre wallet connecté) signera la transaction.
                </Text>
              </Alert>

              <Stack spacing={4} maxW="480px">
                <FormControl>
                  <FormLabel fontSize="sm" color="gray.300">Adresse destinataire</FormLabel>
                  <Input
                    placeholder="0x..."
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                    fontFamily="mono"
                    fontSize="sm"
                    bg="rgba(0,0,0,0.3)"
                    borderColor="rgba(255,255,255,0.15)"
                    _hover={{ borderColor: 'rgba(238,212,132,0.4)' }}
                    _focus={{ borderColor: 'rgba(238,212,132,0.7)', boxShadow: 'none' }}
                    color="brand.cream"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" color="gray.300">Montant (ETH)</FormLabel>
                  <InputGroup>
                    <Input
                      placeholder="0,001"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value.replace(',', '.'))}
                      type="number"
                      step="0.001"
                      min="0"
                      bg="rgba(0,0,0,0.3)"
                      borderColor="rgba(255,255,255,0.15)"
                      _hover={{ borderColor: 'rgba(238,212,132,0.4)' }}
                      _focus={{ borderColor: 'rgba(238,212,132,0.7)', boxShadow: 'none' }}
                      color="brand.cream"
                      fontSize="sm"
                    />
                    <InputRightAddon bg="rgba(238,212,132,0.1)" borderColor="rgba(255,255,255,0.15)" color="brand.gold" fontSize="sm">
                      Ξ
                    </InputRightAddon>
                  </InputGroup>
                  {sendAmount && priceState.eurPrice && (
                    <FormHelperText color="gray.400" fontSize="xs">
                      ≈ €{(parseFloat(sendAmount || '0') * priceState.eurPrice).toFixed(2)}
                    </FormHelperText>
                  )}
                </FormControl>

                <Button
                  onClick={handleSendETH}
                  isLoading={sendLoading}
                  loadingText="Envoi en cours…"
                  isDisabled={!sendTo || !sendAmount || parseFloat(sendAmount) <= 0}
                  colorScheme="yellow"
                  variant="solid"
                  size="md"
                  alignSelf="flex-start"
                >
                  Envoyer →
                </Button>

                {currentBalance > 0 && (
                  <Text fontSize="xs" color="gray.500">
                    Solde disponible : {formatNumberFR(currentBalance, 4)} Ξ
                    {priceState.eurPrice ? ` (≈ €${formatNumberFR(currentBalance * priceState.eurPrice, 2)})` : ''}
                  </Text>
                )}
              </Stack>
            </Box>
          </TabPanel>

          {/* ── Pont & Échange ── */}
          <TabPanel px={0}>
            <Box
              p={5}
              borderRadius="xl"
              border="1px solid rgba(238,212,132,0.15)"
              bg="rgba(0,0,0,0.2)"
            >
              <Heading size="sm" mb={2} color="brand.cream">
                Pont & Échange
              </Heading>
              <Text fontSize="xs" color="gray.400" mb={5}>
                Pontez de l'ETH depuis Ethereum mainnet vers Base, ou échangez des tokens sur Base via des agrégateurs tiers.
                Compatible avec tous les wallets, y compris les wallets intégrés (Coinbase/Stripe).
              </Text>

              <SimpleGrid columns={[1, 2]} gap={4}>
                {/* Base Bridge officiel */}
                <Box
                  p={4}
                  borderRadius="xl"
                  border="1px solid rgba(0,130,255,0.3)"
                  bg="rgba(0,80,200,0.1)"
                  transition="all 0.2s"
                  _hover={{ border: '1px solid rgba(0,130,255,0.6)', bg: 'rgba(0,80,200,0.2)' }}
                >
                  <Text fontSize="lg" mb={1}>🌉</Text>
                  <Text fontWeight="bold" fontSize="sm" color="blue.300" mb={1}>Base Bridge</Text>
                  <Text fontSize="xs" color="gray.400" mb={3}>
                    Pont officiel Ethereum → Base. Idéal pour transférer des ETH depuis le mainnet.
                    Délai : ~15 min.
                  </Text>
                  <Link href="https://bridge.base.org" isExternal>
                    <Button size="xs" colorScheme="blue" variant="outline">
                      Ouvrir Base Bridge ↗
                    </Button>
                  </Link>
                </Box>

                {/* Superbridge */}
                <Box
                  p={4}
                  borderRadius="xl"
                  border="1px solid rgba(100,80,220,0.3)"
                  bg="rgba(80,40,180,0.1)"
                  transition="all 0.2s"
                  _hover={{ border: '1px solid rgba(100,80,220,0.6)', bg: 'rgba(80,40,180,0.2)' }}
                >
                  <Text fontSize="lg" mb={1}>⚡</Text>
                  <Text fontWeight="bold" fontSize="sm" color="brand.gold" mb={1}>Superbridge</Text>
                  <Text fontSize="xs" color="gray.400" mb={3}>
                    Interface alternative pour ponter vers Base. Supporte plusieurs chaînes sources avec une UI claire.
                  </Text>
                  <Link href="https://superbridge.app/base" isExternal>
                    <Button size="xs" variant="outline" borderColor="brand.gold" color="brand.gold" _hover={{ bg: "rgba(238,212,132,0.1)" }}>
                      Ouvrir Superbridge ↗
                    </Button>
                  </Link>
                </Box>

                {/* Jumper (LiFi) */}
                <Box
                  p={4}
                  borderRadius="xl"
                  border="1px solid rgba(238,212,132,0.3)"
                  bg="rgba(238,212,132,0.05)"
                  transition="all 0.2s"
                  _hover={{ border: '1px solid rgba(238,212,132,0.6)', bg: 'rgba(238,212,132,0.1)' }}
                >
                  <Text fontSize="lg" mb={1}>🔄</Text>
                  <Text fontWeight="bold" fontSize="sm" color="brand.gold" mb={1}>Jumper (LiFi)</Text>
                  <Text fontSize="xs" color="gray.400" mb={3}>
                    Agrégateur multi-chaînes : pont + swap en une seule interface. Trouve les meilleures routes.
                  </Text>
                  <Link href="https://jumper.exchange/?fromChain=1&toChain=8453" isExternal>
                    <Button size="xs" colorScheme="yellow" variant="outline">
                      Ouvrir Jumper ↗
                    </Button>
                  </Link>
                </Box>

                {/* Aerodrome (swap Base) */}
                <Box
                  p={4}
                  borderRadius="xl"
                  border="1px solid rgba(0,200,120,0.3)"
                  bg="rgba(0,160,80,0.08)"
                  transition="all 0.2s"
                  _hover={{ border: '1px solid rgba(0,200,120,0.6)', bg: 'rgba(0,160,80,0.15)' }}
                >
                  <Text fontSize="lg" mb={1}>🚀</Text>
                  <Text fontWeight="bold" fontSize="sm" color="green.300" mb={1}>Aerodrome (Base)</Text>
                  <Text fontSize="xs" color="gray.400" mb={3}>
                    DEX natif de Base. Swap ETH ↔ USDC, USDT et autres tokens directement sur Base.
                  </Text>
                  <Link href="https://aerodrome.finance/swap?from=eth&to=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" isExternal>
                    <Button size="xs" colorScheme="green" variant="outline">
                      Ouvrir Aerodrome ↗
                    </Button>
                  </Link>
                </Box>
              </SimpleGrid>

              <Alert status="warning" variant="left-accent" borderRadius="md" mt={5} bg="rgba(200,140,0,0.1)" borderColor="rgba(238,212,132,0.4)">
                <AlertIcon color="yellow.400" />
                <Text fontSize="xs" color="gray.300">
                  Ces services sont des tiers indépendants de Rescoe. Vérifiez toujours les URLs avant de connecter votre wallet.
                </Text>
              </Alert>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Modal Prix EUR */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent bg="rgba(1,28,57,0.95)" borderColor="rgba(238,212,132,0.2)" border="1px">
          <ModalHeader color="brand.cream">Valeurs en EUR</ModalHeader>
          <ModalCloseButton color="brand.cream" />
          <ModalBody color="brand.cream">
            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.400">
                  Prix ETH actuel
                </Text>
                <Text fontSize="2xl" fontWeight="bold">
                  €{priceState.eurPrice?.toFixed(2) || "—"}
                </Text>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.400">
                  Solde actuel
                </Text>
                <Text fontSize="xl" fontWeight="bold">
                  €
                  {formatNumberFR(
                    currentBalance * (priceState.eurPrice || 0),
                    2
                  )}
                </Text>
              </Box>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default UserFinanceDashboard;
