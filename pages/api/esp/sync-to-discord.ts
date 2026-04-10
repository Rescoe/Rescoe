import type { NextApiRequest, NextApiResponse } from 'next';
import { PNG } from 'pngjs';

type PublishPayload = {
  secret?: string;
  uid?: string;
  type?: 'still' | 'gif' | 'poetry' | string;
  mode?: 'still' | 'anim' | 'scroll' | string;
  name?: string;
  artist?: string;
  timestamp?: string;
  forSale?: boolean;
  ethAddress?: string;
  text?: string;
  oledBuffer?: number[];
  frames?: Array<number[] | { buffer: number[]; delay?: number }>;
  delays?: number[];
};

const DISCORD_API = 'https://discord.com/api/v10';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pickChannel(payload: PublishPayload): string {
  const artworkChannel = env('NEXT_PUBLIC_CHANNEL_EXPOS_ID');
  const poetryChannel = env('NEXT_PUBLIC_CHANNEL_EXPOS_ID');
  return payload.type === 'poetry' ? poetryChannel : artworkChannel;
}

function sanitize(s?: string, fallback = ''): string {
  return (s || fallback).toString().trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function buildUid(payload: PublishPayload): string {
  if (payload.uid?.trim()) return payload.uid.trim();
  const stamp = sanitize(payload.timestamp, new Date().toISOString())
    .replace(/[/:\\s]+/g, '-')
    .replace(/-+/g, '-');
  const artist = sanitize(payload.artist, 'anonyme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const name = sanitize(payload.name, 'sans-titre').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const type = sanitize(payload.type, 'still').toLowerCase();
  const mode = sanitize(payload.mode, 'still').toLowerCase();
  return `${stamp}-${type}-${mode}-${artist}-${name}`.replace(/-+/g, '-');
}

function getPrimaryBuffer(payload: PublishPayload): number[] | null {
  if (Array.isArray(payload.oledBuffer) && payload.oledBuffer.length === 1024) return payload.oledBuffer;
  if (Array.isArray(payload.frames) && payload.frames.length) {
    const first = payload.frames[0] as any;
    if (Array.isArray(first) && first.length === 1024) return first;
    if (first && Array.isArray(first.buffer) && first.buffer.length === 1024) return first.buffer;
  }
  return null;
}

function oledBufferToPng(buffer: number[]): Buffer {
  const png = new PNG({ width: 128, height: 64 });
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buffer[page * 128 + x] || 0;
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit;
        const idx = (y * 128 + x) << 2;
        const on = ((b >> bit) & 1) === 1;
        png.data[idx] = on ? 68 : 0;
        png.data[idx + 1] = on ? 170 : 0;
        png.data[idx + 2] = on ? 255 : 0;
        png.data[idx + 3] = 255;
      }
    }
  }
  return PNG.sync.write(png);
}

function buildDiscordContent(payload: PublishPayload, uid: string): string {
  const type = sanitize(payload.type, 'still');
  const mode = sanitize(payload.mode, 'still');
  const name = sanitize(payload.name, 'Sans titre');
  const artist = sanitize(payload.artist, 'Anonyme');
  const timestamp = sanitize(payload.timestamp, new Date().toLocaleString('fr-FR'));
  const eth = sanitize(payload.ethAddress);
  const forSale = payload.forSale ? 'oui' : 'non';

  const lines = [
    payload.type === 'poetry' ? '✍️ Nouvelle poésie OLED' : '🖼️ Nouvelle œuvre OLED',
    `Nom: ${name}`,
    `Artiste: ${artist}`,
    `Date: ${timestamp}`,
    `Type: ${type}`,
    `Mode: ${mode}`,
    `À vendre: ${forSale}`,
    `Adresse ETH: ${eth || '—'}`,
    `UID: ${uid}`,
  ];

  if (payload.text) {
    lines.push('', 'Texte:');
    lines.push(truncate(payload.text, 1200));
  }

  return lines.join('\n');
}

async function fetchChannelMessages(channelId: string, token: string): Promise<any[]> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=50`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) throw new Error(`Discord read failed: ${res.status}`);
  return res.json();
}

function buildMultipartBody(content: string, png: Buffer, boundary: string): Buffer {
  const payloadJsonPart =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="payload_json"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify({ content }) +
    `\r\n`;

  const fileHeaderPart =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="files[0]"; filename="oled-preview.png"\r\n` +
    `Content-Type: image/png\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n`;

  const fileBase64 = png.toString('base64');
  const fileFooterPart = `\r\n--${boundary}--\r\n`;

  return Buffer.concat([
    Buffer.from(payloadJsonPart, 'utf8'),
    Buffer.from(fileHeaderPart, 'utf8'),
    Buffer.from(fileBase64, 'utf8'),
    Buffer.from(fileFooterPart, 'utf8'),
  ]);
}

async function postDiscordMessage(
  channelId: string,
  token: string,
  content: string,
  png?: Buffer
): Promise<any> {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;

  if (!png) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) throw new Error(`Discord post failed: ${res.status}`);
    return res.json();
  }

  const boundary = `----rescoe-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const bodyBuffer = buildMultipartBody(content, png, boundary);
  const body = new Uint8Array(bodyBuffer);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.byteLength),
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Discord upload failed: ${res.status} ${txt}`);
  }

  return res.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // === CORS - AJOUTER CES 5 LIGNES ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    // === FIN CORS ===

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

  try {
    const payload: PublishPayload = req.body;

    if (payload.secret !== env('OLED_SYNC_SECRET')) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const token = env('DISCORD_TOKEN');
    const channelId = pickChannel(payload);
    const uid = buildUid(payload);
    const content = buildDiscordContent(payload, uid);

    const existing = await fetchChannelMessages(channelId, token);
    const alreadyPosted =
      Array.isArray(existing) &&
      existing.some((m: any) => typeof m?.content === 'string' && m.content.includes(`UID: ${uid}`));

    if (alreadyPosted) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'duplicate', uid });
    }

    const primaryBuffer = getPrimaryBuffer(payload);
    const png = primaryBuffer ? oledBufferToPng(primaryBuffer) : undefined;
    const message = await postDiscordMessage(channelId, token, content, png);

    return res.status(200).json({ ok: true, uid, channelId, messageId: message.id });
  } catch (error: any) {
    console.error('sync-to-discord error:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'internal_error',
    });
  }
}
