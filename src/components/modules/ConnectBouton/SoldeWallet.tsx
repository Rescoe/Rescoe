import React, { useEffect, useState, useCallback, useRef } from "react";  // ✅ + useRef
import {
  Box,
  Text,
  Badge,
  Flex,
  useBreakpointValue,
  useToast,
  Tooltip,
} from "@chakra-ui/react";
import { useAuth } from "../../../utils/authContext";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import { formatUnits } from "@ethersproject/units";
import { getEllipsisTxt } from "../../../utils/format";

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

  const [balance, setBalance] = useState("0.00");
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const previousBalanceRef = useRef<string>("0.00");  // 🔥 OPTIM : old balance

  const isDesktop = useBreakpointValue({ base: false, md: true });

  // ✅ INIT Web3
  useEffect(() => {
    const initWeb3 = async () => {
      try {
        const provider = await detectEthereumProvider();
        if (provider) {
          const web3Instance = new Web3(provider as any);
          setWeb3(web3Instance);
        }
      } catch (error) {
        console.error("Erreur init Web3:", error);
      }
    };
    initWeb3();
  }, []);

  // ✅ FETCH avec COMPARAISON (NO RE-RENDER si identique)
  const fetchBalance = useCallback(async () => {
    if (!web3 || !address) {
      setBalance("0.00");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const bal = await web3.eth.getBalance(address);
      const newBalance = parseFloat(formatUnits(bal, 18)).toFixed(4);

      // 🔥 SKIP UPDATE si PAS CHANGÉ → NO RERENDER
      if (newBalance !== previousBalanceRef.current) {
        setBalance(newBalance);
        previousBalanceRef.current = newBalance;
       //console.log(`💰 Balance mise à jour: ${newBalance} ETH`);
      }
    } catch (error) {
      console.error("Erreur balance:", error);
      toast({
        title: "Erreur lecture balance",
        status: "warning",
        duration: 2000,
        position: "top-right",
      });
      setBalance("?.??");
    } finally {
      setIsLoading(false);
    }
  }, [web3, address, toast]);

  useEffect(() => {
    if (isAuthenticated && web3 && address) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000); // 10s
      return () => clearInterval(interval);
    }
  }, [fetchBalance, isAuthenticated, web3, address]);

  // Pas connecté
  if (!isAuthenticated || !address) {
    return (
      <Badge
        colorScheme="gray"
        variant="subtle"
        fontSize={compact ? "2xs" : "xs"}
        px={compact ? 1 : 1.5}
      >
        -- Ξ
      </Badge>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <Badge
        colorScheme="gray"
        variant="subtle"
        fontSize={compact ? "2xs" : "xs"}
        px={1}
      >
        ...
      </Badge>
    );
  }

  return (
    <Tooltip
      label={
        <Flex direction="column" gap={1} p={2}>
          <Text fontSize="xs" fontWeight="500">
            {balance} ETH
          </Text>
          <Text fontSize="2xs" color="gray.400">
            Base
          </Text>
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
          variant="solid"
          fontSize={compact ? "2xs" : "xs"}
          px={compact ? 1 : 1.5}
          cursor="default"
        >
          {balance} Ξ
        </Badge>
      </Flex>
    </Tooltip>
  );
};

export default SoldeWallet;
