/* eslint-disable no-console */
/**
 * Analyse des artefacts (100 % hors-ligne, lecture seule) :
 *   1. tailles de bytecode vs EIP-170 (24 576 o déployé) et EIP-3860 (49 152 o initcode)
 *   2. ABI compilée (Remix/build-info) vs ABI épinglée Base Sepolia (.deploys/pinned-contracts/84532) vs ABI FRONTEND
 *      (src/components/ABI/** — lue, jamais modifiée) : fonctions / événements / erreurs / constructeur, par signature + sélecteur
 *   3. divergences ArtFactory / PoetryFactory (ABI frontend) et HaikuEditions / ArtNFT
 *
 * Sortie : audit-reports/abi-bytecode-report.{json,md}
 * Usage  : node scripts/audit/analyze-artifacts.js
 */
const fs = require("fs");
const path = require("path");
const { Interface } = require("ethers");

const ROOT = path.resolve(__dirname, "..", "..");
const REPO = path.resolve(ROOT, "..");
const ART = path.join(ROOT, "contracts", "artifacts");
const PIN = path.join(ROOT, "contracts", ".deploys", "pinned-contracts");
const FE = path.join(REPO, "src", "components", "ABI");
const OUT = path.join(ROOT, "audit-reports");
const EIP170 = 24576;
const EIP3860 = 49152;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const abiOf = (j) => (Array.isArray(j) ? j : j.abi || j);
const strip = (h) => (h || "").replace(/^0x/, "");

function sigs(abi) {
  const out = { function: {}, event: {}, error: {}, constructor: null, receive: false, fallback: false };
  const iface = new Interface(abi);
  for (const f of abi) {
    const t = (x) => (x.type === "tuple" || x.type.startsWith("tuple") ? "(" + x.components.map(t).join(",") + ")" + x.type.slice(5) : x.type);
    const s = (f.name || "") + "(" + (f.inputs || []).map(t).join(",") + ")";
    if (f.type === "function") {
      let selector = "";
      try { selector = iface.getFunction(s).selector; } catch { /* signature non résolue : sélecteur laissé vide */ }
      out.function[s] = { mut: f.stateMutability, selector };
    }
    else if (f.type === "event") out.event[s] = {};
    else if (f.type === "error") out.error[s] = {};
    else if (f.type === "constructor") out.constructor = "(" + (f.inputs || []).map((i) => i.type + " " + i.name).join(",") + ")";
    else if (f.type === "receive") out.receive = true;
    else if (f.type === "fallback") out.fallback = true;
  }
  return out;
}

function diff(a, b) {
  const d = {};
  for (const k of ["function", "event", "error"]) {
    const A = Object.keys(a[k]), B = Object.keys(b[k]);
    d[k] = { onlyA: A.filter((x) => !(x in b[k])), onlyB: B.filter((x) => !(x in a[k])), common: A.filter((x) => x in b[k]).length };
    if (k === "function") d[k].mutabilityChanged = A.filter((x) => x in b[k] && a[k][x].mut !== b[k][x].mut).map((x) => `${x}: ${a[k][x].mut} -> ${b[k][x].mut}`);
  }
  d.constructor = { A: a.constructor, B: b.constructor, same: a.constructor === b.constructor };
  return d;
}

// ---------------------------------------------------------------- sizes
const sizes = [];
for (const f of fs.readdirSync(ART).sort()) {
  if (!f.endsWith(".json") || f.endsWith("_metadata.json")) continue;
  const j = readJson(path.join(ART, f));
  const dep = strip(j.data && j.data.deployedBytecode && j.data.deployedBytecode.object).length / 2;
  const cre = strip(j.data && j.data.bytecode && j.data.bytecode.object).length / 2;
  if (!dep) continue;
  sizes.push({ contract: f.replace(".json", ""), origin: "artifact Remix", deployedBytes: dep, creationBytes: cre });
}
const man = readJson(path.join(ROOT, "audit-recovered-contracts", "MANIFEST.json"));
for (const b of man.buildInfos) {
  for (const c of b.contracts) {
    if (c.deployedBytes < 1000 && !["SepoliaFaucet"].includes(c.contract)) continue; // librairies OZ vides
    if (!sizes.find((s) => s.contract === c.contract))
      sizes.push({ contract: c.contract, origin: `build-info ${b.id.slice(0, 8)}`, deployedBytes: c.deployedBytes, creationBytes: c.creationBytes });
  }
}
for (const s of sizes) {
  s.eip170Percent = +((s.deployedBytes / EIP170) * 100).toFixed(1);
  s.eip170Headroom = EIP170 - s.deployedBytes;
  s.eip3860Percent = +((s.creationBytes / EIP3860) * 100).toFixed(1);
  s.eip3860Headroom = EIP3860 - s.creationBytes;
}
sizes.sort((x, y) => y.deployedBytes - x.deployedBytes);

