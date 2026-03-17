'use client';

import { Box, Button, Heading, Text, VStack, Link, Alert, AlertIcon, Icon } from "@chakra-ui/react";
import { ChevronLeftIcon } from "@chakra-ui/icons";

const CGUPage = () => {
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
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(window.location.origin + '/CGU_Rescoe_17032026.pdf')}&embedded=true`}
            width="100%"
            height="800px"
            style={{ border: 0 }}
          />
          </Box>
        </Box>

        {/* PDF EMBED PRINCIPAL */}
        <Box  rounded="3xl" shadow="xl" mb={12} overflow="hidden">
          <Box p={8} textAlign="center"  borderBottom="1px solid">
            <Heading size="lg" mb={2}>📜 Document officiel complet</Heading>
            <Text  mb={4}>Visualisation intégrée (PDF original)</Text>
            <Button
              as="a"
              href="/CGU_Rescoe_17032026.pdf"
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
