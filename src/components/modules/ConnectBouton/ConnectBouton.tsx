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
import { signIn, signOut } from "next-auth/react";
import { useAuthRequestChallengeEvm } from "@moralisweb3/next";
import { getEllipsisTxt } from "../../../utils/format";
import { useAuth } from "../../../utils/authContext";
import { brandHover, hoverStyles } from "@styles/theme";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";

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
  const selectedChainId = 84532;  // ID de Base Sepolia
  const chainName = "Base Sepolia"; // Nom du réseau
  const [web3, setWeb3] = useState<Web3 | null>(null);

  // Init Web3 instance
  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const web3Instance = new Web3(provider);
        setWeb3(web3Instance);
        // Changer automatiquement de réseau à Base Sepolia lors de la connexion
        try {
          await (window.ethereum as any).request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${selectedChainId.toString(16)}` }],
          });

        } catch (error) {
          console.error("Erreur lors du changement de chaîne:", error);
        }
      }
    };

    initWeb3();

    // Vérifier l'authentification à la connexion
    /*
    const storedAddress = localStorage.getItem("connectedAddress");
    const storedAuth = localStorage.getItem("isAuthenticated") === "true";
    if (storedAddress && storedAuth) {
      setAddress(storedAddress);
      setIsAuthenticated(true);
    }
    */
  }, []);

  // Moralis EVM auth flow
  const handleAuth = async (account: string) => {
    setIsConnecting(true);
    try {
      const challenge = await requestChallengeAsync({ address: account, chainId: selectedChainId });
      if (!challenge?.message) throw new Error("Challenge non valide.");

      setAddress(account.toLowerCase());
      setIsAuthenticated(true);
      //localStorage.setItem("connectedAddress", account.toLowerCase());
      //localStorage.setItem("isAuthenticated", "true");
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
    await logout();
    signOut({ callbackUrl: "/" });
    setIsAuthenticated(false);
    setAddress(null);
    //localStorage.removeItem("connectedAddress");
    //localStorage.removeItem("isAuthenticated");
  };

  // Suppression de la sélection de chaîne dans le UI
  const getUserRole = () => {
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";
  };

  // --------------------------
  // 🟢 UI
  // --------------------------
  if (isLoading || roleLoading) {
    return (
      <Button px={6} py={4} fontSize="md" borderRadius="full" boxShadow="lg" isLoading>
        Chargement...
      </Button>
    );
  }

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
              if (address) {
                await handleAuth(address);
              } else {
                console.warn("Adresse absente après connexion wallet");
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
              {address ? getEllipsisTxt(address) : "Non connecté"}
            </Text>
          </MenuButton>
          <MenuList>
            <MenuItem onClick={handleDisconnect}>Se déconnecter</MenuItem>
          </MenuList>
        </Menu>
      </Tooltip>
    </Box>
  );
};

export default ConnectBouton;
