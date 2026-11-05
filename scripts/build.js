/**
 * Wrapper de build Next.js.
 *
 * 1. Garde « secrets publics » : échoue si un secret est exposé via NEXT_PUBLIC_*.
 * 2. Supprime les manifests .next d'un build précédent (jamais de preuve périmée).
 * 3. Lance `next build` en relayant stdout/stderr.
 * 4. Le code de sortie de `next build` fait foi (voir scripts/build-verdict.js pour
 *    l'unique exception Windows/NTFS, vérifiée sur la sortie ET la fraîcheur des fichiers).
 */

const { spawn } = require("child_process");
const path = require("path");
const { runCheck, formatReport } = require("./check-public-secrets");
const { clearProofFiles, decideBuildExit } = require("./build-verdict");

try {
  require("@next/env").loadEnvConfig(process.cwd());
} catch {
  // @next/env absent : on contrôle seulement process.env.
}

const guard = runCheck();
if (!guard.ok) {
  console.error(formatReport(guard));
  process.exit(1);
}

clearProofFiles();

const nextBin = path.join("node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const startedAt = Date.now();
let output = "";

// Sur Windows, un .cmd ne peut être lancé qu'avec un shell (Node >= 18.20 / 20.12).
// Les arguments sont des constantes : aucune donnée externe n'est interpolée.
const child = spawn(nextBin, ["build"], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
});

const MAX_CAPTURE = 200_000; // on ne garde que la fin de la sortie pour l'analyse
const capture = (stream, sink) =>
  stream.on("data", (chunk) => {
    sink.write(chunk);
    output = (output + chunk.toString()).slice(-MAX_CAPTURE);
  });
capture(child.stdout, process.stdout);
capture(child.stderr, process.stderr);

child.on("error", (err) => {
  console.error(`❌ Impossible de lancer next build : ${err.message}`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  const verdict = decideBuildExit({ code, signal, platform: process.platform, output, startedAt });
  if (verdict.message) (verdict.exitCode === 0 ? console.log : console.error)(`\n${verdict.message}\n`);
  process.exit(verdict.exitCode);
});
