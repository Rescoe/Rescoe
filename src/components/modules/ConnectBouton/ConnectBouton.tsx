import React, { useEffect, useState } from "react";
import {
  Button,
  Text,
  HStack,
  useToast,
  Tooltip,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { signIn, signOut } from "next-auth/react";
import { useAuthRequestChallengeEvm } from "@moralisweb3/next";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { getEllipsisTxt } from "../../../utils/format";
import { useAuth } from "../../../utils/authContext";
import { brandHover, hoverStyles } from "@styles/theme";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";

const ConnectBouton: React.FC = () => {
  const { disconnectAsync } = useDisconnect();
  const { isConnected, address: wagmiAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { requestChallengeAsync } = useAuthRequestChallengeEvm();
  const toast = useToast();

  const {
    isAuthenticated,
    setIsAuthenticated,
    setAddress,
    connectWithEmail,
    connectWallet,
    logout,
    role,
    address, // ✅ On récupère l’adresse du contexte (connexion Web3Auth)
  } = useAuth();

  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState(11155111);
  const [chainName, setChainName] = useState("Sepolia");
  const [web3, setWeb3] = useState<Web3 | null>(null);

  // Init Web3 instance
  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const web3Instance = new Web3(provider);
        setWeb3(web3Instance);
      }
    };
    initWeb3();
  }, []);

  // Moralis EVM auth flow
  const handleAuth = async (account: string, chainId: number) => {
    setIsConnecting(true);
    try {
      const challenge = await requestChallengeAsync({ address: account, chainId });
      if (!challenge?.message) throw new Error("Challenge non valide.");

      const signature = await signMessageAsync({ message: challenge.message });
      const result = await signIn("moralis-auth", {
        message: challenge.message,
        signature,
        network: "Evm",
        redirect: false,
      });

      if (result?.error) throw new Error(result.error);

      setAddress(account.toLowerCase());
      setIsAuthenticated(true);
      localStorage.setItem("connectedAddress", account.toLowerCase());
      localStorage.setItem("isAuthenticated", "true");
    } catch (e) {
      console.error("Erreur lors de l'authentification:", e);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de vous authentifier, veuillez réessayer.",
        status: "error",
        position: "top-right",
        isClosable: true,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectAsync();
    await logout();
    signOut({ callbackUrl: "/" });
    setIsAuthenticated(false);
    setAddress(null);
    localStorage.removeItem("connectedAddress");
    localStorage.removeItem("isAuthenticated");
  };

  const handleChainSelect = async (chainId: number) => {
    setSelectedChainId(chainId);
    if (web3 && web3.currentProvider) {
      try {
        await (web3.currentProvider as any).request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });

        const chainMap: { [key: number]: string } = {
          1: "Ethereum",
          11155111: "Sepolia",
          42161: "Arbitrum",
          10: "Optimism",
          84531: "Base",
        };

        setChainName(chainMap[chainId] || "Réseau inconnu");
      } catch (error) {
        console.error("Erreur lors du changement de chaîne:", error);
      }
    }
  };

  const getUserRole = () =>
    role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

  // --------------------------
  // 🟢 UI
  // --------------------------
  if (!isAuthenticated) {
    return (
      <Menu>
        <MenuButton
          as={Button}
          px={6}
          py={4}
          fontSize="md"
          borderRadius="full"
          boxShadow="lg"
          _hover={{ ...hoverStyles.brandHover._hover, ...brandHover }}
          _active={{ transform: "scale(0.98)" }}
        >
          Se connecter
        </MenuButton>
        <MenuList>
          <MenuItem
            onClick={async () => {
              await connectWallet();
              if (wagmiAddress) {
                await handleAuth(wagmiAddress, selectedChainId);
              }
            }}
          >
            🦊 MetaMask / Wallet
          </MenuItem>

          <MenuItem
            onClick={async () => {
              await connectWithEmail();
            }}
          >
            📧 Email (Web3Auth)
          </MenuItem>
        </MenuList>
      </Menu>
    );
  }

  return (
    <Box>
      <RainbowConnectButton.Custom>
        {({ account, chain, openAccountModal, mounted }) => {
          if (!mounted) return null;

          // ✅ On choisit dynamiquement la source de l’adresse
          const displayAddress = account?.address || address;

          return (
            <Tooltip
              label={`Connecté : ${getUserRole()}`}
              aria-label="User Role Tooltip"
              hasArrow
              placement="bottom"
            >
              <Menu>
                <MenuButton
                  as={HStack}
                  cursor="pointer"
                  gap={"20px"}
                  spacing={{ base: 2, md: 4 }}
                  direction={{ base: "column", md: "row" }}
                >
                  <Text fontWeight="medium">
                    {displayAddress
                      ? getEllipsisTxt(displayAddress)
                      : "Non connecté"}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {chain ? chain.name : chainName}
                  </Text>
                </MenuButton>

                <MenuList>
                  <MenuItem onClick={() => handleChainSelect(1)}>Ethereum</MenuItem>
                  <MenuItem onClick={() => handleChainSelect(11155111)}>Sepolia</MenuItem>
                  <MenuItem onClick={() => handleChainSelect(84531)}>Base</MenuItem>
                  <MenuItem onClick={handleDisconnect}>Se déconnecter</MenuItem>

                  {displayAddress && (
                    <MenuItem
                      onClick={() => handleAuth(displayAddress, selectedChainId)}
                    >
                      🔁 Vérifier l’adhésion
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            </Tooltip>
          );
        }}
      </RainbowConnectButton.Custom>
    </Box>
  );
};

export default ConnectBouton;
