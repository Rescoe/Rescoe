import { isIP } from "net";
import type { IncomingMessage } from "http";

/**
 * IP du client, utilisée comme clé de rate limiting.
 *
 * `X-Forwarded-For` est forgeable par le client : on ne le lit que derrière un
 * proxy de confiance (Vercel, ou TRUST_PROXY=1 explicitement). Sinon on prend
 * l'adresse de la socket. Valeur inconnue/invalide → "unknown" (bucket partagé,
 * donc plus restrictif, jamais plus permissif).
 */
export function getClientIp(
  req: Pick<IncomingMessage, "headers" | "socket">,
  env: NodeJS.ProcessEnv = process.env
): string {
  const trustProxy = Boolean(env.VERCEL) || env.TRUST_PROXY === "1";

  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first && isIP(first)) return first;
    const real = req.headers["x-real-ip"];
    const realIp = (Array.isArray(real) ? real[0] : real)?.trim();
    if (realIp && isIP(realIp)) return realIp;
  }

  const remote = req.socket?.remoteAddress?.replace(/^::ffff:/, "");
  return remote && isIP(remote) ? remote : "unknown";
}
