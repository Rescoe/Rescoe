import React, { useEffect, useState } from "react";
import { Box, Button, useToast } from "@chakra-ui/react";
import { ethers } from "ethers";
import MessageEditions from "../../ABI/MessageEditions.json";

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

const CONTRACT_ADDRESS = "0x7f0398a2e6edd73e742e4eb2c481be684b44a4ad";

const ChannelFeed: React.FC<ChannelFeedProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const toast = useToast();

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/channel/${channelId}?limit=${limit}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [channelId, limit]);

  const mintMessage = async (msg: DiscordMessage) => {
    if (!window.ethereum) {
      toast({
        title: "Wallet non détecté",
        description: "Installez MetaMask pour mint vos messages.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setMintingIds((prev) => [...prev, msg.id]);


      const ethereum = window.ethereum as any; // simple
      await ethereum.request({ method: "eth_requestAccounts" });

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, MessageEditions, signer);


      const pricePerEdition = 0; // gratuit
      const editionsForSale = 1; // 1 édition par message
      const salonRoyaltyAddress = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879"; // adresse de royalties

      const tx = await contract.mint(
        msg.content,
        pricePerEdition,
        editionsForSale,
        salonRoyaltyAddress
      );
      await tx.wait();

      toast({
        title: "Mint réussi",
        description: `Message de ${msg.author.username} minté !`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Mint échoué",
        description: err?.message || "Erreur lors du mint du message.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };

  return (
    <Box maxWidth="700px" mx="auto" p={4}>
      {messages && messages.length > 0 ? (
        messages.map((msg) => (
          <Box
            key={msg.id}
            border="1px solid #333"
            borderRadius="12px"
            p={4}
            mb={4}
            bg="#111"
            color="#fff"
          >
            {/* Header */}
            <Box display="flex" alignItems="center" mb={2}>
              <img
                src={
                  msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                    : "/default-avatar.png"
                }
                alt={msg.author.username}
                style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
              />
              <strong>{msg.author.username}</strong>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aaa" }}>
                {new Date(msg.timestamp).toLocaleString()}
              </span>
            </Box>

            {/* Content */}
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
        ))
      ) : (
        <Box>Chargement des messages...</Box>
      )}
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

      {/* Onglets */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
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

      {/* Feed */}
      <ChannelFeed channelId={channels[activeTab]} />
    </div>
  );
}
