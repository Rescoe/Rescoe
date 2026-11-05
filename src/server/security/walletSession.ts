import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { verifyMessage } from "ethers";
import { isEvmAddress } from "./validators";
import { parseLoginMessage } from "@/shared/loginMessage";

export { buildLoginMessage, parseLoginMessage, type LoginMessageFields } from "@/shared/loginMessage";

/**
 * Session wallet sans état (serverless-friendly).
 *
 *  1. Le navigateur signe UNE fois un message (personal_sign, aucun frais, aucune tx)
 *     qui nomme l'adresse, le domaine, un nonce et l'heure d'émission.
 *  2. POST /api/wallet/session vérifie la signature, le domaine et la fraîcheur, puis
 *     émet un jeton HMAC-SHA256 valable SESSION_TTL_MS, lié à l'adresse.
 *  3. Les routes sensibles exigent `Authorization: Bearer <jeton>` (voir guards.ts).
 *
 * Le secret HMAC (WALLET_SESSION_SECRET, >= 32 caractères, serveur uniquement) est
 * obligatoire en production : sans lui, les routes protégées répondent 503 (fail closed).
 * Hors production, un secret éphémère est généré au démarrage du processus.
 */

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const LOGIN_MAX_AGE_MS = 5 * 60 * 1000;
const LOGIN_FUTURE_SKEW_MS = 60 * 1000;
const MIN_SECRET_LENGTH = 32;

// ─── Secret ───────────────────────────────────────────────────────────────────

const g = globalThis as unknown as { __rescoeEphemeralSessionSecret?: string };

export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.WALLET_SESSION_SECRET;
  if (configured && configured.length >= MIN_SECRET_LENGTH) return configured;
  if (env.NODE_ENV === "production") return null;
  return (g.__rescoeEphemeralSessionSecret ??= randomBytes(32).toString("hex"));
}

// ─── Message de connexion (format partagé : src/shared/loginMessage.ts) ──────

export type LoginError = "bad_message" | "bad_signature" | "domain_mismatch" | "expired" | "address_mismatch";

/** Vérifie signature + domaine + fraîcheur. Retourne l'adresse prouvée (minuscules). */
export function verifyLogin(
  input: { message: unknown; signature: unknown; host: string | undefined },
  now = Date.now()
): { ok: true; address: string } | { ok: false; error: LoginError } {
  if (typeof input.message !== "string" || input.message.length > 1000) return { ok: false, error: "bad_message" };
  if (typeof input.signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(input.signature)) {
    return { ok: false, error: "bad_signature" };
  }

  const fields = parseLoginMessage(input.message);
  if (!fields || !isEvmAddress(fields.address)) return { ok: false, error: "bad_message" };
  if (!input.host || fields.domain.toLowerCase() !== input.host.toLowerCase()) {
    return { ok: false, error: "domain_mismatch" };
  }

  const issued = Date.parse(fields.issuedAt);
  if (!Number.isFinite(issued) || now - issued > LOGIN_MAX_AGE_MS || issued - now > LOGIN_FUTURE_SKEW_MS) {
    return { ok: false, error: "expired" };
  }

  let recovered: string;
  try {
    recovered = verifyMessage(input.message, input.signature);
  } catch {
    return { ok: false, error: "bad_signature" };
  }
  if (recovered.toLowerCase() !== fields.address.toLowerCase()) return { ok: false, error: "address_mismatch" };

  return { ok: true, address: recovered.toLowerCase() };
}

// ─── Jeton de session ─────────────────────────────────────────────────────────

interface TokenPayload {
  v: 1;
  a: string; // adresse, minuscules
  iat: number;
  exp: number;
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest();

export function issueSessionToken(address: string, secret: string, now = Date.now()): { token: string; expiresAt: number } {
  const payload: TokenPayload = { v: 1, a: address.toLowerCase(), iat: now, exp: now + SESSION_TTL_MS };
  const body = b64u(JSON.stringify(payload));
  return { token: `${body}.${b64u(sign(body, secret))}`, expiresAt: payload.exp };
}

/** Retourne l'adresse liée au jeton, ou null (format, signature, expiration). */
export function verifySessionToken(token: unknown, secret: string, now = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;

  const expected = sign(body, secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (p.v !== 1 || typeof p.a !== "string" || !isEvmAddress(p.a) || typeof p.exp !== "number") return null;
    if (p.exp <= now || p.iat > now + LOGIN_FUTURE_SKEW_MS) return null;
    return p.a.toLowerCase();
  } catch {
    return null;
  }
}
