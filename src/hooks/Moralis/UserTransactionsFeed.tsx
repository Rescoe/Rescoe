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

  // Hook pour prix historiques
  const timestamps = useMemo(
    () => transactions.map((tx) => tx.block_timestamp),
    [transactions]
  );
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
      try {
        if (!provider) return 0;
        const balanceWei = await provider.getBalance(userAddress);
        const balanceEth = parseFloat(formatUnits(balanceWei, 18));
        const rounded = Math.max(0, parseFloat(balanceEth.toFixed(6)));
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
            /*console.log(`Tx ${tx.hash.slice(0,10)} internals (${internals.length}):`, internals.slice(0,3).map(i => ({
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
        return all.sort((a, b) =>
          new Date(b.block_timestamp).getTime() - new Date(a.block_timestamp).getTime()
        );

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

  // 2. REMPLACER le useMemo normalizedLedger par celui-ci
  const normalizedLedger = useMemo<LedgerEntry[]>(() => {
    if (!effectiveAddress || !transactions.length) return [];

    const lowerAddress = effectiveAddress.toLowerCase();

    // Trier du PLUS RÉCENT au PLUS ANCIEN pour calculer les soldes en remontant
    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(b.block_timestamp).getTime() -
        new Date(a.block_timestamp).getTime()
    );

    // PARTIR du solde actuel
    let balanceEth = currentBalance;
    let balanceEur = currentBalance * (priceState.eurPrice || 0);
    const eurAvailable = priceState.status === "available";

    // Créer le ledger en remontant le temps
    const ledger = sorted.map((tx) => {
      const amountETH = Number(tx.value ?? "0") / 1e18;
      const classification = classifyTransaction(
        tx,
        lowerAddress,
        rescoeContracts
      );

      // Prix à la date de la transaction
      const dateKey = new Date(tx.block_timestamp)
        .toISOString()
        .slice(0, 10);
      const priceForDate = priceHistory[dateKey] || priceState.eurPrice || 0;
      const eur =
        eurAvailable && priceForDate > 0 ? amountETH * priceForDate : null;

      // EN REMONTANT LE TEMPS, on fait l'inverse
      // Si c'était une entrée, on la soustrait
      // Si c'était une sortie, on l'ajoute
      const directionMultiplier =
        classification.direction === "Entrant" ? -1 : 1;

      balanceEth -= amountETH * directionMultiplier;
      if (eur != null) {
        balanceEur -= eur * directionMultiplier;
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
        balanceEth: Math.max(0, balanceEth),
        balanceEur: eurAvailable ? Math.max(0, balanceEur) : null,
        isRescoe: classification.isRescoe,
        contract: tx.token_address ?? undefined,
        comment: classification.comment,
        tokenAddress: tx.token_address,
      };
    });

    // INVERSER pour avoir du plus ancien au plus récent
    return ledger.reverse();
  }, [
    transactions,
    effectiveAddress,
    rescoeContracts,
    priceState,
    priceHistory,
    currentBalance,
  ]);

  // 3. REMPLACER le useMemo filteredLedger par celui-ci
  const filteredLedger = useMemo(() => {
    if (!normalizedLedger.length) return [];

    const now = new Date();
    const start = new Date();

    if (filters.period === "month") {
      start.setMonth(now.getMonth());
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (filters.period === "year") {
      // PARTIR DU 1er JANVIER
      start.setFullYear(now.getFullYear());
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setTime(0);
    }

    // Filtrer les transactions
    const filtered = normalizedLedger.filter((entry) => {
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

    // Trouver le solde au début de la période
    const allBeforePeriod = normalizedLedger.filter(
      (entry) => entry.timestamp < start
    );
    const startBalance =
      allBeforePeriod.length > 0
        ? allBeforePeriod[allBeforePeriod.length - 1].balanceEth
        : 0;

    let balanceEth = startBalance;
    let balanceEur = startBalance * (priceState.eurPrice || 0);

    // Recalculer les soldes cumulatifs pour les données filtrées
    return filtered.map((entry) => {
      const directionMultiplier =
        entry.direction === "Entrant" ? 1 : -1;

      balanceEth += entry.amountETH * directionMultiplier;
      if (entry.amountEUR != null) {
        balanceEur += entry.amountEUR * directionMultiplier;
      }

      return {
        ...entry,
        balanceEth: Math.max(0, balanceEth),
        balanceEur: entry.amountEUR != null ? Math.max(0, balanceEur) : null,
      };
    });
  }, [normalizedLedger, filters, priceState.eurPrice]);

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
            border="1px solid rgba(180,166,213,0.3)"
            bg="rgba(180,166,213,0.08)"
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
            border="1px solid rgba(180,166,213,0.3)"
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
