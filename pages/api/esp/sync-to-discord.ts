import type { NextApiRequest, NextApiResponse } from 'next';
import { PNG } from 'pngjs';

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
  const name   = sanitize(payload.name, 'sans-titre').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const type   = sanitize(payload.type, 'still').toLowerCase();
  const mode   = sanitize(payload.mode, 'still').toLowerCase();
  return `${stamp}-${type}-${mode}-${artist}-${name}`.replace(/-+/g, '-');
}

// ── Frame extraction ───────────────────────────────────────────────
function hexStrToBuffer(hex: string): number[] | null {
  if (typeof hex !== 'string' || hex.length !== 2048) return null;
  const buf = new Array<number>(1024);
  for (let i = 0; i < 1024; i++) {
    const b = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(b)) return null;
    buf[i] = b;
  }
  return buf;
}

function extractAllFrames(payload: PublishPayload): OledFrame[] {
  const out: OledFrame[] = [];

  // framesCompact: [{buf:"2048hexchars", delay:N}] — format ESP compact
  if (Array.isArray(payload.framesCompact) && payload.framesCompact.length > 0) {
    for (const f of payload.framesCompact) {
      if (!f || typeof f.buf !== 'string') continue;
      const buffer = hexStrToBuffer(f.buf);
      if (buffer) out.push({ buffer, delay: f.delay ?? 100 });
    }
    if (out.length > 0) {
      console.log(`[frames] ${out.length} frames from framesCompact`);
      return out;
    }
    console.warn('[frames] framesCompact present but no valid frames extracted');
  }

  // oledBufferCompact: string "2048hex" ou string[] ["00","ff",...]
  if (payload.oledBufferCompact) {
    let buf: number[] | null = null;
    if (typeof payload.oledBufferCompact === 'string' && payload.oledBufferCompact.length === 2048) {
      buf = hexStrToBuffer(payload.oledBufferCompact);
    } else if (Array.isArray(payload.oledBufferCompact) && payload.oledBufferCompact.length === 1024) {
      buf = (payload.oledBufferCompact as string[]).map(h => parseInt(h, 16));
      if (buf.some(isNaN)) buf = null;
    }
    if (buf) { out.push({ buffer: buf, delay: 1000 }); console.log('[frames] 1 frame from oledBufferCompact'); return out; }
  }

  // frames: [{buffer:[...1024], delay}] ou [[...1024]]
  if (Array.isArray(payload.frames) && payload.frames.length > 0) {
    for (let i = 0; i < payload.frames.length; i++) {
      const f = payload.frames[i] as any;
      let buf: number[] | null = null;
      if (Array.isArray(f) && f.length === 1024) buf = f;
      else if (Array.isArray(f?.buffer) && f.buffer.length === 1024) buf = f.buffer;
      if (buf) out.push({ buffer: buf, delay: f?.delay ?? payload.delays?.[i] ?? 100 });
    }
    if (out.length > 0) { console.log(`[frames] ${out.length} frames from frames[]`); return out; }
  }

  // oledBuffer: [0..255 ×1024]
  if (Array.isArray(payload.oledBuffer) && payload.oledBuffer.length === 1024) {
    out.push({ buffer: payload.oledBuffer, delay: 1000 });
    console.log('[frames] 1 frame from oledBuffer');
  }

  return out;
}

// ── PNG encoder (4× scale, blue-on-black) ─────────────────────────
function oledToPng(buffer: number[]): Buffer {
  const S = 4, W = 128 * S, H = 64 * S;
  const png = new PNG({ width: W, height: H });
  for (let page = 0; page < 8; page++) {
    for (let x = 0; x < 128; x++) {
      const b = buffer[page * 128 + x] || 0;
      for (let bit = 0; bit < 8; bit++) {
        const on = ((b >> bit) & 1) === 1;
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
          const idx = (((page * 8 + bit) * S + dy) * W + (x * S + dx)) << 2;
          png.data[idx]   = on ? 0x44 : 0;
          png.data[idx+1] = on ? 0xaa : 0;
          png.data[idx+2] = on ? 0xff : 0;
          png.data[idx+3] = 255;
        }
      }
    }
  }
  return PNG.sync.write(png);
}

