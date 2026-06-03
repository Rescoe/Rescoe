/**
 * /api/data/members — Données publiques des adhérents
 *
 * Sert les données nécessaires à :
 *   - DerniersAdherents (lastFour)
 *   - FeaturedMembers (featured)
 *   - Adherent.tsx (membersByRole, totalMembersCount, totalInsectsMinted)
 *
 * Cache stratifié :
 *   - Serveur : module-level 1h  → 1 seul fetch Moralis/heure MAX par instance
 *   - CDN Vercel : max-age=3600, stale-while-revalidate=86400
 *       → 1 appel serveur/heure partagé entre TOUS les utilisateurs
 *       → pendant le refresh CDN en arrière-plan, la réponse périmée est
 *          servie immédiatement (0 latence pour l'utilisateur)
 *   - Navigateur : max-age=0 (pas de cache HTTP navigateur, géré par localStorage)
 *   - Client localStorage : 24h (dans chaque composant)
 *
 * En-têtes séparés CDN / navigateur :
 *   Cache-Control        → navigateur uniquement (max-age=0)
 *   CDN-Cache-Control    → Vercel Edge uniquement (max-age=3600, SWR=86400)
 *
 * Invalidation :
 *   - TTL 1h (filet de sécurité automatique)
 *   - Post-transaction utilisateur → localStorage vidé côté client
 *   - Webhook futur (Moralis Streams) → POST /api/revalidate (secret serveur uniquement)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";

// ─── Adresses "featured" hardcodées (identiques à Home.tsx) ─────────────────
const FEATURED_ADDRESSES = [
  "0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879",
];

// ─── Helpers IPFS ────────────────────────────────────────────────────────────

function extractCID(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.slice(7);
  const m = uri.match(/\/ipfs\/(.+)/);
  if (m) return m[1];
  if (/^[QBb][A-Za-z0-9]{44,}/.test(uri)) return uri;
  return null;
}

/** URL fetchable côté serveur (gateway public) — retourne null pour les data: URIs */
function serverIPFS(uri: string): string | null {
  const cid = extractCID(uri);
  if (cid) return `https://ipfs.io/ipfs/${cid}`;
  if (uri.startsWith("http")) return uri;
  return null;
}

/** URL retournée au navigateur (passe par le proxy /api/ipfs avec cache CDN 1 an) */
function browserIPFS(uri: string): string {
  if (!uri) return "";
  const cid = extractCID(uri);
  if (cid) return `/api/ipfs/${cid}`;
  if (uri.startsWith("http")) return uri;
  return uri;
}

/**
 * Parse un tokenURI (on-chain data: ou IPFS) et retourne nom, image, famille, niveau.
 * Pour les tokens on-chain, l'image est une URL vers /api/token/insect-image
 * (petite chaîne, cacheable) plutôt que le data URI complet (~150 KB).
 */
