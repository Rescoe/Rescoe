import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PROOF_FILES, clearProofFiles, decideBuildExit } = require("../../scripts/build-verdict.js");

let dir: string;
const touch = (rel: string, mtimeMs: number) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, "{}");
  fs.utimesSync(full, mtimeMs / 1000, mtimeMs / 1000);
};
const writeProof = (mtimeMs: number) => PROOF_FILES.forEach((f: string) => touch(f, mtimeMs));
const decide = (o: { code: number | null; platform?: string; output?: string; startedAt: number }) =>
  decideBuildExit({ code: o.code, platform: o.platform ?? "linux", output: o.output ?? "", startedAt: o.startedAt, proofOpts: { cwd: dir } });

const T0 = 1_800_000_000_000;
const WIN_RACE = "Error: ENOENT: no such file or directory, unlink 'C:\\app\\.next\\server\\pages\\404.js'";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-verdict-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("decideBuildExit", () => {
  it("succès : code 0 et manifests produits pendant ce build", () => {
    writeProof(T0 + 5000);
    expect(decide({ code: 0, startedAt: T0 }).exitCode).toBe(0);
  });

  it("code 0 mais manifests absents ou périmés → échec (pas de faux succès)", () => {
    expect(decide({ code: 0, startedAt: T0 }).exitCode).toBe(1); // aucun fichier
    writeProof(T0 - 3_600_000); // vieux de 1 h
    expect(decide({ code: 0, startedAt: T0 }).exitCode).toBe(1);
  });

  it("RÉGRESSION : build en échec + manifests périmés d'un ancien build → échec, même sur Windows avec ENOENT", () => {
    writeProof(T0 - 3_600_000);
    for (const platform of ["linux", "win32"]) {
      const v = decide({ code: 1, platform, output: WIN_RACE, startedAt: T0 });
      expect(v.exitCode).toBe(1);
    }
  });

  it("build en échec avec manifests frais mais sur Linux → échec", () => {
    writeProof(T0 + 5000);
    expect(decide({ code: 1, platform: "linux", output: WIN_RACE, startedAt: T0 }).exitCode).toBe(1);
  });

  it("build en échec avec manifests frais sur Windows mais une AUTRE erreur → échec", () => {
    writeProof(T0 + 5000);
    expect(decide({ code: 1, platform: "win32", output: "Type error: Property 'x' does not exist", startedAt: T0 }).exitCode).toBe(1);
  });

  it("seule exception : Windows + ENOENT unlink + manifests frais → accepté, avec avertissement", () => {
    writeProof(T0 + 5000);
    const v = decide({ code: 1, platform: "win32", output: WIN_RACE, startedAt: T0 });
    expect(v.exitCode).toBe(0);
    expect(v.message).toMatch(/ENOENT/);
  });

  it("conserve le code de sortie d'origine d'un vrai échec", () => {
    expect(decide({ code: 2, startedAt: T0 }).exitCode).toBe(2);
    expect(decide({ code: null, startedAt: T0 }).exitCode).toBe(1);
  });
});

describe("clearProofFiles", () => {
  it("supprime les preuves mais laisse .next/cache", () => {
    writeProof(T0);
    touch(path.join(".next", "cache", "webpack", "x"), T0);
    clearProofFiles(dir);
    for (const f of PROOF_FILES) expect(fs.existsSync(path.join(dir, f))).toBe(false);
    expect(fs.existsSync(path.join(dir, ".next", "cache", "webpack", "x"))).toBe(true);
  });
});
