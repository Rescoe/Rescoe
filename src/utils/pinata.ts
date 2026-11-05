/**
 * Épinglage IPFS depuis le navigateur — via /api/pinata/pin (le JWT Pinata reste côté serveur).
 * `fetcher` est le `walletFetch` de useWalletFetch() : session wallet obligatoire.
 */

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function pin(fetcher: Fetcher, payload: Record<string, unknown>): Promise<string> {
  const res = await fetcher("/api/pinata/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.cid !== "string") {
    throw new Error(data.message || data.error || "Upload IPFS échoué");
  }
  return data.cid;
}

/** Épingle un fichier (<= ~3 Mo) et retourne son CID. */
export async function pinFileToIpfs(fetcher: Fetcher, file: Blob, filename?: string): Promise<string> {
  return pin(fetcher, {
    kind: "file",
    fileBase64: await blobToBase64(file),
    filename: filename ?? (file instanceof File ? file.name : undefined),
  });
}

/** Épingle un objet JSON et retourne son CID. */
export function pinJsonToIpfs(fetcher: Fetcher, json: Record<string, unknown>): Promise<string> {
  return pin(fetcher, { kind: "json", json });
}