// ── GIF encoder — pure TypeScript, zero deps (2× scale) ──────────
function encodeAnimatedGif(frames: OledFrame[]): Buffer {
  const S = 2, W = 128 * S, H = 64 * S;
  const out: number[] = [];
  const u8  = (v: number) => out.push(v & 0xff);
  const u16 = (v: number) => { out.push(v & 0xff); out.push((v >> 8) & 0xff); };
  const str = (s: string) => { for (let i = 0; i < s.length; i++) u8(s.charCodeAt(i)); };

  str('GIF89a'); u16(W); u16(H);
  u8(0b10000000); u8(0); u8(0);
  out.push(0,0,0, 0x44,0xaa,0xff); // palette: black, OLED blue

  u8(0x21); u8(0xff); u8(0x0b);
  str('NETSCAPE2.0');
  u8(3); u8(1); u16(0); u8(0);

  function lzwEncode(px: number[]): number[] {
    const CLR=4, END=5;
    const res: number[] = [];
    let bits=0, cur=0, cs=3;
    const dict = new Map<string,number>();
    let next = END+1;
    const rst = () => { dict.clear(); next=END+1; cs=3; };
    const emit = (c: number) => { cur|=c<<bits; bits+=cs; while(bits>=8){res.push(cur&0xff);cur>>=8;bits-=8;} };
    rst(); emit(CLR);
    let buf='';
    for (let i=0; i<=px.length; i++) {
      const c = i<px.length ? String.fromCharCode(px[i]) : null;
      const nx = c!==null ? buf+c : null;
      if (c!==null && dict.has(nx!)) { buf=nx!; }
      else {
        emit(buf.length===1 ? buf.charCodeAt(0) : dict.get(buf)!);
        if (c!==null) {
          if (next<4096) { dict.set(nx!,next++); if(next>(1<<cs)&&cs<12)cs++; }
          else { emit(CLR); rst(); }
          buf=c;
        }
      }
    }
    emit(END); if(bits>0)res.push(cur&0xff); return res;
  }

  const blocks = (data: number[]) => {
    for (let i=0; i<data.length; i+=255) {
      const c=data.slice(i,i+255); u8(c.length); c.forEach(b=>u8(b));
    }
    u8(0);
  };

  for (const fr of frames) {
    const d = Math.max(2, Math.round(fr.delay/10));
    u8(0x21); u8(0xf9); u8(0x04); u8(0b00000100); u16(d); u8(0); u8(0);
    u8(0x2c); u16(0); u16(0); u16(W); u16(H); u8(0);
    const px = new Array<number>(W*H);
    for (let page=0; page<8; page++) for (let x=0; x<128; x++) {
      const b = fr.buffer[page*128+x]||0;
      for (let bit=0; bit<8; bit++) {
        const on=(b>>bit)&1, sy=page*8+bit;
        for (let dy=0; dy<S; dy++) for (let dx=0; dx<S; dx++)
          px[(sy*S+dy)*W+(x*S+dx)]=on;
      }
    }
    u8(2); blocks(lzwEncode(px));
  }
  u8(0x3b);
  return Buffer.from(out);
}

// ── Discord content ────────────────────────────────────────────────
function buildContent(payload: PublishPayload, uid: string): string {
  const type=sanitize(payload.type,'still'), mode=sanitize(payload.mode,'still');
  const name=sanitize(payload.name,'Sans titre'), artist=sanitize(payload.artist,'Anonyme');
  const ts=sanitize(payload.timestamp,new Date().toLocaleString('fr-FR'));
  const eth=sanitize(payload.ethAddress), forSale=payload.forSale?'oui':'non';
  const isP=type==='poetry', isA=mode==='anim'||mode==='scroll', isPr=type==='profile';
  const emoji=isPr?'👤':isP?'✍️':isA?'🎬':'🖼️';
  const label=isPr?'Mise à jour profil':isP&&isA?'Poésie scroll OLED':isP?'Nouvelle poésie OLED':isA?'Nouvelle animation OLED':'Nouvelle œuvre OLED';
  const lines=[`${emoji} **${label}**`,`**Nom:** ${name}`,`**Artiste:** ${artist}`,`**Date:** ${ts}`];
  if(!isPr){lines.push(`**Type:** ${type} | **Mode:** ${mode}`,`**À vendre:** ${forSale}`);if(eth)lines.push(`**ETH:** ${eth}`);}
  lines.push(`**UID:** \`${uid}\``);
  if(payload.text)lines.push('','**Texte:**',truncate(payload.text,1200));
  return lines.join('\n');
}

