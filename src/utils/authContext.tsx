import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from "@metamask/detect-provider";
import ABI from "../components/ABI/ABIAdhesion.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;

interface AuthContextType {
  address: string | null;
  role: "admin" | "artist" | "poet" | "trainee" | "contributor" | null;
  isMember: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isPoet: boolean;
  isTrainee: boolean;
  isContributor: boolean;
  isAuthenticated: boolean;
  setAddress: (address: string | null) => void;
  setIsAuthenticated: (status: boolean) => void;
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
});

export const useAuth = () => useContext(AuthContext);

const roleMapping: { [key: number]: "admin" | "artist" | "poet" | "trainee" | "contributor" } = {
  0: "artist",
  1: "poet",
  2: "contributor",
  3: "trainee",
};

interface MemberInfo {
  role: number;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "artist" | "poet" | "trainee" | "contributor" | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    const initWeb3 = async () => {
      let provider: any = await detectEthereumProvider();

      // 🚨 Vérification si window.ethereum est disponible en fallback
      if (!provider && typeof window !== "undefined" && (window as any).ethereum) {
        provider = (window as any).ethereum;
      }

      console.log("🔍 Provider détecté :", provider);

      if (!provider) {
        console.error("❌ Aucun provider Ethereum détecté ! Vérifie MetaMask.");
        setIsLoading(false);
        return;
      }

      try {
        const web3Instance = new Web3(provider);
        setWeb3(web3Instance);

        // 🚨 Vérification explicite si `request` est bien disponible (mobile support)
        if (provider && "request" in provider) {
          const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });

          if (accounts.length > 0) {
            console.log("✅ Compte récupéré :", accounts[0]);
            setAddress(accounts[0]);
            setIsAuthenticated(true);
            fetchRole(web3Instance, accounts[0]); // Appel avec `web3Instance`
          } else {
            console.warn("⚠️ Aucun compte connecté.");
            setIsAuthenticated(false);
          }
        } else {
          console.error("❌ Le provider Ethereum détecté ne supporte pas `request`.");
        }
      } catch (error) {
        console.error("❌ Erreur de connexion Web3 :", error);
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    initWeb3();
  }, []);


  const fetchRole = async (web3Instance: Web3, userAddress: string) => {
    try {
      if (!web3Instance || !userAddress) return;

      const contract = new web3Instance.eth.Contract(ABI, CONTRACT_ADDRESS);
      const owner = (await contract.methods.owner().call()) as string;
      const memberInfo: MemberInfo = await contract.methods.members(userAddress).call();

      console.log("🔍 Infos du membre :", memberInfo);

      if (userAddress.toLowerCase() === owner.toLowerCase()) {
        setRole("admin");
        setIsMember(true);
        return;
      }

      setRole(roleMapping[memberInfo.role] || null);
      setIsMember(true);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération du rôle :", error);
      setIsMember(false);
    }
  };

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
      }}
    >
      {isLoading ? <div>Chargement...</div> : children}
    </AuthContext.Provider>
  );
};
