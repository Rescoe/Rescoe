import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { redactSecrets } from "@/server/security/redact";

/**
 * Exécution de Hardhat pour le Deploy Studio (local uniquement, voir deployStudioGuard.ts).
 *
 * - pas de chaîne shell interpolée : le dossier passe par `cwd`, les arguments sont un tableau
 *   (sur Windows, `npx.cmd` impose un shell : les arguments sont alors des constantes ou des
 *   valeurs d'énumération, jamais du texte libre) ;
 * - l'environnement enfant est minimal : les secrets de l'app (Stripe, Pinata, Moralis, clé
 *   relayer de l'app) ne sont pas transmis. Hardhat lit sa propre configuration dans son .env.
 */

const execFileAsync = promisify(execFile);

export const IS_WINDOWS = process.platform === "win32";
export const NPX = IS_WINDOWS ? "npx.cmd" : "npx";

/** Réseaux autorisés (clé UI → nom de réseau Hardhat). */
export const NETWORK_MAP = {
  hardhat: "localhost",
  baseSepolia: "baseSepolia",
  base: "base",
} as const;
export type StudioNetwork = keyof typeof NETWORK_MAP;

export function isStudioNetwork(v: unknown): v is StudioNetwork {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(NETWORK_MAP, v);
}

const ENV_WHITELIST = [
  "PATH", "Path", "PATHEXT", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA",
  "SystemRoot", "ComSpec", "TEMP", "TMP", "TMPDIR", "LANG",
];

export function minimalChildEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = { FORCE_COLOR: "0" };
  for (const key of ENV_WHITELIST) if (source[key] !== undefined) env[key] = source[key];
  return env as NodeJS.ProcessEnv;
}

export async function runHardhat(
  hardhatDir: string,
  args: readonly string[],
  opts: { timeout: number; maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(NPX, ["hardhat", ...args], {
    cwd: hardhatDir,
    timeout: opts.timeout,
    maxBuffer: opts.maxBuffer ?? 10 * 1024 * 1024,
    shell: IS_WINDOWS,
    windowsHide: true,
    env: minimalChildEnv(),
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

/** Sortie d'un processus enfant : toujours masquée avant d'être renvoyée au navigateur. */
export const sanitizeOutput = (text: string) => redactSecrets(text).slice(0, 20_000);

/** Chemin garanti à l'intérieur de `baseDir` (anti path traversal), sinon null. */
export function resolveInside(baseDir: string, ...segments: string[]): string | null {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, ...segments);
  return target === base || target.startsWith(base + path.sep) ? target : null;
}
