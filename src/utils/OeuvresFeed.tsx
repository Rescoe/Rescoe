"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  useToast,
  Input,
  HStack,
} from "@chakra-ui/react";
import Web3 from "web3";
import { useAuth } from "@/utils/authContext"; // chemin vers ton AuthProvider

import MessageEditions from "@/components/ABI/MessageEditions.json";

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

interface OeuvresFeedProps {
  channelId: string;
  collectionAddress: string;
  artistAddress: string; // <-- adresse de l'artiste
}

const OeuvresFeed: React.FC<OeuvresFeedProps> = ({
  channelId,
  collectionAddress,
  artistAddress,
}) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const [rules, setRules] = useState<any>({});
  const { web3, address } = useAuth();
  const toast = useToast();

  const [recipients, setRecipients] = useState<string[]>([]);
  const [percentages, setPercentages] = useState<number[]>([]);

  const isArtist = address?.toLowerCase() === artistAddress.toLowerCase();

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
      } else setRules({});
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

      const contract = new web3.eth.Contract((MessageEditions as any).abi ?? MessageEditions, collectionAddress);

      const keccak = web3.utils.soliditySha3({ type: "string", value: msg.id }) as string | null;
      if (!keccak) throw new Error("Impossible de calculer le keccak du message id");

      const priceInWei = web3.utils.toWei((rules.price ?? 0.001).toString(), "ether");
      const splitAddr = rules.splitAddress || account;

      const recipientsForMint = recipients.length > 0 ? recipients : [splitAddr];
      const percentagesForMint = percentages.length > 0 ? percentages : [1000]; // fallback 10%

      await contract.methods
        .mint(
          keccak,
          msg.content,
          priceInWei,
          splitAddr,
          msg.attachments?.[0]?.url || "",
          Math.floor(Date.now() / 1000),
          0, // durée simplifiée
          rules.editions ?? 1,
          rules.editions === 0,
          recipientsForMint,
          percentagesForMint
        )
        .send({ from: account, value: priceInWei });

      toast({ title: "Mint réussi", status: "success", duration: 4000, isClosable: true });
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({ title: "Erreur mint", description: err?.message || "Erreur inconnue", status: "error", duration: 6000, isClosable: true });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };

  return (
    <Box maxWidth="700px" mx="auto" p={4}>
      {isArtist && (
        <Box mb={4} p={3} bg="#222" color="#ddd" borderRadius="10px">
          <strong>Gestion des royalties (artiste)</strong>
          {recipients.map((r, i) => (
            <HStack key={i} mt={2}>
              <Input
                value={r}
                placeholder="Adresse"
                onChange={(e) => {
                  const newRecipients = [...recipients];
                  newRecipients[i] = e.target.value;
                  setRecipients(newRecipients);
                }}
              />
              <Input
                type="number"
                value={percentages[i]}
                placeholder="% (sur 10000)"
                onChange={(e) => {
                  const newPercentages = [...percentages];
                  newPercentages[i] = parseInt(e.target.value) || 0;
                  setPercentages(newPercentages);
                }}
              />
            </HStack>
          ))}
          <Button
            mt={2}
            size="sm"
            colorScheme="teal"
            onClick={() => {
              setRecipients([...recipients, ""]);
              setPercentages([...percentages, 0]);
            }}
          >
            Ajouter un bénéficiaire
          </Button>
        </Box>
      )}

      {messages.map((msg) => (
        <Box key={msg.id} border="1px solid #333" borderRadius="12px" p={4} mb={4} bg="#111" color="#fff">
          <Box display="flex" alignItems="center" mb={2}>
            <img
              src={msg.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png` : "/default-avatar.png"}
              alt={msg.author.username}
              style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
            />
            <strong>{msg.author.username}</strong>
            <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aaa" }}>
              {new Date(msg.timestamp).toLocaleString()}
            </span>
          </Box>
          <Box whiteSpace="pre-wrap" mb={2}>{msg.content}</Box>
          {msg.attachments.map((att, i) => att.content_type?.startsWith("image/") && (
            <Box key={i} mb={2}>
              <img src={att.url} alt="attachment" style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }} />
            </Box>
          ))}
          <Button size="sm" colorScheme="teal" onClick={() => mintMessage(msg)} isLoading={mintingIds.includes(msg.id)}>
            Mint cette œuvre
          </Button>
        </Box>
      ))}

      {messages.length >= limit && <Button mt={2} onClick={() => setLimit((prev) => prev + 10)}>Voir plus</Button>}
    </Box>
  );
};

export default OeuvresFeed;
