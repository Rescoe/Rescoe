/* eslint-disable no-console */
/**
 * Récupération des sources Solidity depuis les build-info (Cas B de l'audit).
 *
 * Lecture seule sur contracts/artifacts/*. Écrit UNIQUEMENT dans
 *   audit-recovered-contracts/
 *
 * Pour chaque build-info :
 *   - écrit input.sources dans audit-recovered-contracts/build-info/<id>/<chemin source>
 *   - écrit settings.json (réglages solc d'origine)
 *   - vérifie keccak256(source) contre les `_metadata.json` Remix (preuve d'intégrité)
 *   - associe chaque artifact Remix (X.json) au build-info qui a produit son bytecode
 *     (égalité exacte du deployedBytecode, ou égalité hors suffixe CBOR metadata)
 * Puis écrit audit-recovered-contracts/MANIFEST.json.
 *
 * Usage: node scripts/audit/recover-sources.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { keccak256, toUtf8Bytes } = require("ethers");

const ROOT = path.resolve(__dirname, "..", "..");
const ART_DIR = path.join(ROOT, "contracts", "artifacts");
const BI_DIR = path.join(ART_DIR, "build-info");
const OUT_DIR = path.join(ROOT, "audit-recovered-contracts");

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const strip0x = (h) => (h || "").replace(/^0x/, "");

/** Retire le suffixe CBOR metadata (dernier 2 octets = longueur du CBOR). */
function stripCbor(hex) {
  const h = strip0x(hex);
  if (h.length < 4) return h;
  const len = parseInt(h.slice(-4), 16);
  const cut = (len + 2) * 2;
  if (!Number.isFinite(len) || cut >= h.length) return h;
  return h.slice(0, h.length - cut);
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function main() {
  // Ne détruit que NOTRE répertoire de sortie (jamais les artefacts d'origine).
  rmrf(path.join(OUT_DIR, "build-info"));
  fs.mkdirSync(path.join(OUT_DIR, "build-info"), { recursive: true });

  // ---- Artifacts Remix + métadonnées -------------------------------------
  const artifacts = [];
  for (const f of fs.readdirSync(ART_DIR)) {
    if (!f.endsWith(".json") || f.endsWith("_metadata.json")) continue;
    const name = f.replace(/\.json$/, "");
    const metaPath = path.join(ART_DIR, `${name}_metadata.json`);
    const art = JSON.parse(fs.readFileSync(path.join(ART_DIR, f), "utf8"));
    const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
    artifacts.push({
      name,
      file: `contracts/artifacts/${f}`,
      abiLength: (art.abi || []).length,
      creation: strip0x(art.data && art.data.bytecode && art.data.bytecode.object),
      deployed: strip0x(art.data && art.data.deployedBytecode && art.data.deployedBytecode.object),
      compilationTarget: meta && meta.settings && meta.settings.compilationTarget,
      metaSources: (meta && meta.sources) || {},
      metaSettings: meta && meta.settings,
    });
  }

  // ---- Build-info --------------------------------------------------------
  const manifest = {
    warning:
      "SOURCES RÉCUPÉRÉES depuis contracts/artifacts/build-info. Ce ne sont PAS nécessairement les dernières " +
      "sources métier (les .sol ne sont versionnés nulle part : *.sol est gitignoré, jamais committé). " +
      "Chaque source est rattachée à son build-info, et chaque artifact au build-info qui a produit son bytecode.",
    generatedBy: "scripts/audit/recover-sources.js",
    buildInfos: [],
    artifactToBuildInfo: {},
    unmatchedArtifacts: [],
  };

  for (const f of fs.readdirSync(BI_DIR).sort()) {
    if (!f.endsWith(".json")) continue;
    const raw = fs.readFileSync(path.join(BI_DIR, f));
    const bi = JSON.parse(raw.toString("utf8"));
    const id = bi.id;
    const outBase = path.join(OUT_DIR, "build-info", id);

    const sources = {};
    for (const [sp, s] of Object.entries(bi.input.sources)) {
      const dest = path.join(outBase, sp);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, s.content, "utf8");
      const k = keccak256(toUtf8Bytes(s.content));
      // Vérification d'intégrité contre toutes les métadonnées Remix qui citent ce chemin
      const checks = [];
      for (const a of artifacts) {
        const m = a.metaSources[sp];
        if (m) checks.push({ artifact: a.name, metadataKeccak: m.keccak256, match: m.keccak256 === k });
      }
      sources[sp] = {
        bytes: Buffer.byteLength(s.content, "utf8"),
        sha256: sha256(Buffer.from(s.content, "utf8")),
        keccak256: k,
        metadataChecks: checks,
        isThirdParty: sp.startsWith("@openzeppelin/"),
      };
    }
    fs.writeFileSync(
      path.join(outBase, "settings.json"),
      JSON.stringify(
        {
          buildInfoId: id,
          solcLongVersion: bi.solcLongVersion,
          language: bi.input.language,
          settings: bi.input.settings,
        },
        null,
        2
      )
    );

    // Contrats compilés par ce build-info (+ taille bytecode)
    const contracts = [];
    for (const [sp, cs] of Object.entries(bi.output.contracts || {})) {
      for (const [cn, c] of Object.entries(cs)) {
        const dep = strip0x(c.evm && c.evm.deployedBytecode && c.evm.deployedBytecode.object);
        const cre = strip0x(c.evm && c.evm.bytecode && c.evm.bytecode.object);
        if (!dep) continue; // interface/lib abstraite
        contracts.push({
          source: sp,
          contract: cn,
          abiLength: (c.abi || []).length,
          deployedBytes: dep.length / 2,
          creationBytes: cre.length / 2,
          deployedSha256: sha256(Buffer.from(dep, "hex")),
          deployedSha256NoMetadata: sha256(Buffer.from(stripCbor(dep), "hex")),
          creationSha256: sha256(Buffer.from(cre, "hex")),
        });
        // Association artifact <-> build-info
        for (const a of artifacts) {
          if (a.name !== cn) continue;
          const exact = a.deployed === dep;
          const noMeta = stripCbor(a.deployed) === stripCbor(dep);
          const creExact = a.creation === cre;
          if (exact || noMeta || creExact) {
            (manifest.artifactToBuildInfo[a.name] = manifest.artifactToBuildInfo[a.name] || []).push({
              buildInfoId: id,
              source: sp,
              deployedBytecodeExactMatch: exact,
              deployedBytecodeMatchIgnoringMetadata: noMeta,
              creationBytecodeExactMatch: creExact,
            });
          }
        }
      }
    }

    manifest.buildInfos.push({
      id,
      file: `contracts/artifacts/build-info/${f}`,
      fileSha256: sha256(raw),
      solcLongVersion: bi.solcLongVersion,
      settings: {
        optimizer: bi.input.settings.optimizer,
        viaIR: bi.input.settings.viaIR,
        evmVersion: bi.input.settings.evmVersion || "(défaut du compilateur)",
      },
      sourceCount: Object.keys(sources).length,
      businessSources: Object.keys(sources).filter((s) => !s.startsWith("@openzeppelin/")),
      sources,
      contracts,
    });
  }

  for (const a of artifacts) {
    if (!manifest.artifactToBuildInfo[a.name]) {
      manifest.unmatchedArtifacts.push({
        artifact: a.name,
        compilationTarget: a.compilationTarget,
        abiLength: a.abiLength,
        deployedBytes: a.deployed.length / 2,
        reason: "aucun build-info ne produit ce bytecode (sources non récupérables)",
      });
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "MANIFEST.json"), JSON.stringify(manifest, null, 2));

  // ---- Résumé console ----------------------------------------------------
  console.log("== build-info ==");
  for (const b of manifest.buildInfos) {
    console.log(`${b.id}  solc=${b.solcLongVersion}  business=[${b.businessSources.join(", ")}]`);
    console.log("   contrats:", b.contracts.map((c) => `${c.contract}(${c.deployedBytes}B)`).join(", "));
    const bad = Object.entries(b.sources).filter(([, s]) => s.metadataChecks.some((c) => !c.match));
    if (bad.length) {
      for (const [sp, s] of bad)
        console.log(
          "   !! hash différent de la métadonnée:",
          sp,
          s.metadataChecks.filter((c) => !c.match).map((c) => c.artifact).join(",")
        );
    }
  }
  console.log("\n== artifact -> build-info ==");
  for (const [a, v] of Object.entries(manifest.artifactToBuildInfo)) {
    console.log(
      a.padEnd(24),
      v.map((x) => `${x.buildInfoId.slice(0, 8)}${x.deployedBytecodeExactMatch ? "[exact]" : x.deployedBytecodeMatchIgnoringMetadata ? "[hors-metadata]" : x.creationBytecodeExactMatch ? "[creation]" : ""}`).join(" ")
    );
  }
  console.log("\n== artifacts SANS build-info correspondant ==");
  for (const u of manifest.unmatchedArtifacts) console.log(u.artifact.padEnd(24), JSON.stringify(u.compilationTarget), `${u.deployedBytes}B`);
}

main();
