import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, enforceRateLimit, resetRateLimits } from "@/server/security/rateLimit";
import { getClientIp } from "@/server/security/clientIp";
import { mockReq, mockRes } from "../helpers/http";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  const rule = { limit: 3, windowMs: 1000 };
  it("laisse passer `limit` requêtes puis bloque, avec un Retry-After", () => {
    const t = 10_000;
    expect([1, 2, 3].map(() => checkRateLimit("k", rule, t).ok)).toEqual([true, true, true]);
    const blocked = checkRateLimit("k", rule, t + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
  it("repart à zéro après la fenêtre, et isole les clés", () => {
    const t = 50_000;
    for (let i = 0; i < 4; i++) checkRateLimit("a", rule, t);
    expect(checkRateLimit("b", rule, t).ok).toBe(true);
    expect(checkRateLimit("a", rule, t + 1001).ok).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  it("répond 429 + Retry-After à la requête qui dépasse, et limite aussi par wallet", () => {
    const rule = { limit: 2, windowMs: 60_000 };
    const go = (ip: string, subject?: string) => {
      const out = mockRes();
      const ok = enforceRateLimit(mockReq({ remoteAddress: ip }), out.res, "route", rule, subject);
      return { ok, out };
    };
    expect(go("198.51.100.1").ok).toBe(true);
    expect(go("198.51.100.1").ok).toBe(true);
    const third = go("198.51.100.1");
    expect(third.ok).toBe(false);
    expect(third.out.status).toBe(429);
    expect(third.out.headers["retry-after"]).toBeDefined();

    // autre IP, mais même wallet : bloqué par la limite par sujet
    expect(go("198.51.100.2", "0xABC").ok).toBe(true);
    expect(go("198.51.100.3", "0xabc").ok).toBe(true);
    expect(go("198.51.100.4", "0xAbC").ok).toBe(false);
  });
});

describe("getClientIp", () => {
  const req = (xff: string | undefined, remote = "10.0.0.9") =>
    mockReq({ headers: xff ? { "x-forwarded-for": xff } : {}, remoteAddress: remote });
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

  it("ignore X-Forwarded-For forgé quand aucun proxy n'est de confiance", () => {
    expect(getClientIp(req("1.2.3.4"), env({}))).toBe("10.0.0.9");
  });
  it("lit X-Forwarded-For derrière Vercel / TRUST_PROXY, et rejette une valeur non-IP", () => {
    expect(getClientIp(req("1.2.3.4, 10.1.1.1"), env({ VERCEL: "1" }))).toBe("1.2.3.4");
    expect(getClientIp(req("1.2.3.4"), env({ TRUST_PROXY: "1" }))).toBe("1.2.3.4");
    expect(getClientIp(req("not-an-ip"), env({ VERCEL: "1" }))).toBe("10.0.0.9");
  });
  it("normalise ::ffff: et retombe sur 'unknown'", () => {
    expect(getClientIp(req(undefined, "::ffff:192.0.2.1"), env({}))).toBe("192.0.2.1");
    expect(getClientIp(req(undefined, ""), env({}))).toBe("unknown");
  });
});
