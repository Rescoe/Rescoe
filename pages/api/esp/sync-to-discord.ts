@ -1,635 +1,439 @@
import type { NextApiRequest, NextApiResponse } from 'next';
import { PNG } from 'pngjs';

// ─────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────
type PublishPayload = {
  secret?: string;
  uid?: string;
  type?: string;
  mode?: string;
  name?: string;
  artist?: string;
  timestamp?: string;
  forSale?: boolean;
  ethAddress?: string;
  text?: string;
  oledBuffer?: number[];
  oledBufferCompact?: string | string[];
  frames?: Array<number[] | { buffer: number[]; delay?: number }>;
  framesCompact?: Array<{ buf: string; delay?: number }>;
  delays?: number[];
};

type OledFrame = { buffer: number[]; delay: number };

const DISCORD_API = 'https://discord.com/api/v10';

// ─────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────
function sanitize(s?: string, fallback = ''): string {
  return (s || fallback).toString().trim();
}
function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function buildUid(payload: PublishPayload): string {
  if (payload.uid?.trim()) return payload.uid.trim();
  const stamp = sanitize(payload.timestamp, new Date().toISOString())
    .replace(/[/:\s]+/g, '-').replace(/-+/g, '-');
  const artist = sanitize(payload.artist, 'anonyme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const name   = sanitize(payload.name,   'sans-titre').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const type   = sanitize(payload.type,   'still').toLowerCase();
  const mode   = sanitize(payload.mode,   'still').toLowerCase();
  return `${stamp}-${type}-${mode}-${artist}-${name}`.replace(/-+/g, '-');
}

// ─────────────────────────────────────────────────────────────────
//  FRAME EXTRACTION
//  Priority: framesCompact (ESP compact hex) > frames > oledBuffer
// ─────────────────────────────────────────────────────────────────
function hexStrToBuffer(hex: string): number[] | null {
  if (typeof hex !== 'string' || hex.length !== 2048) return null;
  const buf: number[] = new Array(1024);
  for (let i = 0; i < 1024; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    buf[i] = byte;
  }
  return buf;
}

function extractAllFrames(payload: PublishPayload): OledFrame[] {
  const out: OledFrame[] = [];

  // ── framesCompact: [{buf: "2048hexchars", delay: N}] ── ESP format
  if (Array.isArray(payload.framesCompact) && payload.framesCompact.length > 0) {
    for (const f of payload.framesCompact) {
      if (!f || typeof f.buf !== 'string') continue;
      const buffer = hexStrToBuffer(f.buf);
      if (buffer) out.push({ buffer, delay: f.delay ?? 100 });
    }
    if (out.length > 0) {
      console.log(`[frames] extracted ${out.length} frames from framesCompact`);
      return out;
    }
  }

  // ── oledBufferCompact: "2048hexchars" or ["00","ff",...] ── single frame
  if (payload.oledBufferCompact) {
    let buf: number[] | null = null;
    if (typeof payload.oledBufferCompact === 'string') {
      buf = hexStrToBuffer(payload.oledBufferCompact);
    } else if (Array.isArray(payload.oledBufferCompact) && payload.oledBufferCompact.length === 1024) {
      buf = (payload.oledBufferCompact as string[]).map(h => parseInt(h, 16));
    }
    if (buf) {
      out.push({ buffer: buf, delay: 1000 });
      console.log('[frames] extracted 1 frame from oledBufferCompact');
      return out;
    }
  }

  // ── frames: [{buffer:[...1024], delay}] or [[...1024]] ── JS direct
  if (Array.isArray(payload.frames) && payload.frames.length > 0) {
    for (let i = 0; i < payload.frames.length; i++) {
      const f = payload.frames[i] as any;
      let buf: number[] | null = null;
      if (Array.isArray(f) && f.length === 1024) buf = f;
      else if (Array.isArray(f?.buffer) && f.buffer.length === 1024) buf = f.buffer;
      if (buf) out.push({ buffer: buf, delay: f?.delay ?? payload.delays?.[i] ?? 100 });
    }
    if (out.length > 0) {
      console.log(`[frames] extracted ${out.length} frames from frames[]`);
      return out;
    }
  }

  // ── oledBuffer: [0..255, ...×1024] ── single frame
  if (Array.isArray(payload.oledBuffer) && payload.oledBuffer.length === 1024) {
    out.push({ buffer: payload.oledBuffer, delay: 1000 });
    console.log('[frames] extracted 1 frame from oledBuffer');
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────
//  PNG ENCODER  (pngjs, 4× scale, blue-on-black)
// ─────────────────────────────────────────────────────────────────
function oledToPng(buffer: number[]): Buffer {
  const SCALE = 4;
  const W = 128 * SCALE; // 512
  const H = 64  * SCALE; // 256
  const png = new PNG({ width: W, height: H });
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buffer[page * 128 + x] || 0;
      for (let bit = 0; bit < 8; bit++) {
        const on = ((b >> bit) & 1) === 1;
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            const idx = (((page * 8 + bit) * SCALE + dy) * W + (x * SCALE + dx)) << 2;
            png.data[idx]     = on ? 0x44 : 0x00;
            png.data[idx + 1] = on ? 0xaa : 0x00;
            png.data[idx + 2] = on ? 0xff : 0x00;
            png.data[idx + 3] = 255;
          }
        }
      }
    }
  }
  return PNG.sync.write(png);
}

