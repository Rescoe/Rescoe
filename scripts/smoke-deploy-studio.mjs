/**
 * Vérifie le garde du Deploy Studio contre un VRAI `next dev` (Next ajoute lui-même des
 * en-têtes x-forwarded-* : les tests unitaires avec requêtes simulées ne les voient pas).
 *
 *   npm run smoke:studio
 *
 * Démarre `next dev` sur 127.0.0.1 avec l'opt-in activé et un HARDHAT_DIR temporaire VIDE,
 * n'appelle que des routes qui n'exécutent rien (access, list, deployed) et ne tue que son
 * propre groupe de processus. Aucun secret, aucune transaction.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

const hardhatDir = mkdtempSync(join(tmpdir(), "studio-smoke-"));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const failures = [];

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", String(port), "-H", "127.0.0.1"], {
  detached: true,
  stdio: "ignore",
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NEXT_TELEMETRY_DISABLED: "1", ENABLE_DEPLOY_STUDIO: "true", HARDHAT_DIR: hardhatDir },
});

async function expectResponse(name, path, init, status, contains) {
  try {
    const r = await fetch(base + path, init);
    const text = await r.text();
    const ok = r.status === status && (!contains || text.includes(contains));
    console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : ` — [${r.status}] ${text.slice(0, 140)}`}`);
    if (!ok) failures.push(name);
  } catch (e) {
    console.log(`❌ ${name} — ${e.message}`);
    failures.push(name);
  }
}

try {
  let ready = false;
  for (let i = 0; i < 90 && !ready; i++) {
    try {
      await fetch(`${base}/api/webhook`);
      ready = true;
    } catch {
      await sleep(1000);
    }
  }
  if (!ready) throw new Error("next dev n'a pas démarré à temps");

  const json = { "content-type": "application/json" };
  const csrf = { "x-requested-with": "rescoe-deploy-studio" };
  const entry = JSON.stringify({ contract: { name: "Smoke", address: "0x3333333333333333333333333333333333333333", network: "hardhat" } });

  await expectResponse("opt-in + dev + boucle locale → enabled:true", "/api/admin/deploy/access", {}, 200, '"enabled":true');
  await expectResponse("mainnet désactivé par défaut", "/api/admin/deploy/access", {}, 200, '"mainnetAllowed":false');
  await expectResponse("GET contracts/list autorisé (dossier sans contrats → 404 applicatif)", "/api/admin/deploy/contracts/list", {}, 404, "contracts_dir_missing");
  await expectResponse("POST deployed sans en-tête CSRF → refusé", "/api/admin/deploy/deployed", { method: "POST", headers: json, body: entry }, 403, "deploy_studio_csrf");
  await expectResponse("POST deployed avec Origin croisée → refusé", "/api/admin/deploy/deployed", { method: "POST", headers: { ...json, ...csrf, origin: "https://evil.example" }, body: entry }, 403, "deploy_studio_bad_origin");
  await expectResponse("POST deployed avec en-tête CSRF → 200", "/api/admin/deploy/deployed", { method: "POST", headers: { ...json, ...csrf }, body: entry }, 200, '"success":true');
  await expectResponse("GET deployed relit l'entrée", "/api/admin/deploy/deployed", {}, 200, "Smoke");
  await expectResponse("X-Forwarded-For forgé → refusé", "/api/admin/deploy/contracts/list", { headers: { "x-forwarded-for": "8.8.8.8" } }, 403, "deploy_studio_local_only");
  await expectResponse("compile avec nom piégé → 400, rien d'exécuté", "/api/admin/deploy/contracts/compile", { method: "POST", headers: { ...json, ...csrf }, body: JSON.stringify({ name: "../../evil", content: "x" }) }, 400, "invalid_source");

  const files = readdirSync(hardhatDir);
  const onlyExpected = files.length === 1 && files[0] === "deployed.json" && readFileSync(join(hardhatDir, "deployed.json"), "utf8").includes("Smoke");
  console.log(`${onlyExpected ? "✅" : "❌"} HARDHAT_DIR ne contient que deployed.json (trouvé : ${files.join(", ") || "rien"})`);
  if (!onlyExpected) failures.push("fichiers écrits");
} catch (e) {
  console.error(`❌ ${e.message}`);
  failures.push(e.message);
} finally {
  try { process.kill(-child.pid, "SIGTERM"); } catch { /* déjà arrêté */ }
  await sleep(500);
  try { process.kill(-child.pid, "SIGKILL"); } catch { /* déjà arrêté */ }
  rmSync(hardhatDir, { recursive: true, force: true });
}
console.log(failures.length ? `\n${failures.length} échec(s)` : "\nDeploy Studio : garde conforme sous next dev.");
process.exit(failures.length ? 1 : 0);