async function parseTokenMeta(
  tokenId: bigint,
  tokenURI: string
): Promise<{ name: string; image: string; family: string; level: string } | null> {
  try {
    // ── On-chain : data:application/json;base64,... ───────────────────────────
    if (tokenURI.startsWith("data:application/json;base64,")) {
      const b64  = tokenURI.slice("data:application/json;base64,".length);
      const meta = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      const attrs = meta?.attributes as Array<{ trait_type: string; value: unknown }> | undefined;
      const find  = (name: string) => attrs?.find((a) => a.trait_type === name)?.value;
      return {
        name:   String(meta?.name   ?? `Insecte #${tokenId}`),
        // URL légère vers le proxy image — évite de stocker ~150 KB dans le cache API
        image:  `/api/token/insect-image?tokenId=${tokenId}`,
        family: String(find("Famille") ?? find("Family") ?? meta?.family ?? "Inconnue"),
        level:  String(find("Niveau")  ?? meta?.level  ?? "?"),
      };
    }

    // ── Legacy IPFS ───────────────────────────────────────────────────────────
    const ipfsUrl = serverIPFS(tokenURI);
    if (!ipfsUrl) return null;
    const res = await fetch(ipfsUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const meta = await res.json();
    const attrs = meta?.attributes as Array<{ trait_type: string; value: unknown }> | undefined;
    const find  = (name: string) => attrs?.find((a) => a.trait_type === name)?.value;
    return {
      name:   String(meta?.name   ?? `Insecte #${tokenId}`),
      image:  browserIPFS(String(meta?.image ?? "")),
      family: String(find("Famille") ?? find("Family") ?? meta?.family ?? "Inconnue"),
      level:  String(find("Niveau")  ?? find("Level")  ?? meta?.level  ?? "?"),
    };
  } catch {
    return null;
  }
}

// ─── Cache serveur module-level ──────────────────────────────────────────────

interface MemberData {
  address: string;
  membershipValid: boolean;
  name: string;
  bio: string;
  tokens: number[];
  insects: {
    id: string;
    image: string;
    name: string;
    family: string;
    level: string;
  }[];
}

interface ApiPayload {
  lastFour: MemberData[];
  featured: MemberData[];
  membersByRole: Record<string, string[]>;
  totalMembersCount: number;
  totalInsectsMinted: number;
}

let serverCache: { data: ApiPayload; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure — aligné sur CDN-Cache-Control max-age

/**
 * Réinitialise le cache serveur de cette instance.
 * Appelé par /api/revalidate sur réception d'un webhook blockchain.
 * Portée : instance Node.js courante (les autres instances expirent sur TTL).
 */
export function resetCache(): void {
  serverCache = null;
}

// ─── Fetch user data (max 4 tokens pour la vignette) ────────────────────────

async function fetchUserData(
  address: string,
  contract: ethers.Contract
): Promise<MemberData> {
  try {
    const [membershipValid, name, bio] = await contract.getUserInfo(address);
    const rawTokens: bigint[] = await contract.getTokensByOwner(address);
    const tokens = rawTokens.map(Number);

    // Fetch metadata pour les 4 premiers tokens seulement (vignette)
    type InsectMeta = {
      id: string;
      image: string;
      name: string;
      family: string;
      level: string;
    };

    const rawInsects = await Promise.allSettled(
      rawTokens.slice(0, 4).map(async (tokenId): Promise<InsectMeta | null> => {
        const tokenURI: string = await contract.tokenURI(tokenId);
        const parsed = await parseTokenMeta(tokenId, tokenURI);
        if (!parsed) return null;
        return { id: tokenId.toString(), ...parsed };
      })
    );

    const insects: InsectMeta[] = rawInsects
      .filter(
        (r): r is PromiseFulfilledResult<InsectMeta> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);

    return {
      address,
      membershipValid: Boolean(membershipValid),
      name: String(name || ""),
      bio: String(bio || ""),
      tokens,
      insects: insects as MemberData["insects"],
    };
  } catch {
    return {
      address,
      membershipValid: false,
      name: "",
      bio: "",
      tokens: [],
      insects: [],
    };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // GET uniquement
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Servir depuis le cache serveur si encore frais
  if (serverCache && Date.now() - serverCache.ts < CACHE_TTL_MS) {
    // Navigateur : pas de cache HTTP (géré par localStorage côté client)
    // Vercel CDN : 1h frais, puis stale servi instantanément pendant 24h de refresh
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(serverCache.data);
  }

  const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS!;
  const rpcUrl = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

  if (!contractAddress || !rpcUrl) {
    return res
      .status(500)
      .json({ error: "Missing env vars RESCOE_ADHERENTS or MORALIS_URL" });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  try {
    // 2. Récupère tous les membres par rôle (4 appels en parallèle)
    const roleMap: Record<number, string> = {
      0: "Artist",
      1: "Poet",
      2: "Contributor",
      3: "Trainee",
    };

    const roleResults = await Promise.all(
      [0, 1, 2, 3].map((roleId) => contract.getMembersByRole(roleId))
    );

    const membersByRole: Record<string, string[]> = {};
    const uniqueSet = new Set<string>();
    roleResults.forEach((members: string[], idx) => {
      const roleName = roleMap[idx];
      membersByRole[roleName] = members;
      members.forEach((m) => uniqueSet.add(m));
    });

    const allMembers = Array.from(uniqueSet);
    const totalMembersCount = allMembers.length;

    // 3. Total minté (1 appel)
    const totalInsectsMinted = Number(await contract.getTotalMinted());

    // 4. Sélectionne les adresses à hydrater
    const lastFourAddresses = allMembers.slice(-4);
    const allAddresses = Array.from(
      new Set([...lastFourAddresses, ...FEATURED_ADDRESSES])
    );

    // 5. Hydrate en parallèle (getUserInfo + getTokensByOwner + tokenURI + IPFS)
    const userDataArray = await Promise.all(
      allAddresses.map((addr) => fetchUserData(addr, contract))
    );
    const userDataMap = new Map(userDataArray.map((u) => [u.address, u]));

    const empty = (addr: string): MemberData => ({
      address: addr,
      membershipValid: false,
      name: "",
      bio: "",
      tokens: [],
      insects: [],
    });

    const data: ApiPayload = {
      lastFour: lastFourAddresses.map(
        (addr) => userDataMap.get(addr) ?? empty(addr)
      ),
      featured: FEATURED_ADDRESSES.map(
        (addr) => userDataMap.get(addr) ?? empty(addr)
      ),
      membersByRole,
      totalMembersCount,
      totalInsectsMinted,
    };

    // 6. Stocke en cache serveur
    serverCache = { data, ts: Date.now() };

    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.setHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (error) {
    console.error("[/api/data/members] Erreur:", error);

    // En cas d'erreur, renvoie le cache périmé s'il existe (stale)
    if (serverCache) {
      // Cache périmé servi en urgence — TTL CDN court pour forcer refresh rapide
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.setHeader("CDN-Cache-Control", "public, max-age=60, stale-while-revalidate=600");
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(serverCache.data);
    }

    return res
      .status(500)
      .json({ error: "Impossible de charger les données des adhérents" });
  }
}
