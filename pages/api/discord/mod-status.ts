import type { NextApiRequest, NextApiResponse } from "next";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!; //DISCORD_TOKEN!;
const DISCORD_CHANNEL_ART_ID = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!; //DISCORD_CHANNEL_ART_ID!;
const DISCORD_CHANNEL_POETRY_ID = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!; //DISCORD_CHANNEL_POETRY_ID!;
const DISCORD_FETCH_LIMIT = 100;

type StatusResult = {
  uid: string;
  channelId: string;
  messageId: string;
  status: "queued" | "approved" | "rejected";
  content: string;
};

function buildUidTag(uid: string) {
  return `[UID:${uid}]`;
}

async function fetchChannelMessages(channelId: string) {
  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=${DISCORD_FETCH_LIMIT}`,
    {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord fetch error ${response.status}: ${text}`);
  }

  return response.json();
}

function deriveStatusFromMessage(msg: any): "queued" | "approved" | "rejected" {
  const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
  const hasApproved = reactions.some((r: any) => r?.emoji?.name === "✅");
  const hasRejected = reactions.some((r: any) => r?.emoji?.name === "❌");

  if (hasApproved) return "approved";
  if (hasRejected) return "rejected";
  return "queued";
}

async function findByUid(uid: string): Promise<StatusResult | null> {
  const uidTag = buildUidTag(uid);
  const channelIds = [DISCORD_CHANNEL_ART_ID, DISCORD_CHANNEL_POETRY_ID].filter(Boolean);

  for (const channelId of channelIds) {
    const messages = await fetchChannelMessages(channelId);
    const msg = messages.find((m: any) => typeof m.content === "string" && m.content.includes(uidTag));
    if (msg) {
      return {
        uid,
        channelId,
        messageId: msg.id,
        status: deriveStatusFromMessage(msg),
        content: msg.content,
      };
    }
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ART_ID || !DISCORD_CHANNEL_POETRY_ID) {
    return res.status(500).json({ error: "Variables d'environnement manquantes" });
  }

  if (req.method === "GET") {
    try {
      const uid = req.query.uid as string | undefined;
      if (!uid) {
        return res.status(400).json({ error: "uid requis" });
      }

      const record = await findByUid(uid);
      if (!record) {
        return res.status(404).json({ error: "UID introuvable dans Discord" });
      }

      return res.status(200).json(record);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message ?? "Erreur serveur" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
