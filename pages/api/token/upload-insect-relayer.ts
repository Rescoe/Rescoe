/**
 * POST /api/token/upload-insect-relayer
 *
 * Le RELAYER exécute l'upload on-chain de l'image insecte côté serveur.
 * L'adhérent ne paie que le mint (safeMint). Pas de seconde transaction côté client.
 *
 * ─── Flux ───────────────────────────────────────────────────────────────────
 *   1. Client envoie { insectKey }
 *   2. Serveur valide la clé (doit exister dans nft_metadata_clean.json)
 *   3. Vérifie on-chain si l'insecte est déjà finalisé (hasInsectImage)
 *   4. Si non : lit le GIF, construit la data URI, découpe en chunks de ~20 KB
 *      → appendInsectChunk() × N  (~13 M gas chacun, sous la limite Base ~25 M)
 *      → finalizeInsect()          (~1–2 M gas, attrsFragment complet ~36 traits)
 *   5. Retourne { status: "uploaded" | "exists", txHashes? }
 *
 * ─── Traits stockés dans attrsFragment (36 traits) ─────────────────────────
 *   Statiques (par insecte, stockés une fois at finalizeInsect) :
 *     Stade, Type, Cornes, Forme, Corps, Pattes, Ailes, Taille, Poils,
 *     Carapace, Motif, Yeux, Antennes, Filtre, Legendaire   (15 morphologiques)
 *     Famille, Sprite, Insect name, TotalFamille             (4 identité)
 *     Couleur1-5                                             (5 couleurs dominantes)
 *     Teinte, Saturation, Luminosité, Colorful,
 *     Contraste, Nettete, Entropie                           (7 métriques visuelles)
 *     Frames, Pixels, TailleBytes                            (3 stats GIF)
 *   + Lore (stocké séparément, affiché comme trait par InsectImageStorageV2)
 *   Dynamiques (calculés live par InsectImageStorageV2) :
 *     Niveau, Proprietaire, Role, Adhesion, Auto Evolve      (5 live)
 *   Total : 34 statiques + 5 live = 39 attributs
 *
 * ─── Variables d'env requises ────────────────────────────────────────────────
 *   RELAYER_PK                  — clé privée du wallet relayer (0x...)
 *   NEXT_PUBLIC_INSECT_STORAGE  — adresse InsectImageStorageV2
 *   RELAYER_RPC_URL             — RPC Base (recommandé : Alchemy, sans limite gas)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import nftMetadata from "@/data/nft_metadata_clean.json";
import gifProfiles from "@/data/gif_profiles_smart_colors.json";
import fs from "fs";
import path from "path";

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
  metrics: {
    brightness: number;
    saturation: number;
    colorfulness: number;
    contrast: number;
    sharpness: number;
    entropy: number;
  };
  hsv: { mean: number[] };
  family: string;
}

// ─── Lookup GIF profiles par insectKey (filename sans .gif) ─────────────────

const gifProfileMap = (() => {
  const map = new Map<string, GifProfile>();
  for (const entries of Object.values(
    (gifProfiles as { metadata: unknown; families: Record<string, GifProfile[]> }).families
  )) {
    for (const entry of entries) {
      const key = entry.filename.replace(/\.gif$/i, "");
      map.set(key, entry);
    }
  }
  return map;
})();

// ─── Formatage nombres ────────────────────────────────────────────────────────

function fmtPixels(n: number): string {
  // 60000 → "60 000", 30000 → "30 000"
  return n.toLocaleString("fr-FR");
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(2)}MB`;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Construire attrsFragment complet (34 traits statiques) ─────────────────
//
// Retourne une chaîne JSON sans crochets :
//   '{"trait_type":"Stade","value":"Larve"},{"trait_type":"Type","value":"Larve"},...'
//
function buildAttrsFragment(insectKey: string, meta: InsectData): string {
  const parts: string[] = [];

  const push = (t: string, v: unknown) =>
    parts.push(
      `{"trait_type":${JSON.stringify(t)},"value":${JSON.stringify(v)}}`
    );

  // ── 1. Attributs morphologiques issus de nft_metadata_clean.json ─────────
  //     (on exclut "Niveau" — il est live dans InsectImageStorageV2)
  for (const attr of meta.attributes ?? []) {
    if (attr.trait_type !== "Niveau") {
      push(attr.trait_type, attr.value);
    }
  }

  // ── 2. Identité de l'insecte ─────────────────────────────────────────────
  if (meta.family_name) push("Famille", meta.family_name);
  push("Sprite", insectKey);                               // ex: "VulpinSpectraAlpha"
  if (meta.display_name) push("Insect name", meta.display_name); // ex: "VulpinSpectraAlpha | Vulpin"
  if (meta.total_in_family != null) push("TotalFamille", meta.total_in_family);

  // ── 3. Données visuelles depuis gif_profiles_smart_colors.json ───────────
  const profile = gifProfileMap.get(insectKey);
  if (profile) {
    // Top 5 couleurs dominantes (skip #000000 qui est le fond noir)
    const colors = (profile.dominant_colors?.hex ?? []).filter(
      (h: string) => h.toLowerCase() !== "#000000"
    );
    for (let i = 0; i < 5; i++) {
      push(`Couleur${i + 1}`, colors[i] ?? "#000000");
    }

    // Métriques HSV / visuelles
    const hue = profile.hsv?.mean?.[0] ?? 0;
    push("Teinte",     r1(hue));                           // degrés HSV
    push("Saturation", r1(profile.metrics.saturation * 100)); // %
    push("Luminosité", r1(profile.metrics.brightness * 100)); // %
    push("Colorful",   r1(profile.metrics.colorfulness * 100)); // %
    push("Contraste",  r1(profile.metrics.contrast));
    push("Nettete",    r1(profile.metrics.sharpness));
    push("Entropie",   r1(profile.metrics.entropy));

    // Stats GIF
    push("Frames",     profile.frame_count);
    push("Pixels",     fmtPixels(profile.total_pixels_analyzed)); // "60 000"
    push("TailleBytes", fmtBytes(profile.gif_info.size_bytes));   // "88.1KB"
  }

  return parts.join(",");
}

// ─── ABI InsectImageStorageV2 ────────────────────────────────────────────────

const STORAGE_ABI = [
  // ── View ──
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "hasInsectImage",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "insectKey", type: "string" }],
    name: "getChunkCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ── Chunked upload (V2) ──
  {
    inputs: [
      { internalType: "string", name: "insectKey", type: "string" },
      { internalType: "string", name: "chunk",     type: "string" },
    ],
    name: "appendInsectChunk",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "insectKey",     type: "string" },
      { internalType: "string", name: "attrsFragment", type: "string" },
      { internalType: "string", name: "lore",          type: "string" },
    ],
    name: "finalizeInsect",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ─── Taille d'un chunk ────────────────────────────────────────────────────────
//
// 20 000 caractères base64 ASCII = 20 000 bytes.
// Gas estimé : ceil(20000/32) × 20 000 (SSTORE) + 20000 × 16 (calldata) + ~400 K overhead
//            = 625 × 20 000 + 320 000 + 400 000
//            = 12 500 000 + 320 000 + 400 000 ≈ 13.2 M gas
// Bien sous la limite Base ~25 M. ✓
//
// Taille des GIFs (worst case) :
//   Korvus/Capella/Scyth  ~30-34 KB → base64 ~41-46 KB  →  3 chunks
//   Culexix/Gravix        ~38-43 KB → base64 ~51-58 KB  →  3 chunks
//   Sirius                ~48-49 KB → base64 ~65 KB      →  4 chunks
//   Vulpin                ~85-87 KB → base64 ~114-116 KB →  6 chunks
//   Vega                 ~164-167 KB → base64 ~219-223 KB → 11 chunks
//   Kapetyn              ~180-183 KB → base64 ~240-245 KB → 13 chunks
//
const CHUNK_SIZE = 20_000; // caractères (= bytes pour base64 ASCII)

// ─── RPCs à essayer en séquence ──────────────────────────────────────────────
function buildRpcList(primary?: string): string[] {
  const candidates = [
    primary,
    "https://base.llamarpc.com",
    "https://1rpc.io/base",
    "https://mainnet.base.org",
  ].filter(Boolean) as string[];
  return candidates.filter((v, i, a) => a.indexOf(v) === i);
}

function isGasCapError(msg: string): boolean {
  return (
    msg.includes("exceeds max transaction gas limit") ||
    msg.includes("gas limit exceeded") ||
    msg.includes("max transaction gas")
  );
}

function isNetworkError(msg: string): boolean {
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("could not detect network") ||
    msg.includes("could not connect") ||
    msg.includes("SERVER_ERROR") ||
    msg.includes("server response 5") ||
    msg.includes("error code: 5")
  );
}

// ─── Helper : envoie une transaction avec fallback multi-RPC ─────────────────

interface SendResult {
  txHash: string;
  rpcUrl: string;
}

async function sendWithFallback(
  rpcList:              string[],
  relayerPk:            string,
  insectStorageAddress: string,
  gasLimit:             bigint,
  txFn:                 (contract: Contract) => Promise<{ wait: () => Promise<{ hash: string }> }>,
  label:                string
): Promise<SendResult> {
  const errors: string[] = [];

  for (const rpcUrl of rpcList) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const wallet   = new Wallet(relayerPk, provider);
      const contract = new Contract(insectStorageAddress, STORAGE_ABI, wallet);

      const tx      = await txFn(contract);
      const receipt = await tx.wait();

      console.log(`[upload-insect-relayer] ✅ ${label} → ${receipt.hash} (via ${rpcUrl})`);
      return { txHash: receipt.hash, rpcUrl };

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      // Déjà stocké — pas une erreur
      if (msg.includes("Already finalized") || msg.includes("Already uploaded")) {
        console.log(`[upload-insect-relayer] ℹ️  ${label} déjà présent (${rpcUrl})`);
        return { txHash: "already", rpcUrl };
      }

      // Fonds insuffisants — fatal, pas la peine d'essayer d'autres RPCs
      if (msg.includes("insufficient funds") || msg.includes("INSUFFICIENT_FUNDS")) {
        throw new Error(`INSUFFICIENT_FUNDS:${msg}`);
      }

      if (isGasCapError(msg)) {
        console.warn(`[upload-insect-relayer] ⚠️  ${rpcUrl} → cap gas pour ${label}, essai suivant…`);
        errors.push(`${rpcUrl}: gas cap`);
        continue;
      }
      if (isNetworkError(msg)) {
        console.warn(`[upload-insect-relayer] ⚠️  ${rpcUrl} → réseau (${msg.slice(0, 80)}), essai suivant…`);
        errors.push(`${rpcUrl}: network`);
        continue;
      }

      // Autre erreur non récupérable
      console.error(`[upload-insect-relayer] ❌ ${rpcUrl} [${label}]:`, e);
      throw e;
    }
  }

  throw new Error(`GAS_CAP_ALL_RPCS:${errors.join("; ")}`);
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { insectKey } = req.body as { insectKey?: string };

  if (!insectKey || typeof insectKey !== "string" || insectKey.trim().length === 0) {
    return res.status(400).json({ error: "insectKey requis" });
  }

  // Validation : l'insecte doit être connu dans notre catalogue
  const meta = (nftMetadata as unknown as Record<string, InsectData>)[insectKey];
  if (!meta) {
    return res.status(404).json({ error: `Insecte inconnu : ${insectKey}` });
  }

  const insectStorageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE;
  const relayerPk            = process.env.RELAYER_PK;

  if (!insectStorageAddress || !relayerPk) {
    return res.status(500).json({
      error: "Relayer non configuré (NEXT_PUBLIC_INSECT_STORAGE / RELAYER_PK manquants)",
    });
  }

  const primaryRpc = process.env.RELAYER_RPC_URL ?? "https://mainnet.base.org";
  const rpcList    = buildRpcList(primaryRpc);

  try {
    // ── 1. Vérif solde relayer (via RPC primaire) ───────────────────────────
    const primaryProvider = new JsonRpcProvider(primaryRpc);
    const primaryWallet   = new Wallet(relayerPk, primaryProvider);

    const balance    = await primaryProvider.getBalance(primaryWallet.address);
    const MIN_BALANCE = 500_000_000_000_000n; // 0.0005 ETH
    if (balance < MIN_BALANCE) {
      console.error(
        `[upload-insect-relayer] ❌ Solde insuffisant: ${primaryWallet.address} = ${balance} wei`
      );
      return res.status(503).json({
        error: `Relayer wallet vide (${primaryWallet.address}). Envoyez au moins 0.001 ETH sur Base.`,
        relayerAddress: primaryWallet.address,
        currentBalanceWei: balance.toString(),
      });
    }

    // ── 2. Vérif on-chain : déjà finalisé ? ────────────────────────────────
    const primaryContract = new Contract(insectStorageAddress, STORAGE_ABI, primaryWallet);
    const alreadyExists   = await primaryContract.hasInsectImage(insectKey) as boolean;
    if (alreadyExists) {
      return res.status(200).json({ status: "exists" });
    }

    // ── 3. Lire le GIF depuis public/insects/ ──────────────────────────────
    const rel       = (meta.image as string).replace(/\\/g, "/");
    const gifPath   = path.join(process.cwd(), "public", "insects", rel);
    const gifBuffer = fs.readFileSync(gifPath);

    // ── 4. Construire la data URI (GIF base64 direct, sans wrapper SVG) ────
    const imageDataUri = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    const totalBytes   = Buffer.byteLength(imageDataUri, "utf8");

    // ── 5. Attributs statiques complets (34 traits) ────────────────────────
    const attrsFragment = buildAttrsFragment(insectKey, meta);
    const lore          = meta.lore ?? "";

    // ── 6. Découper en chunks de CHUNK_SIZE caractères ─────────────────────
    const chunks: string[] = [];
    for (let i = 0; i < imageDataUri.length; i += CHUNK_SIZE) {
      chunks.push(imageDataUri.slice(i, i + CHUNK_SIZE));
    }

    console.log(
      `[upload-insect-relayer] Uploading ${insectKey}` +
      ` GIF=${Math.round(gifBuffer.length / 1024)}KB` +
      ` dataUri=${Math.round(totalBytes / 1024)}KB` +
      ` chunks=${chunks.length} × ${CHUNK_SIZE}chars` +
      ` attrs=${attrsFragment.length}chars` +
      ` lore=${lore.length}chars`
    );

    // ── 7. Déterminer à partir de quel chunk reprendre (upload partiel) ────
    let startChunk = 0;
    try {
      const existingCount = Number(await primaryContract.getChunkCount(insectKey) as bigint);
      if (existingCount > 0 && existingCount < chunks.length) {
        console.log(
          `[upload-insect-relayer] Reprise depuis chunk ${existingCount}/${chunks.length} pour ${insectKey}`
        );
        startChunk = existingCount;
      }
    } catch (_) {
      // getChunkCount peut ne pas exister sur une ancienne adresse de contrat — on ignore
    }

    // ── 8. Envoyer les chunks manquants ────────────────────────────────────
    const txHashes: string[] = [];
    let   preferredRpc = primaryRpc; // mémoriser le RPC qui a fonctionné

    for (let i = startChunk; i < chunks.length; i++) {
      const chunk      = chunks[i];
      const chunkBytes = Buffer.byteLength(chunk, "utf8");
      // ~700 gas/byte (SSTORE + calldata) + 400K overhead, cap 18M (20KB chunk → ~13.2M réel)
      const gasLimit   = BigInt(Math.min(Math.ceil(chunkBytes * 700 + 400_000), 18_000_000));

      const orderedRpcs = [
        preferredRpc,
        ...rpcList.filter((r) => r !== preferredRpc),
      ];

      const result = await sendWithFallback(
        orderedRpcs,
        relayerPk,
        insectStorageAddress,
        gasLimit,
        (contract) =>
          (contract.appendInsectChunk as any)(insectKey, chunk, { gasLimit }),
        `chunk ${i + 1}/${chunks.length}`
      );

      if (result.txHash !== "already") {
        txHashes.push(result.txHash);
        preferredRpc = result.rpcUrl;
      }
    }

    // ── 9. Finaliser ───────────────────────────────────────────────────────
    // Gas pour finalizeInsect avec attrsFragment complet (~34 traits ≈ 1500 chars)
    // + lore (~200 chars) → total ~1700 bytes de strings
    // SSTORE: ceil(1700/32) × 20000 = ~1 062 500 gas + 100K overhead = ~1.2M
    // On prend 2M pour avoir une marge confortable.
    const finalizeGasLimit = 2_000_000n;

    const orderedRpcs = [
      preferredRpc,
      ...rpcList.filter((r) => r !== preferredRpc),
    ];

    const finalizeResult = await sendWithFallback(
      orderedRpcs,
      relayerPk,
      insectStorageAddress,
      finalizeGasLimit,
      (contract) =>
        (contract.finalizeInsect as any)(insectKey, attrsFragment, lore, {
          gasLimit: finalizeGasLimit,
        }),
      "finalizeInsect"
    );

    if (finalizeResult.txHash !== "already") {
      txHashes.push(finalizeResult.txHash);
    }

    console.log(
      `[upload-insect-relayer] ✅ ${insectKey} uploadé en ${txHashes.length} transactions`
    );

    return res.status(200).json({
      status: "uploaded",
      txHashes,
      chunks: chunks.length,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.startsWith("INSUFFICIENT_FUNDS:")) {
      const primaryProvider = new JsonRpcProvider(primaryRpc);
      const primaryWallet   = new Wallet(relayerPk!, primaryProvider);
      return res.status(503).json({
        error: `Relayer wallet : fonds insuffisants. Adresse : ${primaryWallet.address}. Envoyez 0.001+ ETH sur Base.`,
      });
    }

    if (msg.startsWith("GAS_CAP_ALL_RPCS:")) {
      console.error("[upload-insect-relayer] ❌ Tous les RPCs ont rejeté (cap gas)");
      return res.status(503).json({
        error:
          "Tous les RPCs publics ont rejeté la transaction (limite gas). " +
          "Solution : inscrivez-vous gratuitement sur https://alchemy.com, créez une app " +
          '"Base Mainnet", copiez l\'URL HTTPS et définissez ' +
          "RELAYER_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<votre_clé> dans votre .env",
        details: msg.slice("GAS_CAP_ALL_RPCS:".length),
      });
    }

    console.error("[upload-insect-relayer] ❌", e);
    return res.status(500).json({ error: msg });
  }
}
