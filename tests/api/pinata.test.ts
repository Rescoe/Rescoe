import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "../helpers/http";
import { bearerFor, newWallet, TEST_SECRET } from "../helpers/wallet";
import { resetRateLimits } from "@/server/security/rateLimit";
import { buildMetadata } from "@/server/pinata";

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwaW5hdGEifQ.c2lnbmF0dXJlLXRyZXMtbG9uZ3VlLWRlLXRlc3Q";
const GIF = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(32, 7)]).toString("base64");
const w = newWallet();
const auth = bearerFor(w.address);

const load = async (p: string) => (await import(/* @vite-ignore */ p)).default as (req: any, res: any) => Promise<unknown>;
const upload = () => load("../../pages/api/pinata/upload");
const pin = () => load("../../pages/api/pinata/pin");

let fetchMock: ReturnType<typeof vi.fn>;
const pinataOk = (cid: string) => ({ ok: true, status: 200, json: async () => ({ IpfsHash: cid }) });
const CID1 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const CID2 = "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o";

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("WALLET_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("PINATA_JWT_ARTWORKS", JWT);
  vi.stubEnv("PINATA_JWT_BADGES", JWT);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/api/pinata/upload", () => {
  it("n'appelle jamais Pinata sans session", async () => {
    const r = await call(await upload(), { body: { scope: "oeuvres", fileBase64: GIF, metadata: {} } });
    expect(r.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valide scope, métadonnées, image (taille, octets) avant tout appel Pinata", async () => {
    const h = await upload();
    const base = { scope: "oeuvres", fileBase64: GIF, metadata: { name: "x" } };
    expect((await call(h, { headers: auth, body: { ...base, scope: "admin" } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { ...base, metadata: "str" } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { ...base, metadata: { big: "x".repeat(70_000) } } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { ...base, fileBase64: Buffer.from("<script>alert(1)</script>").toString("base64") } })).status).toBe(415);
    expect((await call(h, { headers: auth, body: { ...base, fileBase64: "####" } })).status).toBe(400);
    const tooBig = Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(3 * 1024 * 1024)]).toString("base64");
    expect((await call(h, { headers: auth, body: { ...base, fileBase64: tooBig } })).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("503 si le JWT serveur est absent — sans le nommer", async () => {
    vi.stubEnv("PINATA_JWT_ARTWORKS", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await call(await upload(), { headers: auth, body: { scope: "oeuvres", fileBase64: GIF, metadata: {} } });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.body)).not.toMatch(/JWT|PINATA/i);
  });

  it("succès : le CID de l'image est imposé par le serveur ; un `image` fourni par le client est écrasé", async () => {
    fetchMock.mockResolvedValueOnce(pinataOk(CID1)).mockResolvedValueOnce(pinataOk(CID2));
    const r = await call(await upload(), {
      headers: auth,
      body: { scope: "badges", fileBase64: GIF, metadata: { name: "Bee", role: "Artiste", image: "ipfs://QmEVILEVILEVILEVILEVILEVILEVILEVILEVILEVILEVIL" } },
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ image: `ipfs://${CID1}`, metadata: `ipfs://${CID2}`, imageHash: CID1, metadataHash: CID2 });

    const [fileUrl, fileInit] = fetchMock.mock.calls[0];
    expect(fileUrl).toBe("https://api.pinata.cloud/pinning/pinFileToIPFS");
    expect(fileInit.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect((fileInit.body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(((fileInit.body as FormData).get("file") as File).name).toBe("badge.gif");

    const pinned = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(pinned.image).toBe(`ipfs://${CID1}`);
    expect(JSON.stringify(r.body)).not.toContain(JWT);
  });

  it("RÉGRESSION : si Pinata échoue, ni le JWT ni le corps d'erreur ne remontent au client ou aux logs", async () => {
    const errLog = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: `bad token ${JWT}` }) });
    const r = await call(await upload(), { headers: auth, body: { scope: "oeuvres", fileBase64: GIF, metadata: {} } });
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain(JWT);
    expect(JSON.stringify(errLog.mock.calls)).not.toContain(JWT);
  });

  it("limite par wallet : 10 uploads / 10 min", async () => {
    fetchMock.mockImplementation(async () => pinataOk(CID1));
    const h = await upload();
    const body = { scope: "oeuvres", fileBase64: GIF, metadata: {} };
    const out: number[] = [];
    for (let i = 0; i < 11; i++) out.push((await call(h, { headers: auth, body })).status);
    expect(out.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(out[10]).toBe(429);
  });
});

describe("/api/pinata/pin", () => {
  it("kind inconnu, JSON non-objet ou trop gros → 400 sans appel Pinata", async () => {
    const h = await pin();
    expect((await call(h, { headers: auth, body: { kind: "exec" } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { kind: "json", json: [1] } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { kind: "json", json: { a: "x".repeat(70_000) } } })).status).toBe(400);
    expect((await call(h, { headers: auth, body: { kind: "file", fileBase64: "" } })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("assainit le nom de fichier (pas de traversée) et retourne le CID", async () => {
    fetchMock.mockResolvedValueOnce(pinataOk(CID1));
    const r = await call(await pin(), {
      headers: auth,
      body: { kind: "file", fileBase64: Buffer.from("<html></html>").toString("base64"), filename: "../../etc/passwd" },
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ cid: CID1, uri: `ipfs://${CID1}` });
    expect(((fetchMock.mock.calls[0][1].body as FormData).get("file") as File).name).toBe("passwd");
  });

  it("épingle un JSON avec le JWT 'oeuvres' côté serveur", async () => {
    fetchMock.mockResolvedValueOnce(pinataOk(CID2));
    const r = await call(await pin(), { headers: auth, body: { kind: "json", json: { name: "Salon" } } });
    expect(r.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.pinata.cloud/pinning/pinJSONToIPFS");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Salon" });
  });
});

describe("buildMetadata", () => {
  it("impose image=ipfs://CID même si le client en fournit une (badges et oeuvres)", () => {
    for (const scope of ["badges", "oeuvres"] as const) {
      const m = buildMetadata(scope, { name: "x", image: "ipfs://evil", custom_data: { image: "ipfs://evil2" } }, CID1);
      expect(m.image).toBe(`ipfs://${CID1}`);
    }
  });
});
