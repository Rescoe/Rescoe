/**
 * /u/insect-storage — Admin: visualisation du statut InsectImageStorage
 * Accessible uniquement au wallet owner (0xFa6d6E36…)
 */

import React, { useCallback, useEffect, useState } from "react";
import { Default } from "components/layouts/Default";
import { useAuth } from "@/utils/authContext";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Grid,
  Heading,
  Progress,
  Spinner,
  Tag,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
} from "@chakra-ui/react";

// ─── types ────────────────────────────────────────────────────────────────────

interface LevelBucket {
  total: number;
  uploaded: number;
}

interface FamilyBucket {
  total: number;
  uploaded: number;
}

interface StorageStatus {
  total: number;
  uploaded: number;
  byLevel: Record<string, LevelBucket>;
  byFamily: Record<string, FamilyBucket>;
  notUploaded: string[];
  cachedAt?: string;
}

// ─── constants ───────────────────────────────────────────────────────────────

const OWNER_ADDRESS = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879";

const LEVEL_LABELS: Record<string, string> = {
  "0": "Niveau 0 – Larve",
  "1": "Niveau 1 – Nymphe",
  "2": "Niveau 2 – Adulte",
  "3": "Niveau 3 – Légendaire",
};

// ─── sub-components ──────────────────────────────────────────────────────────

function ProgressBar({
  value,
  total,
  colorScheme = "teal",
}: {
  value: number;
  total: number;
  colorScheme?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <Box w="full">
      <Flex justify="space-between" mb={1}>
        <Text fontSize="sm" color="whiteAlpha.700">
          {value} / {total}
        </Text>
        <Text fontSize="sm" fontWeight="bold">
          {pct}%
        </Text>
      </Flex>
      <Progress
        value={pct}
        colorScheme={colorScheme}
        borderRadius="full"
        size="sm"
        bg="whiteAlpha.100"
      />
    </Box>
  );
}

