"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Text,
  useBreakpointValue,
  Collapse,
  Button,
  useToast,
  Spinner,
  IconButton,
  useColorModeValue
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Formations } from "@/components/containers/association/Formations";
import { FiChevronDown, FiChevronRight, FiChevronLeft } from "react-icons/fi";

import { brandHover, hoverStyles } from "@styles/theme"; //Style


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

      {/* SECTION FORMATIONS UNIQUEMENT DANS LE CHANNEL CALENDRIER */}
      {channelId === process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID && (
        <Box mb={6}>
          <Formations />
        </Box>
      )}

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




const MotionBox = motion(Box);

export default function Actus() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useBreakpointValue({ base: true, md: false });

/*
  // Permet de désactiver le scroll de la page quand on est en vue étendue
  useEffect(() => {
    if (expanded) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  }, [expanded]);
*/

  const handleExpand = (section: string) => {
  setExpanded(section);
  window.scrollTo({ top: 0, behavior: "smooth" }); // scroll top smooth à l'ouverture
};
const handleClose = () => setExpanded(null);

  const boxShadowHover = useColorModeValue(
  "0 0 15px rgba(180, 166, 213, 0.25)", // light
  "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
);

return (
  <Box w="full" px={0} py={0}>

    <Text
      as="h2"
      textAlign="center"
      mb={10}
      fontSize={{ base: "2xl", md: "3xl" }}
      fontWeight="extrabold"
    >
      Agenda et nouveautées
    </Text>

    <AnimatePresence initial={false} mode="wait">
      {!expanded ? (
        <MotionBox
          key="overview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Flex
            direction={{ base: "column", md: "row" }}
            gap={6}
            justify="center"
            align="stretch"
            maxW="1400px"
            mx="auto"
          >
            {/* Actualités */}
            <MotionBox
              flex="1"
              borderRadius="2xl"
              p={6}
              border="1px solid"
              boxShadow="lg"
              cursor="pointer"
              whileHover={{
                scale: 1.03,
                boxShadow: boxShadowHover,
              }}
              onClick={() => handleExpand("news")}
              transition={{ duration: 0.3 }}
              minH={{ base: "280px", md: "600px" }}
            >
              <Text fontSize="xl" fontWeight="bold" mb={4} textAlign="center">
                📰 Actualités
              </Text>
              <Text textAlign="center" mt={8}>
                Cliquez pour afficher les dernières actualités.
              </Text>
            </MotionBox>

            {/* Colonne droite */}
            <Flex direction="column" flex="1" gap={6}>

              {/* Expositions */}
              <MotionBox
                borderRadius="2xl"
                p={6}
                border="1px solid"
                boxShadow="lg"
                cursor="pointer"
                whileHover={{
                  scale: 1.03,
                  boxShadow: boxShadowHover,
                }}
                onClick={() => handleExpand("expos")}
                transition={{ duration: 0.3 }}
                minH="280px"
              >
                <Text fontSize="xl" fontWeight="bold" mb={4} textAlign="center">
                  🖼️ Expositions
                </Text>
                <Text textAlign="center" mt={8}>
                  Cliquez pour découvrir les expositions récentes.
                </Text>
              </MotionBox>

              {/* Calendrier */}
              <MotionBox
                borderRadius="2xl"
                p={6}
                border="1px solid"
                boxShadow="lg"
                cursor="pointer"
                whileHover={{
                  scale: 1.03,
                  boxShadow: boxShadowHover,
                }}
                onClick={() => handleExpand("calendar")}
                transition={{ duration: 0.3 }}
                minH="280px"
              >
                <Text fontSize="xl" fontWeight="bold" mb={4} textAlign="center">
                  🗓️ Calendrier & Formations
                </Text>
                <Text textAlign="center" mt={8}>
                  Cliquez pour voir les prochains ateliers et événements.
                </Text>
              </MotionBox>
            </Flex>
          </Flex>
        </MotionBox>
      ) : (
        <MotionBox
          key="expanded"
          w="full"
          maxW="none"
          px={{ base: 4, md: 8 }}
          py={{ base: 6, md: 10 }}
          borderRadius="0"
          boxShadow="none"
          overflow="visible"
        >
          <IconButton
            aria-label="Retour"
            icon={<FiChevronLeft size={28} />}
            onClick={handleClose}
            variant="outline"
            borderRadius="full"
            mb={6}
          />
          <Text fontWeight="extrabold" fontSize={{ base: "2xl", md: "3xl" }} mb={6} textAlign="center">
            {expanded === "news"
              ? "📰 Actualités"
              : expanded === "expos"
              ? "🖼️ Expositions"
              : "🗓️ Calendrier & Formations"}
          </Text>

          <Box
            w="100%"
            maxW="100%"
            overflowX="auto"
            px={{ base: 2, md: 4 }}
          >
            {expanded === "news" && (
              <ChannelFeed channelId={process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID!} />
            )}
            {expanded === "expos" && (
              <Flex w="full" justify="center">
                <Box w="full" maxW="1200px" px={{ base: 2, md: 6 }}>
              <ChannelFeed channelId={process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!} />
              </Box>
            </Flex>
            )}
            {expanded === "calendar" && (
  <Flex w="full" justify="center">
    <Box w="full" maxW="1200px" px={{ base: 2, md: 6 }}>
      <Formations />
    </Box>
  </Flex>
)}


          </Box>


          <Button mt={8} display="block" mx="auto" onClick={handleClose}>
            Revenir à la vue d’ensemble
          </Button>
        </MotionBox>
      )}
    </AnimatePresence>
  </Box>
);
}
