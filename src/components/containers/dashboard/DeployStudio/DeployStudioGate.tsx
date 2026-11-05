/**
 * Porte du Deploy Studio : n'affiche l'outil que si le serveur l'autorise
 * (/api/admin/deploy/access). Le contrôle réel reste côté serveur (guardDeployStudio) :
 * cette porte ne sert qu'à afficher un message clair au lieu d'erreurs en cascade.
 *
 * NOTE: chargé via next/dynamic avec ssr: false (voir Admin.tsx).
 */
import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertIcon, Box, Code, Spinner, Text, VStack } from "@chakra-ui/react";
import DeployStudio from "./DeployStudio";

type Access = { enabled: boolean; message?: string; mainnetAllowed?: boolean };

export default function DeployStudioGate() {
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/deploy/access")
      .then((r) => r.json())
      .then((data: Access) => !cancelled && setAccess(data))
      .catch(() => !cancelled && setAccess({ enabled: false, message: "Impossible de joindre le serveur." }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!access) {
    return (
      <Box p={8} textAlign="center">
        <Spinner />
      </Box>
    );
  }

  if (!access.enabled) {
    return (
      <Alert status="warning" variant="left-accent" alignItems="flex-start">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <AlertDescription fontWeight="bold">Deploy Studio désactivé</AlertDescription>
          <Text fontSize="sm">{access.message}</Text>
          <Text fontSize="sm">
            Outil réservé à l&apos;administrateur, en local uniquement. Pour l&apos;activer sur votre machine, définissez
            dans l&apos;environnement serveur <Code>ENABLE_DEPLOY_STUDIO=true</Code> et <Code>HARDHAT_DIR</Code>, puis lancez{" "}
            <Code>npm run dev</Code> (voir docs/security.md).
          </Text>
        </VStack>
      </Alert>
    );
  }

  return <DeployStudio />;
}