// ─────────────────────────────────────────────────────────────────
//  GIF ENCODER  — pure TypeScript, zero external deps
//  Palette: 0=black, 1=OLED blue #44aaff
//  Output: 2× scale (256×128 px)
// ─────────────────────────────────────────────────────────────────
function encodeAnimatedGif(frames: OledFrame[]): Buffer {
  const SCALE = 2;
  const W = 128 * SCALE; // 256
  const H = 64  * SCALE; // 128

  const out: number[] = [];
  const u8  = (v: number) => out.push(v & 0xff);
  const u16 = (v: number) => { out.push(v & 0xff); out.push((v >> 8) & 0xff); };
  const str = (s: string) => { for (let i = 0; i < s.length; i++) u8(s.charCodeAt(i)); };

  // Header
  str('GIF89a');
  u16(W); u16(H);
  u8(0b10000000); // GCT present, 2 colors
  u8(0); u8(0);
  // Global Color Table
  out.push(0x00, 0x00, 0x00); // 0 = black
  out.push(0x44, 0xaa, 0xff); // 1 = OLED blue

  // Netscape loop (infinite)
  u8(0x21); u8(0xff); u8(0x0b);
  str('NETSCAPE2.0');
  u8(3); u8(1); u16(0); u8(0);

  // LZW encoder
  function lzwEncode(indices: number[]): number[] {
    const MIN = 2, CLEAR = 4, END = 5;
    const res: number[] = [];
    let bits = 0, cur = 0, codeSize = 3;
    const dict = new Map<string, number>();
    let next = END + 1;

    const reset = () => { dict.clear(); next = END + 1; codeSize = 3; };
    const emit  = (code: number) => {
      cur |= code << bits; bits += codeSize;
      while (bits >= 8) { res.push(cur & 0xff); cur >>= 8; bits -= 8; }
    };

    reset(); emit(CLEAR);
    let buf = '';

    for (let i = 0; i <= indices.length; i++) {
      const c   = i < indices.length ? String.fromCharCode(indices[i]) : null;
      const nxt = c !== null ? buf + c : null;
      if (c !== null && dict.has(nxt!)) {
        buf = nxt!;
      } else {
        emit(buf.length === 1 ? buf.charCodeAt(0) : dict.get(buf)!);
        if (c !== null) {
          if (next < 4096) {
            dict.set(nxt!, next++);
            if (next > (1 << codeSize) && codeSize < 12) codeSize++;
          } else { emit(CLEAR); reset(); }
          buf = c;
        }
      }
    }
    emit(END);
    if (bits > 0) res.push(cur & 0xff);
    return res;
  }

  const writeBlocks = (data: number[]) => {
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255);
      u8(chunk.length);
      for (const b of chunk) u8(b);
    }
    u8(0);
  };

  for (const frame of frames) {
    const delay = Math.max(2, Math.round(frame.delay / 10));

    // Graphic Control Extension
    u8(0x21); u8(0xf9); u8(0x04);
    u8(0b00000100); // disposal=keep, no transparency
    u16(delay);
    u8(0); u8(0);

    // Image Descriptor
    u8(0x2c);
    u16(0); u16(0); u16(W); u16(H);
    u8(0);

    // Pixel indices (2× scaled)
    const indices = new Array<number>(W * H);
    for (let page = 0; page < 8; page++) {
      for (let x = 0; x < 128; x++) {
        const b = frame.buffer[page * 128 + x] || 0;
        for (let bit = 0; bit < 8; bit++) {
          const on   = (b >> bit) & 1;
          const srcY = page * 8 + bit;
          for (let dy = 0; dy < SCALE; dy++)
            for (let dx = 0; dx < SCALE; dx++)
              indices[(srcY * SCALE + dy) * W + (x * SCALE + dx)] = on;
        }
      }
    }

    u8(2);
    writeBlocks(lzwEncode(indices));
  }

  u8(0x3b);
  return Buffer.from(out);
}

