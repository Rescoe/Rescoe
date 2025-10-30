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
import { useSearchParams } from "next/navigation"; // <-- import

import { motion, AnimatePresence } from "framer-motion";
import { Formations } from "@/components/containers/association/Formations";
import ChannelFeed from "@/utils/channels/ChannelFeed";
import ChannelPreview from "@/utils/channels/ChannelPreview";
import MiniCalendar from "./MiniCalendar";


import { FiChevronDown, FiChevronRight, FiChevronLeft } from "react-icons/fi";

import { brandHover, hoverStyles } from "@styles/theme"; //Style


const MotionBox = motion(Box);



export default function Actus() {
  const searchParams = useSearchParams();
const initialExpand = searchParams.get("expand"); // <-- récupère ?expand=news / expos / calendar
const [expanded, setExpanded] = useState<string | null>(initialExpand);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useBreakpointValue({ base: true, md: false });


  const handleExpand = (section: string) => {
  setExpanded(section);
  window.scrollTo({ top: 0, behavior: "smooth" }); // scroll top smooth à l'ouverture
};
const handleClose = () => setExpanded(null);

  const boxShadowHover = useColorModeValue(
  "0 0 15px rgba(180, 166, 213, 0.25)", // light
  "0 0 15px rgba(238, 212, 132, 0.25)"  // dark
);

useEffect(() => {
  if (initialExpand) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}, [initialExpand]);

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

              <ChannelPreview
              channelId={process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID!}
              title="📰 Actualités"
              limit={5}
              maxLines={5}
              />

              <Text textAlign="center" mt={8}>
                Cliquez pour afficher les dernières actualités.
              </Text>
            </MotionBox>

            {/* Colonne droite */}
            <Flex direction="column" flex="1" gap={6}>


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
            <MiniCalendar onClick={() => handleExpand("calendar")} />

            </MotionBox>

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
                <ChannelPreview
                channelId={process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!}
                title="🖼️ Expositions"
                />

                <Text textAlign="center" mt={8}>
                  Cliquez pour en savoir plus !
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
