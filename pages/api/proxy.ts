/**
 * GET /api/proxy?url=<url> — relais de lecture vers les API Moralis / Basescan.
 *
 * Route publique (les pages de galerie l'utilisent) : on borne donc l'abus plutôt que
 * d'exiger une session. GET uniquement, HTTPS uniquement, hôtes autorisés uniquement,
 * limite par IP. La clé Moralis n'est envoyée qu'aux hôtes Moralis (jamais à Basescan).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { enforceRateLimit } from "@/server/security/rateLimit";
import { requireMethod, sendError } from "@/server/security/guards";
import { logServerError } from "@/server/security/redact";

const MORALIS_HOSTS = ["deep-index.moralis.io", "site1.moralis-nodes.com"];
const ALLOWED_HOSTS = [...MORALIS_HOSTS, "api.basescan.org"];

const matches = (hostname: string, hosts: string[]) =>
  hosts.some((host) => hostname === host || hostname.endsWith("." + host));

export function parseAllowedUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return matches(u.hostname, ALLOWED_HOSTS) ? u : null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireMethod(req, res, ["GET"])) return;
  if (!enforceRateLimit(req, res, "proxy", { limit: 300, windowMs: 60_000 })) return;

  const target = parseAllowedUrl(req.query.url);
  if (!target) return sendError(res, 400, "url_not_allowed", "URL non autorisée.");

  const headers: Record<string, string> = { Accept: "application/json" };
  if (matches(target.hostname, MORALIS_HOSTS) && process.env.MORALIS_API_KEY) {
    headers["x-api-key"] = process.env.MORALIS_API_KEY;
  }

  try {
    const response = await fetch(target, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(15_000) });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    logServerError("proxy", error);
    return sendError(res, 502, "upstream_error", "Erreur lors de la requête au serveur distant.");
  }
}
