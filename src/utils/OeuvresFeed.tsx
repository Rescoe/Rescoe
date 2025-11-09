"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  useToast,
} from "@chakra-ui/react";
import Web3 from "web3";
import { useAuth } from "@/utils/authContext"; // chemin vers ton AuthProvider

import MessageEditions from "@/components/ABI/MessageEditions.json";

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

interface OeuvresFeedProps {
  channelId: string;
  collectionAddress: string;
}

const OeuvresFeed: React.FC<OeuvresFeedProps> = ({ channelId, collectionAddress }) => {
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
  const { web3, address } = useAuth();


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


        if (!web3 || !address) throw new Error("Connectez votre wallet avant de mint");
        if (!rules.price) throw new Error("Prix non défini");

        try {
          setMintingIds((prev) => [...prev, msg.id]);
          const ethereum = (window as any).ethereum;
          await ethereum.request({ method: "eth_requestAccounts" });

          const contract = new web3.eth.Contract(
            (MessageEditions as any).abi ?? MessageEditions,
            collectionAddress
          );

          const keccak = web3.utils.soliditySha3({
            type: "string",
            value: msg.id,
          }) as string;

          const haiku = msg.content || " ";
          const pricePerEdition = rules.price ?? 0.001;
          const priceInWei = web3.utils.toWei(pricePerEdition.toString(), "ether");
          const salonRoyaltyAddress = rules.splitAddress ?? address;
          const editionsForSale = (() => {
            const m = msg.content.match(/\/editions (\d+)/i);
            return m ? parseInt(m[1], 10) : rules.editions ?? 1;
          })();
          const isOpenEdition = editionsForSale === 0;
          const durationRule = rules.duration ?? "7j";
          let mintDurationSeconds = 7 * 24 * 3600;
          if (durationRule.endsWith("j"))
            mintDurationSeconds = parseInt(durationRule) * 24 * 3600;
          else if (durationRule.endsWith("h"))
            mintDurationSeconds = parseInt(durationRule) * 3600;
          else if (durationRule.endsWith("m"))
            mintDurationSeconds = parseInt(durationRule) * 60;

          const imageUrl = msg.attachments?.[0]?.url || "";
          const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);

          const valueToSend = BigInt(priceInWei);

          console.log(            keccak,
                      haiku,
                      priceInWei,
                      salonRoyaltyAddress,
                      imageUrl,
                      messageTimestamp,
                      mintDurationSeconds,
                      editionsForSale,
                      isOpenEdition);

          const gasEstimate = await contract.methods
            .mint(
              keccak,
              haiku,
              priceInWei,
              salonRoyaltyAddress,
              imageUrl,
              messageTimestamp,
              mintDurationSeconds,
              editionsForSale,
              isOpenEdition
            )
            .estimateGas({ from: address, value: priceInWei });

          await contract.methods
            .mint(
              keccak,
              haiku,
              priceInWei,
              salonRoyaltyAddress,
              imageUrl,
              messageTimestamp,
              mintDurationSeconds,
              editionsForSale,
              isOpenEdition
            )
            .send({
              from: address,
              value: valueToSend.toString(),
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
            Mint cette œuvre
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

export default OeuvresFeed;
