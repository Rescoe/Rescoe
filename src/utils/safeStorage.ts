/**
 * Écriture prudente dans localStorage.
 *
 * Avant : `localStorage.setItem(tokenURI, JSON.stringify(metadata))`. Pour un NFT 100 % on-chain, le
 * tokenURI est un `data:` de plusieurs centaines de Ko : il servait de CLÉ, et les métadonnées
 * (image base64 comprise) de valeur. Le stockage se remplit vite et les écritures échouent ensuite.
 *
 * Ici : on ne met pas en cache une clé de type `data:` ou démesurée, ni une valeur trop grosse
 * (les données on-chain sont déjà locales, il n'y a rien à économiser), et on n'échoue jamais.
 */
const MAX_KEY_LENGTH = 300;
const MAX_VALUE_LENGTH = 100_000; // ~100 Ko

export function safeSetJson(key: string, value: unknown): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (!key || key.length > MAX_KEY_LENGTH || key.startsWith("data:")) return false;
    const json = JSON.stringify(value);
    if (json.length > MAX_VALUE_LENGTH) return false;
    localStorage.setItem(key, json);
    return true;
  } catch {
    // stockage plein ou indisponible : on continue sans cache
    return false;
  }
}
