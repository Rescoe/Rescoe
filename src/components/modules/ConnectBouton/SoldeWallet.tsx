import React, { useEffect, useState, useCallback, useRef } from "react";
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
  const [balance, setBalance] = useState("0.00");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);

  const web3Ref = useRef<Web3 | null>(null);
  const cacheRef = useRef<{ [address: string]: { value: string; timestamp: number } }>({});
  const CACHE_DURATION = 300000; // 5min cache
  const SPEND_THRESHOLD = 0.001;  // Refresh si dépense > 0.001 ETH

  const isDesktop = useBreakpointValue({ base: false, md: true });

  // SINGLE Web3 init
  useEffect(() => {
    const initWeb3 = async () => {
      try {
        const provider = await detectEthereumProvider();
        if (provider) {
          web3Ref.current = new Web3(provider as any);
        }
      } catch (error) {
        console.error("Erreur init Web3:", error);
      }
    };
    initWeb3();
  }, []);

  // SMART FETCH + DÉTECTEUR DÉPENSES
  const fetchBalance = useCallback(async (force = false) => {
    if (!web3Ref.current || !address) {
      setBalance("0.00");
      setIsLoading(false);
      return;
    }

    const cached = cacheRef.current[address];

    // ✅ CACHE HIT (sauf force)
    if (!force && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setBalance(cached.value);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const bal = await web3Ref.current.eth.getBalance(address);
      const formatted = parseFloat(formatUnits(bal, 18)).toFixed(4);

      // ✅ Détecteur dépenses
      if (cached && parseFloat(formatted) < parseFloat(cached.value) - SPEND_THRESHOLD) {
        console.log("💸 Dépense détectée ! Refresh auto");
      }

      // Cache update
      cacheRef.current[address] = {
        value: formatted,
        timestamp: Date.now()
      };

      setBalance(formatted);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error("Erreur balance:", error);
      setBalance("?.??");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // ON CONNECT + SLOW REFRESH (5min)
  useEffect(() => {
    if (isAuthenticated && address) {
      fetchBalance(true);  // Force initial

      const interval = setInterval(() => fetchBalance(false), CACHE_DURATION);
      return () => clearInterval(interval);
    }
  }, [fetchBalance, address]);

  // ÉCoute changements chaîne/adresse (MetaMask events)
  useEffect(() => {
    const provider = web3Ref.current?.currentProvider;
    if (!provider || !address) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Déconnexion
        cacheRef.current = {};
        setBalance("0.00");
      }
    };

    const handleChainChanged = () => {
      fetchBalance(true);  // Force refresh chaîne
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [fetchBalance, address]);

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

  if (isLoading) {
    return (
      <Badge colorScheme="blue" variant="subtle" fontSize={compact ? "2xs" : "xs"} px={1}>
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
            Base • Maj il y a {(Date.now() - lastUpdate) / 1000 | 0}s
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
