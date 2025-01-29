import { Default } from 'components/layouts/Default';
import React, { useEffect, useState } from 'react';
import AdminPage from '../../src/components/containers/dashboard/Admin';
import { JsonRpcProvider, Contract } from 'ethers';
import ABIRESCOLLECTION from '../../src/components/ABI/ABI_Collections.json';

const CONTRACT_ADDRESS = '0x3cd67A92A99f8e1086A5A8B5e6f72D470471796e'; // Assurez-vous que cette variable est dans .env.local

const Admin = () => {
    const [account, setAccount] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const loadAccount = async () => {
            if (!CONTRACT_ADDRESS) {
                console.error("Contract address is not defined.");
                return;
            }

            // Utilisation du JsonRpcProvider pour se connecter via RPC
            const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS); // Utiliser l'URL RPC de Moralis

            // Interroger le contrat pour obtenir l'owner
            const contract = new Contract(CONTRACT_ADDRESS, ABIRESCOLLECTION, provider);
            const contractOwner = await contract.admin(); // Remplacez 'admin' par la méthode de votre contrat pour obtenir l'owner

            // Vérifier si l'utilisateur actuel est l'owner du contrat
            const signer = await provider.getSigner(); // Résolution de la promesse avant d'obtenir l'adresse
            const currentAccount = await signer.getAddress(); // Obtenir l'adresse une fois que le signer est résolu

            setAccount(currentAccount);

            // Vérifier si l'utilisateur actuel est l'admin
            if (currentAccount.toLowerCase() === contractOwner.toLowerCase()) {
                setIsAdmin(true);
            }
        };

        loadAccount();
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