// ─────────────────────────────────────────────────────────────────
//  DISCORD CONTENT
// ─────────────────────────────────────────────────────────────────
function buildContent(payload: PublishPayload, uid: string): string {
  const type    = sanitize(payload.type,   'still');
  const mode    = sanitize(payload.mode,   'still');
  const name    = sanitize(payload.name,   'Sans titre');
  const artist  = sanitize(payload.artist, 'Anonyme');
  const ts      = sanitize(payload.timestamp, new Date().toLocaleString('fr-FR'));
  const eth     = sanitize(payload.ethAddress);
  const forSale = payload.forSale ? 'oui' : 'non';

  const isPoetry  = type === 'poetry';
  const isAnim    = mode === 'anim' || mode === 'scroll';
  const isProfile = type === 'profile';

  const emoji = isProfile ? '👤' : isPoetry ? '✍️' : isAnim ? '🎬' : '🖼️';
  const label = isProfile ? 'Mise à jour profil'
    : isPoetry && isAnim ? 'Poésie scroll OLED'
    : isPoetry           ? 'Nouvelle poésie OLED'
    : isAnim             ? 'Nouvelle animation OLED'
    :                      'Nouvelle œuvre OLED';

  const lines = [
    `${emoji} **${label}**`,
    `**Nom:** ${name}`,
    `**Artiste:** ${artist}`,
    `**Date:** ${ts}`,
  ];
  if (!isProfile) {
    lines.push(`**Type:** ${type} | **Mode:** ${mode}`);
    lines.push(`**À vendre:** ${forSale}`);
    if (eth) lines.push(`**ETH:** ${eth}`);
  }
  lines.push(`**UID:** \`${uid}\``);
  if (payload.text) lines.push('', '**Texte:**', truncate(payload.text, 1200));
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
//  DISCORD POST
// ─────────────────────────────────────────────────────────────────
async function postToDiscord(
  channelId: string,
  token: string,
  content: string,
  file?: { data: Buffer; name: string; mime: string }
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;

  if (!file) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return { ok: r.ok, status: r.status, body: await r.text() };
  }

  const boundary = `rescoe${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="payload_json"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      JSON.stringify({ content }) + `\r\n`,
      'utf8'
    ),
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="files[0]"; filename="${file.name}"\r\n` +
      `Content-Type: ${file.mime}\r\n\r\n`,
      'utf8'
    ),
    file.data,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ]);

  console.log(`[Discord] POST ${file.name}: ${file.data.length} bytes`);

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  const txt = await r.text();
  console.log(`[Discord] response: ${r.status} — ${txt.slice(0, 300)}`);

  if (r.status === 403) {
    console.error('[Discord] 403 — missing ATTACH_FILES permission on this channel');
    const r2 = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content + '\n\n⚠️ *[image non jointe — accorde **Joindre des fichiers** au bot]*',
      }),
    });
    return { ok: r2.ok, status: r2.status, body: await r2.text() };
  }

  return { ok: r.ok, status: r.status, body: txt };
}

// ─────────────────────────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('--- SYNC HIT ---');

  try {
    const payload = (req.body || {}) as PublishPayload;
    const type = sanitize(payload.type, 'still');
    const mode = sanitize(payload.mode, 'still');

    console.log(`type=${type} mode=${mode}`);
    console.log(`oledBuffer=${payload.oledBuffer?.length ?? 'none'}`);
    console.log(`oledBufferCompact=${typeof payload.oledBufferCompact === 'string' ? payload.oledBufferCompact.length + ' chars' : Array.isArray(payload.oledBufferCompact) ? payload.oledBufferCompact.length + ' entries' : 'none'}`);
    console.log(`framesCompact=${Array.isArray(payload.framesCompact) ? payload.framesCompact.length + ' frames' : 'none'}`);
    console.log(`frames=${Array.isArray(payload.frames) ? payload.frames.length + ' frames' : 'none'}`);

    const token     = process.env.DISCORD_TOKEN || '';
    const channelId = process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID || '';
    if (!token || !channelId) {
      return res.status(500).json({ ok: false, error: 'missing_env' });
    }

    const uid     = buildUid(payload);
    const content = buildContent(payload, uid);
    const frames  = extractAllFrames(payload);

    console.log(`frames extracted: ${frames.length}`);

    // ── Decide what to attach ──────────────────────────────────
    let file: { data: Buffer; name: string; mime: string } | undefined;

    const isAnimation    = (type === 'gif' || mode === 'anim') && type !== 'poetry';
    const isPoetryScroll = type === 'poetry' && mode === 'scroll';

    if (isPoetryScroll) {
      // Poetry scroll → text only
      console.log('poetry scroll → text only');

    } else if (isAnimation && frames.length > 1) {
      // Animated artwork → GIF
      console.log(`encoding GIF: ${frames.length} frames`);
      const gif = encodeAnimatedGif(frames);
      console.log(`GIF size: ${gif.length} bytes`);
      file = { data: gif, name: 'animation.gif', mime: 'image/gif' };

    } else if (frames.length >= 1) {
      // Still image → PNG
      const png = oledToPng(frames[0].buffer);
      console.log(`PNG size: ${png.length} bytes`);
      file = { data: png, name: 'oled.png', mime: 'image/png' };

    } else {
      console.warn('no frames extracted → text only');
    }

    const discord = await postToDiscord(channelId, token, content, file);
    return res.status(200).json({ ok: discord.ok, uid, discord });

  } catch (err: any) {
    console.error('FATAL:', err);
    return res.status(200).json({ ok: false, error: err?.message ?? 'unknown' });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};
