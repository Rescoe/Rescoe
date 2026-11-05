/**
 * Garde-fou structurel : toute route API qui touche à un secret sensible ou au système
 * doit porter un contrôle d'accès serveur. Échoue si quelqu'un en ajoute une sans garde.
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const API = path.resolve(__dirname, "../../pages/api");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.[jt]sx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const files = walk(API);

const SENSITIVE = /RELAYER_PK|PINATA_JWT|STRIPE_PRIVATE|child_process|writeFileSync|fs\.writeFile|fs\/promises/;
const GUARDS = /requireWalletSession\(|guardDeployStudio\(/;

describe("routes API sensibles", () => {
  it("il y a bien des routes à inspecter", () => expect(files.length).toBeGreaterThan(30));

  it("toute route qui utilise RELAYER_PK / Pinata / Stripe / child_process / écriture fichier exige une session wallet ou le garde Deploy Studio", () => {
    const unguarded = files
      .filter((f) => SENSITIVE.test(fs.readFileSync(f, "utf8")))
      .filter((f) => !GUARDS.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(API, f));
    expect(unguarded).toEqual([]);
  });

  it("aucune route n'accepte un secret dans une variable NEXT_PUBLIC_ ni ne l'écrit dans une réponse", () => {
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/NEXT_PUBLIC_[A-Z_]*(JWT|PRIVATE|SECRET|_PK)/);
      expect(src, f).not.toMatch(/json\(\{[^}]*(error\.message|err\.message|\bmsg\b)[^}]*\}\)/); // pas de message d'erreur brut au client
    }
  });
});
