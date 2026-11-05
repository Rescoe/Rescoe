/* eslint-disable no-console */
/**
 * Recompilation LOCALE EXACTE : rejoue l'`input` standard-JSON de chaque build-info avec solcjs 0.8.30
 * (même version que l'origine) et compare, OCTET À OCTET, le bytecode de création et le bytecode déployé
 * (métadonnées incluses) avec `output` du build-info, puis avec l'artifact Remix correspondant.
 *
 * Aucun réseau. Écrit audit-recovered-contracts/RECOMPILE_RESULT.json.
 * Usage : node scripts/audit/recompile-exact.js [idPrefix]
 */
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.resolve(__dirname, "..", "..");
const BI_DIR = path.join(ROOT, "contracts", "artifacts", "build-info");
const ART_DIR = path.join(ROOT, "contracts", "artifacts");
const only = process.argv[2];

const results = { solc: solc.version(), builds: [] };
for (const f of fs.readdirSync(BI_DIR).sort()) {
  if (!f.endsWith(".json") || (only && !f.startsWith(only))) continue;
  const bi = JSON.parse(fs.readFileSync(path.join(BI_DIR, f), "utf8"));
  const t0 = Date.now();
  const out = JSON.parse(solc.compile(JSON.stringify(bi.input)));
  const errs = (out.errors || []).filter((e) => e.severity === "error");
  const entry = { id: bi.id, seconds: (Date.now() - t0) / 1000, compileErrors: errs.map((e) => e.formattedMessage), contracts: [] };
  for (const [src, cs] of Object.entries(bi.output.contracts)) {
    for (const [name, c] of Object.entries(cs)) {
      const want = c.evm.deployedBytecode.object;
      if (!want) continue;
      const got = out.contracts && out.contracts[src] && out.contracts[src][name];
      const gotDep = got && got.evm.deployedBytecode.object;
      const gotCre = got && got.evm.bytecode.object;
      let artifactMatch = null;
      const ap = path.join(ART_DIR, `${name}.json`);
      if (fs.existsSync(ap)) {
        const a = JSON.parse(fs.readFileSync(ap, "utf8"));
        artifactMatch = {
          deployedEqualsRemixArtifact: gotDep === a.data.deployedBytecode.object.replace(/^0x/, ""),
          creationEqualsRemixArtifact: gotCre === a.data.bytecode.object.replace(/^0x/, ""),
        };
      }
      entry.contracts.push({
        source: src,
        contract: name,
        deployedExactVsBuildInfo: gotDep === want,
        creationExactVsBuildInfo: gotCre === c.evm.bytecode.object,
        abiEqualsBuildInfo: JSON.stringify(got && got.abi) === JSON.stringify(c.abi),
        deployedBytes: want.length / 2,
        artifactMatch,
      });
    }
  }
  results.builds.push(entry);
  const bad = entry.contracts.filter((c) => !c.deployedExactVsBuildInfo || !c.creationExactVsBuildInfo);
  console.log(`${bi.id.slice(0, 8)} ${entry.seconds}s contrats=${entry.contracts.length} divergents=${bad.length} erreurs=${errs.length}`);
}
fs.writeFileSync(path.join(ROOT, "audit-recovered-contracts", "RECOMPILE_RESULT.json"), JSON.stringify(results, null, 2));
const all = results.builds.flatMap((b) => b.contracts);
console.log(`TOTAL contrats comparés: ${all.length} | identiques (déployé+création): ${all.filter((c) => c.deployedExactVsBuildInfo && c.creationExactVsBuildInfo).length}`);