function LevelCard({
  level,
  bucket,
}: {
  level: string;
  bucket: LevelBucket;
}) {
  const pct =
    bucket.total > 0 ? Math.round((bucket.uploaded / bucket.total) * 100) : 0;
  const schemes = ["blue", "cyan", "teal", "purple"];
  const scheme = schemes[parseInt(level, 10)] ?? "gray";

  return (
    <Card bg="whiteAlpha.50" borderColor="whiteAlpha.100" borderWidth={1}>
      <CardHeader pb={1}>
        <HStack justify="space-between">
          <Heading size="xs" color="whiteAlpha.800">
            {LEVEL_LABELS[level] ?? `Niveau ${level}`}
          </Heading>
          <Badge colorScheme={pct === 100 ? "green" : scheme}>
            {pct}%
          </Badge>
        </HStack>
      </CardHeader>
      <CardBody pt={1}>
        <ProgressBar value={bucket.uploaded} total={bucket.total} colorScheme={scheme} />
      </CardBody>
    </Card>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

const InsectStoragePage: React.FC = () => {
  const { address, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFamilies, setShowFamilies] = useState(false);

  const cardBg = useColorModeValue("gray.50", "whiteAlpha.50");

  const isAdmin =
    !!address &&
    address.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  const fetchStatus = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/insect-storage-status?address=${address}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data: StorageStatus = await res.json();
      setStatus(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Auto-fetch on mount when address is ready
  useEffect(() => {
    if (isAdmin) {
      fetchStatus();
    }
  }, [isAdmin, fetchStatus]);

  // ── Auth wall ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <Default pageName="InsectStorage Admin">
        <Flex justify="center" align="center" minH="50vh">
          <Spinner size="xl" color="teal.300" />
        </Flex>
      </Default>
    );
  }

  if (!isAdmin) {
    return (
      <Default pageName="InsectStorage Admin">
        <Flex justify="center" align="center" minH="50vh">
          <Alert
            status="error"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            borderRadius="xl"
            maxW="400px"
            p={8}
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Accès restreint
            </AlertTitle>
            <AlertDescription>
              Accès réservé à l&apos;admin. Connectez le wallet owner pour continuer.
            </AlertDescription>
          </Alert>
        </Flex>
      </Default>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  const totalPct =
    status && status.total > 0
      ? Math.round((status.uploaded / status.total) * 100)
      : 0;

  return (
    <Default pageName="InsectStorage Admin">
      <VStack spacing={6} align="stretch" py={6}>
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
          <Box>
            <Heading size="md" mb={1}>
              InsectImageStorage — Base Mainnet
            </Heading>
            <Text fontSize="sm" color="whiteAlpha.500" fontFamily="mono">
              0x1BD2F00C37a39F87dC08A491C416F04a7F6D4A78
            </Text>
          </Box>
          <Button
            colorScheme="teal"
            size="sm"
            onClick={fetchStatus}
            isLoading={loading}
            loadingText="Vérification…"
          >
            Rafraîchir
          </Button>
        </Flex>

        <Divider borderColor="whiteAlpha.200" />

        {/* Error */}
        {error && (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading skeleton */}
        {loading && !status && (
          <Flex justify="center" align="center" py={16}>
            <VStack spacing={3}>
              <Spinner size="xl" color="teal.300" />
              <Text color="whiteAlpha.600" fontSize="sm">
                Interrogation du contrat (jusqu&apos;à ~30 s pour 1091 clés)…
              </Text>
            </VStack>
          </Flex>
        )}

        {/* Results */}
        {status && (
          <>
            {/* Global progress */}
            <Card bg={cardBg} borderColor="whiteAlpha.100" borderWidth={1}>
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="sm">Progression globale</Heading>
                  <Tag
                    colorScheme={totalPct === 100 ? "green" : "teal"}
                    size="lg"
                    fontWeight="bold"
                  >
                    {status.uploaded} / {status.total}
                  </Tag>
                </HStack>
              </CardHeader>
              <CardBody>
                <ProgressBar
                  value={status.uploaded}
                  total={status.total}
                  colorScheme={totalPct === 100 ? "green" : "teal"}
                />
                {status.cachedAt && (
                  <Text
                    fontSize="xs"
                    color="whiteAlpha.400"
                    mt={2}
                    fontFamily="mono"
                  >
                    Mis en cache à {new Date(status.cachedAt).toLocaleTimeString()}
                  </Text>
                )}
              </CardBody>
            </Card>

            {/* By level */}
            <Box>
              <Heading size="sm" mb={3}>
                Par niveau
              </Heading>
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(4, 1fr)",
                }}
                gap={4}
              >
                {Object.entries(status.byLevel)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([level, bucket]) => (
                    <LevelCard key={level} level={level} bucket={bucket} />
                  ))}
              </Grid>
            </Box>

            {/* By family (collapsible) */}
            <Box>
              <HStack justify="space-between" mb={3}>
                <Heading size="sm">Par famille</Heading>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setShowFamilies((v) => !v)}
                >
                  {showFamilies ? "Masquer" : `Afficher (${Object.keys(status.byFamily).length} familles)`}
                </Button>
              </HStack>
              {showFamilies && (
                <Grid
                  templateColumns={{
                    base: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                    lg: "repeat(4, 1fr)",
                  }}
                  gap={3}
                >
                  {Object.entries(status.byFamily)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([family, bucket]) => {
                      const pct =
                        bucket.total > 0
                          ? Math.round((bucket.uploaded / bucket.total) * 100)
                          : 0;
                      return (
                        <Card
                          key={family}
                          bg="whiteAlpha.50"
                          borderColor="whiteAlpha.100"
                          borderWidth={1}
                          p={3}
                        >
                          <HStack justify="space-between" mb={1}>
                            <Text fontSize="sm" fontWeight="semibold" noOfLines={1}>
                              {family}
                            </Text>
                            <Badge
                              colorScheme={pct === 100 ? "green" : "orange"}
                              fontSize="xs"
                            >
                              {pct}%
                            </Badge>
                          </HStack>
                          <Progress
                            value={pct}
                            colorScheme={pct === 100 ? "green" : "orange"}
                            size="xs"
                            borderRadius="full"
                            bg="whiteAlpha.100"
                          />
                          <Text fontSize="xs" color="whiteAlpha.500" mt={1}>
                            {bucket.uploaded}/{bucket.total}
                          </Text>
                        </Card>
                      );
                    })}
                </Grid>
              )}
            </Box>

            {/* Not uploaded list */}
            {status.notUploaded.length > 0 && (
              <Box>
                <HStack mb={3}>
                  <Heading size="sm">Clés manquantes</Heading>
                  <Badge colorScheme="red" fontSize="sm">
                    {status.notUploaded.length}
                  </Badge>
                </HStack>
                <Box
                  maxH="300px"
                  overflowY="auto"
                  bg="whiteAlpha.50"
                  borderRadius="lg"
                  borderColor="whiteAlpha.100"
                  borderWidth={1}
                  p={3}
                >
                  <VStack align="stretch" spacing={1}>
                    {status.notUploaded.map((key) => (
                      <Text
                        key={key}
                        fontFamily="mono"
                        fontSize="xs"
                        color="red.300"
                        py={0.5}
                        borderBottom="1px solid"
                        borderColor="whiteAlpha.50"
                      >
                        {key}
                      </Text>
                    ))}
                  </VStack>
                </Box>
              </Box>
            )}

            {status.notUploaded.length === 0 && status.uploaded === status.total && (
              <Alert status="success" borderRadius="lg">
                <AlertIcon />
                <AlertDescription>
                  Tous les insectes ({status.total}) sont uploadés sur le contrat.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </VStack>
    </Default>
  );
};

export default InsectStoragePage;
