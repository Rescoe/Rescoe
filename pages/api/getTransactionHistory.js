import { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import ABI from '../../src/components/ABI/ABIAdhesion.json';

const handler = async (req, res) => {
  const { tokenId } = req.query;

  // Remplacez par votre adresse de contrat
  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  try {
    // Obtenez l'historique des événements
    // Assurez-vous d'ajouter des indexed lors de la déclaration de l'événement dans le contrat
    const events = await contract.queryFilter(
        contract.filters.NFTSold(tokenId, null, null), // Ici, filter tokenId et laissez les autres null
        -10, // Consulter les 100 derniers blocs
        'latest'
    );

    // Formatez les événements pour l'envoi en réponse
    const formattedEvents = events.map(event => ({
      eventType: event.event,
      details: event.args,
      timestamp: event.blockTime, // Si vous avez un timestamp
    }));

    res.status(200).json(formattedEvents);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des transactions:' );

    // Assurez-vous de renvoyer une réponse JSON avec un message d'erreur
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique des transactions.'});
  }
};

export default handler;
