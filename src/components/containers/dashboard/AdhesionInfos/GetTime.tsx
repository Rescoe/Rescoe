import React, { useState, useEffect } from 'react';
import { Contract, JsonRpcProvider } from 'ethers';

const GetTime = ({ contractAddress, abi, userAddress }: { contractAddress: string, abi: any, userAddress: string }) => {
  const [mintTimestamp, setMintTimestamp] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const SALE_DELAY = 365 * 24 * 60 * 60; // 365 jours en secondes

  useEffect(() => {
    const fetchMintData = async () => {
      try {
        setLoading(true);
        setError(null);  // Réinitialisation de l'erreur à chaque nouvelle tentative

        if (!userAddress) {
          throw new Error('L\'adresse de l\'utilisateur n\'est pas fournie.');
        }

        // Connexion au provider via Moralis ou Infura
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(contractAddress, abi, provider);


        // Récupération du tokenId de l'utilisateur
        const tokenId: number = await contract.tokenOfOwnerByIndex(userAddress, 0); // Récupère le premier token de l'utilisateur

        if (!tokenId) {
          throw new Error('Aucun token trouvé pour cet utilisateur.');
        }

        // Appel de la fonction du contrat pour récupérer le timestamp de mint
        const timestamp: number = await contract.getMintTimestamp(tokenId);

        if (timestamp === 0) {
          throw new Error('Aucun token trouvé pour cet utilisateur.');
        }

        // Calcul de la date de fin d'adhésion
        const endTimestamp = timestamp + SALE_DELAY;
        const endDateFormatted = new Date(endTimestamp * 1000).toLocaleString();

        // Mise à jour des états
        setMintTimestamp(timestamp);
        setEndDate(endDateFormatted);
      } catch (err) {
        console.error('Erreur lors de la récupération des données:');
        setError(err.message || 'Une erreur inconnue est survenue.');
      } finally {
        setLoading(false);
      }
    };

    if (userAddress) {
      fetchMintData();
    } else {
      setError('Adresse utilisateur manquante');
      setLoading(false);
    }
  }, [contractAddress, abi, userAddress]);

  return (
    <div>
      {loading ? (
        <p>Chargement des données...</p>
      ) : error ? (
        <p style={{ color: 'red' }}><strong>Erreur :</strong> {error}</p>
      ) : mintTimestamp ? (
        <div>
          <p><strong>Date de mint :</strong> {new Date(mintTimestamp * 1000).toLocaleString()}</p>
          <p><strong>Date de fin d'adhésion :</strong> {endDate}</p>
        </div>
      ) : (
        <p>Aucune donnée disponible. L'utilisateur n'a peut-être pas encore minté de jeton.</p>
      )}
    </div>
  );
};

export default GetTime;
