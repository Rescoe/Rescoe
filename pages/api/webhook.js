export default function handler(req, res) {
  if (req.method === 'POST') {
    //console.log('Event Moralis:', req.body);
    res.status(200).json({ success: true });
  } else {
    res.status(405).end();
  }
}
