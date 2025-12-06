// src/components/dashboard/UserFinanceDashboard.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  Select,
} from "@chakra-ui/react";
import { Line } from "react-chartjs-2";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler   // ← obligatoire pour fill: true
);


type TransactionItem = {
  hash: string;
  from_address: string | null;
  to_address: string | null;
  value: string;
  block_timestamp: string;
  transaction_fee: string;
  internal_transactions?: Array<{ from: string; to: string; value: string }>;
};

type BalanceSnapshot = {
  date: Date;
  balance: number;
};

const USER_TRANSACTIONS_PAGE_SIZE = 500;

const CHAINS = [
  { label: "Sepolia", value: "base sepolia", color: "#D69E2E" }, // jaune
  { label: "Ethereum", value: "eth", color: "#4299E1" }, // bleu
  { label: "Base", value: "base", color: "#ED8936" }, // orange
];

// utilitaire pour tronquer les adresses
const truncateAddress = (addr: string | null) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";

const UserFinanceDashboard = ({ walletAddress }: { walletAddress: string }) => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalGains, setTotalGains] = useState(0);
  const [totalSolde, setTotalSolde] = useState(0);


  const [balanceHistory, setBalanceHistory] = useState<BalanceSnapshot[]>([]);

  const [chain, setChain] = useState("base sepolia");
  const [timeGroup, setTimeGroup] = useState<"hour" | "day" | "month">("hour");
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/proxy?url=https://deep-index.moralis.io/api/v2.2/${walletAddress}/verbose?chain=${chain}&include=internal_transactions&order=ASC&limit=${USER_TRANSACTIONS_PAGE_SIZE}`
        );
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
        setTransactions(data.result || []);
      } catch (err: any) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [walletAddress, chain]); // déclenche seulement si walletAddress ou chain changent

  // Calcul du solde cumulatif
  useEffect(() => {
    if (!transactions.length) return;

    const walletLower = walletAddress.toLowerCase();
    let cumulativeBalance = 0;
    const snapshots: BalanceSnapshot[] = [];
    let totalGainsCalc = 0;
    let totalExpensesCalc = 0;

    // Tri par date ASC
    const sortedTxs = [...transactions].sort(
      (a, b) => new Date(a.block_timestamp).getTime() - new Date(b.block_timestamp).getTime()
    );

    sortedTxs.forEach((tx) => {
      const valueEth = parseFloat(tx.value) / 1e18;
      const feeEth = parseFloat(tx.transaction_fee) / 1e18;
      const isIncoming = (tx.to_address ?? "").toLowerCase() === walletLower;
      const isOutgoing = (tx.from_address ?? "").toLowerCase() === walletLower;

      if (isIncoming) {
        cumulativeBalance += valueEth;
        totalGainsCalc += valueEth;
      } else if (isOutgoing) {
        cumulativeBalance -= valueEth + feeEth;
        totalExpensesCalc += valueEth + feeEth;
      }

      snapshots.push({
        date: new Date(tx.block_timestamp),
        balance: cumulativeBalance,
      });
    });

    setBalanceHistory(snapshots);
    setTotalGains(totalGainsCalc);
    setTotalExpenses(totalExpensesCalc);
    setTotalSolde(cumulativeBalance);
  }, [transactions, walletAddress]); // déclenche seulement quand transactions ou walletAddress changent



  function getChartData(
    balanceHistory: { date: Date; balance: number }[],
    chain: string,
    timeGroup: "hour" | "day" | "month"
  ) {
    if (!balanceHistory?.length) return { labels: [], datasets: [{ label: `Balance (${chain})`, data: [] }] };

    // Trier chronologiquement
    const sorted = [...balanceHistory].sort((a, b) => a.date.getTime() - b.date.getTime());

    // On regroupe par période mais **on prend le dernier solde de chaque groupe**
    const grouped: Record<string, number> = {};
    sorted.forEach((snap) => {
      let key = "";
      const d = snap.date;
      if (timeGroup === "hour") key = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      if (timeGroup === "day") key = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      if (timeGroup === "month") key = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      grouped[key] = snap.balance; // <-- on **remplace**, pas on ajoute
    });

    const labels = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const data = labels.map((l) => grouped[l]);

    return {
      labels,
      datasets: [
        {
          label: `Balance (${chain})`,
          data,
          borderColor: "#38B2AC",
          backgroundColor: "#38B2AC33",
          fill: true,
        },
      ],
    };
  }


  if (loading)
    return (
      <Flex justify="center" align="center" py={8}>
        <Spinner />
      </Flex>
    );
  if (error) return <Text color="red.500">Erreur: {error}</Text>;


  // années disponibles pour le select
  const years = Array.from(
    new Set(transactions.map((tx) => new Date(tx.block_timestamp).getFullYear()))
  );

  return (
    <Box p={{ base: 2, md: 6 }}>
    <Flex
      direction={{ base: "column", md: "row" }}
      justify="space-between"
      align={{ base: "flex-start", md: "center" }}
      gap={{ base: 3, md: 0 }}
      mb={4}
    >
        <Text fontSize="2xl" fontWeight="700" mb={2}>
          Transactions de {walletAddress}
        </Text>

        <Flex
          gap={2}
          wrap="wrap"
          w={{ base: "100%", md: "auto" }}
        >
          <Select
            w={{ base: "100%", md: "150px" }}
            onChange={(e) => setChain(e.target.value)}
            value={chain}
          >
            {CHAINS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select
            w={{ base: "100%", md: "100px" }}
            onChange={(e) => setTimeGroup(e.target.value as any)}
            value={timeGroup}
          >
            <option value="hour">Heure</option>
            <option value="day">Jour</option>
            <option value="month">Mois</option>
          </Select>

          <Select
            w={{ base: "100%", md: "100px" }}
            placeholder="Année"
            onChange={(e) => setYearFilter(Number(e.target.value))}
            value={yearFilter ?? ""}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </Flex>
      </Flex>

      <Flex
        direction={{ base: "column", md: "row" }}
        gap={{ base: 2, md: 6 }}
        mb={4}
      >
      <Text>
        Solde:{" "}
        <Text
          as="span"
          color={totalSolde >= 0 ? "green.500" : "red.500"}
        >
          {totalSolde.toFixed(4)} ETH
        </Text>
      </Text>
        <Text>
          Total Gains:{" "}
          <Text as="span" color="green.500">
            {totalGains.toFixed(4)} ETH
          </Text>
        </Text>
        <Text>
          Total Dépenses:{" "}
          <Text as="span" color="red.500">
            {totalExpenses.toFixed(4)} ETH
          </Text>
        </Text>

      </Flex>

      <Box mb={6} w="100%" overflowX="auto">
        <Box minW={{ base: "500px", md: "auto" }}>
          <Line
            data={getChartData(balanceHistory, chain, timeGroup === "hour" ? "day" : timeGroup)}
            options={{
              maintainAspectRatio: false,
            }}
          />

        </Box>
      </Box>

      {/* =======================
          TABLE DESKTOP (>= md)
         ======================= */}
      <Box display={{ base: "none", md: "block" }}>
        <Table variant="simple" size="sm">
          <TableCaption>Historique des Transactions</TableCaption>
          <Thead>
            <Tr>
              <Th>Hash</Th>
              <Th>De</Th>
              <Th>À</Th>
              <Th>Valeur</Th>
              <Th>Frais</Th>
              <Th>Date</Th>
              <Th>Type</Th>
            </Tr>
          </Thead>

          <Tbody>
            {transactions.map((tx) => {
              const isIncoming =
                (tx.to_address ?? "").toLowerCase() ===
                (walletAddress ?? "").toLowerCase();

              return (
                <Tr
                  key={tx.hash}
                  color={isIncoming ? "green.500" : "red.500"}
                >
                  <Td>{truncateAddress(tx.hash)}</Td>
                  <Td>{truncateAddress(tx.from_address)}</Td>
                  <Td>{truncateAddress(tx.to_address)}</Td>
                  <Td>{(parseFloat(tx.value) / 1e18).toFixed(4)}</Td>
                  <Td>{tx.transaction_fee}</Td>
                  <Td>{new Date(tx.block_timestamp).toLocaleString()}</Td>
                  <Td>{isIncoming ? "Entrée" : "Sortie"}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>



      {/* =======================
          VERSION MOBILE (< md)
         ======================= */}
         <Box display={{ base: "flex", md: "none" }} overflowX="auto" mt={4}>
     <Table variant="simple" size="sm" minW="600px">
       <Thead>
         <Tr>
           <Th>Hash</Th>
           <Th>De</Th>
           <Th>À</Th>
           <Th>Valeur</Th>
           <Th>Frais</Th>
           <Th>Date</Th>
           <Th>Type</Th>
         </Tr>
       </Thead>

       <Tbody>
         {transactions.map((tx) => {
           const isIncoming =
             (tx.to_address ?? "").toLowerCase() ===
             (walletAddress ?? "").toLowerCase();

           return (
             <Tr
               key={tx.hash}
               color={isIncoming ? "green.600" : "red.600"}
             >
               <Td>{truncateAddress(tx.hash)}</Td>
               <Td>{truncateAddress(tx.from_address)}</Td>
               <Td>{truncateAddress(tx.to_address)}</Td>
               <Td>{(parseFloat(tx.value) / 1e18).toFixed(4)} ETH</Td>
               <Td>{tx.transaction_fee}</Td>
               <Td>{new Date(tx.block_timestamp).toLocaleString()}</Td>
               <Td>{isIncoming ? "Entrée" : "Sortie"}</Td>
             </Tr>
           );
         })}
       </Tbody>
     </Table>
   </Box>

    </Box>
  );
};

export default UserFinanceDashboard;
