/**
 * Journaux et réponses : ne JAMAIS laisser fuiter un secret.
 *
 * Les messages d'erreur d'ethers/axios embarquent souvent l'URL RPC complète
 * (clé Alchemy dans le chemin), des en-têtes ou des corps de requête.
 */

const SECRET_ENV_NAMES = [
  "RELAYER_PK",
  "PINATA_JWT_BADGES",
  "PINATA_JWT_ARTWORKS",
  "STRIPE_PRIVATE",
  "MORALIS_API_KEY",
  "REVALIDATE_SECRET",
  "WALLET_SESSION_SECRET",
  "BASESCAN_API_KEY",
  "RELAYER_RPC_URL",
] as const;

const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]}]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const HEX_KEY_RE = /\b0x[0-9a-fA-F]{64}\b/g; // clé privée (ou hash de tx : sur-masquer est acceptable)
const BARE_HEX_KEY_RE = /\b[0-9a-fA-F]{64}\b/g;
const SK_RE = /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}/g; // clés Stripe

function replaceKnownSecrets(text: string, env: NodeJS.ProcessEnv): string {
  let out = text;
  for (const name of SECRET_ENV_NAMES) {
    const v = env[name];
    if (v && v.length >= 8) out = out.split(v).join(`[${name}]`);
  }
  return out;
}

/** Réduit une URL à `scheme://host` : on perd chemin, requête et identifiants. */
function stripUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "[url]";
  }
}

export function redactSecrets(input: unknown, env: NodeJS.ProcessEnv = process.env): string {
  let text: string;
  if (input instanceof Error) text = `${input.name}: ${input.message}`;
  else if (typeof input === "string") text = input;
  else {
    try {
      text = JSON.stringify(input) ?? String(input);
    } catch {
      text = String(input);
    }
  }

  return replaceKnownSecrets(text, env)
    .replace(URL_RE, stripUrl)
    .replace(JWT_RE, "[jwt]")
    .replace(BEARER_RE, "$1 [token]")
    .replace(SK_RE, "[stripe-key]")
    .replace(HEX_KEY_RE, "[hex32]")
    .replace(BARE_HEX_KEY_RE, "[hex32]")
    .slice(0, 2000);
}

/** console.error avec masquage systématique. */
export function logServerError(tag: string, err: unknown) {
  console.error(`[${tag}]`, redactSecrets(err));
}

/** Hôte seul d'une URL RPC (pour les logs) : le chemin/la requête contiennent souvent la clé API. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "[rpc]";
  }
}
