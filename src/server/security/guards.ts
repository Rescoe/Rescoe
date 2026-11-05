import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionSecret, verifySessionToken } from "./walletSession";

/** Réponse d'erreur uniforme : `{ error: <code stable>, message?: <texte sûr> }`. */
export function sendError(res: NextApiResponse, status: number, error: string, message?: string) {
  return res.status(status).json(message ? { error, message } : { error });
}

/** 405 + en-tête Allow si la méthode n'est pas autorisée. */
export function requireMethod(req: NextApiRequest, res: NextApiResponse, methods: readonly string[]): boolean {
  if (req.method && methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendError(res, 405, "method_not_allowed");
  return false;
}

/** Le corps doit être du JSON objet (Next n'a parsé que si Content-Type: application/json). */
export function requireJsonBody(req: NextApiRequest, res: NextApiResponse): Record<string, unknown> | null {
  const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const body = req.body as unknown;
  if (type !== "application/json" || typeof body !== "object" || body === null || Array.isArray(body)) {
    sendError(res, 415, "json_required", "Corps JSON (Content-Type: application/json) requis.");
    return null;
  }
  return body as Record<string, unknown>;
}

/**
 * Exige `Authorization: Bearer <jeton de session wallet>`.
 * Retourne l'adresse authentifiée (minuscules) ou null après avoir répondu 401/503.
 * Fail closed : sans WALLET_SESSION_SECRET en production → 503, jamais d'accès libre.
 */
export function requireWalletSession(req: NextApiRequest, res: NextApiResponse): string | null {
  const secret = getSessionSecret();
  if (!secret) {
    console.error("[auth] WALLET_SESSION_SECRET absent ou trop court (>= 32 caractères requis)");
    sendError(res, 503, "auth_not_configured", "Service temporairement indisponible.");
    return null;
  }

  const header = String(req.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const address = verifySessionToken(token, secret);
  if (!address) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="rescoe"');
    sendError(res, 401, "unauthorized", "Connexion wallet requise.");
    return null;
  }
  return address;
}

/** L'adresse authentifiée doit être celle visée par la requête. */
export function requireSameAddress(res: NextApiResponse, authenticated: string, target: string): boolean {
  if (authenticated.toLowerCase() === target.toLowerCase()) return true;
  sendError(res, 403, "forbidden", "Cette action ne concerne pas votre adresse.");
  return false;
}
