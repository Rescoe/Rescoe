import type { NextApiRequest, NextApiResponse } from "next";

const ESP_BASE_URL = process.env.ESP_BASE_URL!;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
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

function setCors(res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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

async function postTestMessage(channelId: string) {
  const now = new Date().toISOString();

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `Test sync-to-discord OK\nDate: ${now}`,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord post test error ${response.status}: ${text}`);
  }

  return response.json();
}

async function runSync() {
  const galleryRes = await fetch(`${ESP_BASE_URL}/gallery`, { cache: "no-store" });
  if (!galleryRes.ok) {
    throw new Error("Impossible de lire /gallery sur l'ESP");
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

  return {
    ok: true,
    posted: posted.length,
    skipped: skipped.length,
    items: posted,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!ESP_BASE_URL || !DISCORD_TOKEN || !DISCORD_CHANNEL_ART_ID || !DISCORD_CHANNEL_POETRY_ID) {
    return res.status(500).json({ error: "Variables d'environnement manquantes" });
  }

  try {
    if (req.method === "GET") {
      const test = req.query.test === "1";
      const channel = req.query.channel === "poetry" ? DISCORD_CHANNEL_POETRY_ID : DISCORD_CHANNEL_ART_ID;

      if (test) {
        const msg = await postTestMessage(channel);
        return res.status(200).json({
          ok: true,
          mode: "test",
          messageId: msg.id,
          channelId: channel,
        });
      }

      const result = await runSync();
      return res.status(200).json({
        mode: "sync",
        ...result,
      });
    }

    if (req.method === "POST") {
      const result = await runSync();
      return res.status(200).json({
        mode: "sync",
        ...result,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? "Erreur serveur" });
  }
}
