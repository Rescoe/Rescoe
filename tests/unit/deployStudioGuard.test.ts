import { describe, expect, it } from "vitest";
import {
  DEPLOY_STUDIO_HEADER,
  DEPLOY_STUDIO_HEADER_VALUE,
  evaluateDeployStudioAccess,
  isMainnetAllowed,
} from "@/server/security/deployStudioGuard";

type Req = Parameters<typeof evaluateDeployStudioAccess>[0];
const req = (o: { method?: string; remote?: string; headers?: Record<string, string> } = {}): Req =>
  ({
    method: o.method ?? "GET",
    headers: { host: "localhost:3000", ...(o.headers ?? {}) },
    socket: { remoteAddress: o.remote ?? "127.0.0.1" },
  }) as unknown as Req;
const env = (o: Record<string, string> = {}) =>
  ({ ENABLE_DEPLOY_STUDIO: "true", NODE_ENV: "development", HARDHAT_DIR: "/opt/hardhat", ...o }) as unknown as NodeJS.ProcessEnv;
const code = (r: ReturnType<typeof evaluateDeployStudioAccess>) => (r.allowed ? "allowed" : r.code);

describe("garde Deploy Studio", () => {
  it("autorise uniquement quand TOUTES les conditions sont réunies", () => {
    expect(evaluateDeployStudioAccess(req(), env())).toEqual({ allowed: true, hardhatDir: "/opt/hardhat" });
  });

  it("par défaut (sans opt-in) : désactivé", () => {
    expect(code(evaluateDeployStudioAccess(req(), env({ ENABLE_DEPLOY_STUDIO: "" })))).toBe("deploy_studio_disabled");
    expect(code(evaluateDeployStudioAccess(req(), env({ ENABLE_DEPLOY_STUDIO: "1" })))).toBe("deploy_studio_disabled"); // uniquement "true"
  });

  it("interdit en production et sur Vercel, même avec l'opt-in", () => {
    expect(code(evaluateDeployStudioAccess(req(), env({ NODE_ENV: "production" })))).toBe("deploy_studio_forbidden_env");
    expect(code(evaluateDeployStudioAccess(req(), env({ VERCEL: "1" })))).toBe("deploy_studio_forbidden_env");
    expect(code(evaluateDeployStudioAccess(req(), env({ VERCEL_ENV: "preview" })))).toBe("deploy_studio_forbidden_env");
  });

  it("exige HARDHAT_DIR (plus de chemin personnel par défaut)", () => {
    expect(code(evaluateDeployStudioAccess(req(), env({ HARDHAT_DIR: "" })))).toBe("deploy_studio_not_configured");
  });

  it("refuse toute connexion non locale ou passant par un proxy", () => {
    expect(code(evaluateDeployStudioAccess(req({ remote: "203.0.113.5" }), env()))).toBe("deploy_studio_local_only");
    expect(code(evaluateDeployStudioAccess(req({ headers: { "x-forwarded-for": "203.0.113.5" } }), env()))).toBe("deploy_studio_local_only");
    for (const ok of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) expect(evaluateDeployStudioAccess(req({ remote: ok }), env()).allowed).toBe(true);
  });

  it("RÉGRESSION : accepte les en-têtes x-forwarded-* que Next.js ajoute lui-même, refuse leurs valeurs forgées", () => {
    // Next pose x-forwarded-for = adresse de la socket, x-forwarded-host = Host, x-forwarded-port, sur TOUTE requête.
    const nextOwn = { "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "localhost:3000", "x-forwarded-port": "3000" };
    expect(evaluateDeployStudioAccess(req({ headers: nextOwn }), env()).allowed).toBe(true);
    expect(evaluateDeployStudioAccess(req({ remote: "::1", headers: { ...nextOwn, "x-forwarded-for": "::1" } }), env()).allowed).toBe(true);

    // forgé ou ajouté par un vrai proxy : refusé
    expect(code(evaluateDeployStudioAccess(req({ headers: { ...nextOwn, "x-forwarded-for": "8.8.8.8" } }), env()))).toBe("deploy_studio_local_only");
    expect(code(evaluateDeployStudioAccess(req({ headers: { ...nextOwn, "x-forwarded-for": "127.0.0.1, 8.8.8.8" } }), env()))).toBe("deploy_studio_local_only");
    expect(code(evaluateDeployStudioAccess(req({ headers: { ...nextOwn, "x-forwarded-host": "rescoe.fr" } }), env()))).toBe("deploy_studio_local_only");
    expect(code(evaluateDeployStudioAccess(req({ headers: { forwarded: "for=8.8.8.8" } }), env()))).toBe("deploy_studio_local_only");
  });

  it("refuse un Host non local (DNS rebinding)", () => {
    expect(code(evaluateDeployStudioAccess(req({ headers: { host: "evil.example:3000" } }), env()))).toBe("deploy_studio_bad_host");
    expect(code(evaluateDeployStudioAccess(req({ headers: { host: "localhost.evil.example" } }), env()))).toBe("deploy_studio_bad_host");
    expect(evaluateDeployStudioAccess(req({ headers: { host: "127.0.0.1:3000" } }), env()).allowed).toBe(true);
  });

  it("requêtes modifiantes : en-tête anti-CSRF obligatoire, Origin = Host si présent", () => {
    const good = { [DEPLOY_STUDIO_HEADER]: DEPLOY_STUDIO_HEADER_VALUE };
    expect(code(evaluateDeployStudioAccess(req({ method: "POST" }), env()))).toBe("deploy_studio_csrf");
    expect(code(evaluateDeployStudioAccess(req({ method: "DELETE", headers: { [DEPLOY_STUDIO_HEADER]: "XMLHttpRequest" } }), env()))).toBe("deploy_studio_csrf");
    expect(evaluateDeployStudioAccess(req({ method: "POST", headers: good }), env()).allowed).toBe(true);
    expect(evaluateDeployStudioAccess(req({ method: "POST", headers: { ...good, origin: "http://localhost:3000" } }), env()).allowed).toBe(true);
    expect(code(evaluateDeployStudioAccess(req({ method: "POST", headers: { ...good, origin: "https://evil.example" } }), env()))).toBe("deploy_studio_bad_origin");
    expect(code(evaluateDeployStudioAccess(req({ method: "POST", headers: { ...good, origin: "not a url" } }), env()))).toBe("deploy_studio_bad_origin");
  });
});

describe("mainnet", () => {
  it("désactivé par défaut", () => {
    expect(isMainnetAllowed(env())).toBe(false);
    expect(isMainnetAllowed(env({ ENABLE_DEPLOY_STUDIO_MAINNET: "true" }))).toBe(true);
  });
});
