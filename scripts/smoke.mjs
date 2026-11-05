/**
 * Smoke test HTTP du build de production.
 *
 *   npm run build && npm run smoke
 *
 * Démarre `next start` sur un port libre (ou cible SMOKE_BASE_URL), puis vérifie :
 *   - les pages publiques principales répondent 200 avec le shell React ;
 *   - les routes sensibles refusent l'accès (401/403) et jamais ne l'accordent par défaut ;
 *   - la limite de corps de Next est effective (413) ;
 *   - le parcours d'authentification : signature réelle → jeton → autorisation par adresse.
 * Aucune transaction blockchain n'est émise, aucun service externe n'est appelé.
 * Code de sortie 1 au premier écart.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { Wallet } from "ethers";

const SESSION_SECRET = "smoke-test-secret-".padEnd(48, "z");

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

let child = null;
let base = process.env.SMOKE_BASE_URL;
let serverLog = "";

async function startServer() {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  // Environnement volontairement réduit : aucun secret réel, aucune ouverture du Deploy Studio.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    WALLET_SESSION_SECRET: SESSION_SECRET,
  };
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => (serverLog += d));
  child.stderr.on("data", (d) => (serverLog += d));

  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`next start s'est arrêté (code ${child.exitCode}) :\n${serverLog}`);
    try {
      const r = await fetch(`${base}/api/webhook`);
      if (r.status > 0) return;
    } catch {
      /* pas encore prêt */
    }
    await sleep(500);
  }
  throw new Error(`next start n'a pas répondu à temps :\n${serverLog}`);
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` — ${detail}`}`);
}

async function check(name, req, expect) {
  try {
    const res = await fetch(`${base}${req.path}`, {
      method: req.method ?? "GET",
      headers: req.headers,
      body: req.body,
      redirect: "manual",
    });
    const text = await res.text();
    const statuses = Array.isArray(expect.status) ? expect.status : [expect.status];
    if (!statuses.includes(res.status)) return record(name, false, `statut ${res.status}, attendu ${statuses.join("|")} — ${text.slice(0, 120)}`);
    if (expect.contains && !text.includes(expect.contains)) return record(name, false, `corps sans « ${expect.contains} »`);
    if (expect.notContains) {
      for (const s of [].concat(expect.notContains)) if (text.includes(s)) return record(name, false, `le corps contient « ${s} »`);
    }
    record(name, true);
    return { res, text };
  } catch (e) {
    record(name, false, e.message);
  }
}

const json = (obj) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

async function main() {
  if (!base) await startServer();
  console.log(`\nSmoke test → ${base}\n`);

  // ── Pages publiques ──────────────────────────────────────────────────────────
  for (const p of [
    "/", "/cgu", "/galerie/art", "/galerie/poesie", "/galerie/generative", "/residents", "/projets/projets",
    "/association/faq", "/association/rescoe", "/association/contact", "/association/formations", "/association/adherent",
    "/mint/mintart", "/mint/poesie", "/u/dashboard",
  ]) {
    await check(`page ${p} → 200 + shell React`, { path: p }, { status: 200, contains: 'id="__next"' });
  }
  await check("page inconnue → 404", { path: "/cette-page-nexiste-pas" }, { status: 404 });

  // ── Routes publiques ─────────────────────────────────────────────────────────
  await check("GET /api/webhook → 405", { path: "/api/webhook" }, { status: 405 });
  await check("/api/proxy refuse un hôte hors liste", { path: "/api/proxy?url=https://evil.example/x" }, { status: 400 });
  await check("/api/proxy refuse le schéma file:", { path: "/api/proxy?url=file:///etc/passwd" }, { status: 400 });
  await check("/api/basescan refuse une adresse invalide", { path: "/api/basescan?address=zzz" }, { status: 400 });
  await check("/api/ipfs refuse un CID invalide", { path: "/api/ipfs/not-a-cid" }, { status: 400 });
  await check("/api/ipfs refuse la traversée de chemin", { path: "/api/ipfs/..%2f..%2fadmin" }, { status: [400, 404] });
  await check("/api/metadata refuse un CID invalide", { path: "/api/metadata/zzz" }, { status: 400 });

  // ── Routes sensibles : refus par défaut ──────────────────────────────────────
  for (const p of [
    "/api/claim-reward", "/api/claim", "/api/create-onramp-session", "/api/pinata/upload", "/api/pinata/pin",
    "/api/token/upload-insect-relayer", "/api/token/upload-insect-relayer-v3", "/api/token/upload-egg-relayer",
  ]) {
    await check(`POST ${p} sans session → 401`, { path: p, method: "POST", ...json({}) }, { status: 401, notContains: ["RELAYER", "PINATA", "STRIPE"] });
    await check(`GET ${p} → 405`, { path: p }, { status: 405 });
  }
  await check("GET /api/admin/insect-storage-status sans session → 401", { path: "/api/admin/insect-storage-status?address=0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879" }, { status: 401 });
  await check("/api/revalidate sans secret configuré/fourni → jamais 200", { path: "/api/revalidate?secret=x" }, { status: [401, 500] });

  for (const [method, p] of [
    ["GET", "/api/admin/deploy/hardhat/status"], ["GET", "/api/admin/deploy/hardhat/logs"], ["GET", "/api/admin/deploy/deployed"],
    ["GET", "/api/admin/deploy/contracts/list"], ["GET", "/api/admin/deploy/contracts/abi?name=AdhesionRescoe"],
    ["GET", "/api/admin/deploy/contracts/source?name=AdhesionRescoe"],
    ["POST", "/api/admin/deploy/hardhat/start"], ["POST", "/api/admin/deploy/hardhat/stop"],
    ["POST", "/api/admin/deploy/contracts/compile"], ["POST", "/api/admin/deploy/contracts/deploy"],
    ["POST", "/api/admin/deploy/full-pipeline"], ["POST", "/api/admin/deploy/deployed"],
  ]) {
    await check(`Deploy Studio ${method} ${p.replace("/api/admin/deploy", "")} → 403 (désactivé)`, { path: p, method, ...(method === "POST" ? json({}) : {}) }, { status: 403, contains: "deploy_studio_disabled" });
  }
  await check("Deploy Studio /access → enabled:false", { path: "/api/admin/deploy/access" }, { status: 200, contains: '"enabled":false' });

  // ── Limite de corps effective (sizeLimit Next) ───────────────────────────────
  await check("corps > 2 ko sur /api/claim-reward → 413", { path: "/api/claim-reward", method: "POST", ...json({ user: "0x" + "a".repeat(40), pad: "x".repeat(4000) }) }, { status: 413 });

  // ── Parcours d'authentification complet (aucune transaction) ─────────────────
  const wallet = Wallet.createRandom();
  const host = new URL(base).host;
  const message = [
    "Rescoe — connexion sécurisée",
    "Je prouve que je contrôle ce wallet. Aucune transaction, aucun frais.",
    "",
    `Adresse: ${wallet.address}`,
    `Domaine: ${host}`,
    `Nonce: ${"ab".repeat(16)}`,
    `Émis le: ${new Date().toISOString()}`,
  ].join("\n");
  const signature = await wallet.signMessage(message);

  await check("session : mauvais domaine refusé", { path: "/api/wallet/session", method: "POST", ...json({ message: message.replace(host, "evil.example"), signature }) }, { status: 401, contains: "domain_mismatch" });
  const login = await check("session : signature réelle → jeton", { path: "/api/wallet/session", method: "POST", ...json({ message, signature }) }, { status: 200, contains: '"token"' });

  if (login) {
    const { token } = JSON.parse(login.text);
    const auth = { "content-type": "application/json", authorization: `Bearer ${token}` };
    const other = Wallet.createRandom().address;
    await check("claim-reward : adresse d'un autre wallet → 403", { path: "/api/claim-reward", method: "POST", headers: auth, body: JSON.stringify({ user: other }) }, { status: 403 });
    await check("claim-reward : adresse invalide → 400", { path: "/api/claim-reward", method: "POST", headers: auth, body: JSON.stringify({ user: "0x12" }) }, { status: 400 });
    await check("pinata/upload : image invalide → 415 (aucun appel Pinata)", { path: "/api/pinata/upload", method: "POST", headers: auth, body: JSON.stringify({ scope: "oeuvres", fileBase64: Buffer.from("<script>").toString("base64"), metadata: {} }) }, { status: 415 });
    await check("upload-insect-relayer-v3 : clé « constructor » → 404 (pas 500)", { path: "/api/token/upload-insect-relayer-v3", method: "POST", headers: auth, body: JSON.stringify({ insectKey: "constructor" }) }, { status: 404 });
    await check("jeton falsifié → 401", { path: "/api/claim-reward", method: "POST", headers: { ...auth, authorization: `Bearer ${token.slice(0, -4)}AAAA` }, body: JSON.stringify({ user: wallet.address }) }, { status: 401 });
  }
}

let exitCode = 0;
try {
  await main();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    exitCode = 1;
    console.log("\nÉchecs :");
    for (const f of failed) console.log(` - ${f.name} — ${f.detail}`);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await sleep(300);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
process.exit(exitCode);
