/**
 * Décide si un `next build` doit être considéré comme réussi.
 *
 * Règle : un code de sortie non nul n'est JAMAIS « rattrapé » par la simple présence
 * de fichiers .next (qui peuvent dater d'un build précédent). Une seule exception,
 * étroite et vérifiable : le bug connu de Next 15 sur Windows/NTFS (ENOENT à l'unlink
 * de fichiers de pages pendant le nettoyage final), à condition que
 *   - la plateforme soit win32,
 *   - la sortie du build contienne bien cette erreur ENOENT/unlink,
 *   - tous les fichiers « preuve » aient été (re)créés PENDANT ce build.
 */

const fs = require("fs");
const path = require("path");

const PROOF_FILES = [
  path.join(".next", "BUILD_ID"),
  path.join(".next", "routes-manifest.json"),
  path.join(".next", "build-manifest.json"),
  path.join(".next", "server", "pages-manifest.json"),
];

const MTIME_TOLERANCE_MS = 2000; // granularité des systèmes de fichiers

/** Supprime les fichiers preuve d'un éventuel build précédent (pas .next/cache). */
function clearProofFiles(cwd = process.cwd(), files = PROOF_FILES) {
  for (const f of files) fs.rmSync(path.join(cwd, f), { force: true });
}

/** true si tous les fichiers existent et ont été écrits depuis `startedAt`. */
function proofIsFresh(startedAt, { cwd = process.cwd(), files = PROOF_FILES, stat = fs.statSync } = {}) {
  return files.every((f) => {
    try {
      return stat(path.join(cwd, f)).mtimeMs >= startedAt - MTIME_TOLERANCE_MS;
    } catch {
      return false;
    }
  });
}

const WINDOWS_CLEANUP_RACE = /ENOENT[^\n]*unlink|unlink[^\n]*ENOENT/i;

/**
 * @returns {{ exitCode: number, message: string }}
 */
function decideBuildExit({ code, signal, platform, output, startedAt, proofOpts }) {
  const fresh = proofIsFresh(startedAt, proofOpts);

  if (code === 0) {
    return fresh
      ? { exitCode: 0, message: "" }
      : { exitCode: 1, message: "next build a rendu 0 mais .next/ ne contient pas de manifests produits par ce build." };
  }

  const exitCode = typeof code === "number" ? code : 1;
  if (platform === "win32" && WINDOWS_CLEANUP_RACE.test(output || "") && fresh) {
    return {
      exitCode: 0,
      message:
        "⚠️  next build : erreur de nettoyage Windows (ENOENT unlink) après un build complet " +
        "(manifests régénérés pendant ce build) — bug connu de Next.js 15 sur NTFS, accepté.",
    };
  }

  const why = signal ? `signal ${signal}` : `code ${exitCode}`;
  return { exitCode, message: `❌ next build a échoué (${why}). Aucun manifest .next n'est accepté comme preuve.` };
}

module.exports = { PROOF_FILES, clearProofFiles, proofIsFresh, decideBuildExit };
