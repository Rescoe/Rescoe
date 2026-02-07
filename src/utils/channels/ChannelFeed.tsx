"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  useBreakpointValue,
  Button,
  useToast,
  Spinner,
  IconButton,
  useColorModeValue
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Formations } from "@/components/containers/association/Formations";

import {useAdherentDataOnce} from  "@/hooks/useAdherentDataOnce";

import { useAuth } from "@/utils/authContext"; // chemin vers ton AuthProvider
import MessageEditions from "@/components/ABI/MessageEditions.json";
import { keccak256 } from "js-sha3";


function parseFrenchDate(str: string): Date {
  const [day, month, year] = str.split("/").map(Number);
  return new Date(year, month - 1, day); // mois indexé à 0
}


const CONTRACT_ADDRESS = "0xF5C33Ef33756B17498eb1F9fEebbcC5918aa2bbc";

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

interface ChannelFeedProps {
  channelId: string;
}

// Typage pour les détails du token
interface TokenDetails {
  mintDate: string;
  haiku_: string;
  currentPrice?: string;
  remainingEditions?: string;
  haikuRoyalties?: any;
  transactions?: any[];
  forSale?: boolean;
  haikuId?: number;
}

interface AdherentFullData {
  finAdhesion?: string;
  // autres champs si besoin
}

