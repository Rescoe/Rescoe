/**
 * migrate-to-v3.js
 *
 * Migre UNIQUEMENT les insectes deja mintes vers InsectImageStorageV3.
 *
 * Logique :
 *   1. Lire getTotalMinted() sur AdhesionRescoe
 *   2. Pour chaque token existant : lire insectKeys(tokenId) + evolutionHistory
 *   3. Collecter les insect keys uniques referencies on-chain
 *   4. Uploader uniquement ceux-la dans V3 (pas l'ensemble du catalogue)
 *
 * Usage :
 *   node scripts/migrate-to-v3.js
 *
 * Variables d'env requises :
 *   NEXT_PUBLIC_INSECT_STORAGE_V3  — adresse du contrat V3 deploye
 *   NEXT_PUBLIC_RESCOE_ADHERENTS   — adresse AdhesionRescoe
 *   RELAYER_PK                     — cle privee du relayer
 *   RELAYER_RPC_URL                — RPC Base
 */

"use strict";

const path   = require("path");
const fs     = require("fs");
const ethers = require("ethers");

// Charger le .env sans dotenv
function loadEnvFile(filePath) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {}
}
loadEnvFile(path.join(__dirname, "../.env.local"));
loadEnvFile(path.join(__dirname, "../.env"));

// Catalogue local (pour lire les GIFs et attrs)
const nftMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/data/nft_metadata_clean.json"), "utf8")
);
const gifProfiles = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../src/data/gif_profiles_smart_colors.json"), "utf8")
);

// Profils GIF
const profileMap = new Map();
for (const entries of Object.values(gifProfiles.families || {})) {
  for (const e of entries) profileMap.set(e.filename.replace(/\.gif$/i, ""), e);
}

// ─── ABI minimal AdhesionRescoe ──────────────────────────────────────────────

