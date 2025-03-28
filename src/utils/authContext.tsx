import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import ABI from '../components/ABI/ABIAdhesion.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;

interface AuthContextType {
  address: string | null;
  role: 'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' | null;
  isMember: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isPoet: boolean;
  isTrainee: boolean;
  isContributor: boolean;
  isAuthenticated: boolean;
  setAddress: (address: string | null) => void;
  setIsAuthenticated: (status: boolean) => void; // Ensure this matches what's provided
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

const roleMapping: { [key: number]: 'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' } = {
  0: 'artist',
  1: 'poet',
  2: 'contributor',
  3: 'trainee',
};

interface MemberInfo {
  role: number;
}
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (!provider) {
        console.error("Please install MetaMask!");
        setIsLoading(false);
        return;
      }

      const web3Instance = new Web3(provider);
      setWeb3(web3Instance);
      const accounts = await web3Instance.eth.getAccounts();
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    };
    initWeb3();
  }, []);

  const fetchRole = async (userAddress: string) => {
    try {
      if (web3 && userAddress) {
        const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
        const owner = (await contract.methods.owner().call()) as string;

        const memberInfo: MemberInfo = await contract.methods.members(userAddress).call();
        setRole(roleMapping[memberInfo.role] || null);

        if (userAddress.toLowerCase() === owner.toLowerCase()) {
          setRole('admin');
          return;
        }

        return roleMapping[memberInfo.role]; // Return role for conditional checking
      }
    } catch (error) {
      console.error("Error fetching role:", error);
    }
  };

  useEffect(() => {
    const fetchUserRole = async () => {
      if (address) {
        try {
          const fetchedRole = await fetchRole(address);
          if (fetchedRole) {
            setRole(fetchedRole);
          } else {
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error("Error while fetching user role:", error);
          setIsAuthenticated(false);
        }
      }
    };
    fetchUserRole();
  }, [address, web3]);

  const isMember = role !== null;

  return (
    <AuthContext.Provider value={{
      address,
      role,
      setAddress,
      isAdmin: role === 'admin',
      isArtist: role === 'artist',
      isPoet: role === 'poet',
      isTrainee: role === 'trainee',
      isContributor: role === 'contributor',
      isMember,
      isAuthenticated,
      setIsAuthenticated,
    }}>
      {isLoading ? <div>Chargement...</div> : children}
    </AuthContext.Provider>
  );
};
