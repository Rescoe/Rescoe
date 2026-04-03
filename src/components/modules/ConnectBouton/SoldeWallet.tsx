import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Text,
  Badge,
  Flex,
  useToast,
  Tooltip,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Spinner,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import { getEllipsisTxt } from "../../../utils/format";
import { setup1inchWidget } from "@1inch/embedded-widget";
import detectEthereumProvider from "@metamask/detect-provider";
import { JsonRpcProvider, formatEther } from "ethers";

interface SoldeWalletProps {
  showAddress?: boolean;
  compact?: boolean;
}

const ETH_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://rpc.ankr.com/eth",
  "https://eth.llamarpc.com",
];

const BASE_RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
];

const SoldeWallet: React.FC<SoldeWalletProps> = ({
  showAddress = true,
  compact = true,
}) => {
  const { address, isAuthenticated } = useAuth();
  const toast = useToast();

  const [baseBalance, setBaseBalance] = useState("0.0000");
  const [ethBalance, setEthBalance] = useState("0.0000");
  const [isLoading, setIsLoading] = useState(true);
  const [showSwap, setShowSwap] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  const iframeRef = useRef<HTMLDivElement>(null);
  const previousBaseRef = useRef<string>("0.0000");
  const previousEthRef = useRef<string>("0.0000");
  const fetchingRef = useRef(false);
  const toastErrorShownRef = useRef(false);
  const widgetCleanupRef = useRef<null | (() => void)>(null);

  const getBalanceWithFallback = useCallback(async (rpcUrls: string[], wallet: string) => {
    let lastError: unknown = null;

    for (const rpc of rpcUrls) {
      try {
        const provider = new JsonRpcProvider(rpc);
        const balance = await provider.getBalance(wallet);
        return formatEther(balance);
      } catch (err) {
        lastError = err;
        console.warn(`RPC failed: ${rpc}`, err);
      }
    }

    throw lastError ?? new Error("Tous les RPC ont échoué");
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setBaseBalance("0.0000");
      setEthBalance("0.0000");
      setIsLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setIsLoading(true);

      const [baseRaw, ethRaw] = await Promise.all([
        getBalanceWithFallback(BASE_RPCS, address),
        getBalanceWithFallback(ETH_RPCS, address),
      ]);

      const newBase = parseFloat(baseRaw).toFixed(4);
      const newEth = parseFloat(ethRaw).toFixed(4);

      if (newBase !== previousBaseRef.current) {
        previousBaseRef.current = newBase;
        setBaseBalance(newBase);
      }

      if (newEth !== previousEthRef.current) {
        previousEthRef.current = newEth;
        setEthBalance(newEth);
      }

      toastErrorShownRef.current = false;
    } catch (error) {
      console.error("Erreur balances:", error);

      if (!toastErrorShownRef.current) {
        toast({
          title: "Erreur balance",
          description: "Impossible de récupérer les soldes pour le moment",
          status: "error",
          duration: 3000,
        });
        toastErrorShownRef.current = true;
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [address, getBalanceWithFallback, toast]);

  useEffect(() => {
    if (!isAuthenticated || !address) {
      setIsLoading(false);
      return;
    }

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, address, fetchBalances]);

  useEffect(() => {
    if (!showSwap || !iframeRef.current || typeof window === "undefined") return;

    let cancelled = false;

    const initWidget = async () => {
      try {
        setWidgetError(null);
        setWidgetLoaded(false);

        if (widgetCleanupRef.current) {
          widgetCleanupRef.current();
          widgetCleanupRef.current = null;
        }

        iframeRef.current!.innerHTML = "";

        const provider = (await detectEthereumProvider()) as any;
        if (!provider || typeof provider.request !== "function") {
          throw new Error("MetaMask non détecté");
        }

        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x1" }],
          });
        } catch (switchError: any) {
          console.warn("Switch Ethereum warning:", switchError);
        }

        if (cancelled || !iframeRef.current) return;

        const amount = Math.max(parseFloat(ethBalance || "0"), 0.001).toFixed(3);

        const widget = setup1inchWidget({
          hostElement: iframeRef.current,
          provider,
          chainId: 1,
          sourceTokenSymbol: "ETH",
          destinationTokenSymbol: "USDC",
          sourceTokenAmount: amount,
          theme: "dark",
          ...(process.env.NODE_ENV === 'production' ? { disableWalletModal: true } : {}),
        });

        if (widget && typeof (widget as any).onIframeLoad === "function") {
          (widget as any).onIframeLoad(() => {
            if (!cancelled) setWidgetLoaded(true);
          });
        } else {
          setTimeout(() => {
            if (!cancelled) setWidgetLoaded(true);
          }, 1500);
        }

        widgetCleanupRef.current = () => {
          try {
            if (widget && typeof (widget as any).destroy === "function") {
              (widget as any).destroy();
            }
          } catch (e) {
            console.warn("Widget cleanup warning:", e);
          }

          if (iframeRef.current) {
            iframeRef.current.innerHTML = "";
          }
        };
      } catch (error: any) {
        console.error("1inch widget error:", error);
        if (!cancelled) {
          setWidgetError(error?.message || "Erreur lors du chargement du widget");
          setWidgetLoaded(false);
        }
      }
    };

    initWidget();

    return () => {
      cancelled = true;
      if (widgetCleanupRef.current) {
        widgetCleanupRef.current();
        widgetCleanupRef.current = null;
      }
    };
  }, [showSwap, ethBalance]);

  if (!isAuthenticated || !address) {
    return (
      <Badge bg="brand.navy" color="brand.cream">
        -- Ξ
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <Badge bg="brand.navy" color="brand.cream">
        ...
      </Badge>
    );
  }

  return (
    <>
      <Tooltip
        hasArrow
        placement="bottom"
        bg="brand.navy"
        color="brand.cream"
        label={
          <Flex direction="column" gap={2} p={2}>
            <Text fontSize="xs" fontWeight="bold">
              Soldes
            </Text>
            <Text fontSize="xs">Ethereum: {ethBalance} ETH</Text>
            <Text fontSize="xs">Base: {baseBalance} ETH</Text>

            {parseFloat(ethBalance) > 0.0009 && (
              <Button
                size="xs"
                mt={1}
                colorScheme="purple"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSwap(true);
                }}
              >
                Swap / Bridge
              </Button>
            )}
          </Flex>
        }
      >
        <Flex align="center" gap={1}>
          {showAddress && (
            <Text
              fontSize={compact ? "2xs" : "xs"}
              fontFamily="mono"
              color="gray.400"
            >
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

      <Modal isOpen={showSwap} onClose={() => setShowSwap(false)} size="6xl" isCentered>
        <ModalOverlay backdropFilter="blur(20px)" bg="blackAlpha.700" />
        <ModalContent
          bg="brand.navy"
          borderRadius="3xl"
          border="2px solid"
          borderColor="purple.400"
          maxW="92vw"
          maxH="90vh"
        >
          <ModalHeader pb={4}>
            <Flex justify="space-between" align="center" gap={4}>
              <Box>
                <Text color="brand.cream" fontSize="2xl" fontWeight={700}>
                  Swap ETH → Base
                </Text>
                <Text fontSize="sm" color="gray.400">
                  Le widget 1inch s’ouvre sur Ethereum mainnet pour le swap. [web:75][web:79]
                </Text>
              </Box>

              <Flex direction="column" align="flex-end">
                <Text fontSize="sm" color="brand.cream">
                  Ethereum: {ethBalance} ETH
                </Text>
                <Text fontSize="sm" color="brand.cream">
                  Base: {baseBalance} ETH
                </Text>
              </Flex>
            </Flex>
          </ModalHeader>

          <ModalCloseButton color="brand.cream" size="lg" />

          <ModalBody p={6}>
            {widgetError ? (
              <Alert status="warning" borderRadius="lg">
                <AlertIcon />
                <Box flex="1">
                  <Text fontWeight="bold">{widgetError}</Text>
                  <Text fontSize="sm">
                    Le chargement du widget a échoué. Réessaie dans quelques secondes.
                  </Text>
                </Box>
                <Button size="sm" ml={4} onClick={() => setShowSwap(false)}>
                  Fermer
                </Button>
              </Alert>
            ) : (
              <Box
                position="relative"
                h={{ base: "420px", md: "560px" }}
                w="full"
                borderRadius="2xl"
                overflow="hidden"
                border="1px solid"
                borderColor="whiteAlpha.300"
                bg="blackAlpha.300"
              >
                {!widgetLoaded && (
                  <Flex
                    position="absolute"
                    inset={0}
                    align="center"
                    justify="center"
                    direction="column"
                    gap={3}
                    bg="rgba(7,12,20,0.75)"
                    zIndex={2}
                  >
                    <Spinner size="xl" color="brand.gold" />
                    <Text color="brand.cream">Chargement du widget 1inch…</Text>
                  </Flex>
                )}

                <div
                  ref={iframeRef}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                />
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SoldeWallet;
