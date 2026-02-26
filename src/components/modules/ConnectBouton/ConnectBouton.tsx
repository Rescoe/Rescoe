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
          px={5}
          py={4}
          minW="auto"
          maxW={{ base: "calc(100vw - 40px)", md: "180px" }}
          fontSize={{ base: "sm", md: "md" }}
          fontWeight={600}
          borderRadius="full"
          letterSpacing={0.5}
          whiteSpace="nowrap"
          bg="brand.cream"
          color="black"
          border="1px solid"
          borderColor="brand.goldAlpha"
          boxShadow="0 10px 40px rgba(238,212,132,0.25)"
          backdropFilter="blur(10px)"
          whileHover={
            isDesktop
              ? {
                  scale: 1.05,
                  y: -2,
                  boxShadow: "0 20px 60px rgba(238,212,132,0.35)",
                  backgroundColor: "var(--chakra-colors-brand-gold)",
                }
              : {}
          }
          whileTap={{ scale: 0.98 }}
          _active={{ transform: "scale(0.98)" }}
          mx={1}
          data-loading={isConnecting}
        >
          Se connecter
        </MotionMenuButton>

        <MenuList
          p={2}
          borderRadius="2xl"
          backdropFilter="blur(18px)"
          bg="rgba(20,20,24,0.95)"
          border="1px solid"
          boxShadow="0 20px 80px rgba(0,0,0,0.45)"
          minW="280px"
        >
          <MenuItem
            borderRadius="xl"
            fontWeight={500}
            _hover={{
              bg: "brand.navy",
              color: "brand.cream",
            }}
            onClick={async () => {
              await connectWallet();
              if (address) await handleAuth(address);
            }}
          >
            🦊 MetaMask / Wallet
          </MenuItem>

          <MenuItem
            mt={1}
            borderRadius="xl"
            fontWeight={500}
            _hover={{
              bg: "brand.navy",
              color: "brand.cream",
            }}
            onClick={connectWithEmail}
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
          <VStack align="start" spacing={0.5}>
            <Text fontSize="sm" fontWeight="600" color="brand.cream">
              {getUserRole()}
            </Text>
            <Text fontSize="xs" color="brand.cream" opacity={0.6}>
              Base • {balance} ETH
            </Text>
          </VStack>
        }
        hasArrow
        placement="bottom-start"
        bg="brand.navy"
        color="brand.cream"
      >
      <MotionMenuButton
        as={Button}
        display="flex"
        alignItems="center"
        justifyContent="center"
        mx="auto"
        px={4}
        py={2.5}
        minW="140px"
        borderRadius="full"
        fontWeight={600}
        letterSpacing={0.4}
        bg="brand.navy"
        color="brand.cream"
        backdropFilter="blur(12px)"
        boxShadow="0 8px 28px rgba(0,0,0,0.35)"
        whileHover={
          isDesktop
            ? {
                scale: 1.05,
                y: -1,
                boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
              }
            : {}
        }
        _hover={{
          borderColor: "brand.gold",
          bg: "brand.navy",
        }}
        _active={{ transform: "scale(0.97)" }}
      >
          <HStack spacing={1.5} w="full">
            <Flex align="center" gap={1} flex={1} minW={0}>
              <Badge
                fontSize="2xs"
                px={1.5}
                borderRadius="full"
                bg="brand.cream/15"
                color="brand.cream"
                border="1px solid"
                borderColor="brand.cream/40"
                flexShrink={0}
              >
                {getUserRole().slice(0, 3)}
              </Badge>

              <Text
                fontSize="xs"
                fontFamily="mono"
                noOfLines={1}
                flex={1}
                color="brand.cream"
                opacity={0.9}
              >
                {getEllipsisTxt(address!)}
              </Text>

              <Badge
                fontSize="2xs"
                px={1.5}
                borderRadius="full"
                bg="brand.gold/20"
                color="brand.gold"
                border="1px solid"
                borderColor="brand.gold/40"
                flexShrink={0}
              >
                {balance} Ξ
              </Badge>
            </Flex>
          </HStack>
        </MotionMenuButton>
      </Tooltip>

      <MenuList
        backdropFilter="blur(18px)"
        bg="brand.navy"
        border="1px solid"
        borderColor="brand.cream/30"
        minW={{ base: "300px", md: "320px" }}
        p={0}
      >
        {/* HEADER WALLET */}
        <Box p={4} borderBottom="1px solid" borderColor="brand.cream/20">
          <VStack align="start" spacing={1}>
            <Text
              fontSize="xs"
              color="brand.cream"
              opacity={0.6}
              textTransform="uppercase"
            >
              Wallet
            </Text>

            <HStack justify="space-between" w="full">
              <Text fontSize="sm" fontFamily="mono" color="brand.cream" noOfLines={1}>
                {getEllipsisTxt(address!)}
              </Text>

              <IconButton
                aria-label={hasCopied ? "Copié" : "Copier"}
                icon={<CopyIcon />}
                size="sm"
                variant="ghost"
                color="brand.cream"
                onClick={onCopy}
                _hover={{ bg: "brand.cream/10" }}
              />
            </HStack>
          </VStack>
        </Box>

        {/* BALANCE */}
        <MenuItem py={3} px={4} _hover={{ bg: "brand.cream/5" }}>
          <HStack>
            <Box w={2.5} h={2.5} bg="brand.gold" borderRadius="full" />
            <VStack align="start" spacing={0}>
              <Text color="brand.cream">Solde</Text>
              <Text fontSize="sm" color="brand.gold">
                {balance} ETH
              </Text>
            </VStack>
          </HStack>
        </MenuItem>

        {/* CHAIN */}
        <MenuItem py={3} px={4} _hover={{ bg: "brand.cream/5" }}>
          <HStack>
            <Box w={2} h={2} bg="brand.cream" borderRadius="full" />
            <Text color="brand.cream">Base ({selectedChainId})</Text>
          </HStack>
        </MenuItem>

        {/* DISCONNECT */}
        <Box p={2} pt={1}>
          <MenuItem
            onClick={handleDisconnect}
            borderRadius="md"
            border="1px solid"
            borderColor="brand.cream/30"
            color="brand.cream"
            _hover={{
              bg: "brand.gold",
              color: "black",
              borderColor: "brand.gold",
            }}
          >
            Se déconnecter
          </MenuItem>
        </Box>
      </MenuList>
    </Menu>
  );
};

export default ConnectBouton;
