/* eslint-disable no-console */
/**
 * Prépare l'arbre compilable par Hardhat à partir des sources RÉCUPÉRÉES (audit-recovered-contracts/build-info/*).
 *
 *   audit-src/recovered/*.sol         sources métier (à plat, comme dans Remix)
 *   audit-vendor/@openzeppelin/**     OpenZeppelin EXACTEMENT comme compilé (mélange de versions inclus),
 *                                     HORS de la racine de sources pour ne pas être compilé deux fois
 *   audit-src/PROVENANCE.json         origine (build-info) + sha256 de chaque fichier
 *
 * RÈGLE : aucune fusion silencieuse. Si un même chemin existe avec des octets différents dans deux
 * build-info, le script ÉCHOUE et liste le conflit (versions à traiter séparément).
 *
 * audit-src/attackers/ est écrit à la main (contrats d'attaque / mocks) et n'est jamais touché ici.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..", "..");
const BI = path.join(ROOT, "audit-recovered-contracts", "build-info");
const OUT = path.join(ROOT, "audit-src");
const VENDOR = path.join(ROOT, "audit-vendor");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

function main() {
  fs.rmSync(path.join(OUT, "recovered"), { recursive: true, force: true });
  fs.rmSync(VENDOR, { recursive: true, force: true });

  const staged = {}; // destRel -> {sha256, origins:[ids]}
  const conflicts = [];

  for (const id of fs.readdirSync(BI).sort()) {
    const dir = path.join(BI, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const rel of walk(dir)) {
      if (rel === "settings.json") continue;
      const buf = fs.readFileSync(path.join(dir, rel));
      const isOz = rel.startsWith("@openzeppelin/");
      const destRel = isOz ? path.join("vendor", rel) : path.join("recovered", rel);
      const destBase = isOz ? VENDOR : OUT;
      const destInBase = isOz ? rel : path.join("recovered", rel);
      const h = sha(buf);
      if (staged[destRel]) {
        if (staged[destRel].sha256 !== h) {
          conflicts.push({ file: destRel, a: staged[destRel].origins, bSha: h, aSha: staged[destRel].sha256, b: id });
        } else {
          staged[destRel].origins.push(id);
        }
        continue;
      }
      const dest = path.join(destBase, destInBase);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      staged[destRel] = { sha256: h, origins: [id] };
    }
  }

  if (conflicts.length) {
    console.error("CONFLIT DE VERSIONS entre build-info (pas de fusion silencieuse) :");
    for (const c of conflicts) console.error(" -", c.file, "build-info", c.a.join(","), "vs", c.b);
    process.exit(2);
  }

  fs.writeFileSync(
    path.join(OUT, "PROVENANCE.json"),
    JSON.stringify(
      {
        warning:
          "Copie COMPILABLE des sources RÉCUPÉRÉES depuis build-info (pas les dernières sources métier). Généré par scripts/audit/stage-sources.js.",
        files: staged,
      },
      null,
      2
    )
  );
  const biz = Object.keys(staged).filter((f) => f.startsWith("recovered"));
  const oz = Object.keys(staged).filter((f) => f.startsWith("vendor"));
  console.log(`staged: ${biz.length} sources métier, ${oz.length} fichiers OpenZeppelin, 0 conflit`);
  for (const f of biz) console.log("  ", f, "<-", staged[f].origins.map((o) => o.slice(0, 8)).join(","));
}

main();