// ── Discord post ───────────────────────────────────────────────────
async function postToDiscord(
  channelId: string, token: string, content: string,
  file?: { data: Buffer; name: string; mime: string }
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${DISCORD_API}/channels/${channelId}/messages`;
  if (!file) {
    const r = await fetch(url,{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({content})});
    return {ok:r.ok,status:r.status,body:await r.text()};
  }
  const boundary = `rescoe${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({content})}\r\n`,'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`,'utf8'),
    file.data,
    Buffer.from(`\r\n--${boundary}--\r\n`,'utf8'),
  ]);
  console.log(`[Discord] POST ${file.name}: ${file.data.length}B, total: ${body.length}B`);
  const r = await fetch(url,{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':`multipart/form-data; boundary=${boundary}`},body});
  const txt = await r.text();
  console.log(`[Discord] ${r.status} ${txt.slice(0,200)}`);
  if (r.status===403) {
    console.error('[Discord] 403 — ATTACH_FILES permission missing');
    const r2=await fetch(url,{method:'POST',headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify({content:content+'\n\n⚠️ *[Joindre des fichiers manquant sur ce canal]*'})});
    return {ok:r2.ok,status:r2.status,body:await r2.text()};
  }
  return {ok:r.ok,status:r.status,body:txt};
}

// ── Main handler ───────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','*');
  if (req.method==='OPTIONS') return res.status(204).end();

  console.log('--- SYNC HIT ---');
  try {
    const payload = (req.body||{}) as PublishPayload;
    const type=sanitize(payload.type,'still'), mode=sanitize(payload.mode,'still');

    console.log(`type=${type} mode=${mode}`);
    console.log(`oledBuffer=${payload.oledBuffer?.length??'none'}`);
    console.log(`oledBufferCompact=${typeof payload.oledBufferCompact==='string'?payload.oledBufferCompact.length+'ch':Array.isArray(payload.oledBufferCompact)?payload.oledBufferCompact.length+'entries':'none'}`);
    console.log(`framesCompact=${Array.isArray(payload.framesCompact)?payload.framesCompact.length+' frames':'none'}`);

    const token=process.env.DISCORD_TOKEN||'';
    const channelId=process.env.NEXT_PUBLIC_CHANNEL_EXPOS_ID||'';
    if (!token||!channelId) return res.status(500).json({ok:false,error:'missing_env'});

    const uid=buildUid(payload);
    const content=buildContent(payload,uid);
    const frames=extractAllFrames(payload);
    console.log(`frames extracted: ${frames.length}`);

    const isAnim=(type==='gif'||mode==='anim')&&type!=='poetry';
    const isPoetryScroll=type==='poetry'&&mode==='scroll';

    let file: {data:Buffer;name:string;mime:string}|undefined;

    if (isPoetryScroll) {
      console.log('poetry scroll → text only');
    } else if (isAnim && frames.length>1) {
      console.log(`encoding GIF: ${frames.length} frames`);
      const gif=encodeAnimatedGif(frames);
      console.log(`GIF: ${gif.length}B`);
      file={data:gif,name:'animation.gif',mime:'image/gif'};
    } else if (frames.length>=1) {
      const png=oledToPng(frames[0].buffer);
      console.log(`PNG: ${png.length}B`);
      file={data:png,name:'oled.png',mime:'image/png'};
    } else {
      console.warn('no frames → text only');
    }

    const discord=await postToDiscord(channelId,token,content,file);
    return res.status(200).json({ok:discord.ok,uid,discord});

  } catch(err:any) {
    console.error('FATAL:',err);
    return res.status(200).json({ok:false,error:err?.message??'unknown'});
  }
}

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };
