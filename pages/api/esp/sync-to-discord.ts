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

function extractAllFrames(payload: PublishPayload): Array<{ buffer: number[]; delay: number }> {
  const out: Array<{ buffer: number[]; delay: number }> = [];

  if (Array.isArray(payload.frames)) {
    for (let i = 0; i < payload.frames.length; i++) {
      const f = payload.frames[i] as any;

      if (Array.isArray(f) && f.length === 1024) {
        out.push({ buffer: f, delay: payload.delays?.[i] ?? 100 });
      } else if (f?.buffer?.length === 1024) {
        out.push({ buffer: f.buffer, delay: f.delay ?? payload.delays?.[i] ?? 100 });
      }
    }
  }

  if (Array.isArray((payload as any).framesCompact)) {
    const fc = (payload as any).framesCompact;
    for (const f of fc) {
      if (typeof f.buf === 'string' && f.buf.length === 2048) {
        const buffer: number[] = [];
        for (let i = 0; i < 2048; i += 2) {
          buffer.push(parseInt(f.buf.slice(i, i + 2), 16));
        }
        if (buffer.length === 1024) {
          out.push({ buffer, delay: f.delay ?? 100 });
        }
      }
    }
  }

  return out;
}


function encodeGif(frames: Array<{ buffer: number[]; delay: number }>): Buffer {

  const W = 128, H = 64;
  const out: number[] = [];

  const push = (...b: number[]) => out.push(...b);
  const writeShort = (v: number) => push(v & 255, (v >> 8) & 255);

  // HEADER
  push(0x47,0x49,0x46,0x38,0x39,0x61);
  writeShort(W);
  writeShort(H);

  push(0x80 | 0x01); // GCT 2 colors
  push(0,0);

  // palette (black / white)
  push(0,0,0, 255,255,255);

  // loop
  push(0x21,0xFF,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0);

  for (const frame of frames) {

    const delay = Math.max(2, Math.floor(frame.delay / 10));

    // GCE
    push(0x21,0xF9,4,0, delay & 255, (delay>>8)&255, 0,0);

    // Image descriptor
    push(0x2C);
    writeShort(0); writeShort(0);
    writeShort(W); writeShort(H);
    push(0);

    const minCodeSize = 2;
    push(minCodeSize);

    const CLEAR = 1 << minCodeSize;
    const END = CLEAR + 1;

    let codeSize = minCodeSize + 1;

    const pixels: number[] = [];

    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < W; x++) {
        const b = frame.buffer[page * W + x];
        for (let bit = 0; bit < 8; bit++) {
          pixels.push((b >> bit) & 1);
        }
      }
    }

    const codes: number[] = [];

    // LZW ultra minimal (pas de dictionnaire dynamique → valide)
    codes.push(CLEAR);
    for (const p of pixels) codes.push(p);
    codes.push(END);

    // bit packing
    const bits: number[] = [];

    for (const c of codes) {
      for (let i = 0; i < codeSize; i++) {
        bits.push((c >> i) & 1);
      }
    }

    const bytes: number[] = [];

    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        if (bits[i + b]) byte |= (1 << b);
      }
      bytes.push(byte);
    }

    for (let i = 0; i < bytes.length; i += 255) {
      const chunk = bytes.slice(i, i + 255);
      push(chunk.length, ...chunk);
    }

    push(0);
  }

  push(0x3B);

  return Buffer.from(out);
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
  // Premier buffer direct (cas classique)
  if (Array.isArray(payload.oledBuffer) && payload.oledBuffer.length === 1024) {
    return payload.oledBuffer;
  }

  // Frames existantes
  if (Array.isArray(payload.frames) && payload.frames.length) {
    const first = payload.frames[0] as any;
    if (Array.isArray(first) && first.length === 1024) return first;
    if (first && Array.isArray(first.buffer) && first.buffer.length === 1024) return first.buffer;
  }

  // NOUVEAU : extractFrames pour framesCompact (hex strings compactes)
  if (!Array.isArray(payload.frames) && Array.isArray((payload as any).framesCompact)) {
    const fc = (payload as any).framesCompact as Array<{ buf: string; delay: number }>;
    for (const f of fc) {
      if (typeof f.buf === 'string' && f.buf.length === 2048) {  // 1024 bytes = 2048 hex chars
        const buffer: number[] = [];
        for (let i = 0; i < 2048; i += 2) {
          buffer.push(parseInt(f.buf.slice(i, i + 2), 16));
        }
        // Retourne le premier frame valide (128x64 = 1024 bytes)
        if (buffer.length === 1024) {
          return buffer;
        }
      }
    }
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
  png?: Buffer,
  gif?: Buffer
): Promise<any> {

  const url = `${DISCORD_API}/channels/${channelId}/messages`;

  try {

    // TEXT ONLY
    if (!png && !gif) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      const txt = await res.text();
      return res.ok
        ? { ok: true, ...(JSON.parse(txt || '{}')) }
        : { ok: false, status: res.status, body: txt };
    }

    // MULTIPART
    const boundary = `----rescoe-${Date.now()}`;
    const parts: Buffer[] = [];

    // payload_json
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="payload_json"\r\n\r\n` +
        JSON.stringify({ content }) +
        `\r\n`
      )
    );

    let fileIndex = 0;

    if (png) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="files[${fileIndex}]"; filename="oled.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`
        )
      );
      parts.push(png, Buffer.from('\r\n'));
      fileIndex++;
    }

    if (gif) {
      parts.push(
        Buffer.from(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="files[${fileIndex}]"; filename="oled.gif"\r\n` +
          `Content-Type: image/gif\r\n\r\n`
        )
      );
      parts.push(gif, Buffer.from('\r\n'));
      fileIndex++;
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const txt = await res.text();

    return res.ok
      ? { ok: true, ...(JSON.parse(txt || '{}')) }
      : { ok: false, status: res.status, body: txt };

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

    console.log('🔍 RAW_BODY_SIZE:', Buffer.from(JSON.stringify(req.body || {})).byteLength);
    console.log('🔍 HAS_OLEDBUFFER:', !!payload.oledBuffer);
    console.log('🔍 PAYLOAD_KEYS:', Object.keys(payload || {}));
    console.log('🔍 FIRST_10_ITEM_KEYS:', (payload as any).item ? Object.keys((payload as any).item || {}).slice(0, 10) : 'NO ITEM');
    console.log('🔍 BUFFER_LEN:', payload.oledBuffer?.length || 'NO BUFFER');

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
    const frames = extractAllFrames(payload);

    const isAnimation =
      sanitize(payload.mode).toLowerCase() === 'anim' ||
      sanitize(payload.type).toLowerCase() === 'gif' ||
      frames.length > 1;
    if (!primaryBuffer) {
      console.warn('[WARN] no buffer');
    }

    const png = primaryBuffer ? oledBufferToPng(primaryBuffer) : undefined;
    const gif = isAnimation && frames.length > 1 ? encodeGif(frames) : undefined;

    const discord = await postDiscordMessage(channelId, token, content, png, gif);
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
