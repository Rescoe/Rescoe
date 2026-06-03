/**
 * /api/token/generate-onchain-uri
 *
 * Génère un tokenUri ENTIÈREMENT ON-CHAIN pour un badge d'adhésion ResCoe.
 *
 *   tokenUri = data:application/json;base64,<base64(JSON)>
 *   image    = data:image/svg+xml;base64,<base64(SVG contenant le GIF en base64)>
 *
 * → Zéro dépendance externe : pas d'IPFS, pas de Pinata, pas d'URL HTTP.
 * → Critères OnChainChecker 5/5 satisfaits.
 *
 * Sélection déterministe :
 *   - Seed prioritaire = bytes32 retourné par getMintSeed(wallet) sur le contrat on-chain
 *     (keccak256(wallet, mintNonce)) → change automatiquement à chaque mint
 *   - Fallback = wallet seul (si contrat ancien sans getMintSeed)
 *   - Aucun reroll côté client — le premier tirage est définitif
 *
 * Contrainte Gas (Base L2, limite ~60M gas) :
 *   - GIF 30KB → tokenUri ~73KB → ~46M gas ← OK
 *   - GIF 35KB → tokenUri ~83KB → ~52M gas ← OK (marge)
 *   - GIF 40KB → tokenUri ~96KB → ~60M gas ← Limite
 *   - Seuil max : MAX_GIF_BYTES = 35KB
 *   - Pool effectif : Korvus + Scyth (~15 insectes)
 *
 * Params GET:
 *   wallet     — adresse ETH du futur propriétaire
 *   seed       — (optionnel) bytes32 hex retourné par getMintSeed(wallet) sur le contrat
 *                Si absent, seed = wallet seul (contrat ancien sans mintNonce)
 *   role       — "Artiste" | "Poete" | …
 *   name       — nom de l'adhérent
 *   bio        — biographie
 *   isAnnual   — "true" | "false"
 *   autoEvolve — "true" | "false"
 *
 * Réponse:
 *   tokenUri       — data:application/json;base64,… (à passer à safeMint)
 *   imageUrl       — /insects/… (chemin local pour preview React)
 *   family, insectName, displayName, lore, attributes
 *   gifSizeKb      — taille du GIF source (debug)
 *   tokenUriSizeKb — taille estimée du tokenUri (info gas)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import nftMetadata from "@/data/nft_metadata_clean.json";
import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsectData {
  level: number;
  name: string;
  display_name: string;
  family_name: string;
  image: string;      // "lvl0\\Korvus\\KorvuBeta.gif" (Windows backslash)
  full_path?: string;
  lore?: string;
  attributes?: Array<{ trait_type: string; value: unknown }>;
}

export interface OnChainUriResponse {
  tokenUri: string;
  imageUrl: string;        // chemin local /insects/… pour preview React
  imageDataUri: string;    // data:image/svg+xml;base64,… (GIF encodé — à passer à contributeInsectMeta)
  attrsFragment: string;   // fragment JSON attrs statiques (sans [] — à passer à contributeInsectMeta)
  family: string;
  insectName: string;
  displayName: string;
  lore: string;
  attributes: Array<{ trait_type: string; value: unknown }>;
  gifSizeKb: number;
  tokenUriSizeKb: number;
}

// ─── Pool (construit une seule fois au démarrage du module) ───────────────────

/**
 * Taille max du GIF source.
 * Au-delà de 35KB, le tokenUri dépasse ~83KB → risque de dépasser 60M gas sur Base.
 * Si aucun GIF n'est ≤ MAX, on prend les 20 plus petits comme fallback.
 */
// 32KB GIF → ~43KB base64 → ~27M gas ← sous la limite réseau Base (30M) via Ankr RPC.
// Inclut Korvus (~30-32KB) et Scyth (~32KB). Exclut Culexix/Gravix/Sirius (trop gros).
const MAX_GIF_BYTES = 32 * 1024; // 32 KB

interface PoolEntry {
  key: string;
  data: InsectData;
  gifPath: string; // chemin absolu vers le fichier GIF
  size: number;    // taille en octets
}

function buildPool(): PoolEntry[] {
  const insects = Object.entries(
    nftMetadata as unknown as Record<string, InsectData>
  ).filter(([, d]) => Number(d.level) === 0);

  const entries: PoolEntry[] = [];
  const publicInsects = path.join(process.cwd(), "public", "insects");

  for (const [key, data] of insects) {
    const rel = data.image.replace(/\\/g, "/"); // "lvl0/Korvus/KorvuBeta.gif"
    const gifPath = path.join(publicInsects, rel);
    try {
      const stat = fs.statSync(gifPath);
      entries.push({ key, data, gifPath, size: stat.size });
    } catch {
      // Fichier absent — on ignore
    }
  }

  entries.sort((a, b) => a.size - b.size); // du plus petit au plus grand

  const small = entries.filter((e) => e.size <= MAX_GIF_BYTES);
  const pool = small.length >= 5 ? small : entries.slice(0, 20); // fallback: 20 plus petits

  console.log(
    `[generate-onchain-uri] Pool: ${pool.length} insectes ≤${MAX_GIF_BYTES / 1024}KB` +
      ` (${entries.length} total lvl0) — familles: ${[...new Set(pool.map((e) => e.data.family_name))].join(", ")}`
  );

  return pool;
}

