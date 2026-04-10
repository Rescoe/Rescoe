import type { NextApiRequest, NextApiResponse } from "next";

const ESP_BASE_URL = process.env.ESP_BASE_URL!;
const DISCORD_TOKEN = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!;
const DISCORD_CHANNEL_ART_ID = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!;
const DISCORD_CHANNEL_POETRY_ID = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID!;
const DISCORD_FETCH_LIMIT = 100;

type GalleryItem = {
  slot: number;
  uid?: string;
  type?: string;
  mode?: string;
  name?: string;
  artist?: string;
  timestamp?: string;
  text?: string;
  oledBuffer?: number[];
  origin?: string;
};

function getChannelId(item: GalleryItem) {
  return item.type === "poetry" ? DISCORD_CHANNEL_POETRY_ID : DISCORD_CHANNEL_ART_ID;
}

function buildUidTag(uid: string) {
  return `[UID:${uid}]`;
}

function buildContent(item: GalleryItem) {
  const uidTag = buildUidTag(item.uid ?? "missing");
  const lines = [
    uidTag,
    `Type: ${item.type ?? "unknown"}`,
    `Mode: ${item.mode ?? "unknown"}`,
    `Nom: ${item.name ?? "Sans titre"}`,
    `Artiste: ${item.artist ?? "Anonyme"}`,
    `Date: ${item.timestamp ?? "Inconnue"}`,
  ];

  if (item.type === "poetry" && item.text) {
    lines.push("", item.text.slice(0, 1500));
  }

  return lines.join("\n");
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

async function alreadyPosted(channelId: string, uid: string) {
  const messages = await fetchChannelMessages(channelId);
  const uidTag = buildUidTag(uid);
  return messages.some((msg: any) => typeof msg.content === "string" && msg.content.includes(uidTag));
}

async function postDiscordMessage(channelId: string, item: GalleryItem) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: buildContent(item),
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord post error ${response.status}: ${text}`);
  }

  return response.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ESP_BASE_URL || !DISCORD_TOKEN || !DISCORD_CHANNEL_ART_ID || !DISCORD_CHANNEL_POETRY_ID) {
    return res.status(500).json({ error: "Variables d'environnement manquantes" });
  }

  try {
    const galleryRes = await fetch(`${ESP_BASE_URL}/gallery`, { cache: "no-store" });
    if (!galleryRes.ok) {
      return res.status(502).json({ error: "Impossible de lire /gallery sur l'ESP" });
    }

    const galleryItems: GalleryItem[] = await galleryRes.json();
    const posted: Array<{ uid: string; slot: number; channelId: string; messageId: string }> = [];
    const skipped: string[] = [];

    for (const item of galleryItems) {
      if (typeof item.slot !== "number") continue;

      const detailRes = await fetch(`${ESP_BASE_URL}/gallery-item?slot=${encodeURIComponent(item.slot)}`, {
        cache: "no-store",
      });
      if (!detailRes.ok) continue;

      const full: GalleryItem = await detailRes.json();
      const merged: GalleryItem = { ...item, ...full };
      const uid = merged.uid;
      if (!uid) continue;

      const channelId = getChannelId(merged);
      const exists = await alreadyPosted(channelId, uid);
      if (exists) {
        skipped.push(uid);
        continue;
      }

      const discordMessage = await postDiscordMessage(channelId, merged);
      posted.push({ uid, slot: merged.slot, channelId, messageId: discordMessage.id });
    }

    return res.status(200).json({
      ok: true,
      posted: posted.length,
      skipped: skipped.length,
      items: posted,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? "Erreur serveur" });
  }
}
