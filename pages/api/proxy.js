export default async function handler(req, res) {
  const { url } = req.query;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...req.headers,
        'x-api-key': process.env.MORALIS_API_KEY, // Utilisez votre clé API
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Erreur lors de l'appel proxy :" );
    res.status(500).json({ error: "Erreur lors de la requête au serveur distant." });
  }
}
