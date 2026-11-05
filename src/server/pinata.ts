/**
 * Accès Pinata côté serveur uniquement. Les JWT ne vivent que dans des variables
 * d'environnement SANS préfixe NEXT_PUBLIC_ (PINATA_JWT_BADGES / PINATA_JWT_ARTWORKS)
 * et ne sont jamais renvoyés, journalisés ni inclus dans un message d'erreur.
 */

import { isPlainObject } from "@/server/security/validators";

export type PinataScope = "badges" | "oeuvres";

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export function getPinataJwt(scope: PinataScope, env: NodeJS.ProcessEnv = process.env): string | null {
  const jwt = scope === "badges" ? env.PINATA_JWT_BADGES : env.PINATA_JWT_ARTWORKS;
  return jwt && jwt.length > 20 ? jwt : null;
}

async function postToPinata(url: string, jwt: string, init: { body: BodyInit; headers?: Record<string, string> }, timeoutMs: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, ...init.headers },
    body: init.body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  // On ne lit/propage jamais le corps d'erreur : seulement le statut.
  if (!res.ok) throw new Error(`pinata_http_${res.status}`);
  const data = (await res.json()) as { IpfsHash?: string };
  if (typeof data.IpfsHash !== "string" || !/^[A-Za-z0-9]{20,100}$/.test(data.IpfsHash)) {
    throw new Error("pinata_bad_response");
  }
  return data.IpfsHash;
}

export function pinFile(jwt: string, bytes: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);
  return postToPinata(PIN_FILE_URL, jwt, { body: form }, 60_000);
}

export function pinJson(jwt: string, json: unknown): Promise<string> {
  return postToPinata(
    PIN_JSON_URL,
    jwt,
    { body: JSON.stringify(json), headers: { "Content-Type": "application/json" } },
    30_000
  );
}

// ─── Métadonnées ──────────────────────────────────────────────────────────────

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 4 Mo de corps JSON ≈ 3 Mo d'image en base64
export const MAX_METADATA_BYTES = 64 * 1024;

function str(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.length <= max ? v : undefined;
}

export function buildMetadata(scope: PinataScope, metadata: Record<string, unknown>, imageCid: string) {
  const attributes = Array.isArray(metadata.attributes)
    ? metadata.attributes.filter((a: any) => a?.trait_type && a.value !== undefined)
    : [];

  let clean: Record<string, unknown>;
  if (scope === "badges") {
    const role = str(metadata.role, 100) || "Membre";
    const bio = str(metadata.bio, 2000) || "";
    clean = {
      name: str(metadata.name, 200) || "Badge Rescoe",
      description: `Badge ${role}. ${bio || "Aucune bio."}`,
      bio,
      role,
      tags: ["Adhesion", role],
      evolutionHistory: Array.isArray(metadata.evolutionHistory) ? metadata.evolutionHistory : [],
      attributes,
      breeding: isPlainObject(metadata.breeding) ? metadata.breeding : {},
      ...metadata,
    };
  } else {
    clean = {
      name: str(metadata.name, 200) || "Untitled",
      description: str(metadata.description, 5000) || "",
      artist: str(metadata.artist, 200) || "",
      tags: Array.isArray(metadata.tags) ? metadata.tags : ["Oeuvre"],
      collectionType: str(metadata.collectionType, 50) || "solo",
      maxEditions: metadata.maxEditions || 1,
      attributes,
      ...(isPlainObject(metadata.custom_data) ? metadata.custom_data : {}),
    };
  }

  // Nettoyage (supprime les undefined/null/"")
  for (const key of Object.keys(clean)) {
    if (clean[key] === null || clean[key] === undefined || clean[key] === "") delete clean[key];
  }
  // Imposé en dernier : un champ `image` fourni par le client ne peut pas l'emporter.
  clean.image = `ipfs://${imageCid}`;
  return clean;
}
