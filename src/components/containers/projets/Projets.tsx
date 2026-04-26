"use client";

import { useEffect, useState } from "react";
import {
  Box,
  VStack,
  Text,
  Spinner,
  HStack,
  Badge,
  SimpleGrid,
} from "@chakra-ui/react";

type MessageItem = {
  id: string;
  timestamp: string;
  rawContent: string;
  parsed: {
    label: string | null;
    name: string | null;
    artist: string | null;
    date: string | null;
    type: string | null;
    mode: string | null;
    forSale: string | null;
    uid: string | null;
    text: string | null;
  };
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    contentType: string | null;
    isImage: boolean;
    isGif: boolean;
  }>;
  embeds: Array<{
    title: string | null;
    description: string | null;
    image: string | null;
    thumbnail: string | null;
    url: string | null;
  }>;
};

function MetaItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box>
      <Text fontSize="xs" textTransform="uppercase" opacity={0.6} mb={1}>
        {label}
      </Text>
      <Text fontWeight="semibold">{value}</Text>
    </Box>
  );
}

export default function Projets({
  channelId,
  limit = 20,
}: {
  channelId: string;
  limit?: number;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `/api/discord-feed?channelId=${encodeURIComponent(channelId)}&limit=${limit}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!data.ok) throw new Error(data.error || "Erreur API");

        if (!cancelled) setMessages(data.messages || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Erreur inconnue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (channelId) load();

    return () => {
      cancelled = true;
    };
  }, [channelId, limit]);

  if (loading) {
    return (
      <Box py={12} textAlign="center">
        <Spinner size="lg" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="xl">
        <Text color="red.400">{error}</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={8} align="stretch">
      {messages.map((msg) => {
        const firstImage =
          msg.attachments.find((a) => a.isImage)?.url ||
          msg.embeds.find((e) => e.image)?.image ||
          msg.embeds.find((e) => e.thumbnail)?.thumbnail ||
          null;

        return (
          <Box
            key={msg.id}
            p={{ base: 4, md: 6 }}
            borderWidth="1px"
            borderRadius="2xl"
            boxShadow="md"
          >
            <HStack spacing={3} mb={4} align="center">
              <Box
                boxSize="40px"
                borderRadius="full"
                bg="gray.300"
                backgroundImage={msg.author.avatarUrl || undefined}
                backgroundSize="cover"
                backgroundPosition="center"
              />
              <Box>
                <Text fontWeight="bold">{msg.parsed.artist || msg.author.username}</Text>
                <Text fontSize="sm" opacity={0.7}>
                  {msg.parsed.date || new Date(msg.timestamp).toLocaleString("fr-FR")}
                </Text>
              </Box>
            </HStack>

            <HStack spacing={2} mb={3} flexWrap="wrap">
              {msg.parsed.label && <Badge colorScheme="purple">{msg.parsed.label}</Badge>}
              {msg.parsed.type && <Badge colorScheme="blue">{msg.parsed.type}</Badge>}
              {msg.parsed.mode && <Badge colorScheme="green">{msg.parsed.mode}</Badge>}
              {msg.parsed.forSale && (
                <Badge colorScheme={msg.parsed.forSale === "oui" ? "orange" : "gray"}>
                  {msg.parsed.forSale === "oui" ? "À vendre" : "Non à vendre"}
                </Badge>
              )}
            </HStack>

            {msg.parsed.name && (
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="extrabold" mb={4}>
                {msg.parsed.name}
              </Text>
            )}

            <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
              <MetaItem label="Artiste" value={msg.parsed.artist} />
              <MetaItem label="Date" value={msg.parsed.date} />
              <MetaItem label="Type" value={msg.parsed.type} />
              <MetaItem label="Mode" value={msg.parsed.mode} />
            </SimpleGrid>

            {msg.parsed.text && (
              <Box mb={5} p={4} borderRadius="xl" bg="blackAlpha.50">
                <Text fontStyle="italic" whiteSpace="pre-wrap">
                  {msg.parsed.text}
                </Text>
              </Box>
            )}

            {firstImage && (
              <Box mb={4}>
                <img
                  src={firstImage}
                  alt={msg.parsed.name || "Œuvre Discord"}
                  style={{
                    width: "100%",
                    maxHeight: "640px",
                    objectFit: "contain",
                    borderRadius: "16px",
                  }}
                />
              </Box>
            )}

            {msg.parsed.uid && (
              <Text fontSize="xs" opacity={0.55}>
                UID : {msg.parsed.uid}
              </Text>
            )}
          </Box>
        );
      })}
    </VStack>
  );
}
