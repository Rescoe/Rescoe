
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import { Web3Auth } from "@web3auth/modal";
import { IProvider } from "@web3auth/base";
import { useToast } from "@chakra-ui/react";
import ABI from "../components/ABI/ABIAdhesion.json";
import Loading from "./Loading";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

// Clé localStorage pour restaurer la session MetaMask entre onglets
const LS_CONNECTOR = "rescoe_connector"; // "metamask" | "web3auth"

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
  /** 0–100 : progression réelle de l'initialisation (pour le loader) */
  loadingProgress: number;
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
  loadingProgress: 0,
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
  const [loadingProgress, setLoadingProgress] = useState(0);

  const toast = useToast();

  const fetchRole = useCallback(async (web3Instance: Web3, userAddress: string) => {
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
  }, []);

  // ─── Précache des données insectes dès que l'adresse est connue ─────────────
  const prefetchInsects = useCallback((userAddress: string) => {
    const sessionKey = `insect_data_${userAddress}`;
    const SESSION_TTL = 5 * 60 * 1000;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < SESSION_TTL) return; // déjà en cache
      }
    } catch {}
    // Fire & forget — on ne bloque pas l'auth sur ça
    fetch(`/api/token/insects?address=${encodeURIComponent(userAddress)}`)
      .then((r) => r.json())
      .then((data) => {
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ data, ts: Date.now() }));
          const evolutionCount = data.filter((i: any) => i.canEvolve || i.isEgg).length;
          window.dispatchEvent(new CustomEvent("RESCOE_EVOLUTION_COUNT", { detail: evolutionCount }));
        } catch {}
      })
      .catch(() => {}); // silencieux — pas critique au chargement
  }, []);

  // ─── Init Web3Auth + restauration session ───────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initWeb3Auth = async () => {
      try {
        setLoadingProgress(5);

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const instance = new Web3Auth({
          clientId: WEB3AUTH_CLIENT_ID,
          web3AuthNetwork: "sapphire_mainnet",
          uiConfig: {
            loginMethodsOrder: isMobile
              ? ["google", "facebook", "email_passwordless"]
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
              defaultPortfolio: "token",
            },
          },
        });

        setLoadingProgress(20);
        await instance.init();
        if (!mounted) return;

        setWeb3auth(instance);
        setLoadingProgress(40);

        // ── Cas 1 : session Web3Auth active ────────────────────────────────
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
            localStorage.setItem(LS_CONNECTOR, "web3auth");
            setLoadingProgress(65);
            prefetchInsects(userAddress);
            await fetchRole(web3Instance, userAddress);
            if (mounted) setLoadingProgress(95);
          }
        }
        // ── Cas 2 : restauration session MetaMask (silencieuse, sans prompt) ─
        else if (!isMobile && localStorage.getItem(LS_CONNECTOR) === "metamask") {
          try {
            const detectedProvider = await detectEthereumProvider({ silent: true });
            if (detectedProvider && mounted) {
              const web3Instance = new Web3(detectedProvider);
              // eth_accounts = silencieux (pas de popup), retourne [] si révoqué
              const accounts: string[] = await web3Instance.eth.getAccounts();
              if (accounts.length > 0 && mounted) {
                const userAddress = accounts[0].toLowerCase();
                setWeb3(web3Instance);
                setProvider(detectedProvider as any);
                setAddress(userAddress);
                setIsAuthenticated(true);
                setLoadingProgress(65);
                prefetchInsects(userAddress);
                await fetchRole(web3Instance, userAddress);
                if (mounted) setLoadingProgress(95);
              } else {
                // Permission révoquée ou wallet verrouillé — on nettoie
                localStorage.removeItem(LS_CONNECTOR);
              }
            }
          } catch {
            localStorage.removeItem(LS_CONNECTOR);
          }
        }

        if (mounted) {
          setLoadingProgress(100);
          // Petit délai pour laisser la barre atteindre 100% visuellement
          setTimeout(() => {
            if (mounted) setIsLoading(false);
          }, 400);
        }
      } catch (err) {
        console.error("Erreur init Web3Auth:", err);
        if (mounted) {
          setLoadingProgress(100);
          setIsLoading(false);
        }
      }
    };

    initWeb3Auth();
    return () => { mounted = false; };
  }, [fetchRole, prefetchInsects]);

  // ─── Connexion MetaMask ──────────────────────────────────────────────────────
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
      localStorage.setItem(LS_CONNECTOR, "metamask"); // ✅ Persist pour restauration
      prefetchInsects(userAddress);
      await fetchRole(web3Instance, userAddress);

      toast({
        title: "Wallet connecté",
        description: userAddress.slice(0, 6) + "...",
        status: "success",
      });
    } catch (error: any) {
      toast({ title: "Erreur wallet", description: error.message, status: "error" });
    }
  };

  // ─── Connexion email / social (Web3Auth) ─────────────────────────────────────
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
      localStorage.setItem(LS_CONNECTOR, "web3auth"); // ✅ Persist
      prefetchInsects(userAddress);
      await fetchRole(web3Instance, userAddress);

      toast({
        title: "Connecté !",
        description: userAddress.slice(0, 6) + "...",
        status: "success",
      });
    } catch (error: any) {
      toast({ title: "Erreur connexion", description: error.message, status: "error" });
    }
  };

  // ─── Déconnexion ─────────────────────────────────────────────────────────────
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
      localStorage.removeItem(LS_CONNECTOR); // ✅ Nettoie la persistance
      toast({ title: "Déconnecté", status: "info" });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isMember = role !== null && role !== "non-member";

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
        loadingProgress,
      }}
    >
      {isLoading ? <Loading /> : children}
    </AuthContext.Provider>
  );
};
