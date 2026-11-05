/**
 * POST /api/pinata/pin — épingle UN fichier ou UN objet JSON sur IPFS (scope "oeuvres").
 *
 * Remplace les appels directs du navigateur à api.pinata.cloud, qui reposaient sur un JWT
 * embarqué dans le bundle client. Le JWT reste côté serveur (PINATA_JWT_ARTWORKS).
 *
 * Sécurité : session wallet obligatoire, limite par IP et par wallet, taille bornée,
 * nom de fichier assaini.
 *
 * Body : { kind: "file", fileBase64: string, filename?: string }
 *     ou { kind: "json",  json: object }
 * Réponse : { cid: string, uri: "ipfs://<cid>" }
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireJsonBody, requireMethod, requireWalletSession, sendError } from "@/server/security/guards";
import { decodeBase64Limited, isPlainObject, safeFilename } from "@/server/security/validators";
import { logServerError } from "@/server/security/redact";
import { getPinataJwt, MAX_IMAGE_BYTES, MAX_METADATA_BYTES, pinFile, pinJson } from "@/server/pinata";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["POST"])) return;
  // Un ZIP génératif envoie un appel par fichier : fenêtre plus large que /upload.
  if (!enforceRateLimit(req, res, "pinata-pin", { limit: 120, windowMs: 10 * 60_000 })) return;

  const session = requireWalletSession(req, res);
  if (!session) return;
  if (!enforceRateLimit(req, res, "pinata-pin-wallet", { limit: 60, windowMs: 10 * 60_000 }, session)) return;

  const body = requireJsonBody(req, res);
  if (!body) return;

  const jwt = getPinataJwt("oeuvres");
  if (!jwt) {
    console.error('[pinata-pin] JWT serveur absent pour le scope "oeuvres"');
    return sendError(res, 503, "not_configured", "Service temporairement indisponible.");
  }

  try {
    let cid: string;

    if (body.kind === "file") {
      const decoded = decodeBase64Limited(body.fileBase64, MAX_IMAGE_BYTES);
      if (!decoded.ok) {
        return sendError(res, decoded.reason === "too_large" ? 413 : 400, `file_${decoded.reason}`, "Fichier invalide");
      }
      cid = await pinFile(jwt, decoded.bytes, safeFilename(body.filename, "file.bin"));
    } else if (body.kind === "json") {
      if (!isPlainObject(body.json) || JSON.stringify(body.json).length > MAX_METADATA_BYTES) {
        return sendError(res, 400, "invalid_json", "JSON invalide ou trop volumineux");
      }
      cid = await pinJson(jwt, body.json);
    } else {
      return sendError(res, 400, "invalid_kind", 'kind doit valoir "file" ou "json"');
    }

    return res.status(200).json({ cid, uri: `ipfs://${cid}` });
  } catch (err) {
    logServerError("pinata-pin", err);
    return sendError(res, 502, "upload_failed", "Upload IPFS échoué");
  }
}
