import React, { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { Button, Text, HStack, Avatar, useToast, Tooltip, Box } from '@chakra-ui/react';
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

  // Fonction pour gérer l'authentification utilisateur via RainbowKit
  const handleAuth = async (account: string, chainId: number) => {
    setIsConnecting(true);

    try {
      const challenge = await requestChallengeAsync({ address: account, chainId: 11155111 });

      if (!challenge || !challenge.message) {
        throw new Error("Challenge non valide.");
      }

      const signature = await signMessageAsync({ message: challenge.message });

      await signIn('moralis-auth', {
        message: challenge.message,
        signature,
        network: 'Evm',
        redirect: false,
      });

      setAddress(account.toLowerCase());
      setIsAuthenticated(true);
      localStorage.setItem('connectedAddress', account.toLowerCase());
    } catch (e) {
      console.error("Erreur lors de l'authentification:", e);
      toast({
        title: 'Oops, something went wrong...',
        description: 'Petite erreur, revenez plus tard',
        status: 'error',
        position: 'top-right',
        isClosable: true,
      });
    } finally {
      setIsConnecting(false);
    }
  };


  // Gérer la déconnexion
  const handleDisconnect = async () => {
    await disconnectAsync();
    signOut({ callbackUrl: '/' });
    setIsAuthenticated(false);

    // Supprimer l'adresse du localStorage lors de la déconnexion
    localStorage.removeItem('connectedAddress');
  };

  // Récupérer l'adresse depuis le localStorage au chargement de la page
  useEffect(() => {
    const storedAddress = localStorage.getItem('connectedAddress');
    if (storedAddress && isConnected) {
      setAddress(storedAddress);
      setIsAuthenticated(true);
    }
  }, [isConnected, setAddress]);

  // Déterminer le rôle de l'utilisateur
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
                loadingText="Verification de l'adhésion..."
              >
                Espace Adhérents
              </Button>
            );
          }

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
        }}
      </RainbowConnectButton.Custom>
    </Box>
  );
};

export default ConnectBouton;
