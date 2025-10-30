"use client";

import React, { useEffect, useState } from "react";
import { Box, Text, Flex, Spinner, Image } from "@chakra-ui/react";

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string };
  timestamp: string;
  attachments?: { url: string; content_type?: string }[];
}

interface ChannelPreviewProps {
  channelId: string;
  title?: string; // optionnel : pour afficher un titre ("Actualités", "Expositions"…)
  maxLines?: number; // nb de lignes de texte à afficher par message
  withImage?: boolean; // inclure l’image Discord jointe
  limit?: number; // nombre de messages à afficher
}

const ChannelPreview: React.FC<ChannelPreviewProps> = ({
  channelId,
  title,
  maxLines = 3,
  withImage = true,
  limit = 1, // 🔹 par défaut : 1 message
}) => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      } catch (e) {
        console.error("Erreur ChannelPreview:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [channelId, limit]);

  if (loading)
    return (
      <Flex align="center" justify="center" py={4}>
        <Spinner size="sm" />
      </Flex>
    );

  if (!messages.length)
    return (
      <Text textAlign="center" color="gray.500" fontSize="sm">
        Aucun message trouvé.
      </Text>
    );

  return (
    <Box textAlign="center" px={2}>
      {title && (
        <Text fontSize="xl" fontWeight="bold" mb={3}>
          {title}
        </Text>
      )}

      {messages.map((msg) => {
        const image =
          withImage &&
          msg.attachments?.find((att) =>
            att.content_type?.startsWith("image/")
          )?.url;

        return (
          <Box
            key={msg.id}
            border="1px solid"
            borderColor="gray.700"
            borderRadius="xl"
            p={4}
            mb={4}
            textAlign="left"
          >
            <Flex align="center" mb={2}>
              <Box
                as="img"
                src={
                  msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                    : "/default-avatar.png"
                }
                alt={msg.author.username}
                boxSize="30px"
                borderRadius="full"
                mr={2}
              />
              <Text fontWeight="bold" fontSize="sm">
                {msg.author.username}
              </Text>
              <Text ml="auto" fontSize="xs" color="gray.400">
                {new Date(msg.timestamp).toLocaleDateString()}
              </Text>
            </Flex>

            {image && (
              <Image
                src={image}
                alt="aperçu discord"
                borderRadius="lg"
                maxH="200px"
                mx="auto"
                mb={3}
                objectFit="cover"
              />
            )}

            <Text noOfLines={maxLines} fontSize="sm" whiteSpace="pre-wrap">
              {msg.content}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

export default ChannelPreview;
