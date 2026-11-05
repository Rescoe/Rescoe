/**
 * Session wallet côté navigateur : UNE signature (personal_sign, sans frais ni transaction)
 * ouvre une session de 30 min, mise en cache pour les appels aux routes protégées.
 * Voir src/server/security/walletSession.ts pour le côté serveur.
 */
import { buildLoginMessage } from "@/shared/loginMessage";

export type PersonalSign = (message: string, address: string) => Promise<string>;

interface StoredSession {
  token: string;
  address: string;
  expiresAt: number;
}

const STORAGE_KEY = "rescoe_wallet_session";
const REFRESH_MARGIN_MS = 60_000;

let memory: StoredSession | null = null;
const pending = new Map<string, Promise<string>>(); // une seule signature à la fois par adresse

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function readCached(address: string, now = Date.now()): string | null {
  let s = memory;
  if (!s) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      s = raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      s = null; // stockage indisponible (navigation privée, SSR…)
    }
  }
  if (!s || s.address !== address.toLowerCase() || s.expiresAt - REFRESH_MARGIN_MS <= now) return null;
  memory = s;
  return s.token;
}

function store(s: StoredSession) {
  memory = s;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* le cache mémoire suffit */
  }
}

export function clearWalletSession() {
  memory = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Signeur basé sur un provider EIP-1193 (MetaMask, Web3Auth…). */
export function providerSigner(provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }): PersonalSign {
  return async (message, address) => {
    const hex = "0x" + toHex(new TextEncoder().encode(message));
    return (await provider.request({ method: "personal_sign", params: [hex, address] })) as string;
  };
}

async function login(address: string, sign: PersonalSign): Promise<string> {
  const message = buildLoginMessage({
    address,
    domain: window.location.host,
    nonce: toHex(crypto.getRandomValues(new Uint8Array(16))),
    issuedAt: new Date().toISOString(),
  });
  const signature = await sign(message, address);

  const res = await fetch("/api/wallet/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.token !== "string") {
    throw new Error(res.status === 503 ? "Service d'authentification indisponible." : "Connexion wallet refusée.");
  }
  store({ token: data.token, address: address.toLowerCase(), expiresAt: Number(data.expiresAt) });
  return data.token;
}

export function getSessionToken(address: string, sign: PersonalSign, force = false): Promise<string> {
  if (!force) {
    const cached = readCached(address);
    if (cached) return Promise.resolve(cached);
  }
  const key = address.toLowerCase();
  let p = pending.get(key);
  if (!p) {
    p = login(address, sign).finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

export interface WalletAuth {
  address: string;
  sign: PersonalSign;
}

/** fetch avec `Authorization: Bearer`. Un 401 (jeton expiré) déclenche une seule re-signature. */
export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}, auth: WalletAuth): Promise<Response> {
  const send = async (force: boolean) => {
    const token = await getSessionToken(auth.address, auth.sign, force);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const res = await send(false);
  if (res.status !== 401) return res;
  clearWalletSession();
  return send(true);
}
