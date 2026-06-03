// components/LiveLogs.tsx
import React, { useEffect, useRef } from "react";
import { Box, HStack, Text, Button, Badge } from "@chakra-ui/react";

interface Props {
  logs: string[];
  onClear: () => void;
}

function getLogColor(line: string): string {
  if (line.includes("❌") || line.includes("ERROR") || line.includes("[ERR]"))
    return "#FC8181"; // red.300
  if (line.includes("✅") || line.includes("DONE") || line.includes("[OUT]"))
    return "#68D391"; // green.300
  if (line.includes("🚀") || line.includes("PIPELINE"))
    return "#B794F4"; // purple.300
  if (line.includes("⚠️") || line.includes("WARN"))
    return "#F6AD55"; // orange.300
  if (line.includes("📋") || line.includes("📂") || line.includes("📤"))
    return "#90CDF4"; // blue.200
  return "#CBD5E0"; // gray.300
}

export function LiveLogs({ logs, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Box
      bg="whiteAlpha.50"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="xl"
      overflow="hidden"
    >
      {/* Header */}
      <HStack
        px={4}
        py={3}
        bg="blackAlpha.300"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
      >
        <HStack spacing={2}>
          {/* Faux boutons macOS */}
          <Box w={3} h={3} borderRadius="full" bg="red.400" />
          <Box w={3} h={3} borderRadius="full" bg="yellow.400" />
          <Box w={3} h={3} borderRadius="full" bg="green.400" />
          <Text
            fontSize="xs"
            color="whiteAlpha.500"
            fontFamily="mono"
            ml={2}
            letterSpacing="wider"
          >
            DEPLOY LOGS
          </Text>
        </HStack>
        <HStack spacing={2}>
          <Badge
            fontFamily="mono"
            fontSize="9px"
            colorScheme="whiteAlpha"
            variant="subtle"
          >
            {logs.length} lignes
          </Badge>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="whiteAlpha"
            onClick={onClear}
            fontFamily="mono"
            fontSize="10px"
          >
            Effacer
          </Button>
        </HStack>
      </HStack>

      {/* Terminal */}
      <Box
        ref={containerRef}
        h="220px"
        overflowY="auto"
        p={4}
        fontFamily="mono"
        fontSize="11px"
        bg="black"
        sx={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255,255,255,0.1)",
            borderRadius: "4px",
          },
        }}
      >
        {logs.length === 0 ? (
          <Text color="whiteAlpha.300" fontStyle="italic">
            En attente d&apos;activité...
          </Text>
        ) : (
          logs.map((line, i) => (
            <Text
              key={i}
              color={getLogColor(line)}
              lineHeight="1.6"
              _hover={{ bg: "whiteAlpha.50" }}
              px={1}
              borderRadius="sm"
            >
              {line}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}
