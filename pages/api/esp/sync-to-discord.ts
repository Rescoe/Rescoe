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

const ESP_BASE_URL = process.env.ESP_OLED_URL!;
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

async function fetchEspSlot(slot: number) {
  const res = await fetch(`${ESP_BASE_URL}/gallery-item?slot=${slot}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`ESP slot fetch failed ${res.status}: ${txt}`);
  }

  return res.json();
}

async function postDiscordMessage(
  channelId: string,
  token: string,
  content: string,
  png?: Buffer
): Promise<any> {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;

  try {
    // TEXT ONLY
    if (!png) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      const txt = await res.text();

      if (!res.ok) {
        return { ok: false, status: res.status, body: txt };
      }

      return { ok: true, ...(JSON.parse(txt || '{}')) };
    }

    // MULTIPART SAFE
    const boundary = `----rescoe-${Date.now()}`;

    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="payload_json"\r\n\r\n` +
        JSON.stringify({ content }) +
        `\r\n`
      ),
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files[0]"; filename="oled.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const txt = await res.text();

    if (!res.ok) {
      return { ok: false, status: res.status, body: txt };
    }

    return { ok: true, ...(JSON.parse(txt || '{}')) };

  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'discord_exception',
    };
  }
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // CORS SAFE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  console.log('--- SYNC HIT ---');
  if (req.method === 'GET') {
    try {
      const rawSlot = req.query.slot;

      console.log('[API GET] slot raw:', rawSlot);

      if (!rawSlot) {
        return res.status(400).json({
          ok: false,
          error: 'missing_slot',
        });
      }

      const slot = Number(rawSlot);

      if (!Number.isFinite(slot) || slot < 0) {
        return res.status(400).json({
          ok: false,
          error: 'invalid_slot',
          raw: rawSlot,
        });
      }

      const url = `${ESP_BASE_URL}/gallery-item?slot=${slot}`;

      console.log('[API GET] fetching ESP:', url);

      const resEsp = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      const text = await resEsp.text();

      console.log('[API GET] ESP status:', resEsp.status);
      console.log('[API GET] ESP raw response:', text.slice(0, 300));

      if (!resEsp.ok) {
        return res.status(502).json({
          ok: false,
          error: 'esp_error',
          status: resEsp.status,
          body: text,
        });
      }

      let item;

      try {
        item = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({
          ok: false,
          error: 'invalid_json_from_esp',
          raw: text,
        });
      }

      return res.status(200).json({
        ok: true,
        slot,
        item,
      });

    } catch (err: any) {
      console.error('[API GET FATAL]', err);

      return res.status(500).json({
        ok: false,
        error: err?.message || 'esp_proxy_failed',
      });
    }
  }
  
  try {
    const payload = (req.body || {}) as PublishPayload;

    console.log('payload type:', typeof payload);
    console.log('keys:', Object.keys(payload || {}));

    // NEVER CRASH ON ENV
    const token = process.env.DISCORD_TOKEN || '';
    const channelId = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID || '';

    if (!token || !channelId) {
      return res.status(500).json({
        ok: false,
        error: 'missing_env',
        token: !!token,
        channel: !!channelId,
      });
    }

    const uid = buildUid(payload);
    const content = buildDiscordContent(payload, uid);

    const primaryBuffer = getPrimaryBuffer(payload);

    if (!primaryBuffer) {
      console.warn('[WARN] no buffer');
    }

    const png = primaryBuffer ? oledBufferToPng(primaryBuffer) : undefined;

    const discord = await postDiscordMessage(channelId, token, content, png);

    console.log('discord result:', discord);

    return res.status(200).json({
      ok: true,
      uid,
      discord,
    });

  } catch (err: any) {

    console.error('FATAL HANDLER ERROR:', err);

    return res.status(200).json({
      ok: false,
      error: err?.message || 'unknown_error',
      stack: err?.stack || null,
    });
  }
}


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};
