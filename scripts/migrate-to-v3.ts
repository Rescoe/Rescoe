/**
 * migrate-to-v3.ts
 *
 * Migre tous les insectes de InsectImageStorageV2 vers InsectImageStorageV3.
 * Lance le relayer V3 pour chaque insecte dans nft_metadata_clean.json.
 *
 * Usage :
 *   npx ts-node scripts/migrate-to-v3.ts
 *   (ou depuis le dashboard admin → bouton "Migrer vers V3")
 *
 * Variables d'env requises :
 *   NEXT_PUBLIC_INSECT_STORAGE_V3  — adresse du contrat V3 déployé
 *   RELAYER_PK                     — clé privée du relayer
 *   RELAYER_RPC_URL                — RPC Base (Alchemy recommandé)
 */

import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ─── Import des données ───────────────────────────────────────────────────────

const nftMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/data/nft_metadata_clean.json"), "utf8")
) as Record<string, {
  level: number;
  display_name?: string;
  family_name?: string;
  image: string;
  lore?: string;
  total_in_family?: number;
  attributes?: Array<{ trait_type: string; value: unknown }>;
}>;

const gifProfiles = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/data/gif_profiles_smart_colors.json"), "utf8")
) as { families: Record<string, Array<{
  filename: string;
  frame_count: number;
  total_pixels_analyzed: number;
  gif_info: { size_bytes: number };
  dominant_colors: { hex: string[] };
  metrics: { brightness: number; saturation: number; colorfulness: number; contrast: number; sharpness: number; entropy: number };
  hsv: { mean: number[] };
}>> };

// ─── ABI V3 minimal ───────────────────────────────────────────────────────────

const STORAGE_V3_ABI = [
  { inputs: [{ type: "bytes32", name: "imageHash" }, { type: "string", name: "chunk" }], name: "uploadImageChunk", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "bytes32", name: "imageHash" }], name: "finalizeImage", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "bytes32", name: "imageHash" }], name: "hasImage", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "bytes32", name: "imageHash" }], name: "getImageChunkCount", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "string", name: "insectKey" }, { type: "string", name: "displayName" }, { type: "string", name: "family" }, { type: "bytes32", name: "imageHash" }, { type: "string", name: "attrsFragment" }, { type: "string", name: "lore" }], name: "registerInsect", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "string", name: "insectKey" }], name: "isInsectRegistered", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 20_000;

function computeImageHash(imageDataUri: string): string {
  return keccak256(toUtf8Bytes(imageDataUri));
}

