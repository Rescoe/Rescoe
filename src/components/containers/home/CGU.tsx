'use client';

import { useEffect, useState } from "react";
import { Box, Button, Heading, Text, Link, Icon } from "@chakra-ui/react";
import { ChevronLeftIcon } from "@chakra-ui/icons";

const CGU_PDF_PATH = "/CGU_Rescoe_17032026.pdf";

const CGUPage = () => {
  // `window` n'existe pas pendant le rendu serveur : l'origine n'est lue qu'après
  // le montage. Tant qu'elle est inconnue (SSR / 1er rendu), on n'affiche que le
  // lien de téléchargement, identique côté serveur et côté client (pas de mismatch).
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <Box minH="100vh" py={12} px={4}>
      <Box maxW="6xl" mx="auto">
        {/* Header */}
        <Box textAlign="center" mb={12}>
          <Heading as="h1" size="2xl" mb={4}>
            Conditions Générales d'Utilisation
          </Heading>
          <Text fontSize="xl" mb={6}>
            Version du <strong>17 mars 2026</strong>
          </Text>
          <Button
            as={Link}
            href="/"
            leftIcon={<ChevronLeftIcon />}
            variant="outline"
            size="lg"
          >
            Retour à Rescoe
          </Button>
        </Box>


          {/* IFRAME PDF RESPONSIVE */}
          <Box p={0} h={{ base: "70vh", md: "80vh", lg: "90vh" }} position="relative">
          {origin && (
            <iframe
              title="Conditions Générales d'Utilisation (PDF)"
              src={`https://docs.google.com/gview?url=${encodeURIComponent(origin + CGU_PDF_PATH)}&embedded=true`}
              width="100%"
              height="800px"
              style={{ border: 0 }}
            />
          )}
          </Box>
        </Box>

        {/* PDF EMBED PRINCIPAL */}
        <Box  rounded="3xl" shadow="xl" mb={12} overflow="hidden">
          <Box p={8} textAlign="center"  borderBottom="1px solid">
            <Heading size="lg" mb={2}>📜 Document officiel complet</Heading>
            <Text  mb={4}>Visualisation intégrée (PDF original)</Text>
            <Button
              as="a"
              href={CGU_PDF_PATH}
              download
              colorScheme="teal"
              size="lg"
              leftIcon={<Icon as={() => "📥"} />}
              mb={4}
            >
              Télécharger PDF (1.2 Mo)
            </Button>
          </Box>

      </Box>
    </Box>
  );
};

export default CGUPage;
