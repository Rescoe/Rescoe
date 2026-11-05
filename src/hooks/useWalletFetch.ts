import { useCallback } from "react";
import { useAuth } from "@/utils/authContext";
import { authedFetch, providerSigner } from "@/utils/walletSession";

/**
 * `fetch` authentifié par session wallet, pour les routes qui exigent `Authorization: Bearer`.
 * La première utilisation demande une signature (sans frais) ; les suivantes réutilisent
 * la session pendant 30 min.
 */
export function useWalletFetch() {
  const { address, provider } = useAuth();

  return useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      if (!address || !provider) return Promise.reject(new Error("Connectez votre wallet."));
      return authedFetch(input, init, { address, sign: providerSigner(provider) });
    },
    [address, provider]
  );
}

/** Corps JSON + POST, pour les appels courants. */
export const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
