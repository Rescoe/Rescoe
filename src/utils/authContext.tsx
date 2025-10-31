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

  useEffect(() => {
    const initWeb3Auth = async () => {
      const start = Date.now();
      try {
        const instance = new Web3Auth({
          clientId: WEB3AUTH_CLIENT_ID,
          web3AuthNetwork: "sapphire_devnet", // ou "mainnet"
          uiConfig: {
            loginMethodsOrder: ["google", "facebook", "email_passwordless", "metamask"],
          },
        });

        await instance.init(); // ✅ plus besoin de configureAdapter()
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
        const elapsed = Date.now() - start;
        const minDuration = 1500;
        setTimeout(() => setIsLoading(false), Math.max(0, minDuration - elapsed));
      }
    };

    initWeb3Auth();
  }, []);

  const fetchRole = async (userAddress: string) => {
    try {
      if (web3 && userAddress) {
        const contract = new web3.eth.Contract(ABI as any, CONTRACT_ADDRESS);
        const owner = (await contract.methods.owner().call()) as string;

        if (userAddress.toLowerCase() === owner.toLowerCase()) {
          setRole("admin");
          return;
        }

        // pour le membre
        const memberInfo = (await contract.methods.members(userAddress).call()) as { role: number };
        setRole(roleMapping[memberInfo.role] || null);

      }
    } catch (error) {
      console.error("Erreur récupération rôle:", error);
    }
  };

  const connectWallet = async () => {
    try {
      const detectedProvider = await detectEthereumProvider();
      if (!detectedProvider) {
        toast({
          title: "Wallet non détecté",
          description: "Veuillez installer MetaMask.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
        return;
      }

      const web3Instance = new Web3(detectedProvider);
      setWeb3(web3Instance);

      const accounts = await web3Instance.eth.requestAccounts();
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsAuthenticated(true);
        await fetchRole(accounts[0].toLowerCase());
      }
    } catch (error) {
      console.error("Erreur connexion MetaMask:", error);
    }
  };

  const connectWithEmail = async () => {
    try {
      if (!web3auth) throw new Error("Web3Auth non initialisé");

      const provider = await web3auth.connect();
      if (provider) {
        const web3Instance = new Web3(provider as any);
        setWeb3(web3Instance);
        const accounts = await web3Instance.eth.getAccounts();
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          setIsAuthenticated(true);
          await fetchRole(accounts[0].toLowerCase());
        }
      }
    } catch (error) {
      console.error("Erreur connexion email:", error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de se connecter via e-mail.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
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
