const ALLOWED_HOSTS = [
  "deep-index.moralis.io",
  "site1.moralis-nodes.com",
  "api.basescan.org",
];

function isAllowedUrl(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return ALLOWED_HOSTS.some(
      (host) => hostname === host || hostname.endsWith("." + host)
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url || !isAllowedUrl(url)) {
    return res.status(400).json({ error: "URL non autorisée." });
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        "x-api-key": process.env.MORALIS_API_KEY,
        Accept: "application/json",
      },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Erreur proxy :", error.message);
    res.status(500).json({ error: "Erreur lors de la requête au serveur distant." });
  }
}
