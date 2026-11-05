/**
 * Format du message signé par le wallet pour ouvrir une session (voir
 * src/server/security/walletSession.ts). Module sans dépendance Node : il est partagé
 * entre le navigateur (qui construit le message) et le serveur (qui le relit strictement).
 */

export interface LoginMessageFields {
  address: string;
  domain: string;
  nonce: string;
  issuedAt: string; // ISO 8601
}

export function buildLoginMessage(f: LoginMessageFields): string {
  return [
    "Rescoe — connexion sécurisée",
    "Je prouve que je contrôle ce wallet. Aucune transaction, aucun frais.",
    "",
    `Adresse: ${f.address}`,
    `Domaine: ${f.domain}`,
    `Nonce: ${f.nonce}`,
    `Émis le: ${f.issuedAt}`,
  ].join("\n");
}

export function parseLoginMessage(message: string): LoginMessageFields | null {
  const m = message.match(
    /^Rescoe — connexion sécurisée\nJe prouve que je contrôle ce wallet\. Aucune transaction, aucun frais\.\n\nAdresse: (0x[0-9a-fA-F]{40})\nDomaine: ([A-Za-z0-9.\-:[\]]{1,255})\nNonce: ([0-9a-fA-F]{16,64})\nÉmis le: (\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/
  );
  return m ? { address: m[1], domain: m[2], nonce: m[3], issuedAt: m[4] } : null;
}
