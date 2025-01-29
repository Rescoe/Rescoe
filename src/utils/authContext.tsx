import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';
import ABI from '../components/ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS; // Mettez à jour avec votre adresse de contrat.

type AuthContextType = {
  address: string | null;
  role: 'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' | null;
  isMember: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isPoet: boolean;
  isTrainee: boolean;
  isContributor: boolean;
  setAddress: (address: string | null) => void;
};

const AuthContext = createContext<AuthContextType>({
  address: null,
  role: null,
  isMember: false,
  isAdmin: false,
  isArtist: false,
  isPoet: false,
  isTrainee: false,
  isContributor: false,
  setAddress: () => {},
});

export const useAuth = () => useContext(AuthContext);

const roleMapping = {
  0: 'artist',
  1: 'poet',
  2: 'contributor',
  3: 'trainee',
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'artist' | 'poet' | 'trainee' | 'contributor' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [web3, setWeb3] = useState<Web3 | null>(null);

  useEffect(() => {
    const initWeb3 = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const web3Instance = new Web3(provider);
        setWeb3(web3Instance);
        const accounts = await web3Instance.eth.getAccounts();
        setAddress(accounts[0]); // Définir l'adresse connectée
      } else {
        alert('Veuillez installer MetaMask !');
      }
    };
    initWeb3();
  }, []);

  useEffect(() => {
    const fetchRole = async (userAddress: string) => {
      setLoading(true);
      try {
        if (web3 && address) {
          const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

          // Vérifier si l'utilisateur est le propriétaire du contrat (admin)
          const owner = await contract.methods.owner().call();
          if (userAddress.toLowerCase() === owner.toLowerCase()) {
            setRole('admin');
            return;
          }

          // Récupérer les informations du membre
          const memberInfo = await contract.methods.members(userAddress).call();
          const userRoleIndex = memberInfo.role;

          // Déterminer le rôle basé sur l'index
          if (roleMapping[userRoleIndex] !== undefined) {
            setRole(roleMapping[userRoleIndex]);
          } else {
            setRole(null);
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du rôle:" );
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchRole(address.toLowerCase());
    } else {
      // Reset values if no address
      setRole(null);
    }
  }, [address, web3]);

  // Définir isMember si l'utilisateur a l'un des rôles spécifiques
  const isMember = role !== null; // Vrai si le rôle est défini, donc l'utilisateur est membre.

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

    }}>
      {loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
};
