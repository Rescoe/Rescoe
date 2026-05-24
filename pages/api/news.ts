// pages/api/news.ts
import type { NextApiRequest, NextApiResponse } from "next";

const UNIQUE_DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.NEXT_PUBLIC_CHANNEL_NEWS_ID;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // récupère ?limit=10 (par défaut 10 si non fourni)
    const limit = parseInt((req.query.limit as string) || "10", 10);

    // appel à l’API Discord avec le limit demandé
    const response = await fetch(
      `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=${limit}`,
      {
        headers: { Authorization: `Bot ${UNIQUE_DISCORD_TOKEN}` },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Impossible de récupérer les messages" });
    }

    const messages = await response.json();

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
