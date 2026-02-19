import React, { useEffect, useState } from "react";
import {
  Button,
  Text,
  useToast,
  Tooltip,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useClipboard,
  IconButton,
  VStack,
  HStack,
  Badge,
  Flex,
  useBreakpointValue,
} from "@chakra-ui/react";
import { LinkIcon, CopyIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { signIn, signOut } from "next-auth/react";
import { useAuthRequestChallengeEvm } from "@moralisweb3/next";
import { getEllipsisTxt } from "../../../utils/format";
import { useAuth } from "../../../utils/authContext";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import { formatUnits } from "@ethersproject/units";

const MotionMenuButton = motion(MenuButton);

const ConnectBouton: React.FC = () => {
  const { requestChallengeAsync } = useAuthRequestChallengeEvm();
  const toast = useToast();

  const {
    isAuthenticated,
    setIsAuthenticated,
    setAddress,
    connectWithEmail,
    connectWallet,
    provider,
    logout,
    role,
    address,
    isLoading,
    roleLoading,
  } = useAuth();

  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState("0");
  const selectedChainId = 8453;
  const [web3, setWeb3] = useState<Web3 | null>(null);

  const isDesktop = useBreakpointValue({ base: false, md: true });

  // Init Web3 + fetch balance périodique
  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const web3Instance = new Web3(provider as any);
        setWeb3(web3Instance);
      }
    };
    initWeb3();
  }, []);

  useEffect(() => {
    if (!web3 || !address) return;

    const fetchBalance = async () => {
      try {
        const bal = await web3.eth.getBalance(address);
        const formatted = formatUnits(bal, 18);
        setBalance(formatted.slice(0, 8));
      } catch (e) {
        console.error("Erreur balance:", e);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [web3, address]);

  const handleAuth = async (account: string) => {
    setIsConnecting(true);
    try {
      const challenge = await requestChallengeAsync({
        address: account,
        chainId: selectedChainId,
      });
      if (!challenge?.message) throw new Error("Challenge non valide.");

      setAddress(account.toLowerCase());
      setIsAuthenticated(true);

      toast({
        title: "Connecté avec succès !",
        status: "success",
        duration: 2000,
        position: "top-right",
      });
    } catch (e) {
      toast({
        title: "Erreur de connexion",
        description: "Veuillez réessayer.",
        status: "error",
        position: "top-right",
        duration: 4000,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await logout();
    signOut({ callbackUrl: "/" });
    setIsAuthenticated(false);
    setAddress(null);
    setBalance("0");
  };

  const getUserRole = () => {
    if (!role) return "User";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Loading state
  if (isLoading || roleLoading) {
    return (
      <Button
        size="sm"
        borderRadius="full"
        bg="whiteAlpha.100"
        border="1px solid whiteAlpha.200"
        backdropFilter="blur(10px)"
        isLoading
      />
    );
  }

  // ========== DISCONNECTED - Ton bouton doré parfait ✅ ==========
  if (!isAuthenticated) {
    return (
      <Menu>
        <MotionMenuButton
          as={Button}
          py={4}
          minW="auto"
          maxW={{ base: "calc(100vw - 40px)", md: "160px" }}
          fontSize={{ base: "sm", md: "md" }}
          fontWeight="600"
          borderRadius="full"
          letterSpacing={0.5}
          whiteSpace="nowrap"
          bg="brand.gold"
          color="black"
          boxShadow="0 10px 40px rgba(238,212,132,0.25)"
          border="1px solid rgba(238,212,132,0.3)"
          whileHover={isDesktop ? { scale: 1.05, boxShadow: "0 20px 60px rgba(238,212,132,0.35)", y: -2 } : {}}
          whileTap={{ scale: 0.98 }}
          _hover={{ bg: "brand.gold" }}
          _active={{ transform: "scale(0.98)" }}
          data-loading={isConnecting}
          //isDisabled={isConnecting}
          mx={1}
        >
          Se connecter
        </MotionMenuButton>

        <MenuList
          backdropFilter="blur(18px)"
          bg="rgba(20,20,24,0.95)"
          border="1px solid whiteAlpha.200"
          shadow="lg"
          minW="280px"
        >
          <MenuItem
            onClick={async () => {
              await connectWallet();
              if (address) await handleAuth(address);
            }}
            _hover={{ bg: "whiteAlpha.100" }}
          >
            🦊 MetaMask / Wallet
          </MenuItem>
          <MenuItem
            onClick={connectWithEmail}
            _hover={{ bg: "whiteAlpha.100" }}
          >
            📧 Email (Web3Auth)
          </MenuItem>
        </MenuList>
      </Menu>
    );
  }

  // ========== CONNECTED - NOUVEAU BOUTON PETIT + COMPACT ✅ ==========
  const { onCopy, hasCopied } = useClipboard(address || "");

  return (
    <Menu placement="bottom-end">
      <Tooltip
        label={
          <VStack align="start" spacing={1} p={2}>
            <Text fontSize="sm" fontWeight="500">{getUserRole()}</Text>
            <Text fontSize="xs" color="gray.400">Base • {balance} ETH</Text>
          </VStack>
        }
        hasArrow
        placement="bottom-start"
        bg="gray.800"
        color="white"
      >
        <MotionMenuButton
          as={Button}
          px={2.5} py={2}             // ✅ COMPACT
          borderRadius="full"
          bg="whiteAlpha.100"
          border="1px solid whiteAlpha.200"
          backdropFilter="blur(10px)"
          whileHover={isDesktop ? { scale: 1.05 } : {}}
          _hover={{ bg: "whiteAlpha.200" }}
        >
          {/* Layout ultra-compact : Logo + Badge + Adresse + Solde */}
          <HStack spacing={1.5} w="full">

            {/* Rôle + Adresse + Solde */}
            <Flex align="center" gap={1} flex={1} minW={0}>
              <Badge
                colorScheme={role === "admin" ? "purple" : "green"}
                fontSize="2xs" px={1.5} borderRadius="full" flexShrink={0}
              >
                {getUserRole().slice(0, 3)}
              </Badge>
              <Text
                fontSize="xs"
                fontFamily="mono"
                noOfLines={1}
                overflow="hidden"
                textOverflow="ellipsis"
                flex={1}
              >
                {getEllipsisTxt(address!)}
              </Text>
              <Badge fontSize="2xs" colorScheme="gray" variant="subtle" px={1} flexShrink={0}>
                {balance} Ξ
              </Badge>
            </Flex>
          </HStack>
        </MotionMenuButton>
      </Tooltip>

      {/* Ton MenuList parfait (inchangé) */}
      <MenuList
        backdropFilter="blur(18px)"
        bg="rgba(20,20,24,0.95)"
        border="1px solid whiteAlpha.200"
        minW={{ base: "300px", md: "320px" }}
        maxW="90vw"
      >
        <MenuItem p={4} borderBottom="1px" borderColor="gray.700">
          <VStack align="start" spacing={2} w="full">
            <Text fontSize="xs" color="gray.400" textTransform="uppercase">Adresse</Text>
            <HStack justify="space-between" w="full">
              <Text fontSize="sm" fontFamily="mono" color="white" noOfLines={1}>
                {getEllipsisTxt(address!)}
              </Text>
              <IconButton
                aria-label={hasCopied ? "Copié !" : "Copier"}
                icon={hasCopied ? <CopyIcon color="green.400" /> : <LinkIcon />}
                size="sm"
                variant="ghost"
                colorScheme="purple"
                onClick={onCopy}
                title={hasCopied ? "Copié !" : "Copier"}
                animation={hasCopied ? "pulse 0.5s" : "none"}
                _hover={{ bg: "purple.600" }}
              />
            </HStack>
          </VStack>
        </MenuItem>

        <MenuItem py={3} px={4}>
          <HStack>
            <Box w={3} h={3} bg="green.400" borderRadius="full" />
            <VStack align="start" spacing={0}>
              <Text fontWeight="500">Solde</Text>
              <Text fontSize="sm" color="green.400">{balance} ETH</Text>
            </VStack>
          </HStack>
        </MenuItem>

        <MenuItem py={3} px={4}>
          <HStack>
            <Box w={2} h={2} bg="blue.400" borderRadius="full" />
            <Text>Base ({selectedChainId})</Text>
          </HStack>
        </MenuItem>

        <MenuItem
          onClick={handleDisconnect}
          mt={2}
          _hover={{ bg: "red.600", color: "white" }}
          fontWeight="600"
          borderTop="1px"
          borderColor="gray.700"
          borderRadius="md"
          color="red.300"
        >
          Se déconnecter
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default ConnectBouton;
