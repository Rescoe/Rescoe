// /utils/resolveIPFS.ts
const PUBLIC_GATEWAY = "https://cloudflare-ipfs.com/ipfs/";
const LOCAL_PROXY = "/api/ipfs/"; // ton API

export function resolveIPFS(uri?: string | null, useProxy = false): string | undefined {
  if (!uri) return undefined;

  // Déjà une URL HTTP -> on renvoie tel quel
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }

  // ipfs://CID[/path]
  if (uri.startsWith("ipfs://")) {
    const withoutPrefix = uri.replace("ipfs://", ""); // "CID" ou "CID/path"
    if (useProxy) {
      // /api/ipfs/[cidOrCidSlashPath]
      return `${LOCAL_PROXY}${withoutPrefix}`;
    }
    return `${PUBLIC_GATEWAY}${withoutPrefix}`;
  }

  // CID brut
  if (/^[a-zA-Z0-9]+$/.test(uri)) {
    if (useProxy) return `${LOCAL_PROXY}${uri}`;
    return `${PUBLIC_GATEWAY}${uri}`;
  }

  return uri;
}
