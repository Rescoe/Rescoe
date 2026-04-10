import { NextRequest, NextResponse } from 'next/server';
import { PNG } from 'pngjs';

export const runtime = 'nodejs';
export const maxDuration = 15;

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

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pickChannel(payload: PublishPayload) {
  const artworkChannel = env('NEXT_PUBLIC_CHANNEL_EXPOS_ID');
  const poetryChannel = env('NEXT_PUBLIC_CHANNEL_EXPOS_ID');
  return payload.type === 'poetry' ? poetryChannel : artworkChannel;
}

function sanitize(s?: string, fallback = '') {
  return (s || fallback).toString().trim();
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function buildUid(payload: PublishPayload) {
  if (payload.uid?.trim()) return payload.uid.trim();
  const stamp = sanitize(payload.timestamp, new Date().toISOString())
    .replace(/[/:\s]+/g, '-')
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

function oledBufferToPng(buffer: number[]) {
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

function buildDiscordContent(payload: PublishPayload, uid: string) {
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

async function fetchChannelMessages(channelId: string, token: string) {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=50`, {
    headers: { Authorization: `Bot ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Discord read failed: ${res.status}`);
  return res.json();
}

async function postDiscordMessage(channelId: string, token: string, content: string, png?: Buffer) {
  if (!png) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
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

  const form = new FormData();
  form.set('payload_json', JSON.stringify({ content }));
  form.set('files[0]', new Blob([png], { type: 'image/png' }), 'oled-preview.png');

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Discord upload failed: ${res.status}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as PublishPayload;
    if (payload.secret !== env('OLED_SYNC_SECRET')) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const token = env('DISCORD_TOKEN');
    const channelId = pickChannel(payload);
    const uid = buildUid(payload);
    const content = buildDiscordContent(payload, uid);

    const existing = await fetchChannelMessages(channelId, token);
    const alreadyPosted = Array.isArray(existing) && existing.some((m: any) => typeof m?.content === 'string' && m.content.includes(`UID: ${uid}`));
    if (alreadyPosted) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'duplicate', uid });
    }

    const primaryBuffer = getPrimaryBuffer(payload);
    const png = primaryBuffer ? oledBufferToPng(primaryBuffer) : undefined;
    const message = await postDiscordMessage(channelId, token, content, png);

    return NextResponse.json({ ok: true, uid, channelId, messageId: message.id });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'internal_error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, mode: 'direct-post-enabled' });
}
