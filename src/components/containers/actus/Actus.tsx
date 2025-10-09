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

const CONTRACT_ADDRESS = "0xF050834a6cfdF20118B9f1e896739e7eD7FcF58c";

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
      toast({
        title: "Wallet non détecté",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    try {
      setMintingIds((prev) => [...prev, msg.id]);

      const ethereum = (window as any).ethereum;
      await ethereum.request({ method: "eth_requestAccounts" });
      const web3 = new Web3(ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];

      const contract = new web3.eth.Contract(MessageEditions as any, CONTRACT_ADDRESS);

      // --- Récupération des règles ---
      let pricePerEdition = rules.price ?? 0.001;
      let editionsForSale = rules.editions ?? 1;
      let salonRoyaltyAddress = rules.splitAddress ?? account;

      const priceMatch = msg.content.match(/\/prix (\d+(\.\d+)?)/i);
      if (priceMatch) pricePerEdition = parseFloat(priceMatch[1]);

      const addressMatch = msg.content.match(/\/split (0x[a-fA-F0-9]{40})/i);
      if (addressMatch) salonRoyaltyAddress = addressMatch[1];

      const editionsMatch = msg.content.match(/\/editions (\d+)/i);
      if (editionsMatch) editionsForSale = parseInt(editionsMatch[1]);

      const durationMatch = rules.duration;
      let mintDurationSeconds = 3600; // fallback 1h
      if (durationMatch) {
        const dur = durationMatch;
        if (dur.endsWith("j")) mintDurationSeconds = parseInt(dur) * 24 * 3600;
        else if (dur.endsWith("h")) mintDurationSeconds = parseInt(dur) * 3600;
        else if (dur.endsWith("m")) mintDurationSeconds = parseInt(dur) * 60;
        else mintDurationSeconds = parseInt(dur);
      }

      const mintDurationSecondsString = mintDurationSeconds.toString()
      // --- Paramètres de mint pour ce test ---
      //const discordMessageId = "1425418191232041001"; // ID du message Discord
      const discordMessageId = "123456789";// msg.id;  // ID du message Discord
      const discordMessageIdVrai = msg.id;  // ID du message Discord

      //const hashedId = keccak256(discordMessageId); // Hachage de l'ID


// Vérification de sécurité : transformer en BigInt pour s'assurer que c'est valide
const messageIdBigInt = BigInt(discordMessageIdVrai);
const messageIdString = messageIdBigInt.toString(); // décimal, prêt pour Solidity

console.log("ID Discord converti :", messageIdString, typeof messageIdString);



      const haiku = msg.content || " "; // jamais vide
      const priceInWei = web3.utils.toWei(pricePerEdition.toString(), "ether"); // string
      let imageUrl = msg.attachments[0]?.url || " ";

      // --- Upload d’image sur IPFS (optionnel) ---
      if (
        msg.attachments.length > 0 &&
        msg.attachments[0].content_type?.startsWith("image/")
      ) {
        try {
          const file = await fetch(msg.attachments[0].url).then((r) => r.blob());
          const formData = new FormData();
          formData.append("file", file);
          const imageResponse = await axios.post<{ IpfsHash: string }>(
            "https://api.pinata.cloud/pinning/pinFileToIPFS",
            formData,
            {
              headers: {
                Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                "Content-Type": "multipart/form-data",
              },
            }
          );
          imageUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
        } catch (err) {
          console.warn("IPFS upload échoué, mint sans image");
        }
      }

      // Timestamp en secondes
      const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);

      // --- Vérifications locales ---
      const latestBlock = await web3.eth.getBlock("latest");
      const chainTimestamp = Number(latestBlock.timestamp);


      //if (chainTimestamp > messageTimestamp + mintDurationSecondsString) throw new Error("Période de mint expirée");

      // --- Envoi de la TX ---
      await contract.methods
        .mint(
          discordMessageId,
          haiku,
          priceInWei,
          salonRoyaltyAddress,
          imageUrl,
          messageTimestamp,
          mintDurationSecondsString,
          editionsForSale
        )
        .send({
          from: account,
          value: priceInWei,
          gas: "500000",
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