const ChannelFeed: React.FC<ChannelFeedProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [tokenDetails, setTokenDetails] = useState<{ [msgId: string]: any }>({});
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);


  const [loading, setLoading] = useState(true);

  const { web3, address } = useAuth();

  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const [isAdherent, setIsAdherent] = useState<Boolean>(false);

  const toast = useToast();
  const [rules, setRules] = useState<{
    price?: number;
    splitAddress?: string;
    editions?: number;
    duration?: string;
  }>({});


  const { data: adherentData } = useAdherentDataOnce(address ?? undefined);

  useEffect(() => {
    if (adherentData?.finAdhesion) {
      const [day, month, year] = adherentData.finAdhesion.split("/").map(Number);
      const finAdhesionDate = new Date(year, month - 1, day);
      setIsAdherent(finAdhesionDate > new Date());
    } else {
      setIsAdherent(false);
    }
  }, [adherentData]);

  //console.log(isAdherent);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/channel/${channelId}?limit=${limit}`);
      const data = await res.json();
      const messagesArray = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
        ? data
        : [];
      setMessages(messagesArray);

      const pinnedContent = data?.pinnedMessage?.content ?? null;
      if (pinnedContent) {
        const priceMatch = pinnedContent.match(/\/prix (\d+(\.\d+)?)/i);
        const addressMatch = pinnedContent.match(/\/split (0x[a-fA-F0-9]{40})/i);
        const editionsMatch = pinnedContent.match(/\/editions (\d+)/i);
        const durationMatch = pinnedContent.match(/\/duree (\S+)/i);

        setRules({
          price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
          splitAddress: addressMatch ? addressMatch[1] : undefined,
          editions: editionsMatch ? parseInt(editionsMatch[1]) : undefined,
          duration: durationMatch ? durationMatch[1] : undefined,
        });
      } else {
        setRules({});
      }
    } catch (err) {
      console.error("Erreur fetch Discord:", err);
      toast({
        title: "Erreur lors du chargement",
        description: "Impossible de charger les messages.",
        status: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [channelId, limit]);
  const handleExpandMessage = async (msg: DiscordMessage) => {
      if (!web3 || !address) return;
      setExpandedMessage(msg.id);

      if (tokenDetails[msg.id] !== undefined) return;

      try {
        const contract = new web3.eth.Contract((MessageEditions as any).abi ?? MessageEditions, CONTRACT_ADDRESS);

        const lastHaikuId: number = Number(await contract.methods.getLastUniqueHaikusMinted().call());
        let matchedToken: { tokenId: string; details: TokenDetails } | null = null;

        for (let id = 0; id < lastHaikuId; id++) {
          const tokenId: string = await contract.methods.haikuIdToTokenId(id).call();
          const details: TokenDetails = await contract.methods.getTokenFullDetails(tokenId).call() as TokenDetails;

          const remainingEditions = await contract.methods.getRemainingEditions(id).call();
          const haikuRoyalties = await contract.methods.getHaikuRoyalties(id).call();

          const transactionsRaw = await contract.methods.getTransactionHistory(tokenId).call();
          const transactions: any[] = Array.isArray(transactionsRaw) ? transactionsRaw : [];

          const forSaleRaw = await contract.methods.isNFTForSale(tokenId).call();
          const forSale: boolean = typeof forSaleRaw === "boolean" ? forSaleRaw : false;

          const tokenTimestamp = parseInt(details.mintDate, 10);
          const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);

          const normalize = (s: string = "") => s.replace(/\s+/g, " ").trim();
          const contentMatch = normalize(details.haiku_) === normalize(msg.content);
          const timestampsMatch = tokenTimestamp === messageTimestamp || tokenTimestamp === messageTimestamp * 1000;

          if (contentMatch || timestampsMatch) {
            matchedToken = {
              tokenId,
              details: {
                ...details,
                remainingEditions: Number(remainingEditions).toString(),
                haikuRoyalties,
                transactions,
                forSale,
                haikuId: id,
              },
            };
            break;
          }
        }

        setTokenDetails(prev => ({ ...prev, [msg.id]: matchedToken?.details ?? null }));
      } catch (err) {
        console.error("Erreur fetch token details:", err);
        setTokenDetails(prev => ({ ...prev, [msg.id]: null }));
      }
    };


  const mintMessage = async (msg: DiscordMessage, adherentData?: AdherentFullData | null) => {
    if (!web3 || !address) throw new Error("Connectez votre wallet avant de mint");
    if (!rules.price) throw new Error("Prix non défini");

    try {
      setMintingIds((prev) => [...prev, msg.id]);

      const ethereum = (window as any).ethereum;
      await ethereum.request({ method: "eth_requestAccounts" });

      const contract = new web3.eth.Contract(
        (MessageEditions as any).abi ?? MessageEditions,
        CONTRACT_ADDRESS
      );

      // ----------------------------------------------------------
      // 1) Données de base
      // ----------------------------------------------------------
      const keccak = web3.utils.soliditySha3({ type: "string", value: msg.id })!;
      const haiku = msg.content || " ";
      const pricePerEdition = rules.price ?? 0.001;
      const priceInWei = web3.utils.toWei(pricePerEdition.toString(), "ether");

      // Vérification adhérent = clef du patch 🔥
      // ----------------------------------------------------------
  // 1) Vérification adhérent valide (finAdhesion > maintenant)
  // ----------------------------------------------------------
  const reductionRate = 200; // 20% de réduction pour les adhérents

  // prix réel
  const priceBN = BigInt(priceInWei);
  const priceToPay = isAdherent ? (priceBN * (1000n - BigInt(reductionRate))) / 1000n : priceBN;

  //console.log("isAdherent:", isAdherent, "priceToPay:", priceToPay.toString());


      // timestamp
      const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);

      // durée
      const durationRule = rules.duration ?? "7j";
      let mintDurationSeconds = 7 * 24 * 3600;
      if (durationRule.endsWith("j")) mintDurationSeconds = parseInt(durationRule) * 24 * 3600;
      else if (durationRule.endsWith("h")) mintDurationSeconds = parseInt(durationRule) * 3600;
      else if (durationRule.endsWith("m")) mintDurationSeconds = parseInt(durationRule) * 60;

      // image
      const imageUrl = msg.attachments?.[0]?.url || "";

      // éditions
      const editionsForSale = (() => {
        const m = msg.content.match(/\/editions (\d+)/i);
        return m ? parseInt(m[1], 10) : rules.editions ?? 1;
      })();
      const isOpenEdition = editionsForSale === 0;

      // ----------------------------------------------------------
      // 2) Split addresses
      // ----------------------------------------------------------
      const splitRegex = /\/split\s+((0x[a-fA-F0-9]{40}\s*)+)/i;
      const splitMatch = msg.content.match(splitRegex);

      let recipients: string[] = [];
      if (splitMatch) {
        recipients = splitMatch[1]
          .trim()
          .split(/\s+/)
          .filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
      }

      // ----------------------------------------------------------
      // 3) Percentages
      // ----------------------------------------------------------
      const percentRegex = /\/percent\s+([\d\s]+)/i;
      const percentMatch = msg.content.match(percentRegex);

      let percentages: number[] = [];
      if (percentMatch) {
        percentages = percentMatch[1]
          .trim()
          .split(/\s+/)
          .map((n) => parseInt(n, 10));
      }

      // ----------------------------------------------------------
      // 4) Fallbacks identiques ateliers/messages
      // ----------------------------------------------------------
      const fallbackSplit = rules.splitAddress || address;

      const recipientsForMint =
        recipients.length > 0 ? recipients : [fallbackSplit];

      const percentagesForMint =
        percentages.length > 0 ? percentages : [1000]; // 100%

      //  //console.log("priceInWei");
      //  //console.log(priceInWei);

      // ----------------------------------------------------------
      // 5) ESTIMATION **AVEC LE BON PRICE**
      // ----------------------------------------------------------
      // Estimation gas
      const gasEstimate = await contract.methods
        .mint(
          keccak,
          haiku,
          priceInWei,           // prix catalogue
          fallbackSplit,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          editionsForSale,
          isOpenEdition,
          recipientsForMint,
          percentagesForMint,
          reductionRate         // 200 = 20%
        )
        .estimateGas({
          from: address,
          value: priceToPay.toString(), // prix payé réel (réduction appliquée)
        });

    //  //console.log(gasEstimate);
  //    //console.log(priceToPay);
      // Envoi transaction
      await contract.methods
        .mint(
          keccak,
          haiku,
          priceInWei,
          fallbackSplit,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          editionsForSale,
          isOpenEdition,
          recipientsForMint,
          percentagesForMint,
          reductionRate
        )
        .send({
          from: address,
          value: priceToPay.toString(),
          gas: gasEstimate.toString(),
        });

      toast({
        title: "Mint réussi",
        description: `Message de ${msg.author.username} minté !`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({
        title: "Mint échoué",
        description: err?.message || "Erreur inconnue lors du mint.",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };


  return (
<Box w="full" px={0} py={0}>

      {/* RÈGLES DU SALON */}
      <Box
        borderRadius="lg"
        bg="gray.800"
        border="1px solid"
        borderColor="gray.700"
      >
        <Text fontWeight="bold" >
          Règles du salon
        </Text>
        <Text fontSize="sm" mt={1}>
          Prix : {rules.price ?? "—"} ETH • Split :{" "}
          {rules.splitAddress ?? "—"} • Éditions : {rules.editions ?? "—"} •
          Durée : {rules.duration ?? "—"}
        </Text>
      </Box>

      {/* CHARGEMENT */}
      {loading && (
        <Flex justify="center" align="center" py={8}>
          <Spinner size="xl" />
        </Flex>
      )}

      {/* MESSAGES */}
      {!loading &&
          messages.map((msg) => (
            <Box
              key={msg.id}
              p={5}
              mb={4}
              border="1px solid"
              borderColor="gray.700"
              borderRadius="xl"
              boxShadow="md"
              _hover={{ transform: "scale(1.01)" }}
              transition="all 0.2s ease"
              cursor="pointer"
              onClick={() => handleExpandMessage(msg)}
            >
            <Flex align="center" mb={3}>
              <Box
                as="img"
                src={
                  msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                    : "/default-avatar.png"
                }
                alt={msg.author.username}
                boxSize="40px"
                borderRadius="full"
                mr={3}
              />
              <Text fontWeight="bold">{msg.author.username}</Text>
              <Text
                ml="auto"
                fontSize="xs"

                whiteSpace="nowrap"
              >
                {new Date(msg.timestamp).toLocaleString()}
              </Text>
            </Flex>

            <Text whiteSpace="pre-wrap" mb={3}>
              {msg.content}
            </Text>

            {msg.attachments.map(
              (att, i) =>
                att.content_type?.startsWith("image/") && (
                  <Box key={i} mb={3}>
                    <Box
                      as="img"
                      src={att.url}
                      alt="attachment"
                      borderRadius="lg"
                      maxW="100%"
                      objectFit="cover"
                    />
                  </Box>
                )
            )}

            <Button
              size="sm"
              onClick={() => mintMessage(msg)}
              isLoading={mintingIds.includes(msg.id)}
            >
              Acheter ce journal
            </Button>

            {/* ✅ Détails affichés uniquement si message sélectionné */}
            {expandedMessage === msg.id && tokenDetails[msg.id] !== undefined && (
              <Box mt={2} p={2} bg="gray.700" borderRadius="md">
                {tokenDetails[msg.id] ? (
                  <>
                    <Text fontSize="sm">
                      Éditions restantes: {tokenDetails[msg.id].remainingEditions} / {rules.editions ?? 10}
                    </Text>
                    <Text fontSize="sm">
                      Durée restante: {(() => {
                        const endTimestamp = parseInt(tokenDetails[msg.id].mintDate) + 7 * 24 * 3600;
                        const remaining = endTimestamp - Math.floor(Date.now() / 1000);
                        const h = Math.floor(remaining / 3600);
                        const m = Math.floor((remaining % 3600) / 60);
                        const s = remaining % 60;
                        return `${h}h ${m}m ${s}s`;
                      })()}
                    </Text>
                    <Text fontSize="sm">
                      Prix actuel: {web3 ? web3.utils.fromWei(tokenDetails[msg.id].currentPrice, "ether") : "—"} ETH
                    </Text>

                    <Text fontSize="sm">
                      À vendre: {tokenDetails[msg.id].forSale ? "Oui" : "Non"}
                    </Text>
                  </>
                ) : (
                  <Text fontSize="sm" color="gray.300">
                    Aucun token minté pour ce message
                  </Text>
                )}
              </Box>
            )}

       </Box>
     ))}

      {/* BOUTON "VOIR PLUS" */}
      {!loading && messages.length >= limit && (
        <Flex justify="center" mt={6}>
          <Button
            variant="outline"
            onClick={() => setLimit((prev) => prev + 10)}
          >
            Voir plus
          </Button>
        </Flex>
      )}
    </Box>
  );
};


export default ChannelFeed;
