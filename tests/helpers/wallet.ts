import { Wallet } from "ethers";

/** Wallet.createRandom() renvoie un HDNodeWallet : on n'exige que ce dont on se sert. */
export interface Signer {
  address: string;
  signMessage(message: string): Promise<string>;
}
import { buildLoginMessage } from "@/shared/loginMessage";
import { issueSessionToken } from "@/server/security/walletSession";

export const TEST_SECRET = "test-secret-".padEnd(48, "x");

export function newWallet() {
  return Wallet.createRandom();
}

export async function signedLogin(wallet: Signer, over: Partial<{ domain: string; issuedAt: string; nonce: string }> = {}) {
  const message = buildLoginMessage({
    address: wallet.address,
    domain: over.domain ?? "localhost:3000",
    nonce: over.nonce ?? "ab".repeat(16),
    issuedAt: over.issuedAt ?? new Date().toISOString(),
  });
  return { message, signature: await wallet.signMessage(message) };
}

/** En-tête Authorization valide pour `address`. */
export function bearerFor(address: string) {
  return { authorization: `Bearer ${issueSessionToken(address, TEST_SECRET).token}` };
}
