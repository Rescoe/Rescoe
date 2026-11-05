/**
 * Garde « secrets publics » — exécutée avant chaque `next build` (scripts/build.js).
 *
 * Toute variable NEXT_PUBLIC_* est embarquée en clair dans le JavaScript envoyé au
 * navigateur. On interdit donc d'y mettre un JWT Pinata, une clé privée ou un secret.
 *
 * Trois contrôles, qui n'affichent JAMAIS une valeur (uniquement des noms et des
 * emplacements fichier:ligne) :
 *   1. nom de variable NEXT_PUBLIC_* interdit présent dans l'environnement ;
 *   2. valeur d'une variable NEXT_PUBLIC_* qui ressemble à un JWT (xxx.yyy.zzz en base64url) ;
 *   3. référence à un nom interdit dans le code source (pages/, src/).
 *
 * Usage : `node scripts/check-public-secrets.js` (code 1 si violation).
 */

const fs = require("fs");
const path = require("path");

// Noms interdits après le préfixe NEXT_PUBLIC_.
// NB : NEXT_PUBLIC_STRIPE_PUBLIC_KEY (clé publiable) ne correspond volontairement pas.
const FORBIDDEN_NAME = /^NEXT_PUBLIC_.*(PINATA|JWT|PRIVATE|SECRET|RELAYER|MNEMONIC|SEED|_PK$)/i;
const JWT_VALUE = /^eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}$/;
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function isForbiddenPublicName(name) {
  return FORBIDDEN_NAME.test(name);
}

function looksLikeJwt(value) {
  return typeof value === "string" && JWT_VALUE.test(value.trim());
}

/** @returns {{name: string, reason: string}[]} — jamais de valeur. */
function findForbiddenEnv(env) {
  const out = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("NEXT_PUBLIC_")) continue;
    if (isForbiddenPublicName(name)) {
      out.push({ name, reason: "nom interdit (secret potentiel exposé au navigateur)" });
    } else if (looksLikeJwt(value)) {
      out.push({ name, reason: "la valeur ressemble à un JWT" });
    }
  }
  return out;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (SOURCE_EXT.test(e.name)) yield full;
  }
}

/** @returns {{file: string, line: number, name: string}[]} */
function scanSources(rootDirs, cwd = process.cwd()) {
  const out = [];
  const ref = /NEXT_PUBLIC_[A-Z0-9_]+/g;
  for (const root of rootDirs) {
    for (const file of walk(path.join(cwd, root))) {
      const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((text, i) => {
        for (const m of text.matchAll(ref)) {
          if (isForbiddenPublicName(m[0])) {
            out.push({ file: path.relative(cwd, file), line: i + 1, name: m[0] });
          }
        }
      });
    }
  }
  return out;
}

function runCheck({ env = process.env, rootDirs = ["pages", "src"], cwd = process.cwd() } = {}) {
  const envHits = findForbiddenEnv(env);
  const srcHits = scanSources(rootDirs, cwd);
  return { ok: envHits.length === 0 && srcHits.length === 0, envHits, srcHits };
}

function formatReport({ envHits, srcHits }) {
  const lines = ["❌ Secret potentiel exposé au navigateur (variables NEXT_PUBLIC_*) :"];
  for (const h of envHits) lines.push(`   - env  ${h.name} — ${h.reason}`);
  for (const h of srcHits) lines.push(`   - code ${h.file}:${h.line} référence ${h.name}`);
  lines.push(
    "   → Les JWT Pinata, clés privées et secrets doivent rester côté serveur (sans préfixe",
    "     NEXT_PUBLIC_). Les uploads Pinata passent par /api/pinata/*. Valeurs jamais affichées."
  );
  return lines.join("\n");
}

module.exports = {
  isForbiddenPublicName,
  looksLikeJwt,
  findForbiddenEnv,
  scanSources,
  runCheck,
  formatReport,
};

if (require.main === module) {
  try {
    // Charge .env* comme le fait Next, pour contrôler aussi les variables du fichier.
    require("@next/env").loadEnvConfig(process.cwd());
  } catch {
    // @next/env absent : on contrôle seulement process.env.
  }
  const result = runCheck();
  if (!result.ok) {
    console.error(formatReport(result));
    process.exit(1);
  }
  console.log("✅ Aucun secret exposé via NEXT_PUBLIC_*.");
}
