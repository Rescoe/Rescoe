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
  const { isAuthenticated, setIsAuthenticated } = useAuth();
  const [walletConnected, setWalletConnected] = useState(false); // Suivi de la connexion

  // 🔹 Fonction d'authentification appelée APRÈS connexion
  useEffect(() => {
    if (walletConnected && address && isConnected) {
      handleAuth(address, 11155111); // Appelle handleAuth une seule fois après connexion
      setWalletConnected(false); // Reset après appel
    }
  }, [walletConnected, address, isConnected]);

  const handleAuth = async (account: string, chainId: number) => {
    setIsConnecting(true);
    try {
      const challenge = await requestChallengeAsync({ address: account, chainId: 11155111 });

      if (!challenge || !challenge.message) {
        throw new Error("Challenge non valide.");
      }

      const signature = await signMessageAsync({ message: challenge.message });

      const result = await signIn('moralis-auth', {
        message: challenge.message,
        signature,
        network: 'Evm',
        redirect: false,
      });

      if (result && result.error) {
        throw new Error(result.error);
      }

      setAddress(account.toLowerCase());
      setIsAuthenticated(true);

      localStorage.setItem('connectedAddress', account.toLowerCase());
      localStorage.setItem('isAuthenticated', 'true');
    } catch (e) {
      console.error("Erreur lors de l'authentification:", e);
      toast({
        title: 'Oops, quelque chose s\'est mal passé...',
        description: 'Essayez depuis le navigateur de votre wallet',
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
         if (!mounted) return null;

         if (!isAuthenticated) {
           // Afficher "Connect Wallet" si l'utilisateur n'est pas authentifié
           return (
             <Button
               onClick={async () => {
                 await openConnectModal(); // 🔹 Ouvre Metamask
                 setWalletConnected(true); // 🔹 Déclenche useEffect pour appeler handleAuth() après connexion
               }}
               colorScheme="blue"
               size="sm"
               isLoading={isConnecting}
               loadingText="Vérification..."
             >
               Connect Wallet
             </Button>
           );
         }

         // Afficher les informations de l'utilisateur connecté (adresse et rôle)
         return (
           <Box>
             <Tooltip label={`Connecté : ${getUserRole()}`} aria-label="User Role Tooltip" hasArrow placement="bottom">
               <HStack onClick={handleDisconnect} cursor="pointer" gap={'20px'} spacing={{ base: 2, md: 4 }} direction={{ base: 'column', md: 'row' }}>

               <Text fontWeight="medium">
                 {account ? getEllipsisTxt(account.address) : "Non connecté"}
               </Text>

               <Text fontSize="sm" color="gray.500">
                 {chain ? chain.name : "Réseau inconnu"}
               </Text>

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
