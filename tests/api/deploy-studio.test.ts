/**
 * Deploy Studio : AUCUNE route /api/admin/deploy/* ne doit rien exécuter ni écrire sans le garde serveur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { call } from "../helpers/http";
import { resetRateLimits } from "@/server/security/rateLimit";

const cp = vi.hoisted(() => ({ execFile: vi.fn(), spawn: vi.fn(), exec: vi.fn() }));
vi.mock("child_process", () => ({ ...cp, default: cp }));

const ROOT = path.resolve(__dirname, "../../pages/api/admin/deploy");
const routeFiles = (dir = ROOT): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? routeFiles(path.join(dir, e.name)) : e.name.endsWith(".ts") ? [path.join(dir, e.name)] : []));
const GUARDED = routeFiles().filter((f) => !f.endsWith("access.ts"));

const load = async (file: string) => (await import(/* @vite-ignore */ file)).default as (req: any, res: any) => Promise<unknown>;
const METHODS: Record<string, string> = {
  "contracts/compile": "POST", "contracts/deploy": "POST", "contracts/list": "GET", "contracts/source": "GET", "contracts/abi": "GET",
  "deployed": "GET", "full-pipeline": "POST", "hardhat/start": "POST", "hardhat/stop": "POST", "hardhat/status": "GET", "hardhat/logs": "GET",
};
const methodOf = (file: string) => METHODS[path.relative(ROOT, file).replace(/\.ts$/, "").replace(/\\/g, "/")] ?? "GET";

let tmp: string;
const CSRF = { "x-requested-with": "rescoe-deploy-studio" };

