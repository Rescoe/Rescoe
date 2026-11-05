import { describe, expect, it } from "vitest";
import {
  decodeBase64Limited,
  detectFileType,
  hasOwn,
  isContractName,
  isEvmAddress,
  isSafeIpfsPath,
  parseDeployArgs,
  safeFilename,
} from "@/server/security/validators";

describe("isEvmAddress", () => {
  it("accepte une adresse en minuscules et une adresse checksum valide", () => {
    expect(isEvmAddress("0xfa6d6e36da4aca3e6aa3bf2b4939165c39d83879")).toBe(true);
    expect(isEvmAddress("0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879")).toBe(true);
  });
  it("refuse un checksum faux (casse mixte altérée), une longueur fausse et les non-strings", () => {
    expect(isEvmAddress("0xFA6d6E36Da4acA3e6aa3bf2b4939165C39d83879")).toBe(false);
    expect(isEvmAddress("0x1234")).toBe(false);
    expect(isEvmAddress("fa6d6e36da4aca3e6aa3bf2b4939165c39d83879")).toBe(false);
    expect(isEvmAddress(undefined)).toBe(false);
    expect(isEvmAddress({ toString: () => "0x" })).toBe(false);
  });
});

describe("hasOwn", () => {
  it("ne confond pas les clés héritées avec les entrées d'un catalogue", () => {
    const catalog = { ABEILLE1: { level: 1 } };
    expect(hasOwn(catalog, "ABEILLE1")).toBe(true);
    for (const k of ["constructor", "__proto__", "toString", "hasOwnProperty"]) expect(hasOwn(catalog, k)).toBe(false);
    // et l'accès naïf serait bien truthy : c'est la faille que hasOwn évite
    expect((catalog as Record<string, unknown>)["constructor"]).toBeTruthy();
  });
});

describe("decodeBase64Limited", () => {
  const b64 = (n: number) => Buffer.alloc(n, 1).toString("base64");

  it("décode un base64 valide dans la limite et accepte le préfixe data:", () => {
    const r = decodeBase64Limited(`data:image/png;base64,${b64(10)}`, 100);
    expect(r.ok && r.bytes.length).toBe(10);
  });
  it("refuse trop gros AVANT de décoder (taille estimée depuis la longueur)", () => {
    expect(decodeBase64Limited(b64(1000), 999)).toEqual({ ok: false, reason: "too_large" });
    expect(decodeBase64Limited(b64(999), 999).ok).toBe(true);
  });
  it("refuse caractères invalides, vide et non-string", () => {
    expect(decodeBase64Limited("abc$", 100)).toEqual({ ok: false, reason: "invalid_base64" });
    expect(decodeBase64Limited("", 100)).toEqual({ ok: false, reason: "empty" });
    expect(decodeBase64Limited(42, 100)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("detectFileType (octets, pas le type annoncé)", () => {
  it("reconnaît GIF, PNG, JPEG, WebP, ZIP", () => {
    expect(detectFileType(Buffer.from("GIF89a....", "latin1"))).toBe("image/gif");
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectFileType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe("image/webp");
    expect(detectFileType(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("application/zip");
  });
  it("refuse HTML/script déguisé et contenu vide", () => {
    expect(detectFileType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe("safeFilename", () => {
  it("supprime chemins et caractères de contrôle, retombe sur le défaut", () => {
    expect(safeFilename("../../etc/passwd", "f.bin")).toBe("passwd");
    expect(safeFilename("C:\\temp\\a b.png", "f.bin")).toBe("a b.png");
    expect(safeFilename(".env", "f.bin")).toBe("f.bin");
    expect(safeFilename(undefined, "f.bin")).toBe("f.bin");
    expect(safeFilename("x\u0000y\n.png", "f.bin")).toBe("x_y_.png");
  });
});

describe("isContractName", () => {
  it("n'accepte que des identifiants simples", () => {
    expect(isContractName("AdhesionRescoe")).toBe(true);
    for (const bad of ["../x", "a/b", "a b", "1abc", "", "a".repeat(65), "x.sol", 12, null]) expect(isContractName(bad)).toBe(false);
  });
});

describe("parseDeployArgs", () => {
  it("accepte primitives et tableaux, refuse objets, fonctions et excès", () => {
    expect(parseDeployArgs(["0xabc", 1, true, ["a", "b"]])).toEqual(["0xabc", 1, true, ["a", "b"]]);
    expect(parseDeployArgs([{ a: 1 }])).toBeNull();
    expect(parseDeployArgs([null])).toBeNull();
    expect(parseDeployArgs([Infinity])).toBeNull();
    expect(parseDeployArgs("x")).toBeNull();
    expect(parseDeployArgs(new Array(33).fill(1))).toBeNull();
    expect(parseDeployArgs([[[[1]]]])).toBeNull(); // profondeur
    expect(parseDeployArgs(["x".repeat(2001)])).toBeNull();
  });
});

describe("isSafeIpfsPath", () => {
  const cid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  it("accepte CID v0/v1 et sous-chemins sûrs", () => {
    expect(isSafeIpfsPath(cid)).toBe(true);
    expect(isSafeIpfsPath(`${cid}/index.html`)).toBe(true);
    expect(isSafeIpfsPath("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")).toBe(true);
  });
  it("refuse traversée, schéma, CID invalide", () => {
    expect(isSafeIpfsPath(`${cid}/../../admin`)).toBe(false);
    expect(isSafeIpfsPath("../secret")).toBe(false);
    expect(isSafeIpfsPath("https://evil.example/x")).toBe(false);
    expect(isSafeIpfsPath("Qm123")).toBe(false);
    expect(isSafeIpfsPath(`${cid}/a?x=1`)).toBe(false);
  });
});
