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
    // --- Récupération des messages normaux ---
    const messagesResponse = await fetch(
      `https://discord.com/api/v10/channels/${id}/messages?limit=${limitParsed}`,
      {
        headers: { Authorization: `Bot ${UNIQUE_DISCORD_TOKEN}` },
      }
    );

    if (!messagesResponse.ok) {
      const text = await messagesResponse.text();
      console.error("Discord API error:", messagesResponse.status, text);
      return res
        .status(messagesResponse.status)
        .json({ error: "Impossible de récupérer les messages", details: text });
    }

    const messages = await messagesResponse.json();

    // --- Récupération du message épinglé ---
    const pinnedResponse = await fetch(
      `https://discord.com/api/v10/channels/${id}/pins`,
      {
        headers: { Authorization: `Bot ${UNIQUE_DISCORD_TOKEN}` },
      }
    );

    let pinnedMessage = null;
    if (pinnedResponse.ok) {
      const pinnedMessages = await pinnedResponse.json();
      pinnedMessage = pinnedMessages.length > 0 ? pinnedMessages[0] : null;
    }

    res.status(200).json({
      pinnedMessage,
      messages,
    });
  } catch (error: any) {
    console.error("Erreur serveur API /channel/[id]:", error);
    res.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
