import { isAddress } from "ethers";

/** Adresse EVM valide (checksum vérifié si l'adresse est en casse mixte). */
export function isEvmAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v) && isAddress(v);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** Évite les clés héritées ("constructor", "__proto__", "toString"…) sur un catalogue. */
export function hasOwn<T extends object>(obj: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function boundedString(v: unknown, max: number, { allowEmpty = false } = {}): string | null {
  if (typeof v !== "string") return null;
  if (v.length > max) return null;
  if (!allowEmpty && v.trim().length === 0) return null;
  return v;
}

/** Nom de contrat Solidity / Hardhat : identifiant simple, sans chemin ni espace. */
export function isContractName(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v);
}

// ─── Base64 / fichiers ────────────────────────────────────────────────────────

export type DecodeResult = { ok: true; bytes: Buffer } | { ok: false; reason: "invalid_base64" | "too_large" | "empty" };

/** Décode du base64 en vérifiant la taille AVANT d'allouer le buffer. */
export function decodeBase64Limited(v: unknown, maxBytes: number): DecodeResult {
  if (typeof v !== "string" || v.length === 0) return { ok: false, reason: "empty" };
  const clean = v.replace(/^data:[^;,]+;base64,/, "");
  if (clean.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return { ok: false, reason: "invalid_base64" };
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const size = Math.floor((clean.length * 3) / 4) - padding;
  if (size > maxBytes) return { ok: false, reason: "too_large" };
  if (size <= 0) return { ok: false, reason: "empty" };
  return { ok: true, bytes: Buffer.from(clean, "base64") };
}

export type DetectedType = "image/gif" | "image/png" | "image/jpeg" | "image/webp" | "application/zip";

/** Détection par « magic bytes » : on ne fait jamais confiance au type annoncé par le client. */
export function detectFileType(b: Buffer): DetectedType | null {
  if (b.length >= 6 && (b.toString("latin1", 0, 6) === "GIF87a" || b.toString("latin1", 0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) && (b[3] === 0x04 || b[3] === 0x06)) return "application/zip";
  return null;
}

/** Nom de fichier sûr pour Pinata (pas de chemin, pas de caractères de contrôle). */
export function safeFilename(name: unknown, fallback: string): string {
  if (typeof name !== "string") return fallback;
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ]/g, "_").slice(0, 80).trim();
  return cleaned && !cleaned.startsWith(".") ? cleaned : fallback;
}

// ─── Arguments de déploiement ─────────────────────────────────────────────────

export type DeployArg = string | number | boolean | DeployArg[];

/** Arguments de constructeur : primitives ou tableaux de primitives, tailles bornées. */
export function parseDeployArgs(v: unknown, depth = 0): DeployArg[] | null {
  if (!Array.isArray(v) || v.length > 32 || depth > 2) return null;
  const out: DeployArg[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      if (item.length > 2000) return null;
      out.push(item);
    } else if (typeof item === "number") {
      if (!Number.isFinite(item)) return null;
      out.push(item);
    } else if (typeof item === "boolean") {
      out.push(item);
    } else if (Array.isArray(item)) {
      const nested = parseDeployArgs(item, depth + 1);
      if (!nested) return null;
      out.push(nested);
    } else {
      return null;
    }
  }
  return out;
}

// ─── IPFS ─────────────────────────────────────────────────────────────────────

/** CID v0 (Qm…) ou v1 (b…) suivi d'éventuels segments de chemin sûrs, sans "..". */
export function isSafeIpfsPath(path: string): boolean {
  const [cid, ...rest] = path.split("/");
  if (!/^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,120})$/.test(cid)) return false;
  return rest.length <= 8 && rest.every((seg) => /^[A-Za-z0-9._-]{1,100}$/.test(seg) && seg !== "." && seg !== "..");
}
