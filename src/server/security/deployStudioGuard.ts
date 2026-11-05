import type { NextApiRequest, NextApiResponse } from "next";
import { sendError } from "./guards";

/**
 * Garde serveur du Deploy Studio (compile / déploie / écrit sur disque / lance des
 * processus). Outil LOCAL de l'administrateur : il doit être inaccessible partout ailleurs.
 *
 * Toutes les conditions suivantes sont requises, vérifiées à CHAQUE requête :
 *   1. opt-in explicite : ENABLE_DEPLOY_STUDIO=true dans l'environnement serveur ;
 *   2. mode développement (NODE_ENV != production) et hors Vercel ;
 *   3. HARDHAT_DIR défini (plus aucun chemin personnel par défaut) ;
 *   4. connexion venant de la boucle locale, sans en-tête de proxy (X-Forwarded-*) ;
 *   5. en-tête Host = localhost / 127.0.0.1 / [::1] (anti DNS-rebinding) ;
 *   6. requêtes modifiantes : en-tête `x-requested-with: rescoe-deploy-studio` (un site
 *      tiers ne peut pas l'envoyer sans préflight CORS) et Origin identique à Host.
 *
 * Le déploiement sur le mainnet Base exige en plus ENABLE_DEPLOY_STUDIO_MAINNET=true.
 */

export const DEPLOY_STUDIO_HEADER = "x-requested-with";
export const DEPLOY_STUDIO_HEADER_VALUE = "rescoe-deploy-studio";

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const SAFE_METHODS = new Set(["GET", "HEAD"]);

export type DeployStudioDecision =
  | { allowed: true; hardhatDir: string }
  | { allowed: false; status: number; code: string; message: string };

const deny = (status: number, code: string, message: string): DeployStudioDecision => ({
  allowed: false,
  status,
  code,
  message,
});

const hostname = (hostHeader: string) => hostHeader.replace(/:\d+$/, "").toLowerCase();

/**
 * Next.js renseigne LUI-MÊME x-forwarded-for (= adresse de la socket), x-forwarded-host (= Host)
 * et x-forwarded-port sur toute requête, y compris directe (base-server.js, `??=`) : leur simple
 * présence ne prouve donc rien. Un passage par un proxy se détecte à leur CONTENU : une IP non
 * locale (valeur forgée ou ajoutée par un vrai proxy), un hôte non local, ou l'en-tête `Forwarded`.
 */
function viaNonLocalProxy(headers: NextApiRequest["headers"]): boolean {
  const xff = headers["x-forwarded-for"];
  if (xff !== undefined) {
    const ips = String(xff).split(",").map((ip) => ip.trim());
    if (ips.some((ip) => !LOOPBACK.has(ip))) return true;
  }
  const xfh = headers["x-forwarded-host"];
  if (xfh !== undefined && !LOCAL_HOSTS.has(hostname(String(xfh)))) return true;
  return headers["forwarded"] !== undefined;
}

export function evaluateDeployStudioAccess(
  req: Pick<NextApiRequest, "headers" | "socket" | "method">,
  env: NodeJS.ProcessEnv = process.env
): DeployStudioDecision {
  if (env.ENABLE_DEPLOY_STUDIO !== "true") {
    return deny(403, "deploy_studio_disabled", "Deploy Studio désactivé. Opt-in local : ENABLE_DEPLOY_STUDIO=true (voir docs/security.md).");
  }
  if (env.NODE_ENV === "production" || env.VERCEL || env.VERCEL_ENV) {
    return deny(403, "deploy_studio_forbidden_env", "Deploy Studio interdit en production / sur Vercel.");
  }
  if (!env.HARDHAT_DIR) {
    return deny(503, "deploy_studio_not_configured", "HARDHAT_DIR non défini (chemin du projet Hardhat).");
  }

  const remote = req.socket?.remoteAddress ?? "";
  if (!LOOPBACK.has(remote) || viaNonLocalProxy(req.headers)) {
    return deny(403, "deploy_studio_local_only", "Accessible uniquement depuis la machine locale.");
  }

  const host = String(req.headers.host ?? "");
  if (!LOCAL_HOSTS.has(hostname(host))) {
    return deny(403, "deploy_studio_bad_host", "Hôte non autorisé.");
  }

  if (!SAFE_METHODS.has(req.method ?? "")) {
    if (req.headers[DEPLOY_STUDIO_HEADER] !== DEPLOY_STUDIO_HEADER_VALUE) {
      return deny(403, "deploy_studio_csrf", "En-tête de protection CSRF manquant.");
    }
    const origin = req.headers.origin;
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(String(origin)).host;
      } catch {
        /* origine illisible → refusée ci-dessous */
      }
      if (originHost.toLowerCase() !== host.toLowerCase()) {
        return deny(403, "deploy_studio_bad_origin", "Origine non autorisée.");
      }
    }
  }

  return { allowed: true, hardhatDir: env.HARDHAT_DIR };
}

/** Le déploiement sur Base mainnet est un acte distinct, à activer explicitement. */
export function isMainnetAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENABLE_DEPLOY_STUDIO_MAINNET === "true";
}

/**
 * À appeler en TÊTE de chaque route /api/admin/deploy/*.
 * Retourne le dossier Hardhat si l'accès est autorisé, sinon répond et retourne null.
 */
export function guardDeployStudio(req: NextApiRequest, res: NextApiResponse): string | null {
  const decision = evaluateDeployStudioAccess(req);
  if (!decision.allowed) {
    sendError(res, decision.status, decision.code, decision.message);
    return null;
  }
  return decision.hardhatDir;
}