beforeEach(() => {
  resetRateLimits();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hardhat-dir-"));
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("inventaire", () => {
  it("couvre bien toutes les routes du Studio (garde contre un oubli lors d'un renommage)", () => {
    expect(GUARDED.length).toBe(11);
  });
  it("chaque route appelle guardDeployStudio() et n'a plus aucun chemin personnel codé en dur", () => {
    for (const f of GUARDED) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).toContain("guardDeployStudio(");
      expect(src, f).not.toMatch(/C:\/Users|thibf/);
      expect(src, f).not.toMatch(/\bexec\(|execSync|`cd \/d/);
    }
  });
});

describe.each(GUARDED.map((f) => [path.relative(ROOT, f), f]))("%s", (_name, file) => {
  it("403 par défaut (sans opt-in), sans exécuter ni écrire quoi que ce soit", async () => {
    vi.stubEnv("HARDHAT_DIR", tmp);
    const r = await call(await load(file), { method: methodOf(file), headers: { host: "localhost:3000", ...CSRF }, remoteAddress: "127.0.0.1", body: {}, query: { name: "X" } });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("deploy_studio_disabled");
    expect(cp.execFile).not.toHaveBeenCalled();
    expect(cp.spawn).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it("403 en 'production' même avec l'opt-in", async () => {
    vi.stubEnv("ENABLE_DEPLOY_STUDIO", "true");
    vi.stubEnv("HARDHAT_DIR", tmp);
    vi.stubEnv("NODE_ENV", "production");
    const r = await call(await load(file), { method: methodOf(file), headers: CSRF, remoteAddress: "127.0.0.1", body: {}, query: { name: "X" } });
    expect(r.status).toBe(403);
    expect(cp.execFile).not.toHaveBeenCalled();
  });

  it("403 depuis une adresse non locale, même avec l'opt-in", async () => {
    vi.stubEnv("ENABLE_DEPLOY_STUDIO", "true");
    vi.stubEnv("HARDHAT_DIR", tmp);
    const r = await call(await load(file), { method: methodOf(file), headers: CSRF, remoteAddress: "203.0.113.9", body: {}, query: { name: "X" } });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("deploy_studio_local_only");
    expect(cp.execFile).not.toHaveBeenCalled();
  });
});

describe("avec opt-in local : validation stricte, rien n'est exécuté sur entrée invalide", () => {
  const local = { remoteAddress: "127.0.0.1", headers: CSRF };
  beforeEach(() => {
    vi.stubEnv("ENABLE_DEPLOY_STUDIO", "true");
    vi.stubEnv("HARDHAT_DIR", tmp);
  });
  const h = (rel: string) => load(path.join(ROOT, rel));

  it("compile : nom de contrat avec traversée / injection → 400, aucun fichier écrit", async () => {
    for (const name of ["../../evil", "a b", "x; rm -rf /", "..\\..\\x"]) {
      const r = await call(await h("contracts/compile.ts"), { ...local, body: { name, content: "pragma solidity ^0.8.0;" } });
      expect(r.status, name).toBe(400);
    }
    expect((await call(await h("contracts/compile.ts"), { ...local, body: { name: "Ok", content: "x".repeat(500_001) } })).status).toBe(400);
    expect(cp.execFile).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it("deploy : nom, arguments et réseau validés ; mainnet refusé sans second opt-in", async () => {
    const d = await h("contracts/deploy.ts");
    expect((await call(d, { ...local, body: { name: "../x" } })).status).toBe(400);
    expect((await call(d, { ...local, body: { name: "Ok", args: [{ evil: 1 }] } })).status).toBe(400);
    expect((await call(d, { ...local, body: { name: "Ok", mode: "mainnet-prod" } })).status).toBe(400);
    const main = await call(d, { ...local, body: { name: "Ok", args: [], mode: "base" } });
    expect(main.status).toBe(403);
    expect(main.body.error).toBe("mainnet_disabled");
    expect(cp.execFile).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tmp, "temp-deploy-args.json"))).toBe(false);
  });

  it("full-pipeline : adresses invalides, réseau inconnu, mainnet → refusés sans exécution", async () => {
    const p = await h("full-pipeline.ts");
    const ok = "0x" + "3".repeat(40);
    expect((await call(p, { ...local, body: { ownerAddress: "0x1", artistAddress: ok } })).status).toBe(400);
    expect((await call(p, { ...local, body: { ownerAddress: ok, artistAddress: ok, network: "evil" } })).status).toBe(400);
    expect((await call(p, { ...local, body: { ownerAddress: ok, artistAddress: ok, network: "base" } })).status).toBe(403);
    expect(cp.execFile).not.toHaveBeenCalled();
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  it("abi/source : pas de traversée de chemin", async () => {
    for (const name of ["../../secret", "a/b", "..", ""]) {
      expect((await call(await h("contracts/abi.ts"), { ...local, method: "GET", query: { name } })).status, name).toBe(400);
    }
    const src = await call(await h("contracts/source.ts"), { ...local, method: "GET", query: { name: "../../etc/passwd" } });
    expect([400, 404]).toContain(src.status);
  });

  it("deployed : écriture refusée sans en-tête CSRF, validée avec", async () => {
    const d = await h("deployed.ts");
    const addr = "0x" + "3".repeat(40);
    const noCsrf = await call(d, { method: "POST", remoteAddress: "127.0.0.1", body: { contract: { name: "A", address: addr } } });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error).toBe("deploy_studio_csrf");
    expect((await call(d, { ...local, body: { contract: { name: "A", address: "nope" } } })).status).toBe(400);
    expect((await call(d, { ...local, body: { contract: { name: "A", address: addr, network: "evil" } } })).status).toBe(400);
    expect((await call(d, { ...local, body: { contract: { name: "A", address: addr, network: "baseSepolia" } } })).status).toBe(200);
    const list = await call(d, { ...local, method: "GET" });
    expect(list.body.contracts).toHaveLength(1);
  });

  it("access : 200 avec enabled=false ou true selon le garde, sans fuite de chemin", async () => {
    const access = await load(path.join(ROOT, "access.ts"));
    vi.stubEnv("ENABLE_DEPLOY_STUDIO", "");
    const off = await call(access, { method: "GET", remoteAddress: "127.0.0.1" });
    expect(off.body.enabled).toBe(false);
    expect(JSON.stringify(off.body)).not.toContain(tmp);
    vi.stubEnv("ENABLE_DEPLOY_STUDIO", "true");
    const on = await call(access, { method: "GET", remoteAddress: "127.0.0.1" });
    expect(on.body).toEqual({ enabled: true, mainnetAllowed: false });
  });
});
