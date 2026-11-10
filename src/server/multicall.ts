/**
 * Multicall3 : regroupe N lectures de contrat en UN seul appel RPC (eth_call).
 *
 * Pourquoi : les fournisseurs RPC facturent chaque appel. Lire 4 rôles, 12 membres et leurs
 * insectes un par un coûtait ~15 appels par route. Avec Multicall3, la même lecture tient en
 * 3-4 appels, quel que soit le nombre de lectures regroupées.
 *
 * Multicall3 est déployé à la même adresse sur toutes les chaînes EVM, dont Base mainnet.
 * Chaque sous-appel est autorisé à échouer individuellement (allowFailure) : un token brûlé ne
 * fait pas échouer toute la lecture, exactement comme le `try/catch` par appel d'avant.
 */
import { Interface, type Provider } from "ethers";

export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const multicallIface = new Interface([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);

export type MulticallCall = {
  target: string;
  iface: Interface;
  fn: string;
  args?: readonly unknown[];
};

export type MulticallResult = { ok: true; value: any } | { ok: false; value?: undefined };

/**
 * Exécute les lectures par paquets de `chunkSize`. Le résultat de chaque lecture est décodé comme le
 * ferait un `Contract` ethers : la valeur seule si la fonction a une sortie, sinon le `Result` nommé.
 *
 * ⚠ À RÉSERVER AUX LECTURES LÉGÈRES (rôles, propriétaires, infos d'adhésion, compteurs...).
 * NE PAS y mettre `tokenURI` : il génère l'image/le JSON on-chain (~260 Ko, plusieurs millions de gaz) ;
 * deux `tokenURI` dans le même eth_call dépassent le plafond de gaz des nœuds (50 M) et font échouer
 * tout le lot (« out of gas: gas required exceeds »). Vérifié sur Base mainnet le 2026-11-10.
 *
 * `chunkSize` borne le nombre de lectures par appel RPC.
 */
export async function multicall(
  provider: Provider,
  calls: readonly MulticallCall[],
  chunkSize = 50
): Promise<MulticallResult[]> {
  const out: MulticallResult[] = [];

  for (let start = 0; start < calls.length; start += chunkSize) {
    const chunk = calls.slice(start, start + chunkSize);
    const data = multicallIface.encodeFunctionData("aggregate3", [
      chunk.map((c) => ({
        target: c.target,
        allowFailure: true,
        callData: c.iface.encodeFunctionData(c.fn, c.args ? [...c.args] : []),
      })),
    ]);

    const raw = await provider.call({ to: MULTICALL3_ADDRESS, data });
    const [results] = multicallIface.decodeFunctionResult("aggregate3", raw);

    chunk.forEach((c, i) => {
      const r = results[i];
      if (!r?.success) {
        out.push({ ok: false });
        return;
      }
      try {
        const decoded = c.iface.decodeFunctionResult(c.fn, r.returnData);
        out.push({ ok: true, value: decoded.length === 1 ? decoded[0] : decoded });
      } catch {
        out.push({ ok: false });
      }
    });
  }

  return out;
}
