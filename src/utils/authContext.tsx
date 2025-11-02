import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider } from "@web3auth/base";
import { useToast } from "@chakra-ui/react";
import ABI from "../components/ABI/ABIAdhesion.json";
import Loading from "./Loading";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

type RoleType = "admin" | "artist" | "poet" | "trainee" | "contributor" | null;

interface AuthContextType {
  address: string | null;
  role: RoleType;
  isMember: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isPoet: boolean;
  isTrainee: boolean;
  isContributor: boolean;
  isAuthenticated: boolean;
  setAddress: (address: string | null) => void;
  setIsAuthenticated: (status: boolean) => void;
  web3: Web3 | null;
  provider: any;
  connectWallet: () => Promise<void>;
  connectWithEmail: () => Promise<void>;
  logout: () => Promise<void>;
}

// Interface représentant les informations du membre
interface MemberInfo {
  role: number; // ou string selon la structure retournée par votre contrat
  // Ajoutez d'autres propriétés si nécessaire
}

const AuthContext = createContext<AuthContextType>({
  address: null,
  role: null,
  isMember: false,
  isAdmin: false,
  isArtist: false,
  isPoet: false,
  isTrainee: false,
  isContributor: false,
  isAuthenticated: false,
  setAddress: () => {},
  setIsAuthenticated: () => {},
  web3: null,
  provider: null,
  connectWallet: async () => {},
  connectWithEmail: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const roleMapping: { [key: number]: RoleType } = {
  0: "artist",
  1: "poet",
  2: "contributor",
  3: "trainee",
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<RoleType>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const toast = useToast();



/*
  const web3AuthNetwork =
    process.env.NODE_ENV === "production"
      ? "sapphire_mainnet"
      : "sapphire_devnet";
*/

useEffect(() => {
  const initWeb3Auth = async () => {
    try {
      // Configuration de Web3Auth avec walletServicesConfig
      const instance = new Web3Auth({
        clientId: WEB3AUTH_CLIENT_ID,
        web3AuthNetwork: "sapphire_devnet",
        uiConfig: {
          loginMethodsOrder: ["google", "facebook", "email_passwordless", "metamask"],
        },
        walletServicesConfig: {
          confirmationStrategy: "default", // Ou "default" selon votre choix
          modalZIndex: 99999,
          enableKeyExport: false,
          whiteLabel: {
            showWidgetButton: true,
            buttonPosition: "bottom-right", // Modifiez selon vos préférences
            hideNftDisplay: false,
            hideTokenDisplay: false,
            hideTransfers: false,
            hideTopup: false,
            hideReceive: false,
            hideSwap: false,
            hideShowAllTokens: false,
            hideWalletConnect: false,
            defaultPortfolio: 'token', // Ou "nft" selon vos besoins
          },
        },
      });

      await instance.init();

      setWeb3auth(instance);

      if (instance.provider) {
        const web3Instance = new Web3(instance.provider as any);
        setWeb3(web3Instance);
        const accounts = await web3Instance.eth.getAccounts();
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      console.error("Erreur init Web3Auth:", err);
    } finally {
      setIsLoading(false);
    }
  };

  initWeb3Auth();
}, []);



  const fetchRole = async (web3Instance: Web3, userAddress: string) => {
    if (!web3Instance || !userAddress) {
      console.error("[fetchRole] web3Instance or userAddress is missing", web3Instance, userAddress);
      setRole(null);
      return;
    }

    try {
      //console.log("[fetchRole] Start fetching role for", userAddress);

      const contract = new web3Instance.eth.Contract(ABI as any, CONTRACT_ADDRESS);

      const owner: string = await contract.methods.owner().call();
      if (owner && typeof owner === "string" && userAddress.toLowerCase() === owner.toLowerCase()) {
        setRole("admin");
        return;
      }

      // Récupération des informations sur le membre
      const memberInfo: MemberInfo = await contract.methods.members(userAddress).call();
      console.log(memberInfo);
      //console.log("[fetchRole] memberInfo received:", memberInfo);

      if (!memberInfo || typeof memberInfo.role === 'undefined') {
        console.warn("[fetchRole] No role found for address");
        setRole(null);
        return;
      }

      const roleIndex = parseInt(String(memberInfo.role), 10);
      const resolvedRole = roleMapping[roleIndex] || null;

      //console.log("[fetchRole] Role resolved to:", resolvedRole);
      setRole(resolvedRole);

    } catch (error) {
      console.error("[fetchRole] Error fetching role:", error);
      setRole(null);
    }
  };

  const connectWallet = async () => {
    try {
      const detectedProvider = await detectEthereumProvider();
      if (!detectedProvider) {
        throw new Error("Wallet non détecté");
      }

      const web3Instance = new Web3(detectedProvider);
      const accounts = await web3Instance.eth.requestAccounts();

      if (accounts.length === 0) {
        throw new Error("Aucun compte trouvé");
      }

      const userAddress = accounts[0].toLowerCase();
      setWeb3(web3Instance);
      setProvider(detectedProvider as any);
      setAddress(userAddress);
      setIsAuthenticated(true);

      await fetchRole(web3Instance, userAddress);
    } catch (error) {
      console.error("[connectWallet] Erreur:", error);
    }
  };

  const connectWithEmail = async () => {
    try {
      if (!web3auth) throw new Error("Web3Auth non initialisé");

      const providerInstance = await web3auth.connect();
      if (!providerInstance) throw new Error("Provider Web3Auth non retourné");

      const web3Instance = new Web3(providerInstance);
      const accounts = await web3Instance.eth.getAccounts();

      if (accounts.length === 0) {
        throw new Error("Aucun compte trouvé");
      }

      const userAddress = accounts[0].toLowerCase();
      setWeb3(web3Instance);
      setProvider(providerInstance);
      setAddress(userAddress);
      setIsAuthenticated(true);

      await fetchRole(web3Instance, userAddress);
    } catch (error) {
      console.error("[connectWithEmail] Erreur:", error);
    }
  };

  const logout = async () => {
    try {
      if (web3auth) await web3auth.logout();
      setAddress(null);
      setRole(null);
      setIsAuthenticated(false);
      setWeb3(null);
      setProvider(null);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };


  const isMember = !!role;

  return (
    <AuthContext.Provider
      value={{
        address,
        role,
        setAddress,
        isAdmin: role === "admin",
        isArtist: role === "artist",
        isPoet: role === "poet",
        isTrainee: role === "trainee",
        isContributor: role === "contributor",
        isMember,
        isAuthenticated,
        setIsAuthenticated,
        web3,
        provider,
        connectWallet,
        connectWithEmail,
        logout,
      }}
    >
      {isLoading ? <Loading /> : children}
    </AuthContext.Provider>
  );
};
