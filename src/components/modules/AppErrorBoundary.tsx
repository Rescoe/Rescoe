import React from "react";
import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";

/**
 * Filet de sécurité : une erreur d'affichage ne doit plus donner la page blanche
 * « Application error: a client-side exception has occurred ».
 * Le bouton vide aussi les caches de session (données d'insectes, etc.), première cause
 * possible d'un plantage qui se répète à chaque rechargement.
 */
type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[AppErrorBoundary]", error, info);
  }

  private reset = () => {
    try {
      sessionStorage.clear();
    } catch {
      /* stockage indisponible : on recharge quand même */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box minH="60vh" display="flex" alignItems="center" justifyContent="center" px={4}>
        <VStack spacing={4} textAlign="center" maxW="480px">
          <Heading size="md">Un problème est survenu</Heading>
          <Text>
            Cette page n'a pas pu s'afficher correctement. Les données sont en sécurité sur la blockchain :
            il s'agit d'un souci d'affichage ou de connexion au réseau, souvent temporaire.
          </Text>
          <Button onClick={this.reset}>Réessayer</Button>
        </VStack>
      </Box>
    );
  }
}
