import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "../helpers/http";
import { newWallet, signedLogin, TEST_SECRET } from "../helpers/wallet";
import { resetRateLimits } from "@/server/security/rateLimit";
import { verifySessionToken } from "@/server/security/walletSession";

const load = async (p: string) => (await import(/* @vite-ignore */ p)).default as (req: any, res: any) => Promise<unknown>;

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("WALLET_SESSION_SECRET", TEST_SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/wallet/session", () => {
  const route = () => load("../../pages/api/wallet/session");

  it("échange une vraie signature contre un jeton lié à l'adresse", async () => {
    const w = newWallet();
    const r = await call(await route(), { body: await signedLogin(w) });
    expect(r.status).toBe(200);
    expect(r.body.address).toBe(w.address.toLowerCase());
    expect(verifySessionToken(r.body.token, TEST_SECRET)).toBe(w.address.toLowerCase());
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("401 : mauvais domaine, signature d'un autre wallet, message périmé", async () => {
    const h = await route();
    const w = newWallet();
    expect((await call(h, { body: await signedLogin(w, { domain: "evil.example" }) })).body.error).toBe("domain_mismatch");

    const { message } = await signedLogin(w);
    expect((await call(h, { body: { message, signature: await newWallet().signMessage(message) } })).body.error).toBe("address_mismatch");

    const stale = await signedLogin(w, { issuedAt: new Date(Date.now() - 10 * 60_000).toISOString() });
    expect((await call(h, { body: stale })).body.error).toBe("expired");
  });

  it("405 sur GET, 415 sans JSON, 503 en production sans secret", async () => {
    const h = await route();
    expect((await call(h, { method: "GET" })).status).toBe(405);
    expect((await call(h, { body: "x", headers: { "content-type": "text/plain" } })).status).toBe(415);
    vi.stubEnv("WALLET_SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(h, { body: await signedLogin(newWallet()) })).status).toBe(503);
  });

  it("429 : 20 tentatives / 10 min par IP (anti brute-force)", async () => {
    const h = await route();
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) codes.push((await call(h, { body: { message: "x", signature: "y" } })).status);
    expect(codes[19]).toBe(401);
    expect(codes[20]).toBe(429);
  });
});

describe("GET /api/revalidate", () => {
  const route = () => load("../../pages/api/revalidate");
  const SECRET = "s3cr3t-revalidate-value";

  it("500 si le secret serveur n'est pas configuré (échec fermé)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(await route(), { method: "GET", headers: { "x-revalidate-secret": "x" } })).status).toBe(500);
  });

  it("401 : mauvais secret, secret de longueur différente, secret en query en production", async () => {
    vi.stubEnv("REVALIDATE_SECRET", SECRET);
    const h = await route();
    expect((await call(h, { method: "GET" })).status).toBe(401);
    expect((await call(h, { method: "GET", headers: { "x-revalidate-secret": "nope" } })).status).toBe(401);
    expect((await call(h, { method: "GET", headers: { "x-revalidate-secret": SECRET + "x" } })).status).toBe(401);
    vi.stubEnv("NODE_ENV", "production");
    expect((await call(h, { method: "GET", query: { secret: SECRET } })).status).toBe(401);
  });

  it("200 avec le bon secret en en-tête ; tokenId non numérique refusé", async () => {
    vi.stubEnv("REVALIDATE_SECRET", SECRET);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const h = await route();
    const ok = await call(h, { method: "GET", headers: { "x-revalidate-secret": SECRET }, query: { caches: "members" } });
    expect(ok.status).toBe(200);
    expect(ok.body.invalidated).toEqual(["members"]);
    const bad = await call(h, { method: "GET", headers: { "x-revalidate-secret": SECRET }, query: { caches: "adhesion-evolution", tokenId: "1;drop" } });
    expect(bad.status).toBe(400);
  });
});

describe("GET /api/proxy", () => {
  const route = () => load("../../pages/api/proxy");
  const mockUpstream = () => {
    const f = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", f);
    return f;
  };

  it("refuse hôtes hors liste, http, identifiants dans l'URL et méthodes non-GET — sans appel réseau", async () => {
    const f = mockUpstream();
    const h = await route();
    for (const url of [
      "https://evil.example/x", "http://deep-index.moralis.io/x", "https://deep-index.moralis.io.evil.example/x",
      "https://user:pw@deep-index.moralis.io/x", "file:///etc/passwd", "javascript:alert(1)", "https://localhost/x", "https://169.254.169.254/latest",
    ]) {
      expect((await call(h, { method: "GET", query: { url } })).status, url).toBe(400);
    }
    expect((await call(h, { method: "POST", query: { url: "https://deep-index.moralis.io/x" } })).status).toBe(405);
    expect(f).not.toHaveBeenCalled();
  });

  it("n'envoie la clé Moralis qu'aux hôtes Moralis (jamais à Basescan)", async () => {
    vi.stubEnv("MORALIS_API_KEY", "moralis-key-value-123456");
    const f = mockUpstream();
    const h = await route();
    await call(h, { method: "GET", query: { url: "https://deep-index.moralis.io/api/v2.2/x" } });
    expect(f.mock.calls[0][1].headers["x-api-key"]).toBe("moralis-key-value-123456");
    await call(h, { method: "GET", query: { url: "https://api.basescan.org/api?module=account" } });
    expect(f.mock.calls[1][1].headers["x-api-key"]).toBeUndefined();
  });
});

describe("GET /api/basescan et /api/ipfs", () => {
  it("basescan : adresse validée (pas d'injection de paramètres), sinon aucun appel", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [] }) });
    vi.stubGlobal("fetch", f);
    const h = await load("../../pages/api/basescan");
    for (const address of ["0x123", "0x" + "3".repeat(40) + "&module=proxy", undefined]) {
      expect((await call(h, { method: "GET", query: address ? { address } : {} })).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
    expect((await call(h, { method: "GET", query: { address: "0x" + "3".repeat(40) } })).status).toBe(200);
    const url = new URL(String(f.mock.calls[0][0]));
    expect(url.searchParams.get("address")).toBe("0x" + "3".repeat(40));
    expect(url.searchParams.getAll("module")).toEqual(["account"]);
  });

  it("ipfs et metadata : CID invalide ou traversée → 400 sans appel aux passerelles", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const ipfs = await load("../../pages/api/ipfs/[cid]");
    const meta = await load("../../pages/api/metadata/[cid]");
    expect((await call(ipfs, { method: "GET", query: { cid: ["QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", "..", "admin"] } })).status).toBe(400);
    expect((await call(ipfs, { method: "GET", query: { cid: "not-a-cid" } })).status).toBe(400);
    expect((await call(ipfs, { method: "POST", query: { cid: "x" } })).status).toBe(405);
    expect((await call(meta, { method: "GET", query: { cid: "../x" } })).status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});
