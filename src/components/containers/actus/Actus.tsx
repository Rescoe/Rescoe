// src/components/containers/actus/Actus.tsx
import React, { useEffect, useState } from "react";
import { Box, Button, useToast } from "@chakra-ui/react";
import Web3 from "web3";
import MessageEditions from "../../ABI/MessageEditions.json";
import axios from "axios";
import { keccak256 } from "js-sha3";


interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

interface ChannelFeedProps {
  channelId: string;
}

const CONTRACT_ADDRESS = "0x93bDfC9d22E47BaFF14726F249603d844795dEE4";

const ChannelFeed: React.FC<ChannelFeedProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const toast = useToast();
  const [rules, setRules] = useState<{
    price?: number;
    splitAddress?: string;
    editions?: number;
    duration?: string;
  }>({});

  // --- FETCH DES MESSAGES DISCORD ---
  const fetchMessages = async () => {
    try {
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
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [channelId, limit]);


  const mintMessage = async (msg: DiscordMessage) => {
    if (!(window as any).ethereum) {
      toast({ title: "Wallet non détecté", status: "error", duration: 4000, isClosable: true });
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

      // --- Inspect ABI pour debug (trouve la signature de mint dans l'ABI) ---
      const mintAbiEntry = ((MessageEditions as any).abi || []).find(
        (a: any) => a.name === "mint" && a.type === "function"
      );
      //console.log("mint abi entry:", mintAbiEntry);

      // --- Génération d'un vrai bytes32 via keccak/soliditySha3 ---
      const keccak = web3.utils.soliditySha3({ type: "string", value: msg.id }) as string | null;
      //console.log("keccak(msg.id) =>", keccak, "isHexStrict?", web3.utils.isHexStrict(keccak), "len:", keccak?.length);

      if (!keccak) throw new Error("Impossible de calculer le keccak du message id");

      // --- Choix du type à envoyer selon l'ABI ---
      const firstType = mintAbiEntry?.inputs?.[0]?.type;
      let discordMessageParam: any;
      if (!firstType || firstType === "bytes32") {
        discordMessageParam = keccak; // 0x... (bytes32)
      } else if (firstType === "uint256") {
        // Convertit le hash en BN (uint256)
        discordMessageParam = BigInt(keccak);

      } else {
        // fallback : envoie le hex (probablement bytes32 attendu)
        discordMessageParam = keccak;
      }
      //console.log("firstType:", firstType, "discordMessageParam:", discordMessageParam);

      // --- Prépare les autres params proprement ---
      const haiku = msg.content || " ";
      const pricePerEdition = rules.price ?? 0.001;
      const priceInWei = web3.utils.toWei(pricePerEdition.toString(), "ether");
      const salonRoyaltyAddress = rules.splitAddress ?? account;
      const editionsForSale = (() => {
        const m = msg.content.match(/\/editions (\d+)/i);
        return m ? parseInt(m[1], 10) : rules.editions ?? 1;
      })();
      const isOpenEdition = editionsForSale === 0;
      const durationRule = rules.duration ?? "7j";
      let mintDurationSeconds = 7 * 24 * 3600;
      if (durationRule.endsWith("j")) mintDurationSeconds = parseInt(durationRule) * 24 * 3600;
      else if (durationRule.endsWith("h")) mintDurationSeconds = parseInt(durationRule) * 3600;
      else if (durationRule.endsWith("m")) mintDurationSeconds = parseInt(durationRule) * 60;
      else mintDurationSeconds = parseInt(durationRule) || 7 * 24 * 3600;

      const imageUrl = msg.attachments[0]?.url || "";

      const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);
/*
      console.log("params prepared:", {
        discordMessageParam,
        haiku,
        priceInWei,
        salonRoyaltyAddress,
        imageUrl,
        messageTimestamp,
        mintDurationSeconds,
        editionsForSale,
        isOpenEdition,
      });
*/
      // --- Tentative d'encodeABI pour voir si Web3 accepte les types ---
      try {
        const encoded = contract.methods
          .mint(
            discordMessageParam,
            haiku,
            priceInWei,
            salonRoyaltyAddress,
            imageUrl,
            messageTimestamp,
            mintDurationSeconds,
            editionsForSale,
            isOpenEdition
          )
          .encodeABI();
        //console.log("encodeABI OK (preview):", encoded.slice(0, 140) + "...");
      } catch (encErr) {
        //console.error("encodeABI failed:", encErr);
        throw encErr;
      }

      //console.log("msg.value (sent)", typeof priceInWei, priceInWei);
      const valueToSend = BigInt(priceInWei);


      // --- Estimation du gas (debug utile avant send) ---
      const gasEstimate = await contract.methods
        .mint(
          discordMessageParam,
          haiku,
          priceInWei,
          salonRoyaltyAddress,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          editionsForSale,
          isOpenEdition
        )
        .estimateGas({ from: account, value: priceInWei });
      console.log("gasEstimate:", gasEstimate);

      // --- Envoi de la TX ---
      await contract.methods
        .mint(
          discordMessageParam,
          haiku,
          priceInWei,
          salonRoyaltyAddress,
          imageUrl,
          messageTimestamp,
          mintDurationSeconds,
          editionsForSale,
          isOpenEdition
        )
        .send({ from: account, value: valueToSend.toString(), gas: gasEstimate.toString() });

      toast({ title: "Mint réussi", description: `Message de ${msg.author.username} minté !`, status: "success", duration: 4000, isClosable: true });
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({ title: "Mint échoué", description: err?.message || "Erreur inconnue lors du mint.", status: "error", duration: 6000, isClosable: true });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };





  return (
    <Box maxWidth="700px" mx="auto" p={4}>
      {Object.keys(rules).length > 0 ? (
        <Box
          border="1px solid #444"
          borderRadius="10px"
          p={3}
          mb={4}
          bg="#222"
          color="#ddd"
        >
          <strong>Règles du salon :</strong>
          <Box fontSize="sm" mt={1}>
            Prix par édition : {rules.price ?? "—"} ETH
            <br />
            Adresse de split : {rules.splitAddress ?? "—"}
            <br />
            Nombre d’éditions : {rules.editions ?? "—"}
            <br />
            Durée : {rules.duration ?? "—"}
          </Box>
        </Box>
      ) : (
        <Box mb={4} color="#bbb">
          Aucune règle épinglée pour ce salon.
        </Box>
      )}

      {messages.map((msg) => (
        <Box
          key={msg.id}
          border="1px solid #333"
          borderRadius="12px"
          p={4}
          mb={4}
          bg="#111"
          color="#fff"
        >
          <Box display="flex" alignItems="center" mb={2}>
            <img
              src={
                msg.author.avatar
                  ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                  : "/default-avatar.png"
              }
              alt={msg.author.username}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                marginRight: 10,
              }}
            />
            <strong>{msg.author.username}</strong>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.8rem",
                color: "#aaa",
              }}
            >
              {new Date(msg.timestamp).toLocaleString()}
            </span>
          </Box>
          <Box whiteSpace="pre-wrap" mb={2}>
            {msg.content}
          </Box>
          {msg.attachments.map(
            (att, i) =>
              att.content_type?.startsWith("image/") && (
                <Box key={i} mb={2}>
                  <img
                    src={att.url}
                    alt="attachment"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      borderRadius: "8px",
                    }}
                  />
                </Box>
              )
          )}
          <Button
            size="sm"
            colorScheme="teal"
            onClick={() => mintMessage(msg)}
            isLoading={mintingIds.includes(msg.id)}
          >
            Mint ce message
          </Button>
        </Box>
      ))}
      {messages.length >= limit && (
        <Button mt={2} onClick={() => setLimit((prev) => prev + 10)}>
          Voir plus
        </Button>
      )}
    </Box>
  );
};

export default function Actus() {
  const [activeTab, setActiveTab] = useState<"news" | "expos">("news");
  const channels = {
    news: process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID as string,
    expos: process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID as string,
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        Actualités & Expositions
      </h2>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        {(["news", "expos"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.5rem 1rem",
              margin: "0 0.5rem",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === tab ? "#0070f3" : "#333",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {tab === "news" ? "News" : "Expos"}
          </button>
        ))}
      </div>
      <ChannelFeed channelId={channels[activeTab]} />
    </div>
  );
}
