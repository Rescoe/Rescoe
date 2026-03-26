import React, { useEffect, useState, useCallback, useRef } from "react";
import { Box, Text, Badge, Flex, useBreakpointValue, useToast, Tooltip, Button,Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton } from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import Web3 from "web3";
import { formatUnits } from "@ethersproject/units";
import { getEllipsisTxt } from "../../../utils/format";
import { setup1inchWidget } from "@1inch/embedded-widget";

import detectEthereumProvider from "@metamask/detect-provider"; // ✅ AJOUTE ÇA

interface SoldeWalletProps {
  showAddress?: boolean;
  compact?: boolean;
}

const SoldeWallet: React.FC<SoldeWalletProps> = ({
  showAddress = true,
  compact = true,
}) => {
  const { address, isAuthenticated } = useAuth();
  const toast = useToast();

  const [baseBalance, setBaseBalance] = useState("0.00");
  const [ethBalance, setEthBalance] = useState("0.00"); // ✅ NOUVEAU : ETH Ethereum
  const [web3Base, setWeb3Base] = useState<Web3 | null>(null); // Base RPC
  const [web3Eth, setWeb3Eth] = useState<Web3 | null>(null); // Ethereum RPC
  const [isLoading, setIsLoading] = useState(true);
  const [showSwap, setShowSwap] = useState(false);
  const iframeRef = useRef<HTMLDivElement>(null);

  const previousBaseRef = useRef<string>("0.00");
  const previousEthRef = useRef<string>("0.00");

  const BASE_RPC = "https://mainnet.base.org"; // ou Alchemy
  const ETH_RPC = "https://eth.llamarpc.com"; // ou Infura
  const isDesktop = useBreakpointValue({ base: false, md: true });

  // ✅ INIT Web3 multi-chain
  useEffect(() => {
    const initWeb3 = async () => {
      try {
        const provider = await detectEthereumProvider();
        if (provider) {
          // Base chainId 8453
          const web3b = new Web3(new Web3.providers.HttpProvider(BASE_RPC));
          const web3e = new Web3(new Web3.providers.HttpProvider(ETH_RPC));
          setWeb3Base(web3b);
          setWeb3Eth(web3e);
        }
      } catch (error) {
        console.error("Erreur init Web3:", error);
      }
    };
    initWeb3();
  }, []);

  useEffect(() => {
    const handleOpenSwap = () => setShowSwap(true);
    window.addEventListener('openSwapModal', handleOpenSwap);
    return () => window.removeEventListener('openSwapModal', handleOpenSwap);
  }, []);

  // ✅ FETCH BALANCES MULTI-CHAIN
  const fetchBalances = useCallback(async () => {
    if (!web3Base || !web3Eth || !address) {
      setBaseBalance("0.00");
      setEthBalance("0.00");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Base ETH
      const balBase = await web3Base.eth.getBalance(address);
      const newBase = parseFloat(formatUnits(balBase, 18)).toFixed(4);
      if (newBase !== previousBaseRef.current) {
        setBaseBalance(newBase);
        previousBaseRef.current = newBase;
      }

      // Ethereum ETH
      const balEth = await web3Eth.eth.getBalance(address);
      const newEth = parseFloat(formatUnits(balEth, 18)).toFixed(4);
      if (newEth !== previousEthRef.current) {
        setEthBalance(newEth);
        previousEthRef.current = newEth;
      }
    } catch (error) {
      console.error("Erreur balances:", error);
    } finally {
      setIsLoading(false);
    }
  }, [web3Base, web3Eth, address]);

  useEffect(() => {
    if (isAuthenticated && web3Base && web3Eth && address) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchBalances, isAuthenticated, web3Base, web3Eth, address]);

  // useEffect widget (remplace ligne 108)
  useEffect(() => {
    if (!showSwap || !iframeRef.current) return;
    if (typeof window === "undefined") return;

    const provider = (window as any).ethereum;
    if (!provider || typeof provider.request !== "function") {
      console.warn("No valid Ethereum provider");
      return;
    }

    const init = async () => {
      try {
        // ✅ switch Base
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        // reset widget
        iframeRef.current!.innerHTML = "";

        setup1inchWidget({
          hostElement: iframeRef.current!,
          provider,

          chainId: 8453,

          sourceTokenSymbol: "ETH",
          destinationTokenSymbol: "WETH",

          sourceTokenAmount: baseBalance || "0.001",

          theme: "dark",
        });

      } catch (e) {
        console.error("1inch widget error:", e);
      }
    };

    init();

  }, [showSwap, baseBalance]);

  if (!isAuthenticated || !address) {
    return <Badge bg="brand.navy" color="brand.cream"> -- Ξ </Badge>;
  }

  if (isLoading) {
    return <Badge bg="brand.navy" color="brand.cream"> ... </Badge>;
  }

  return (
    <>
      <Tooltip
        label={
          <Flex direction="column" gap={1} p={2}>
            <Text fontSize="xs" fontWeight="500" color="brand.cream">
              Base: {baseBalance} ETH
            </Text>
            <Text fontSize="xs" fontWeight="500" color="brand.cream">
              Eth: {ethBalance} ETH
            </Text>
            {parseFloat(ethBalance) > 0 && (
              <Button
                size="xs"
                mt={1}
                onClick={() => setShowSwap(true)}
                colorScheme="brand"
              >
                Swap → Base
              </Button>
            )}
          </Flex>
        }
        hasArrow
        placement="bottom"
      >
        <Flex align="center" gap={1}>
          {showAddress && (
            <Text fontSize={compact ? "2xs" : "xs"} fontFamily="mono" color="gray.400">
              {getEllipsisTxt(address, 6)}
            </Text>
          )}
          <Badge
            bg="brand.cream"
            color="black"
            fontSize={compact ? "2xs" : "xs"}
            px={compact ? 1 : 2}
            py={0.5}
            borderRadius="full"
            boxShadow="0 0 8px rgba(238,212,132,0.35)"
          >
            {baseBalance} Ξ
          </Badge>
        </Flex>
      </Tooltip>

      {/* ✅ SWAP MODAL/WIDGET */}
      {/* ✅ SWAP MODAL PLEINE PAGE */}
      {showSwap && (
        <Modal isOpen={showSwap} onClose={() => setShowSwap(false)} size="6xl" isCentered>
          <ModalOverlay backdropFilter="blur(20px)" bg="blackAlpha.700" />
          <ModalContent
            bg="brand.navy"
            borderRadius="3xl"
            border="2px solid"
            borderColor="brand.purple/30"
            maxW="90vw"
            maxH="90vh"
          >
            <ModalHeader pb={4}>
              <Flex justify="space-between" align="center">
                <Text color="brand.cream" fontSize="2xl" fontWeight={700}>
                  Swap ETH → Base ETH
                </Text>
                <Text fontSize="sm" color="brand.cream" opacity={0.8}>
                  {ethBalance} ETH disponibles
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton color="brand.cream" size="lg" />

            <Box p={6} h="500px" w="full">
              <div ref={iframeRef} style={{ width: "100%", height: "100%" }} />
            </Box>
          </ModalContent>
        </Modal>
      )}

    </>
  );
};

export default SoldeWallet;
