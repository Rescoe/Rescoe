// pages/api/channel/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";

const UNIQUE_DISCORD_TOKEN = process.env.DISCORD_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const limit = parseInt((req.query.limit as string) || "10", 10);

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${id}/messages?limit=${limit}`,
      {
        headers: { Authorization: `Bot ${UNIQUE_DISCORD_TOKEN}` },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Impossible de récupérer les messages" });
    }

    const messages = await response.json();
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
