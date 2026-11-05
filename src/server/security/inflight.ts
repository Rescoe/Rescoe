/**
 * Verrou « une opération à la fois » par clé (même instance Node).
 * Évite deux transactions relayer simultanées pour la même ressource
 * (double upload on-chain, double distribution de points).
 */
const g = globalThis as unknown as { __rescoeInflight?: Set<string> };
const inflight: Set<string> = (g.__rescoeInflight ??= new Set());

export function tryAcquire(key: string): boolean {
  if (inflight.has(key)) return false;
  inflight.add(key);
  return true;
}

export function release(key: string) {
  inflight.delete(key);
}
