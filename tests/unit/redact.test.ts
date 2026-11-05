import { describe, expect, it } from "vitest";
import { hostOf, redactSecrets } from "@/server/security/redact";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("redactSecrets", () => {
  it("réduit les URL RPC à scheme://host (la clé API est dans le chemin)", () => {
    const out = redactSecrets(new Error("failed https://base-mainnet.g.alchemy.com/v2/ABCDEF1234567890SECRET?x=1"), env({}));
    expect(out).toContain("https://base-mainnet.g.alchemy.com");
    expect(out).not.toContain("ABCDEF1234567890SECRET");
  });
  it("masque JWT, Bearer, clés Stripe et clés privées hex", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const pk = "0x" + "ab".repeat(32);
    const text = `jwt=${jwt} Authorization: Bearer abcdefghijkl123456 stripe sk_live_abcdefghij1234 pk=${pk} bare=${"cd".repeat(32)}`;
    const out = redactSecrets(text, env({}));
    for (const leaked of [jwt, "abcdefghijkl123456", "sk_live_abcdefghij1234", pk, "cd".repeat(32)]) expect(out).not.toContain(leaked);
  });
  it("masque la valeur littérale des secrets d'environnement connus", () => {
    const out = redactSecrets("erreur avec la clé SuperSecretValue-123 dedans", env({ MORALIS_API_KEY: "SuperSecretValue-123" }));
    expect(out).not.toContain("SuperSecretValue-123");
    expect(out).toContain("[MORALIS_API_KEY]");
  });
  it("tronque et ne plante pas sur des objets circulaires", () => {
    const a: any = {};
    a.self = a;
    expect(() => redactSecrets(a, env({}))).not.toThrow();
    expect(redactSecrets("x".repeat(5000), env({})).length).toBeLessThanOrEqual(2000);
  });
});

describe("hostOf", () => {
  it("ne garde que l'hôte", () => {
    expect(hostOf("https://base-mainnet.g.alchemy.com/v2/SECRET")).toBe("base-mainnet.g.alchemy.com");
    expect(hostOf("pas une url")).toBe("[rpc]");
  });
});
