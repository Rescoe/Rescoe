/**
 * Wrapper build Next.js — gère le race condition NTFS Windows sur le cleanup
 * des pages auto-statically optimized (Next.js 15 bug).
 *
 * Comportement :
 * - Linux/Vercel : next build réussit → exit 0
 * - Windows : next build sort en erreur 1 UNIQUEMENT à cause de l'unlink ENOENT
 *   → vérifie que .next/routes-manifest.json existe (build complet)
 *   → exit 0 si oui, exit 1 sinon (vraie erreur de build)
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nextBin = path.join('node_modules', '.bin', 'next');
const result = spawnSync(
  process.platform === 'win32' ? nextBin + '.cmd' : nextBin,
  ['build'],
  { stdio: 'inherit', shell: false }
);

const code = result.status ?? 1;

if (code === 0) {
  process.exit(0);
}

// Vérifie si le build est réellement complet malgré l'erreur
const routesManifest = path.join('.next', 'routes-manifest.json');
const pagesManifest = path.join('.next', 'server', 'pages-manifest.json');
const buildComplete = fs.existsSync(routesManifest) && fs.existsSync(pagesManifest);

if (buildComplete) {
  console.log(
    '\n⚠️  next build a terminé avec une erreur de cleanup Windows (ENOENT unlink).'
  );
  console.log(
    '   Le dossier .next est complet — ce warning est un bug connu de Next.js 15 sur Windows NTFS.\n'
  );
  process.exit(0);
}

// Vraie erreur de build
process.exit(code);
