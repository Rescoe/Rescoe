/**
 * POST /api/token/upload-insect-relayer-v3
 *
 * Version 3 du relayer d'upload — compatible InsectImageStorageV3.
 *
 * Différences avec V2 :
 *   - Images content-addressed : uploadImageChunk(imageHash, chunk) + finalizeImage(imageHash)
 *   - Insect registration séparé : registerInsect(insectKey, displayName, family, imageHash, attrsFragment, lore)
 *   - Si deux insectes partagent le même GIF, l'image est uploadée une seule fois
 *   - Getters disponibles on-chain : getInsectAttrs, getInsectLore, getInsectIdentity
 *
 * Body :
 *   { insectKey: string }
 *
 * Réponse :
 *   { status: "uploaded" | "exists", txHashes?, imageHash?, imageShared? }
 *
 * Variables d'env :
 *   RELAYER_PK, NEXT_PUBLIC_INSECT_STORAGE_V3, RELAYER_RPC_URL
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from "ethers";
import nftMetadata from "@/data/nft_metadata_clean.json";
import gifProfiles from "@/data/gif_profiles_smart_colors.json";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InsectData {
  level: number;
  name: string;
  display_name?: string;
  family_name?: string;
  image: string;
  lore?: string;
  total_in_family?: number;
  attributes?: Array<{ trait_type: string; value: unknown }>;
}

interface GifProfile {
  filename: string;
  frame_count: number;
  total_pixels_analyzed: number;
  gif_info: { size_bytes: number; width: number; height: number };
  dominant_colors: { hex: string[]; proportions: number[] };
  metrics: { brightness: number; saturation: number; colorfulness: number; contrast: number; sharpness: number; entropy: number };
  hsv: { mean: number[] };
  family: string;
}

// ─── Profils GIF ─────────────────────────────────────────────────────────────

const gifProfileMap = (() => {
  const map = new Map<string, GifProfile>();
  for (const entries of Object.values(
    (gifProfiles as { metadata: unknown; families: Record<string, GifProfile[]> }).families
  )) {
    for (const entry of entries) {
      map.set(entry.filename.replace(/\.gif$/i, ""), entry);
    }
  }
  return map;
})();

// ─── ABI InsectImageStorageV3 ─────────────────────────────────────────────────

const STORAGE_V3_ABI = [
  // Image store
  {
    inputs: [
      { internalType: "bytes32", name: "imageHash", type: "bytes32" },
      { internalType: "string",  name: "chunk",     type: "string"  },
    ],
    name: "uploadImageChunk",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "imageHash", type: "bytes32" }],
    name: "finalizeImage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "imageHash", type: "bytes32" }],
    name: "hasImage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "imageHash", type: "bytes32" }],
    name: "getImageChunkCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Insect registry
  {
    inputs: [
      { internalType: "string",  name: "insectKey",     type: "string"  },
      { internalType: "string",  name: "displayName",   type: "string"  },
      { internalType: "string",  name: "family",        type: "string"  },
      { internalType: "bytes32", name: "imageHash",     type: "bytes32" },
      { internalType: "string",  name: "attrsFragment", type: "string"  },
      { internalType: "string",  name: "lore",          type: "string"  },
    ],
    name: "registerInsect",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "isInsectRegistered",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Legacy compat
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "hasInsectImage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
];

// ─── Helpers formatage ────────────────────────────────────────────────────────

function fmtPixels(n: number): string { return n.toLocaleString("fr-FR"); }
function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(2)}MB`;
}
function r1(n: number): number { return Math.round(n * 10) / 10; }

// ─── Construire attrsFragment ─────────────────────────────────────────────────

function buildAttrsFragment(insectKey: string, meta: InsectData): string {
  const parts: string[] = [];
  const push = (t: string, v: unknown) =>
    parts.push(`{"trait_type":${JSON.stringify(t)},"value":${JSON.stringify(v)}}`);

  for (const attr of meta.attributes ?? []) {
    if (attr.trait_type !== "Niveau") push(attr.trait_type, attr.value);
  }

  if (meta.family_name) push("Famille", meta.family_name);
  push("Sprite", insectKey);
  if (meta.display_name) push("Insect name", meta.display_name);
  if (meta.total_in_family != null) push("TotalFamille", meta.total_in_family);

  const profile = gifProfileMap.get(insectKey);
  if (profile) {
    const colors = (profile.dominant_colors?.hex ?? []).filter(h => h.toLowerCase() !== "#000000");
    for (let i = 0; i < 5; i++) push(`Couleur${i + 1}`, colors[i] ?? "#000000");
    const hue = profile.hsv?.mean?.[0] ?? 0;
    push("Teinte",     r1(hue));
    push("Saturation", r1(profile.metrics.saturation * 100));
    push("Luminosité", r1(profile.metrics.brightness * 100));
    push("Colorful",   r1(profile.metrics.colorfulness * 100));
    push("Contraste",  r1(profile.metrics.contrast));
    push("Nettete",    r1(profile.metrics.sharpness));
    push("Entropie",   r1(profile.metrics.entropy));
    push("Frames",     profile.frame_count);
    push("Pixels",     fmtPixels(profile.total_pixels_analyzed));
    push("TailleBytes", fmtBytes(profile.gif_info.size_bytes));
  }

  return parts.join(",");
}

// ─── RPC helpers ─────────────────────────────────────────────────────────────

function buildRpcList(primary?: string): string[] {
  const candidates = [primary, "https://base.llamarpc.com", "https://1rpc.io/base", "https://mainnet.base.org"]
    .filter(Boolean) as string[];
  return candidates.filter((v, i, a) => a.indexOf(v) === i);
}

async function sendTx(
  rpcList: string[],
  relayerPk: string,
  contractAddress: string,
  txFn: (contract: Contract) => Promise<{ wait: () => Promise<{ hash: string }> }>,
  label: string,
  gasLimit: bigint
): Promise<string> {
  const errors: string[] = [];
  for (const rpc of rpcList) {
    try {
      const provider = new JsonRpcProvider(rpc);
      const wallet   = new Wallet(relayerPk, provider);
      const contract = new Contract(contractAddress, STORAGE_V3_ABI, wallet);
      const tx       = await txFn(contract);
      const receipt  = await tx.wait();
      console.log(`[v3-relayer] ✅ ${label} → ${receipt.hash} (${rpc})`);
      return receipt.hash;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Already finalized") || msg.includes("already registered")) {
        console.log(`[v3-relayer] ℹ️  ${label} déjà présent`);
        return "already";
      }
      if (msg.includes("insufficient funds")) throw new Error(`INSUFFICIENT_FUNDS:${msg}`);
      errors.push(`${rpc}: ${msg.slice(0, 80)}`);
    }
  }
  throw new Error(`TOUS_RPC_ECHOUE: ${errors.join(" | ")}`);
}

// ─── Calculer imageHash depuis le contenu GIF ─────────────────────────────────
//
// imageHash = keccak256(GIF base64 string) — content-addressed
// Si deux insectes ont le même GIF → même imageHash → une seule upload
//

function computeImageHash(imageDataUri: string): string {
  // Utiliser ethers keccak256 sur les bytes UTF-8 de la data URI
  return keccak256(toUtf8Bytes(imageDataUri));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { insectKey } = req.body as { insectKey?: string };
  if (!insectKey?.trim()) return res.status(400).json({ error: "insectKey requis" });

  const meta = (nftMetadata as unknown as Record<string, InsectData>)[insectKey];
  if (!meta) return res.status(404).json({ error: `Insecte inconnu : ${insectKey}` });

  const storageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE_V3;
  const relayerPk      = process.env.RELAYER_PK;
  if (!storageAddress || !relayerPk) {
    return res.status(500).json({ error: "NEXT_PUBLIC_INSECT_STORAGE_V3 ou RELAYER_PK manquant" });
  }

  const primaryRpc = process.env.RELAYER_RPC_URL ?? "https://mainnet.base.org";
  const rpcList    = buildRpcList(primaryRpc);

  try {
    const provider  = new JsonRpcProvider(primaryRpc);
    const wallet    = new Wallet(relayerPk, provider);
    const contract  = new Contract(storageAddress, STORAGE_V3_ABI, wallet);

    // ── 1. Vérif solde relayer ────────────────────────────────────────────────
    const balance = await provider.getBalance(wallet.address);
    if (balance < 500_000_000_000_000n) {
      return res.status(503).json({ error: `Relayer vide : ${wallet.address}. Envoyez 0.001 ETH sur Base.` });
    }

    // ── 2. Si insecte déjà enregistré → exit ─────────────────────────────────
    const alreadyRegistered = await contract.isInsectRegistered(insectKey) as boolean;
    if (alreadyRegistered) return res.status(200).json({ status: "exists" });

    // ── 3. Lire le GIF ────────────────────────────────────────────────────────
    const rel       = (meta.image as string).replace(/\\/g, "/");
    const gifPath   = path.join(process.cwd(), "public", "insects", rel);
    const gifBuffer = fs.readFileSync(gifPath);

    const imageDataUri  = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    const imageHashHex  = computeImageHash(imageDataUri);
    const imageHashBytes32 = imageHashHex as `0x${string}`;

    // ── 4. Uploader l'image si elle n'existe pas encore ───────────────────────
    const CHUNK_SIZE = 20_000;
    const txHashes: string[] = [];
    let imageShared = false;

    const imageAlreadyExists = await contract.hasImage(imageHashBytes32) as boolean;
    if (imageAlreadyExists) {
      console.log(`[v3-relayer] Image partagée (imageHash ${imageHashHex.slice(0, 10)}… déjà finalisée)`);
      imageShared = true;
    } else {
      // Uploader chunks
      const chunks: string[] = [];
      for (let i = 0; i < imageDataUri.length; i += CHUNK_SIZE) {
        chunks.push(imageDataUri.slice(i, i + CHUNK_SIZE));
      }

      // Reprendre depuis le bon chunk si upload partiel
      let startChunk = 0;
      try {
        const existingCount = Number(await contract.getImageChunkCount(imageHashBytes32) as bigint);
        if (existingCount > 0 && existingCount < chunks.length) startChunk = existingCount;
      } catch {}

      for (let i = startChunk; i < chunks.length; i++) {
        const gasLimit = BigInt(Math.min(Math.ceil(chunks[i].length * 700 + 400_000), 18_000_000));
        const hash = await sendTx(
          rpcList, relayerPk, storageAddress,
          (c) => (c.uploadImageChunk as any)(imageHashBytes32, chunks[i], { gasLimit }),
          `imageChunk ${i + 1}/${chunks.length}`,
          gasLimit
        );
        if (hash !== "already") txHashes.push(hash);
      }

      // Finaliser l'image
      const finalizeHash = await sendTx(
        rpcList, relayerPk, storageAddress,
        (c) => (c.finalizeImage as any)(imageHashBytes32, { gasLimit: 500_000n }),
        "finalizeImage",
        500_000n
      );
      if (finalizeHash !== "already") txHashes.push(finalizeHash);
    }

    // ── 5. Enregistrer l'insecte (lie insectKey → imageHash + attrs + lore) ───
    const attrsFragment = buildAttrsFragment(insectKey, meta);
    const lore          = meta.lore ?? "";
    const displayName   = meta.display_name ?? insectKey;
    const family        = meta.family_name ?? "";

    const registerHash = await sendTx(
      rpcList, relayerPk, storageAddress,
      (c) => (c.registerInsect as any)(
        insectKey, displayName, family, imageHashBytes32, attrsFragment, lore,
        { gasLimit: 3_000_000n }
      ),
      "registerInsect",
      3_000_000n
    );
    if (registerHash !== "already") txHashes.push(registerHash);

    console.log(`[v3-relayer] ✅ ${insectKey} — imageHash: ${imageHashHex.slice(0, 10)}… — imageShared: ${imageShared}`);

    return res.status(200).json({
      status: "uploaded",
      txHashes,
      imageHash: imageHashHex,
      imageShared,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("INSUFFICIENT_FUNDS:")) {
      return res.status(503).json({ error: "Fonds insuffisants sur le wallet relayer" });
    }
    console.error("[v3-relayer] ❌", e);
    return res.status(500).json({ error: msg });
  }
}
