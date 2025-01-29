export default async function handler(req, res) {
  // Ajouter des en-têtes CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Ajouter des en-têtes CORP
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const { method } = req;

  if (method === 'GET') {
    try {
      const { ipfsHash } = req.query;

      // Validation simple de l'IPFS Hash
      if (!ipfsHash || typeof ipfsHash !== 'string' || ipfsHash.length !== 46) {
        return res.status(400).json({ message: 'Hash IPFS invalide' });
      }

      // Utiliser l'URL personnalisée Pinata (assurez-vous que c'est celle qui fonctionne)
      const pinataUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${ipfsHash}`;

      const response = await fetch(pinataUrl);
      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data);
      } else {
        const errorText = await response.text();
        console.error('Erreur Pinata:' Text);
        res.status(response.status).json({ message: 'Une erreur est survenue avec le service externe.' });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données de Pinata' );
      res.status(500).json({ message: 'Erreur serveur' });
    }
  } else {
    res.status(405).json({ message: 'Méthode non autorisée' });
  }
}
