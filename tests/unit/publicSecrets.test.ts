import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { findForbiddenEnv, formatReport, isForbiddenPublicName, looksLikeJwt, runCheck, scanSources } = require("../../scripts/check-public-secrets.js");

const FAKE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJlLWJpZW4tbG9uZ3VlLTEyMzQ1";

describe("noms interdits", () => {
  it("interdit tout JWT/clé privée/secret/Pinata/relayer exposé via NEXT_PUBLIC_", () => {
    for (const n of [
      "NEXT_PUBLIC_PINATA_JWT_OEUVRES", "NEXT_PUBLIC_PINATA_JWT_BADGES", "NEXT_PUBLIC_PINATA_GATEWAY_KEY",
      "NEXT_PUBLIC_JWT", "NEXT_PUBLIC_RELAYER_PK", "NEXT_PUBLIC_STRIPE_SECRET", "NEXT_PUBLIC_STRIPE_PRIVATE",
      "NEXT_PUBLIC_ADMIN_SECRET", "NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY", "NEXT_PUBLIC_WALLET_MNEMONIC",
    ]) expect(isForbiddenPublicName(n), n).toBe(true);
  });
  it("laisse passer les variables publiques légitimes du projet", () => {
    for (const n of [
      "NEXT_PUBLIC_URL_SERVER_MORALIS", "NEXT_PUBLIC_RESCOE_ADHERENTS", "NEXT_PUBLIC_INSECT_STORAGE_V3",
      "NEXT_PUBLIC_STRIPE_PUBLIC_KEY", "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID", "NEXT_PUBLIC_CHANNEL_NEWS_ID",
    ]) expect(isForbiddenPublicName(n), n).toBe(false);
  });
});

describe("findForbiddenEnv", () => {
  it("signale un nom interdit et un JWT caché sous un nom innocent — sans jamais citer la valeur", () => {
    const hits = findForbiddenEnv({
      NEXT_PUBLIC_PINATA_JWT_OEUVRES: FAKE_JWT,
      NEXT_PUBLIC_INNOCENT_NAME: FAKE_JWT,
      NEXT_PUBLIC_RESCOE_ADHERENTS: "0xfa6d6e36da4aca3e6aa3bf2b4939165c39d83879",
      PINATA_JWT_ARTWORKS: FAKE_JWT, // côté serveur : autorisé
    });
    expect(hits.map((h: { name: string }) => h.name).sort()).toEqual(["NEXT_PUBLIC_INNOCENT_NAME", "NEXT_PUBLIC_PINATA_JWT_OEUVRES"]);
    expect(formatReport({ envHits: hits, srcHits: [] })).not.toContain(FAKE_JWT);
  });
  it("looksLikeJwt", () => {
    expect(looksLikeJwt(FAKE_JWT)).toBe(true);
    expect(looksLikeJwt("0xfa6d6e36da4aca3e6aa3bf2b4939165c39d83879")).toBe(false);
  });
});

describe("scanSources", () => {
  it("trouve fichier:ligne d'une référence interdite dans le code", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-scan-"));
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, "src", "a.tsx"), "const ok = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;\nconst bad = process.env.NEXT_PUBLIC_PINATA_JWT_X;\n");
    try {
      expect(scanSources(["src"], dir)).toEqual([{ file: path.join("src", "a.tsx"), line: 2, name: "NEXT_PUBLIC_PINATA_JWT_X" }]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("ce dépôt", () => {
  it("n'expose aucun secret via NEXT_PUBLIC_* dans pages/ et src/", () => {
    const result = runCheck({ env: {}, rootDirs: ["pages", "src"], cwd: path.resolve(__dirname, "../..") });
    expect(result.srcHits).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
