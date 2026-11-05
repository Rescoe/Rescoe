/**
 * Routes qui dépensent le gas du relayer ou appellent Stripe/Pinata :
 * authentification par session wallet, autorisation (adresse = session), validation, secrets.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "../helpers/http";
import { bearerFor, newWallet, TEST_SECRET } from "../helpers/wallet";
import { resetRateLimits } from "@/server/security/rateLimit";
import { release, tryAcquire } from "@/server/security/inflight";
import nftMetadata from "@/data/nft_metadata_clean.json";

const RELAYER_ADDR = "0x1111111111111111111111111111111111111111";

const chain = vi.hoisted(() => ({
  getPendingPoints: vi.fn(),
  rewardRelayer: vi.fn(),
  distributeToAdhesion: vi.fn(),
  claimTo: vi.fn(),
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  class FakeWallet {
    async getAddress() {
      return "0x1111111111111111111111111111111111111111";
    }
  }
  class FakeContract {
    constructor() {
      return chain as unknown as FakeContract;
    }
  }
  return { ...actual, ethers: { ...actual, JsonRpcProvider: class {}, Wallet: FakeWallet, Contract: FakeContract } };
});

const load = async (p: string) => (await import(/* @vite-ignore */ p)).default as (req: any, res: any) => Promise<unknown>;

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("WALLET_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_URL_SERVER_MORALIS", "https://rpc.example/v2/SUPERSECRETRPCKEY123");
  vi.stubEnv("RELAYER_PK", "0x" + "ab".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT", "0x2222222222222222222222222222222222222222");
});
afterEach(() => vi.unstubAllEnvs());

const ROUTES: { name: string; path: string; method?: string; body: unknown }[] = [
  { name: "claim-reward", path: "../../pages/api/claim-reward/index", body: { user: "0x" + "3".repeat(40) } },
  { name: "claim (faucet)", path: "../../pages/api/claim", body: { user: "0x" + "3".repeat(40) } },
  { name: "create-onramp-session", path: "../../pages/api/create-onramp-session", body: { walletAddress: "0x" + "3".repeat(40) } },
  { name: "pinata/upload", path: "../../pages/api/pinata/upload", body: { scope: "oeuvres", fileBase64: "AAAA", metadata: {} } },
  { name: "pinata/pin", path: "../../pages/api/pinata/pin", body: { kind: "json", json: {} } },
  { name: "upload-insect-relayer", path: "../../pages/api/token/upload-insect-relayer", body: { insectKey: "x" } },
  { name: "upload-insect-relayer-v3", path: "../../pages/api/token/upload-insect-relayer-v3", body: { insectKey: "x" } },
  { name: "upload-egg-relayer", path: "../../pages/api/token/upload-egg-relayer", body: { eggIndex: 1 } },
];

describe.each(ROUTES)("$name — authentification", ({ path, body }) => {
  it("401 sans jeton, avec jeton falsifié, ou signé par un autre secret", async () => {
    const h = await load(path);
    expect((await call(h, { body })).status).toBe(401);
    expect((await call(h, { body, headers: { authorization: "Bearer n.importe.quoi" } })).status).toBe(401);
    const forged = bearerFor(newWallet().address).authorization.slice(0, -3) + "AAA";
    expect((await call(h, { body, headers: { authorization: forged } })).status).toBe(401);
  });

  it("405 + Allow sur GET", async () => {
    const r = await call(await load(path), { method: "GET" });
    expect(r.status).toBe(405);
    expect(r.headers["allow"]).toBe("POST");
  });

  it("échec fermé : 503 si WALLET_SESSION_SECRET est absent en production", async () => {
    vi.stubEnv("WALLET_SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const r = await call(await load(path), { body, headers: bearerFor(newWallet().address) });
    expect(r.status).toBe(503);
  });

  it("415 si le corps n'est pas du JSON", async () => {
    const r = await call(await load(path), { body: "texte", headers: { ...bearerFor(newWallet().address), "content-type": "text/plain" } });
    expect(r.status).toBe(415);
  });
});

describe("claim-reward — autorisation et fuites", () => {
  const w = newWallet();
  const user = w.address.toLowerCase();

  it("403 : on ne peut pas déclencher une tx relayer pour l'adresse de quelqu'un d'autre", async () => {
    const victim = newWallet().address;
    const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user: victim }, headers: bearerFor(w.address) });
    expect(r.status).toBe(403);
    expect(chain.distributeToAdhesion).not.toHaveBeenCalled();
  });

  it("400 sur adresse invalide, avant toute action on-chain", async () => {
    const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user: "0x123" }, headers: bearerFor(w.address) });
    expect(r.status).toBe(400);
    expect(chain.getPendingPoints).not.toHaveBeenCalled();
  });

  it("503 sans fuite quand la config serveur manque", async () => {
    vi.stubEnv("RELAYER_PK", "");
    const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toMatch(/RELAYER|SUPERSECRET/);
  });

  it("succès : distribue pour l'adresse authentifiée", async () => {
    chain.getPendingPoints.mockResolvedValue(5n);
    chain.rewardRelayer.mockResolvedValue(RELAYER_ADDR);
    chain.distributeToAdhesion.mockResolvedValue({ hash: "0xhash", wait: async () => ({ blockNumber: 12, status: 1 }) });
    const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, points: "5", txHash: "0xhash" });
    expect(chain.distributeToAdhesion).toHaveBeenCalledWith(user, expect.anything());
  });

  it("400 sans points en attente ; 403 si le relayer n'est pas autorisé", async () => {
    chain.getPendingPoints.mockResolvedValueOnce(0n);
    expect((await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) })).status).toBe(400);
    chain.getPendingPoints.mockResolvedValueOnce(1n);
    chain.rewardRelayer.mockResolvedValueOnce("0x9999999999999999999999999999999999999999");
    expect((await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) })).status).toBe(403);
    expect(chain.distributeToAdhesion).not.toHaveBeenCalled();
  });

  it("RÉGRESSION : une erreur RPC (URL avec clé API) n'est jamais renvoyée au client ni journalisée en clair", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    chain.getPendingPoints.mockRejectedValue(new Error("could not fetch https://rpc.example/v2/SUPERSECRETRPCKEY123 (code=SERVER_ERROR)"));
    const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) });
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("SUPERSECRET");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SUPERSECRET");
  });

  it("429 au-delà de 3 tentatives par minute pour la même adresse", async () => {
    chain.getPendingPoints.mockResolvedValue(0n);
    const h = await load("../../pages/api/claim-reward/index");
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await call(h, { body: { user }, headers: bearerFor(w.address) })).status);
    expect(statuses).toEqual([400, 400, 400, 429]);
  });

  it("409 si une distribution est déjà en cours pour cette adresse", async () => {
    expect(tryAcquire(`claim-reward:${user}`)).toBe(true);
    try {
      const r = await call(await load("../../pages/api/claim-reward/index"), { body: { user }, headers: bearerFor(w.address) });
      expect(r.status).toBe(409);
    } finally {
      release(`claim-reward:${user}`);
    }
  });
});

