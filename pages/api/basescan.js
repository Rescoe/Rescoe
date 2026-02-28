// pages/api/basescan.js
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address required' });

  try {
    const url = `https://api.basescan.org/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=100&sort=desc&apikey=${process.env.BASESCAN_API_KEY || 'YourFreeKey'}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Basescan ${response.status}`);

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