// ---------------------------------------------------------------- ABI comparisons
const pins = {};
for (const d of ["84532", "vm-prague"]) {
  const dir = path.join(PIN, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const j = readJson(path.join(dir, f));
    pins[`${j.name}@${d}`] = { name: j.name, address: j.address, chain: d, abi: j.abi, pinnedAt: j.pinnedAt };
  }
}
const compiledAbi = (name) => {
  const p = path.join(ART, `${name}.json`);
  if (fs.existsSync(p)) return readJson(p).abi;
  // sinon : build-info (MessageEditions n'a pas d'artifact Remix)
  const dir = path.join(ART, "build-info");
  for (const f of fs.readdirSync(dir)) {
    const bi = readJson(path.join(dir, f));
    for (const cs of Object.values(bi.output.contracts)) if (cs[name] && cs[name].evm.deployedBytecode.object) return cs[name].abi;
  }
  return null;
};

const pairs = [
  { contract: "AdhesionRescoe", fe: "ABIAdhesion.json" },
  { contract: "TokenManagement", fe: "ABI_ADHESION_MANAGEMENT.json" },
  { contract: "ArtNFT", fe: "ABI_ART.json" },
  { contract: "ResCoellectionManager", fe: "ABI_Collections.json" },
  { contract: "ArtFactory", fe: "Factories/ABI_ART_FACTORY.json" },
  { contract: "MasterFactory", fe: "Factories/ABI_MasterFactory.json" },
  { contract: "MessageFactory", fe: "Factories/ABI_SOCIAL_FACTORY.json" },
  { contract: "MessageEditions", fe: "MessageEditions.json" },
  { contract: "SepoliaFaucet", fe: "Faucet.json" },
];
const abiReport = [];
for (const p of pairs) {
  const comp = compiledAbi(p.contract);
  const fe = abiOf(readJson(path.join(FE, p.fe)));
  const entry = { contract: p.contract, frontendFile: `src/components/ABI/${p.fe}`, compiledEntries: comp && comp.length, frontendEntries: fe.length };
  if (comp) entry.compiledVsFrontend = diff(sigs(comp), sigs(fe));
  const pin = pins[`${p.contract}@84532`];
  if (pin) {
    entry.pinnedBaseSepolia = { address: pin.address, entries: pin.abi.length, pinnedAt: pin.pinnedAt };
    if (comp) entry.compiledVsPinned = diff(sigs(comp), sigs(pin.abi));
    entry.pinnedVsFrontend = diff(sigs(pin.abi), sigs(fe));
  }
  const pinVm = pins[`${p.contract}@vm-prague`];
  if (pinVm) entry.pinnedRemixVm = { address: pinVm.address, entries: pinVm.abi.length, sameAsCompiled: comp ? JSON.stringify(sigs(comp)) === JSON.stringify(sigs(pinVm.abi)) : null };
  abiReport.push(entry);
}

// Contrats sans source : ABI frontend seulement
const feOnly = [
  { contract: "HaikuEditions", fe: "HaikuEditions.json" },
  { contract: "PoetryFactory", fe: "Factories/ABI_POESIE_FACTORY.json" },
  { contract: "InsectImageStorageV3", fe: "ABIInsectStorage.json" },
  { contract: "GenerativeArt (inconnu)", fe: "ABI_GENERATIVE_ART.json" },
].map((x) => {
  const abi = abiOf(readJson(path.join(FE, x.fe)));
  const s = sigs(abi);
  return { ...x, entries: abi.length, functions: Object.keys(s.function).length, events: Object.keys(s.event).length, errors: Object.keys(s.error).length, constructor: s.constructor, sourceAvailable: false };
});

const cross = {};
{
  const art = abiOf(readJson(path.join(FE, "Factories/ABI_ART_FACTORY.json")));
  const poe = abiOf(readJson(path.join(FE, "Factories/ABI_POESIE_FACTORY.json")));
  cross.artFactoryVsPoetryFactoryFrontendIdentical = JSON.stringify(art) === JSON.stringify(poe);
  cross.artFactoryVsPoetryFactoryDiff = diff(sigs(art), sigs(poe));
  const hk = abiOf(readJson(path.join(FE, "HaikuEditions.json")));
  const artnft = compiledAbi("ArtNFT");
  cross.haikuEditionsVsCompiledArtNFT = diff(sigs(hk), sigs(artnft));
  const artFe = abiOf(readJson(path.join(FE, "ABI_ART.json")));
  cross.haikuEditionsVsFrontendArt = diff(sigs(hk), sigs(artFe));
  cross.compiledArtFactoryVsFrontendArtFactory = diff(sigs(compiledAbi("ArtFactory")), sigs(art));
}

