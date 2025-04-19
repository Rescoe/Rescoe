import React, { createContext, useContext, useEffect, useState } from 'react';
import Web3 from 'web3';
import detectEthereumProvider from '@metamask/detect-provider';

interface Web3ContextType {
    web3: Web3 | null;
    accounts: string[];
    connect: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [accounts, setAccounts] = useState<string[]>([]);

    const connect = async () => {
        const provider: any = await detectEthereumProvider();
        if (provider) {
            const web3Instance = new Web3(provider);
            setWeb3(web3Instance);

            const userAccounts = await web3Instance.eth.getAccounts();
            if (userAccounts.length > 0) {
                setAccounts(userAccounts);
            } else {
                alert("Aucun compte Ethereum détecté. Ouvrez MetaMask pour vous connecter.");
            }
        } else {
            alert("MetaMask non détecté. Veuillez installer MetaMask.");
        }
    };

    useEffect(() => {
        connect(); // Essaye de se connecter lors du montage
    }, []);

    return (
        <Web3Context.Provider value={{ web3, accounts, connect }}>
            {children}
        </Web3Context.Provider>
    );
};

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) {
        throw new Error("useWeb3 must be used within a Web3Provider");
    }
    return context;
};
