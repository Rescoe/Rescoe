// src/components/containers/actus/Actus.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "@chakra-ui/react";
import Web3 from "web3";
import MessageEditions from "../../ABI/MessageEditions.json";
import { keccak256 } from "js-sha3";
import { Formations } from "@/components/containers/association/Formations";

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

const CONTRACT_ADDRESS = "0xDb5fd535f7c380F0588092D0f52b3A742cE89629";

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

  // Votre fonction mintMessage reste la même (pour des raisons de concision je ne la remets pas ici)
  // Assurez-vous que mintMessage est bien déclarée dans ce scope.

  return (
    <Box maxWidth="700px" mx="auto" p={4}>
      <Formations />
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
            //onClick={() => mintMessage(msg)}
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
  const [activeTab, setActiveTab] = useState("news");

  const channels = {
    news: process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID as string,
    expos: process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID as string,
  };

  return (
    <Box maxWidth="800px" mx="auto" p={8}>
      <Box as="h2" textAlign="center" mb={6} fontSize="2xl" fontWeight="bold">
        Actualités & Expositions
      </Box>

      <Tabs index={activeTab === "expos" ? 1 : 0} onChange={(i) => setActiveTab(i === 0 ? "news" : "expos")}>
        <TabList justifyContent="center" mb={4}>
          <Tab>News</Tab>
          <Tab>Expositions</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <ChannelFeed channelId={channels.news} />
          </TabPanel>
          <TabPanel>
            <ChannelFeed channelId={channels.expos} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
