import { Default } from 'components/layouts/Default';
import React, { useEffect, useState } from 'react';
import AdminPage from '../../src/components/containers/dashboard/Admin';
import Web3 from 'web3';
import ABIRESCOLLECTION from '../../src/components/ABI/ABI_Collections.json';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

const Admin = () => {
    const [account, setAccount] = useState<string>('');
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [web3, setWeb3] = useState<Web3 | null>(null);

    useEffect(() => {
        const initWeb3 = async () => {
            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    // Vérification que window.ethereum est bien présent
                    const provider = window.ethereum as any; // On cast en 'any' pour éviter l'erreur de typage
                    await provider.request({ method: 'eth_requestAccounts' });

                    const web3Instance = new Web3(provider);
                    setWeb3(web3Instance);

                    const accounts = await web3Instance.eth.getAccounts();
                    if (accounts.length > 0) {
                        setAccount(accounts[0]);

                        // Vérification de l'existence du contrat
                        if (!CONTRACT_ADDRESS) {
                            console.error("L'adresse du contrat n'est pas définie dans les variables d'environnement.");
                            return;
                        }

                        // Connexion au contrat
                        const contract = new web3Instance.eth.Contract(ABIRESCOLLECTION, CONTRACT_ADDRESS);
                        const contractOwner: string = await contract.methods.admin().call();

                          if (contractOwner && contractOwner.length > 0) {
                              setIsAdmin(accounts[0].toLowerCase() === contractOwner.toLowerCase());
                          } else {
                              console.error("Impossible de récupérer l'admin du contrat.");
                          }


                    }
                } catch (error) {
                    console.error('Erreur de connexion à MetaMask:');
                }
            } else {
                console.error('MetaMask non détecté.');
            }
        };

        initWeb3();
    }, []);

    if (!isAdmin) {
        return <h1>Access Denied: Admins Only</h1>;
    }

    return (
      <Default pageName="Administration">
        <AdminPage />
      </Default>
    );
};

export default Admin;