fs.mkdirSync(OUT, { recursive: true });
const report = { eip170: EIP170, eip3860: EIP3860, sizes, abiReport, frontendOnly: feOnly, cross };
fs.writeFileSync(path.join(OUT, "abi-bytecode-report.json"), JSON.stringify(report, null, 2));

// ---------------------------------------------------------------- markdown
const L = [];
L.push("# Rapport artefacts (généré par `scripts/audit/analyze-artifacts.js`)\n");
L.push("## Tailles de bytecode\n");
L.push("| Contrat | Origine | Déployé (o) | % EIP-170 (24 576) | Marge (o) | Initcode (o) | % EIP-3860 (49 152) |");
L.push("|---|---|---:|---:|---:|---:|---:|");
for (const s of sizes) L.push(`| ${s.contract} | ${s.origin} | ${s.deployedBytes} | ${s.eip170Percent} % | ${s.eip170Headroom} | ${s.creationBytes} | ${s.eip3860Percent} % |`);
L.push("\n## ABI compilée vs ABI frontend vs ABI épinglée Base Sepolia\n");
for (const e of abiReport) {
  L.push(`### ${e.contract}`);
  L.push(`- Frontend : \`${e.frontendFile}\` (${e.frontendEntries} entrées) ; compilée : ${e.compiledEntries ?? "—"} entrées` + (e.pinnedBaseSepolia ? ` ; épinglée Base Sepolia \`${e.pinnedBaseSepolia.address}\` : ${e.pinnedBaseSepolia.entries} entrées` : ""));
  const fmt = (d, a, b) => {
    const f = d.function, ev = d.event;
    L.push(`  - constructeur ${a}: \`${d.constructor.A}\` | ${b}: \`${d.constructor.B}\` ${d.constructor.same ? "(identique)" : "**(DIFFÉRENT)**"}`);
    L.push(`  - fonctions : ${f.common} communes ; seulement ${a} (${f.onlyA.length}) ; seulement ${b} (${f.onlyB.length}) ; mutabilité changée (${f.mutabilityChanged.length})`);
    if (f.onlyA.length) L.push(`    - seulement ${a} : ${f.onlyA.map((x) => "`" + x + "`").join(", ")}`);
    if (f.onlyB.length) L.push(`    - seulement ${b} : ${f.onlyB.map((x) => "`" + x + "`").join(", ")}`);
    if (f.mutabilityChanged.length) L.push(`    - mutabilité : ${f.mutabilityChanged.map((x) => "`" + x + "`").join(", ")}`);
    L.push(`  - événements : seulement ${a} ${ev.onlyA.length}, seulement ${b} ${ev.onlyB.length}`);
  };
  if (e.compiledVsFrontend) { L.push("- **compilée (A) vs frontend (B)**"); fmt(e.compiledVsFrontend, "compilée", "frontend"); }
  if (e.compiledVsPinned) { L.push("- **compilée (A) vs épinglée Base Sepolia (B)**"); fmt(e.compiledVsPinned, "compilée", "épinglée"); }
  if (e.pinnedVsFrontend) { L.push("- **épinglée Base Sepolia (A) vs frontend (B)**"); fmt(e.pinnedVsFrontend, "épinglée", "frontend"); }
  if (e.pinnedRemixVm) L.push(`- ABI épinglée Remix VM \`${e.pinnedRemixVm.address}\` : ${e.pinnedRemixVm.entries} entrées ; identique à la compilée : ${e.pinnedRemixVm.sameAsCompiled}`);
  L.push("");
}
L.push("## Contrats sans source (ABI frontend uniquement)\n");
for (const f of feOnly) L.push(`- **${f.contract}** (\`${f.fe}\`) : ${f.functions} fonctions, ${f.events} événements, ${f.errors} erreurs ; constructeur \`${f.constructor}\``);
L.push("\n## Divergences croisées\n");
L.push(`- ABI frontend ArtFactory et PoetryFactory identiques : **${cross.artFactoryVsPoetryFactoryFrontendIdentical}**`);
L.push(`- HaikuEditions (frontend) vs ArtNFT compilé : fonctions communes ${cross.haikuEditionsVsCompiledArtNFT.function.common}, seulement Haiku ${cross.haikuEditionsVsCompiledArtNFT.function.onlyA.length}, seulement ArtNFT ${cross.haikuEditionsVsCompiledArtNFT.function.onlyB.length}`);
L.push(`- ArtFactory compilée vs ABI frontend ArtFactory : seulement compilée ${cross.compiledArtFactoryVsFrontendArtFactory.function.onlyA.length}, seulement frontend ${cross.compiledArtFactoryVsFrontendArtFactory.function.onlyB.length}`);
fs.writeFileSync(path.join(OUT, "abi-bytecode-report.md"), L.join("\n") + "\n");
console.log(L.join("\n"));
