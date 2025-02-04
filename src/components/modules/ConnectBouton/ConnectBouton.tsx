import React, { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { Button, Text, HStack, useToast, Tooltip, Box } from '@chakra-ui/react';
import { getEllipsisTxt } from '../../../utils/format';
import { useAuth } from '../../../utils/authContext';
import { useAuthRequestChallengeEvm } from '@moralisweb3/next';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';

const ConnectBouton: React.FC = () => {
  const { disconnectAsync } = useDisconnect();
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const toast = useToast();
  const { requestChallengeAsync } = useAuthRequestChallengeEvm();
  const { role, setAddress } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuth = async (account: string, chainId: number) => {
    setIsConnecting(true);
    try {
      // Étape 1: Demander le challenge à Moralis
      console.log("Demande de challenge avec adresse:", account, "et chainId:", chainId);
      const challenge = await requestChallengeAsync({ address: account, chainId: 11155111 });

      // Vérifier la validité du challenge
      console.log("Challenge reçu:", challenge);
      if (!challenge || !challenge.message) {
        throw new Error("Challenge non valide.");
      }

      // Étape 2: Signer le message du challenge
      console.log("Message à signer:", challenge.message);
      const signature = await signMessageAsync({ message: challenge.message });

      // Vérifier la signature
      console.log("Signature générée:", signature);

      // Étape 3: Authentification avec Moralis
      const result = await signIn('moralis-auth', {
        message: challenge.message,
        signature,
        network: 'Evm',
        redirect: false,
      });

      // Vérifier la réponse de l'authentification
      console.log("Résultat de l'authentification:", result);

      // Vérification d'erreur dans la réponse de signIn
      if (result && result.error) {
        throw new Error(result.error);
      }

      // Étape 4: Mise à jour de l'adresse et de l'état d'authentification
      setAddress(account.toLowerCase());
      console.log("Adresse mise à jour:", account.toLowerCase());

      setIsAuthenticated(true);
      console.log("Utilisateur authentifié:", account.toLowerCase());

      // Sauvegarde dans localStorage
      localStorage.setItem('connectedAddress', account.toLowerCase());
      localStorage.setItem('isAuthenticated', 'true');
      console.log("Données sauvegardées dans localStorage");

    } catch (e) {
      console.error("Erreur lors de l'authentification:", e);
      toast({
        title: 'Oops, quelque chose s\'est mal passé...',
        description: 'Petite erreur, revenez plus tard',
        status: 'error',
        position: 'top-right',
        isClosable: true,
      });
    } finally {
      setIsConnecting(false);
    }
  };


  const handleDisconnect = async () => {
    await disconnectAsync();
    signOut({ callbackUrl: '/' });
    setIsAuthenticated(false);
    setAddress('');
    localStorage.removeItem('connectedAddress');
    localStorage.removeItem('isAuthenticated'); // Retirer de localStorage
  };

  useEffect(() => {
    const storedAddress = localStorage.getItem('connectedAddress');
    const storedAuth = localStorage.getItem('isAuthenticated') === 'true'; // Vérifier auth
    if (storedAddress && isConnected) {
      setAddress(storedAddress);
      setIsAuthenticated(storedAuth); // Mettre à jour l'état d'authentification
    } else {
      setIsAuthenticated(false);
    }
  }, [isConnected, setAddress]);

  const getUserRole = () => {
    if (!address) return 'User';
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';
  };

  return (
    <Box>
      <RainbowConnectButton.Custom>
        {({ account, chain, openConnectModal, mounted }) => {
          if (!mounted || !account || !chain) {
            return (
              <Button size="sm" onClick={openConnectModal} colorScheme="blue">
                Connect Wallet
              </Button>
            );
          }

          if (isConnected && !isAuthenticated) {
            return (
              <Button
                size="sm"
                onClick={() => handleAuth(account.address, chain.id)}
                colorScheme="green"
                isLoading={isConnecting}
                loadingText="Vérification de l'adhésion..."
              >
                Espace Adhérents
              </Button>
            );
          }

          if (isAuthenticated) {
            return (
              <Box>
                <Tooltip label={`Connecté : ${getUserRole()}`} aria-label="User Role Tooltip" hasArrow placement="bottom">
                  <HStack onClick={handleDisconnect} cursor="pointer" gap={'20px'} spacing={{ base: 2, md: 4 }} direction={{ base: 'column', md: 'row' }}>
                    <Text fontWeight="medium">{getEllipsisTxt(account.address)}</Text>
                    <Text fontSize="sm" color="gray.500">{chain.name}</Text>
                  </HStack>
                </Tooltip>
              </Box>
            );
          }

          return null; // Ne devrait pas atteindre ici dans un flux correct
        }}
      </RainbowConnectButton.Custom>
    </Box>
  );
};

export default ConnectBouton;
