// /utils/resolveIPFS.ts
const PUBLIC_GATEWAY = "https://gateway.pinata.cloud/ipfs/";  // Backup (mais proxy prioritaire)
const LOCAL_PROXY = "/api/ipfs/";

export function resolveIPFS(uri?: string | null, useProxy = true): string | undefined {  // true par défaut
  if (!uri) return undefined;

  //console.log(`🔍 resolveIPFS input: ${uri} (useProxy: ${useProxy})`);

  // EXTRACTION CID/PATH DE TOUS LES FORMATS (ipfs://, http gateway, CID brut)
  let cidPath = "";

  // 1. ipfs://CID/path
  if (uri.startsWith("ipfs://")) {
    cidPath = uri.replace("ipfs://", "");
  }
  // 2. http(s)://gateway/ipfs/CID/path → extrait /CID/path
  else if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const url = new URL(uri);
    cidPath = url.pathname.replace(/^\/ipfs\//, "");  // /ipfs/CID → CID
    if (!cidPath) cidPath = url.pathname.replace(/^\/ipfs\//i, "");
    //console.log(`📡 Extracted CID/path from HTTP: ${cidPath}`);
  }
  // 3. CID brut
  else if (/^[Qm][A-Za-z0-9]{44,}$/.test(uri) || /^[b][A-Za-z2-7]{58,}$/.test(uri)) {
    cidPath = uri;
  }
  else {
    //console.log(`❌ Invalid IPFS URI: ${uri}`);
    return uri;
  }

  // PRIORITÉ PROXY API (fallback auto publics + log)
  if (useProxy) {
    const proxyUrl = `${LOCAL_PROXY}${cidPath}`;
    //console.log(`🔗 Using PROXY: ${proxyUrl} (CID: ${cidPath})`);
    return proxyUrl;
  }

  // Fallback public direct
  const publicUrl = `${PUBLIC_GATEWAY}${cidPath}`;
  //console.log(`🌐 Using PUBLIC: ${publicUrl}`);
  return publicUrl;
}