describe("faucet /api/claim et Stripe onramp — autorisation", () => {
  const w = newWallet();

  it("403 si l'adresse visée n'est pas celle de la session", async () => {
    const other = newWallet().address;
    expect((await call(await load("../../pages/api/claim"), { body: { user: other }, headers: bearerFor(w.address) })).status).toBe(403);
    expect((await call(await load("../../pages/api/create-onramp-session"), { body: { walletAddress: other }, headers: bearerFor(w.address) })).status).toBe(403);
    expect(chain.claimTo).not.toHaveBeenCalled();
  });

  it("onramp : 400 adresse invalide, 503 si STRIPE_PRIVATE manque (sans le nommer au client)", async () => {
    const h = await load("../../pages/api/create-onramp-session");
    expect((await call(h, { body: { walletAddress: "nope" }, headers: bearerFor(w.address) })).status).toBe(400);
    vi.stubEnv("STRIPE_PRIVATE", "");
    const r = await call(h, { body: { walletAddress: w.address }, headers: bearerFor(w.address) });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toContain("STRIPE");
  });
});

describe("relayers d'upload d'insectes/œufs", () => {
  const w = newWallet();
  const realKey = Object.keys(nftMetadata)[0];

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_INSECT_STORAGE", "0x4444444444444444444444444444444444444444");
    vi.stubEnv("NEXT_PUBLIC_INSECT_STORAGE_V3", "0x5555555555555555555555555555555555555555");
  });

  it.each([["upload-insect-relayer"], ["upload-insect-relayer-v3"]])("%s : clés héritées (constructor, __proto__…) → 404, pas 500", async (name) => {
    const h = await load(`../../pages/api/token/${name}`);
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      const r = await call(h, { body: { insectKey: key }, headers: bearerFor(w.address) });
      expect(r.status, key).toBe(404);
    }
    expect((await call(h, { body: { insectKey: "" }, headers: bearerFor(w.address) })).status).toBe(400);
    expect((await call(h, { body: { insectKey: { a: 1 } }, headers: bearerFor(w.address) })).status).toBe(400);
  });

  it.each([["upload-insect-relayer"], ["upload-insect-relayer-v3"]])("%s : 503 (sans fuite) si RELAYER_PK manque, 409 si déjà en cours", async (name) => {
    const h = await load(`../../pages/api/token/${name}`);
    vi.stubEnv("RELAYER_PK", "");
    const missing = await call(h, { body: { insectKey: realKey }, headers: bearerFor(w.address) });
    expect(missing.status).toBe(503);
    expect(JSON.stringify(missing.body)).not.toMatch(/RELAYER|PK/);

    vi.stubEnv("RELAYER_PK", "0x" + "ab".repeat(32));
    const lock = `${name.endsWith("v3") ? "insect-v3" : "insect"}:${realKey}`;
    expect(tryAcquire(lock)).toBe(true);
    try {
      expect((await call(h, { body: { insectKey: realKey }, headers: bearerFor(w.address) })).status).toBe(409);
    } finally {
      release(lock);
    }
  });

  it("upload-egg-relayer : eggIndex strictement entier 1-9", async () => {
    const h = await load("../../pages/api/token/upload-egg-relayer");
    for (const eggIndex of [0, 10, -1, 1.5, "3", null, [1], NaN]) {
      expect((await call(h, { body: { eggIndex }, headers: bearerFor(w.address) })).status, String(eggIndex)).toBe(400);
    }
    vi.stubEnv("RELAYER_PK", "");
    expect((await call(h, { body: { eggIndex: 3 }, headers: bearerFor(w.address) })).status).toBe(503);
  });

  it("429 : limite par IP sur les relayers", async () => {
    const h = await load("../../pages/api/token/upload-egg-relayer");
    const out: number[] = [];
    for (let i = 0; i < 31; i++) out.push((await call(h, { body: { eggIndex: 1 } })).status);
    expect(out.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(out[30]).toBe(429);
  });
});