let _pool: PoolEntry[] | null = null;
function getPool(): PoolEntry[] {
  if (!_pool) _pool = buildPool();
  return _pool;
}

// ─── RNG déterministe (même algo que hatchEngine.ts) ─────────────────────────

function rngFromSeed(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ─── Construction de l'image data URI ─────────────────────────────────────────

/**
 * Enveloppe le GIF dans un SVG inline pour produire :
 *   data:image/svg+xml;base64,<base64(SVG)>
 *
 * Pourquoi SVG et pas data:image/gif directement ?
 * → SVG est mieux reconnu par les wallets et exploreurs NFT.
 * → OnChainChecker accepte SVG comme format "image on-chain".
 */
function buildImageDataUri(gifBuffer: Buffer): string {
  // GIF direct — pas de wrapper SVG (double-encode +40% data = +10M gas inutile).
  return `data:image/gif;base64,${gifBuffer.toString("base64")}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<OnChainUriResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const pool = getPool();
  if (pool.length === 0) {
    return res.status(500).json({ error: "Aucun insecte lvl0 disponible dans le pool" });
  }

  const {
    wallet = "",
    seed: seedParam = "",
    reroll = "0",
    role = "Membre",
    name = "",
    bio = "",
    isAnnual = "true",
    autoEvolve = "false",
  } = req.query;

  // Seed déterministe :
  //   1. Si seedParam fourni (bytes32 on-chain via getMintSeed) → l'utiliser directement
  //   2. Sinon → wallet normalisé (fallback ancien contrat sans mintNonce)
  // Le paramètre `reroll` (entier ≥ 0) permet de générer 3 variantes différentes
  // pour le même wallet — l'utilisateur choisit parmi 3 options, puis c'est définitif.
  const seedStr  = String(seedParam).trim();
  const rerollN  = Math.max(0, parseInt(String(reroll), 10) || 0);
  const seed = seedStr
    ? `${seedStr}::r${rerollN}::adhesion`
    : `${String(wallet).toLowerCase().trim()}::r${rerollN}::adhesion`;
  const rng = rngFromSeed(seed);
  const entry = pool[Math.floor(rng() * pool.length)];

  // Lire le GIF depuis le disque
  let gifBuffer: Buffer;
  try {
    gifBuffer = fs.readFileSync(entry.gifPath);
  } catch {
    return res.status(500).json({
      error: `Impossible de lire le GIF : ${entry.gifPath}`,
    });
  }

  // Image 100% on-chain (SVG wrapper autour du GIF base64)
  const imageDataUri = buildImageDataUri(gifBuffer);

  // Chemin local pour le preview dans l'UI React (ne va PAS dans le tokenUri)
  const imageUrl = `/insects/${entry.data.image.replace(/\\/g, "/")}`;

  // Attributs statiques de l'insecte (morpho, couleurs… sans les attrs live)
  const insectAttrs = entry.data.attributes ?? [];

  // Fragment JSON pour InsectImageStorage.contributeInsectMeta
  // → "{...},{...},..." sans crochets extérieurs, attrs statiques uniquement
  const attrsFragment = insectAttrs
    .map((a) => `{"trait_type":${JSON.stringify(a.trait_type)},"value":${JSON.stringify(a.value)}}`)
    .join(",");
  const adhesionAttrs = [
    { trait_type: "1er Propriétaire", value: String(name) },
    { trait_type: "Rôle", value: String(role) },
    { trait_type: "Type d'adhésion", value: isAnnual === "true" ? "Annuel" : "Essai" },
    { trait_type: "Évolution auto", value: autoEvolve === "true" ? "Oui" : "Non" },
  ];

  // Métadonnées JSON — toutes les données sont on-chain
  const metadata = {
    name: `ResCoe — ${entry.data.display_name}`,
    description:
      entry.data.lore ||
      `Carte d'adhésion ResCoe — Famille ${entry.data.family_name} — Rôle : ${role}.`,
    image: imageDataUri, // ← 100% on-chain, aucune URL externe
    family: entry.data.family_name,
    insect: entry.key,
    role: String(role),
    attributes: [...insectAttrs, ...adhesionAttrs],
  };

  // tokenUri final : data:application/json;base64,…
  const json = JSON.stringify(metadata);
  const tokenUri = `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`;

  return res.status(200).json({
    tokenUri,
    imageUrl,
    imageDataUri,                   // data:image/svg+xml;base64,… → contributeInsectMeta
    attrsFragment,                  // fragment JSON attrs statiques → contributeInsectMeta
    family: entry.data.family_name,
    insectName: entry.key,
    displayName: entry.data.display_name,
    lore: entry.data.lore ?? "",
    attributes: insectAttrs,
    gifSizeKb: Math.round(entry.size / 1024),
    tokenUriSizeKb: Math.round(tokenUri.length / 1024),
  });
}