function buildAttrsFragment(insectKey: string, meta: typeof nftMetadata[string]): string {
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

  const profileMap = new Map<string, any>();
  for (const entries of Object.values(gifProfiles.families)) {
    for (const e of entries) profileMap.set(e.filename.replace(/\.gif$/i, ""), e);
  }

  const profile = profileMap.get(insectKey);
  if (profile) {
    const colors = (profile.dominant_colors?.hex ?? []).filter((h: string) => h.toLowerCase() !== "#000000");
    for (let i = 0; i < 5; i++) push(`Couleur${i + 1}`, colors[i] ?? "#000000");
    const hue = profile.hsv?.mean?.[0] ?? 0;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    push("Teinte",     r1(hue));
    push("Saturation", r1(profile.metrics.saturation * 100));
    push("Luminosité", r1(profile.metrics.brightness * 100));
    push("Colorful",   r1(profile.metrics.colorfulness * 100));
    push("Contraste",  r1(profile.metrics.contrast));
    push("Nettete",    r1(profile.metrics.sharpness));
    push("Entropie",   r1(profile.metrics.entropy));
    push("Frames",     profile.frame_count);
    const px = profile.total_pixels_analyzed;
    push("Pixels",     px.toLocaleString("fr-FR"));
    const bytes = profile.gif_info.size_bytes;
    const kb = bytes / 1024;
    push("TailleBytes", kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb/1024).toFixed(2)}MB`);
  }

  return parts.join(",");
}

// ─── Migration ────────────────────────────────────────────────────────────────

async function migrate() {
  const storageAddress = process.env.NEXT_PUBLIC_INSECT_STORAGE_V3;
  const relayerPk      = process.env.RELAYER_PK;
  const rpcUrl         = process.env.RELAYER_RPC_URL ?? "https://mainnet.base.org";

  if (!storageAddress || !relayerPk) {
    console.error("❌ NEXT_PUBLIC_INSECT_STORAGE_V3 ou RELAYER_PK manquant");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet   = new Wallet(relayerPk, provider);
  const contract = new Contract(storageAddress, STORAGE_V3_ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Relayer : ${wallet.address} — solde : ${Number(balance) / 1e18} ETH`);

  const allKeys = Object.keys(nftMetadata);
  console.log(`\n${allKeys.length} insectes à migrer vers InsectImageStorageV3\n`);

  // Tracker les images déjà uploadées (partage entre insectes)
  const uploadedImages = new Set<string>();
  let skipped = 0, uploaded = 0, shared = 0;

  for (const [index, insectKey] of allKeys.entries()) {
    const meta = nftMetadata[insectKey];
    const prefix = `[${(index+1).toString().padStart(3, " ")}/${allKeys.length}] ${insectKey}`;

    // Vérif si déjà migré
    const alreadyDone = await contract.isInsectRegistered(insectKey) as boolean;
    if (alreadyDone) {
      console.log(`${prefix} — ✅ déjà migré`);
      skipped++;
      continue;
    }

    // Lire le GIF
    const rel     = meta.image.replace(/\\/g, "/");
    const gifPath = path.join(__dirname, "../public/insects", rel);
    if (!fs.existsSync(gifPath)) {
      console.warn(`${prefix} — ⚠️  GIF introuvable : ${gifPath}`);
      continue;
    }

    const gifBuffer    = fs.readFileSync(gifPath);
    const imageDataUri = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    const imageHashHex = computeImageHash(imageDataUri) as `0x${string}`;

    // Upload image si nouvelle
    const imageAlreadyExists = await contract.hasImage(imageHashHex) as boolean;
    if (!imageAlreadyExists && !uploadedImages.has(imageHashHex)) {
      const chunks: string[] = [];
      for (let i = 0; i < imageDataUri.length; i += CHUNK_SIZE) {
        chunks.push(imageDataUri.slice(i, i + CHUNK_SIZE));
      }

      // Reprendre depuis le bon chunk
      let startChunk = 0;
      try {
        const count = Number(await contract.getImageChunkCount(imageHashHex) as bigint);
        if (count > 0 && count < chunks.length) startChunk = count;
      } catch {}

      for (let i = startChunk; i < chunks.length; i++) {
        const gasLimit = BigInt(Math.min(Math.ceil(chunks[i].length * 700 + 400_000), 18_000_000));
        const tx       = await (contract.uploadImageChunk as any)(imageHashHex, chunks[i], { gasLimit });
        await tx.wait();
        process.stdout.write(`  chunk ${i+1}/${chunks.length} ✓\r`);
      }

      const tx = await (contract.finalizeImage as any)(imageHashHex, { gasLimit: 500_000n });
      await tx.wait();
      uploadedImages.add(imageHashHex);
      console.log(`${prefix} — image uploadée (${Math.round(gifBuffer.length/1024)}KB)`);
    } else {
      shared++;
      console.log(`${prefix} — image partagée (${imageHashHex.slice(0, 10)}…)`);
    }

    // Enregistrer l'insecte
    const attrsFragment = buildAttrsFragment(insectKey, meta);
    const tx = await (contract.registerInsect as any)(
      insectKey,
      meta.display_name ?? insectKey,
      meta.family_name ?? "",
      imageHashHex,
      attrsFragment,
      meta.lore ?? "",
      { gasLimit: 3_000_000n }
    );
    await tx.wait();

    uploaded++;
    console.log(`${prefix} — ✅ enregistré`);
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Migration terminée :`);
  console.log(`  Déjà présents  : ${skipped}`);
  console.log(`  Uploadés       : ${uploaded}`);
  console.log(`  Images partagées: ${shared}`);
  console.log(`────────────────────────────────────────\n`);
}

migrate().catch(console.error);
