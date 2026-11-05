import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import {
  getSessionSecret,
  issueSessionToken,
  LOGIN_MAX_AGE_MS,
  SESSION_TTL_MS,
  verifyLogin,
  verifySessionToken,
} from "@/server/security/walletSession";
import { newWallet, signedLogin, TEST_SECRET } from "../helpers/wallet";

describe("verifyLogin", () => {
  const host = "localhost:3000";

  it("accepte une vraie signature fraîche et retourne l'adresse en minuscules", async () => {
    const w = newWallet();
    const { message, signature } = await signedLogin(w);
    expect(verifyLogin({ message, signature, host })).toEqual({ ok: true, address: w.address.toLowerCase() });
  });

  it("refuse une signature faite par un autre wallet (usurpation d'adresse)", async () => {
    const victim = newWallet();
    const attacker = newWallet();
    const { message } = await signedLogin(victim);
    const forged = await attacker.signMessage(message);
    expect(verifyLogin({ message, signature: forged, host })).toEqual({ ok: false, error: "address_mismatch" });
  });

  it("refuse un message altéré après signature", async () => {
    const w = newWallet();
    const { message, signature } = await signedLogin(w);
    const other = newWallet();
    const tampered = message.replace(w.address, other.address);
    expect(verifyLogin({ message: tampered, signature, host }).ok).toBe(false);
  });

  it("refuse un autre domaine (rejeu depuis un site tiers)", async () => {
    const w = newWallet();
    const { message, signature } = await signedLogin(w, { domain: "evil.example" });
    expect(verifyLogin({ message, signature, host })).toEqual({ ok: false, error: "domain_mismatch" });
  });

  it("refuse un message trop ancien ou daté du futur", async () => {
    const w = newWallet();
    const now = Date.now();
    const old = await signedLogin(w, { issuedAt: new Date(now - LOGIN_MAX_AGE_MS - 1000).toISOString() });
    expect(verifyLogin({ ...old, host }, now)).toEqual({ ok: false, error: "expired" });
    const future = await signedLogin(w, { issuedAt: new Date(now + 10 * 60_000).toISOString() });
    expect(verifyLogin({ ...future, host }, now)).toEqual({ ok: false, error: "expired" });
  });

  it("refuse entrées malformées", () => {
    expect(verifyLogin({ message: 42, signature: "0x", host })).toEqual({ ok: false, error: "bad_message" });
    expect(verifyLogin({ message: "hello", signature: "0xzz", host })).toEqual({ ok: false, error: "bad_signature" });
    expect(verifyLogin({ message: "hello", signature: "0x" + "ab".repeat(65), host })).toEqual({ ok: false, error: "bad_message" });
  });
});

describe("jeton de session", () => {
  const addr = Wallet.createRandom().address;

  it("aller-retour : le jeton porte l'adresse (minuscules) jusqu'à expiration", () => {
    const now = 1_700_000_000_000;
    const { token, expiresAt } = issueSessionToken(addr, TEST_SECRET, now);
    expect(expiresAt).toBe(now + SESSION_TTL_MS);
    expect(verifySessionToken(token, TEST_SECRET, now + 1000)).toBe(addr.toLowerCase());
    expect(verifySessionToken(token, TEST_SECRET, now + SESSION_TTL_MS + 1)).toBeNull();
  });

  it("refuse un jeton signé avec un autre secret ou modifié", () => {
    const { token } = issueSessionToken(addr, TEST_SECRET);
    expect(verifySessionToken(token, "autre-secret-".padEnd(40, "y"))).toBeNull();

    const [body, mac] = token.split(".");
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    payload.a = Wallet.createRandom().address.toLowerCase(); // changer l'adresse sans re-signer
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;
    expect(verifySessionToken(forged, TEST_SECRET)).toBeNull();
  });

  it("refuse les formes invalides", () => {
    for (const bad of ["", "abc", "a.b.c", undefined, 12, "x".repeat(700)]) expect(verifySessionToken(bad, TEST_SECRET)).toBeNull();
  });
});

describe("getSessionSecret (échec fermé)", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  it("en production : null sans secret ou avec un secret trop court", () => {
    expect(getSessionSecret(env({ NODE_ENV: "production" }))).toBeNull();
    expect(getSessionSecret(env({ NODE_ENV: "production", WALLET_SESSION_SECRET: "court" }))).toBeNull();
  });
  it("accepte un secret >= 32 caractères", () => {
    const s = "s".repeat(32);
    expect(getSessionSecret(env({ NODE_ENV: "production", WALLET_SESSION_SECRET: s }))).toBe(s);
  });
  it("hors production : secret éphémère stable pour le processus", () => {
    const a = getSessionSecret(env({ NODE_ENV: "development" }));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(getSessionSecret(env({ NODE_ENV: "development" }))).toBe(a);
  });
});
