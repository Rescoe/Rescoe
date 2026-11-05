import type { NextApiRequest, NextApiResponse } from "next";
import { getClientIp } from "./clientIp";

/**
 * Rate limiting à fenêtre fixe, en mémoire.
 *
 * LIMITE CONNUE : les compteurs vivent dans l'instance Node courante. Sur Vercel
 * (plusieurs instances serverless) la limite effective est donc « par instance » :
 * c'est un frein anti-abus best-effort, pas une garantie globale. Pour une garantie
 * globale, brancher un store partagé (Vercel KV / Upstash) derrière `checkRateLimit`.
 */

export interface RateLimitRule {
  /** nombre maximal de requêtes par fenêtre */
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const MAX_BUCKETS = 10_000;

const g = globalThis as unknown as { __rescoeRateBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__rescoeRateBuckets ??= new Map());

function purgeExpired(now: number) {
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  if (buckets.size >= MAX_BUCKETS) {
    purgeExpired(now);
    // Toujours saturé après purge : on évite une croissance mémoire non bornée.
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
  }

  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, b);
  }
  b.count += 1;

  const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  return { ok: b.count <= rule.limit, remaining: Math.max(0, rule.limit - b.count), retryAfterSec };
}

/** Réservé aux tests. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Applique la règle pour (route, IP[, sujet]). Répond 429 et retourne false si dépassée.
 * `subject` permet une seconde limite par adresse de wallet en plus de la limite par IP.
 */
export function enforceRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  route: string,
  rule: RateLimitRule,
  subject?: string
): boolean {
  const keys = [`${route}|ip:${getClientIp(req)}`];
  if (subject) keys.push(`${route}|sub:${subject.toLowerCase()}`);

  for (const key of keys) {
    const r = checkRateLimit(key, rule);
    if (!r.ok) {
      res.setHeader("Retry-After", String(r.retryAfterSec));
      res.status(429).json({ error: "rate_limited", message: "Trop de requêtes, réessayez plus tard." });
      return false;
    }
  }
  return true;
}