const ADHESION_ABI = [
  { inputs: [], name: "getTotalMinted", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "uint256", name: "tokenId" }], name: "ownerOf", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ type: "uint256", name: "tokenId" }], name: "insectKeys", outputs: [{ type: "string" }], stateMutability: "view", type: "function" },
  {
    inputs: [{ type: "uint256", name: "tokenId" }, { type: "uint256", name: "index" }],
    name: "evolutionHistory",
    outputs: [
      { type: "bytes32", name: "insectKeyHash" },
      { type: "uint64",  name: "timestamp" },
      { type: "uint8",   name: "fromLevel" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // insectKeys est indexe par tokenId, retourne le nom de l'insecte actuel
  // Certains contrats exposent aussi displayNames ou insectFamilies
];

// ─── ABI minimal InsectImageStorageV2 ────────────────────────────────────────

const STORAGE_V2_ABI = [
  { inputs: [{ type: "string", name: "insectKey" }], name: "hasInsectImage", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
];

// ─── Lire tous les insectes presents dans V2 ─────────────────────────────────
// Interroge V2 en parallele (batches de 20) pour chaque cle du catalogue.
// Plus fiable que lire par tokenId (les IDs ne commencent pas forcement a 0).

async function collectFromV2(v2, allKeys) {
  const presentInV2 = new Set();
  const BATCH = 20;
  console.log(`Verification dans InsectImageStorageV2 (${allKeys.length} cles, batches de ${BATCH})...`);

  for (let i = 0; i < allKeys.length; i += BATCH) {
    const batch = allKeys.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(key => v2.hasInsectImage(key).catch(() => false))
    );
    results.forEach((has, j) => { if (has) presentInV2.add(batch[j]); });
    process.stdout.write(`\r  ${Math.min(i + BATCH, allKeys.length)}/${allKeys.length} verifies... (${presentInV2.size} trouves)`);
  }
  console.log();
  return presentInV2;
}

// ─── ABI minimal InsectImageStorageV3 ────────────────────────────────────────

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

function computeImageHash(imageDataUri) {
  return ethers.keccak256(ethers.toUtf8Bytes(imageDataUri));
}

function r1(n) { return Math.round(n * 10) / 10; }
function fmtPixels(n) { return n.toLocaleString("fr-FR"); }
function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + "B";
  const kb = bytes / 1024;
  return kb < 1024 ? kb.toFixed(1) + "KB" : (kb / 1024).toFixed(2) + "MB";
}

function buildAttrsFragment(insectKey, meta) {
  const parts = [];
  const push = (t, v) => parts.push(`{"trait_type":${JSON.stringify(t)},"value":${JSON.stringify(v)}}`);
  for (const attr of meta.attributes || []) {
    if (attr.trait_type !== "Niveau") push(attr.trait_type, attr.value);
  }
  if (meta.family_name)           push("Famille", meta.family_name);
  push("Sprite", insectKey);
  if (meta.display_name)          push("Insect name", meta.display_name);
  if (meta.total_in_family != null) push("TotalFamille", meta.total_in_family);
  const profile = profileMap.get(insectKey);
  if (profile) {
    const colors = (profile.dominant_colors?.hex || []).filter(h => h.toLowerCase() !== "#000000");
    for (let i = 0; i < 5; i++) push(`Couleur${i + 1}`, colors[i] || "#000000");
    push("Teinte",     r1(profile.hsv?.mean?.[0] || 0));
    push("Saturation", r1(profile.metrics.saturation * 100));
    push("Luminosite", r1(profile.metrics.brightness * 100));
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

// Index inverse : keccak256(insectKey) -> insectKey (construit une seule fois)
function buildHashIndex() {
  const index = new Map();
  for (const key of Object.keys(nftMetadata)) {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(key)).toLowerCase();
    index.set(hash, key);
  }
  return index;
}

// ─── Etape 1 : collecter les insect keys mintees on-chain ────────────────────

async function collectMintedInsectKeys(adhesion, totalMinted, hashIndex) {
  const mintedKeys = new Set();
  // On cherche dans une plage large (totalMinted*2 + 100) car les token IDs
  // ne commencent pas forcement a 0 (certains contrats partent de 1)
  const searchRange = Math.max(totalMinted * 2 + 100, 200);
  const BATCH = 10;
  let found = 0;

  console.log(`Recherche des tokens (plage 0..${searchRange})...`);

  for (let i = 0; i <= searchRange && found < totalMinted; i += BATCH) {
    const ids = Array.from({ length: Math.min(BATCH, searchRange - i + 1) }, (_, j) => i + j);

    const results = await Promise.allSettled(ids.map(async (tokenId) => {
      try {
        const owner = await adhesion.ownerOf(tokenId);
        if (!owner || owner === "0x0000000000000000000000000000000000000000") return null;

        found++;
        // Insecte actuel
        const currentKey = await adhesion.insectKeys(tokenId).catch(() => "");
        if (currentKey) mintedKeys.add(currentKey);

        // Historique (insectes des niveaux precedents)
        for (let h = 0; h < 4; h++) {
          try {
            const snap    = await adhesion.evolutionHistory(tokenId, h);
            const hashHex = snap.insectKeyHash.toLowerCase();
            const key     = hashIndex.get(hashHex);
            if (key) mintedKeys.add(key);
          } catch { break; }
        }
        return tokenId;
      } catch { return null; }
    }));

    const foundIds = results
      .filter(r => r.status === "fulfilled" && r.value !== null)
      .map(r => r.value);
    if (foundIds.length) process.stdout.write(`\r  Tokens trouves: ${foundIds.join(", ")} | total: ${found}/${totalMinted}    `);
  }

  console.log(`\r  ${found}/${totalMinted} tokens lus.                              `);
  return mintedKeys;
}

// ─── Migration ─────────────────────────────────────────────────────────────────

async function migrate() {
  const storageV3Address = process.env.NEXT_PUBLIC_INSECT_STORAGE_V3;
  const storageV2Address = process.env.NEXT_PUBLIC_INSECT_STORAGE;   // V2 = source de verite
  const adhesionAddress  = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;
  const relayerPk        = process.env.RELAYER_PK;
  const rpcUrl           = process.env.RELAYER_RPC_URL || "https://mainnet.base.org";

  if (!storageV3Address) {
    console.error("ERREUR : NEXT_PUBLIC_INSECT_STORAGE_V3 manquant dans .env");
    console.error("  -> Deployez InsectImageStorageV3 depuis le DeployStudio");
    console.error("  -> Ajoutez : NEXT_PUBLIC_INSECT_STORAGE_V3=0x<adresse> dans .env");
    console.error("  -> (Ne pas confondre avec NEXT_PUBLIC_INSECT_STORAGE = V2)");
    process.exit(1);
  }
  if (!adhesionAddress) { console.error("ERREUR : NEXT_PUBLIC_RESCOE_ADHERENTS manquant"); process.exit(1); }
  if (!relayerPk)       { console.error("ERREUR : RELAYER_PK manquant");                  process.exit(1); }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(relayerPk, provider);
  const v3       = new ethers.Contract(storageV3Address, STORAGE_V3_ABI, wallet);
  const adhesion = new ethers.Contract(adhesionAddress,  ADHESION_ABI,   provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Relayer  : ${wallet.address}`);
  console.log(`Solde    : ${(Number(balance) / 1e18).toFixed(6)} ETH`);
  console.log(`V3       : ${storageV3Address}`);
  console.log(`V2       : ${storageV2Address || "non defini"}`);
  console.log(`Adhesion : ${adhesionAddress}`);
  console.log(`RPC      : ${rpcUrl}\n`);

  // Etape 1 : combien de tokens existent ?
  const totalMinted = Number(await adhesion.getTotalMinted());
  console.log(`Total minte : ${totalMinted} tokens\n`);

  // Index inverse hash -> insectKey (construit une seule fois, O(1) par lookup)
  const hashIndex  = buildHashIndex();
  const allCatalogKeys = Object.keys(nftMetadata);

  // Etape 2a : collecter les insect keys via lecture des tokens on-chain
  let mintedKeys = await collectMintedInsectKeys(adhesion, totalMinted, hashIndex);

  // Etape 2b : si 0 trouve (token IDs hors plage), fallback sur V2 comme source de verite
  if (mintedKeys.size === 0 && storageV2Address) {
    console.log(`\nAucun insecte trouve via token IDs. Fallback : lecture de V2 (${storageV2Address})...`);
    const v2 = new ethers.Contract(storageV2Address, STORAGE_V2_ABI, provider);
    mintedKeys = await collectFromV2(v2, allCatalogKeys);
    console.log(`V2 contient ${mintedKeys.size} insecte(s).`);
  }
  console.log(`\n${mintedKeys.size} insect key(s) unique(s) references on-chain :`);
  for (const k of mintedKeys) console.log(`  - ${k}`);
  console.log();

  // Etape 3 : uploader uniquement les insectes mintes
  const uploadedImages = new Set();
  let skipped = 0, registered = 0, sharedImg = 0, unknown = 0;

  for (const insectKey of mintedKeys) {
    const meta = nftMetadata[insectKey];
    if (!meta) {
      console.warn(`  [WARN] ${insectKey} : absent du catalogue local -> skip`);
      unknown++;
      continue;
    }

    // Deja enregistre dans V3 ?
    const done = await v3.isInsectRegistered(insectKey);
    if (done) {
      console.log(`[OK] ${insectKey} -- deja dans V3`);
      skipped++;
      continue;
    }

    // Lire le GIF
    const rel     = meta.image.replace(/\\/g, "/");
    const gifPath = path.join(__dirname, "../public/insects", rel);
    if (!fs.existsSync(gifPath)) {
      console.warn(`[WARN] ${insectKey} : GIF introuvable (${gifPath})`);
      unknown++;
      continue;
    }

    const gifBuffer    = fs.readFileSync(gifPath);
    const imageDataUri = `data:image/gif;base64,${gifBuffer.toString("base64")}`;
    const imageHashHex = computeImageHash(imageDataUri);

    // Upload image si pas encore presente
    const imgExists = await v3.hasImage(imageHashHex);
    if (!imgExists && !uploadedImages.has(imageHashHex)) {
      const chunks = [];
      for (let i = 0; i < imageDataUri.length; i += CHUNK_SIZE) {
        chunks.push(imageDataUri.slice(i, i + CHUNK_SIZE));
      }

      let start = 0;
      try {
        const count = Number(await v3.getImageChunkCount(imageHashHex));
        if (count > 0 && count < chunks.length) start = count;
      } catch {}

      for (let i = start; i < chunks.length; i++) {
        const gas = BigInt(Math.min(Math.ceil(chunks[i].length * 700 + 400_000), 18_000_000));
        const tx  = await v3.uploadImageChunk(imageHashHex, chunks[i], { gasLimit: gas });
        await tx.wait();
        process.stdout.write(`\r  ${insectKey} chunk ${i + 1}/${chunks.length}...`);
      }
      const txF = await v3.finalizeImage(imageHashHex, { gasLimit: 500_000n });
      await txF.wait();
      uploadedImages.add(imageHashHex);
      console.log(`\r[UP] ${insectKey} -- image uploadee (${Math.round(gifBuffer.length / 1024)}KB)     `);
    } else {
      sharedImg++;
      console.log(`[SH] ${insectKey} -- image partagee (${imageHashHex.slice(0, 10)}...)`);
    }

    // Enregistrer l'insecte dans V3
    const attrsFragment = buildAttrsFragment(insectKey, meta);
    const txR = await v3.registerInsect(
      insectKey,
      meta.display_name || insectKey,
      meta.family_name  || "",
      imageHashHex,
      attrsFragment,
      meta.lore || "",
      { gasLimit: 3_000_000n }
    );
    await txR.wait();
    registered++;
    console.log(`[OK] ${insectKey} -- enregistre dans V3`);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Migration terminee :`);
  console.log(`  Tokens lus       : ${totalMinted}`);
  console.log(`  Insectes uniques : ${mintedKeys.size}`);
  console.log(`  Deja dans V3     : ${skipped}`);
  console.log(`  Enregistres      : ${registered}`);
  console.log(`  Images partagees : ${sharedImg}`);
  if (unknown > 0) console.log(`  Inconnus/skip    : ${unknown}`);
  console.log(`${"=".repeat(50)}\n`);
}

migrate().catch(err => {
  console.error("ERREUR FATALE :", err.message || err);
  process.exit(1);
});
