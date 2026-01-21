import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import { Web3Auth } from "@web3auth/modal";
import { IProvider } from "@web3auth/base";
import { useToast } from "@chakra-ui/react";
import ABI from "../components/ABI/ABIAdhesion.json";
import Loading from "./Loading";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

type RoleType = "admin" | "artist" | "poet" | "contributor" | "trainee" | "non-member" | null;

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
  roleLoading: boolean;
  isLoading: boolean;
}

interface MemberInfo {
  role: number;
  exists: boolean;
  timestamp: number;
  isforSale: boolean;
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
  roleLoading: false,
  isLoading: false,
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
  const [roleLoading, setRoleLoading] = useState(false);

  const toast = useToast();

  // ✅ INIT Web3Auth + RESTAURE SESSION (MODIFIÉ : loading persistant + mobile detection)
  useEffect(() => {
    let mounted = true;

    const initWeb3Auth = async () => {
      try {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const instance = new Web3Auth({
          clientId: WEB3AUTH_CLIENT_ID,
          web3AuthNetwork: "sapphire_devnet",
          uiConfig: {
            loginMethodsOrder: isMobile
              ? ["google", "facebook", "email_passwordless"]  // ✅ Sans metamask mobile
              : ["google", "facebook", "email_passwordless", "metamask"],
          },
          walletServicesConfig: {
            confirmationStrategy: "default",
            modalZIndex: 99999,
            enableKeyExport: false,
            whiteLabel: {
              showWidgetButton: true,
              buttonPosition: "bottom-right",
              hideNftDisplay: false,
              hideTokenDisplay: false,
              hideTransfers: false,
              hideTopup: false,
              hideReceive: false,
              hideSwap: false,
              hideShowAllTokens: false,
              hideWalletConnect: false,
              defaultPortfolio: 'token',
            },
          },
        });

        await instance.init();
        if (!mounted) return;
        setWeb3auth(instance);

        // ✅ Check session + setup complet AVANT fin loading
        const providerInstance = instance.provider;
        if (providerInstance) {
          const web3Instance = new Web3(providerInstance);
          const accounts = await web3Instance.eth.getAccounts();

          if (accounts.length > 0 && mounted) {
            const userAddress = accounts[0].toLowerCase();
            setWeb3(web3Instance);
            setProvider(providerInstance);
            setAddress(userAddress);
            setIsAuthenticated(true);
            await fetchRole(web3Instance, userAddress);  // ✅ Fetch rôle AVANT fin loading
          }
        }
        // ✅ Fin loading UNIQUEMENT quand tout est prêt
        if (mounted) setIsLoading(false);
      } catch (err) {
        console.error("Erreur init Web3Auth:", err);
        if (mounted) setIsLoading(false);
      }
    };

    initWeb3Auth();
    return () => { mounted = false; };
  }, []);

  const fetchRole = async (web3Instance: Web3, userAddress: string) => {
    if (!web3Instance || !userAddress) {
      setRole(null);
      return;
    }

    setRoleLoading(true);
    try {
      const contract = new web3Instance.eth.Contract(ABI as any, CONTRACT_ADDRESS);
      const owner = (await contract.methods.owner().call()) as string;

      if (owner && userAddress.toLowerCase() === owner.toLowerCase()) {
        setRole("admin");
        return;
      }

      const memberInfo: MemberInfo = await contract.methods.members(userAddress).call();
      if (!memberInfo || !memberInfo.exists) {
        setRole("non-member");
        return;
      }

      const roleIndex = parseInt(String(memberInfo.role), 10);
      setRole(roleMapping[roleIndex] || null);
    } catch (error) {
      console.error("[fetchRole] Error:", error);
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      const detectedProvider = await detectEthereumProvider();
      if (!detectedProvider) {
        toast({ title: "Wallet requis", description: "MetaMask requis", status: "error" });
        return;
      }

      const web3Instance = new Web3(detectedProvider);
      const accounts = await web3Instance.eth.requestAccounts();
      const userAddress = accounts[0].toLowerCase();

      setWeb3(web3Instance);
      setProvider(detectedProvider as any);
      setAddress(userAddress);
      setIsAuthenticated(true);
      await fetchRole(web3Instance, userAddress);

      toast({
        title: "Wallet connecté",
        description: userAddress.slice(0, 6) + "...",
        status: "success"
      });
    } catch (error: any) {
      toast({ title: "Erreur wallet", description: error.message, status: "error" });
    }
  };

  const connectWithEmail = async () => {
    try {
      if (!web3auth) throw new Error("Web3Auth non prêt");

      toast({ title: "Connexion...", status: "loading", duration: 5000 });

      await web3auth.connect();
      const providerInstance = web3auth.provider;

      if (!providerInstance) throw new Error("Provider manquant");

      const web3Instance = new Web3(providerInstance);
      const accounts = await web3Instance.eth.getAccounts();
      const userAddress = accounts[0].toLowerCase();

      setWeb3(web3Instance);
      setProvider(providerInstance);
      setAddress(userAddress);
      setIsAuthenticated(true);
      await fetchRole(web3Instance, userAddress);

      toast({
        title: "Connecté !",
        description: userAddress.slice(0, 6) + "...",
        status: "success"
      });
    } catch (error: any) {
      toast({ title: "Erreur connexion", description: error.message, status: "error" });
    }
  };

  const logout = async () => {
    try {
      if (web3auth) {
        await web3auth.logout();
      }

      setAddress(null);
      setRole(null);
      setIsAuthenticated(false);
      setWeb3(null);
      setProvider(null);

      toast({ title: "Déconnecté", status: "info" });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // ✅ SUPPRIMÉ : useEffect checkSession interval (cause doubles fetchRole)

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
        roleLoading,
        isLoading,
      }}
    >
      {(isLoading || roleLoading) ? <Loading /> : children}  {/* ✅ ET roleLoading */}
    </AuthContext.Provider>
  );
};
