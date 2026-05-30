/**
 * cacheInvalidation.ts — Invalidation du cache localStorage côté client
 *
 * À appeler après chaque transaction blockchain réussie qui modifie
 * des données publiques (mint, burn, transfer, changement de rôle, etc.).
 *
 * Ce fichier ne contient AUCUN secret. Il ne fait que vider les clés
 * localStorage pertinentes pour forcer un refetch depuis l'API CDN
 * lors de la prochaine visite.
 *
 * Pattern d'utilisation :
 *   import { invalidatePublicCache } from "@/utils/cacheInvalidation";
 *
 *   // Après tx.wait() :
 *   invalidatePublicCache(["members", "insects"]);  // mint d'un NFT adhésion
 *   invalidatePublicCache(["collections"]);          // mint d'une œuvre
 *   invalidatePublicCache(["all"]);                  // changement structurel
 *
 * Portée : localStorage de l'utilisateur courant.
 * Le CDN Vercel se rafraîchit naturellement via stale-while-revalidate (TTL 1h).
 * Pour un refresh immédiat du CDN, le webhook /api/revalidate (serveur) est requis.
 */

export type CacheScope = "members" | "insects" | "collections" | "all";

// ─── Clés localStorage publiques connues ─────────────────────────────────────

const MEMBERS_KEYS = [
  "deradh_api_v2",       // DerniersAdherents
  "adherent_stats_v2",   // Adherent stats + membersByRole
];

const INSECTS_KEYS = [
  "adherent_insects_v2", // galerie cartes Adherent.tsx
];

const COLLECTIONS_KEYS = [
  "collections_api_v1",  // useRescoeData (nouveau)
  "featured_collections",// useRescoeData (ancien — conservé pendant transition)
];

// Préfixes pour les clés dynamiques (pattern-based)
const MEMBERS_PREFIXES = ["featured_api_v2_"];
const COLLECTIONS_PREFIXES = ["nfts_", "haikus_", "collections_api_v1"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore (SSR, quota, etc.)
  }
}

function removeByPrefixes(prefixes: string[]) {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(safeRemove);
  } catch {}
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Invalide les caches localStorage publics selon le scope spécifié.
 *
 * @param scopes - Tableau de domaines à invalider.
 *   "members"     → derniers adhérents, stats, galerie membres
 *   "insects"     → galerie cartes d'adhésion
 *   "collections" → collections, NFTs, poèmes
 *   "all"         → tout ce qui précède
 */
export function invalidatePublicCache(scopes: CacheScope[]): void {
  if (typeof window === "undefined") return;

  const doAll = scopes.includes("all");

  if (doAll || scopes.includes("members")) {
    MEMBERS_KEYS.forEach(safeRemove);
    removeByPrefixes(MEMBERS_PREFIXES);
  }

  if (doAll || scopes.includes("insects")) {
    INSECTS_KEYS.forEach(safeRemove);
  }

  if (doAll || scopes.includes("collections")) {
    COLLECTIONS_KEYS.forEach(safeRemove);
    removeByPrefixes(COLLECTIONS_PREFIXES);
  }
}

/**
 * Invalide les caches d'un utilisateur spécifique (données personnelles).
 * À appeler après une transaction affectant les points ou les tokens de l'utilisateur.
 */
export function invalidateUserCache(address: string): void {
  if (typeof window === "undefined" || !address) return;
  [
    `adhesionPoints_${address}`,
    `pendingPoints_${address}`,
    `statsCollection_${address}`,
    `dashboard_roles_${address}`,
  ].forEach(safeRemove);
}
