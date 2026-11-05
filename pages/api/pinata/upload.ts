/**
 * POST /api/pinata/upload — épingle une image + ses métadonnées sur IPFS (Pinata).
 *
 * Sécurité : session wallet obligatoire, limite par IP et par wallet, corps limité,
 * image décodée et identifiée par ses octets (GIF/PNG/JPEG/WebP), métadonnées bornées.
 * Le CID de l'image est imposé par le serveur (`image` n'est jamais pris du client).
 *
 * Body : { scope: "badges" | "oeuvres", fileBase64: string, metadata: object }
 * Réponse : { image, metadata, imageHash, metadataHash }
 *
 * Décision : pas de contrôle « membre on-chain » ici, car le flux d'adhésion envoie le
 * badge AVANT que l'adresse soit membre. Voir docs/security.md (« Pinata »).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireWalletSession, sendError } from "@/server/security/guards";
import { decodeBase64Limited, detectFileType, isPlainObject } from "@/server/security/validators";
import { logServerError } from "@/server/security/redact";
import { buildMetadata, getPinataJwt, MAX_IMAGE_BYTES, MAX_METADATA_BYTES, pinFile, pinJson } from "@/server/pinata";

const IMAGE_TYPES = new Set(["image/gif", "image/png", "image/jpeg", "image/webp"]);
const EXT: Record<string, string> = { "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  if (!enforceRateLimit(req, res, "pinata-upload", { limit: 20, windowMs: 10 * 60_000 })) return;

  const session = requireWalletSession(req, res);
  if (!session) return;
  if (!enforceRateLimit(req, res, "pinata-upload-wallet", { limit: 10, windowMs: 10 * 60_000 }, session)) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const scope = body.scope;
  if (scope !== "badges" && scope !== "oeuvres") return sendError(res, 400, "invalid_scope", "Scope invalide");

  const metadata = body.metadata;
  if (!isPlainObject(metadata) || JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    return sendError(res, 400, "invalid_metadata", "Métadonnées invalides ou trop volumineuses");
  }

  const decoded = decodeBase64Limited(body.fileBase64, MAX_IMAGE_BYTES);
  if (!decoded.ok) {
    return sendError(res, decoded.reason === "too_large" ? 413 : 400, `image_${decoded.reason}`, "Image invalide");
  }
  const type = detectFileType(decoded.bytes);
  if (!type || !IMAGE_TYPES.has(type)) {
    return sendError(res, 415, "image_type_unsupported", "Formats acceptés : GIF, PNG, JPEG, WebP");
  }

  const jwt = getPinataJwt(scope);
  if (!jwt) {
    console.error(`[pinata-upload] JWT serveur absent pour le scope "${scope}"`);
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  try {
    const imageHash = await pinFile(jwt, decoded.bytes, `${scope === "oeuvres" ? "artwork" : "badge"}.${EXT[type]}`);
    const metadataHash = await pinJson(jwt, buildMetadata(scope, metadata, imageHash));

    return res.status(200).json({
      image: `ipfs://${imageHash}`,
      metadata: `ipfs://${metadataHash}`,
      imageHash,
      metadataHash,
    });
  } catch (err) {
    logServerError("pinata-upload", err);
    return sendError(res, 502, "upload_failed", "Upload IPFS échoué");
  }
}
