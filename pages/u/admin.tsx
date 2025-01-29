// pages/admin.js
import { Default } from 'components/layouts/Default';
import React, { useEffect, useState } from 'react';
import AdminPage from '../../src/components/containers/dashboard/Admin';

const ADMIN_ADDRESS = "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879"; // Remplacez par l'adresse de votre administrateur

const Admin = () => {
    const [account, setAccount] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const loadAccount = async () => {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            const currentAccount = accounts[0];
            console.log("Current account:", currentAccount);
            setAccount(currentAccount);
            const adminStatus = currentAccount.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
            console.log("Is Admin:", adminStatus);
            setIsAdmin(adminStatus);
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
