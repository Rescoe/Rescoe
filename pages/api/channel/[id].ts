// pages/api/channel/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";

const UNIQUE_DISCORD_TOKEN = process.env.DISCORD_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, limit } = req.query;

  if (!UNIQUE_DISCORD_TOKEN) {
    return res.status(500).json({ error: "Token Discord manquant en configuration serveur." });
  }

  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: "Paramètre 'id' invalide." });
  }

  const limitParsed = parseInt(Array.isArray(limit) ? limit[0] : limit || "10", 10);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${id}/messages?limit=${limitParsed}`,
      {
        headers: { Authorization: `Bot ${UNIQUE_DISCORD_TOKEN}` },
      }
    );

    if (!response.ok) {
      const text = await response.text(); // log de debug
      console.error("Discord API error:", response.status, text);
      return res
        .status(response.status)
        .json({ error: "Impossible de récupérer les messages", details: text });
    }

    const messages = await response.json();
    res.status(200).json(messages);
  } catch (error: any) {
    console.error("Erreur serveur API /channel/[id]:", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
