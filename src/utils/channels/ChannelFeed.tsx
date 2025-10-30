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

const ChannelFeed: React.FC<ChannelFeedProps> = ({ channelId }) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
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

  // Mint simulation (à remplacer par ta fonction réelle)
  const mintMessage = async (msg: DiscordMessage) => {
    toast({
      title: "Mint simulé",
      description: `Message de ${msg.author.username} minté.`,
      status: "info",
      duration: 2000,
    });
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
