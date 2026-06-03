/**
 * useEvolutionHistory
 *
 * Lit l'historique d'évolution et la généalogie d'un token 100% depuis la chaîne.
 *
 * Sources de données (toutes on-chain, par ordre de priorité) :
 *   - AdhesionRescoe.tokenURI(tokenId)                  → step courant (image + attrs)
 *   - AdhesionRescoe.evolutionHistory(tokenId, i)       → snapshots passés (hash + timestamp + fromLevel)
 *   - AdhesionRescoe.insectStorage()                    → adresse InsectImageStorageV2
 *   - InsectImageStorageV2.getInsectImage(keyHash)      → image base64 de chaque step passé ← toujours on-chain
 *   - InsectImageStorageV2.getInsectAttrs(keyHash)      → attrsFragment complet (famille, sprite, nom…) ← on-chain si dispo
 *   - AdhesionRescoe.hatchedFromEgg(tokenId)            → œuf d'origine (généalogie)
 *   - AdhesionRescoe.reproductionParents(eggId, …)      → parents géniteurs
 *
 * Fallback local (catalogue statique, jamais de données token) :
 *   nft_metadata_clean.json → utilisé UNIQUEMENT si getInsectAttrs n'est pas exposé
 *   par le contrat déployé (appel qui échoue → catch → lookup local).
 */

import { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, keccak256, toUtf8Bytes } from "ethers";
import nftMetadata from "@/data/nft_metadata_clean.json";

// ─── Types exportés ───────────────────────────────────────────────────────────

export interface EvolutionStep {
  level: number;
  insectKey: string;
  displayName: string;
  family: string;
  /** data URI base64 — toujours depuis la chaîne (InsectImageStorageV2 ou tokenURI) */
  imageUrl: string;
  timestamp: number;   // unix seconds ; 0 = step courant
  isCurrent: boolean;
  attributes: Array<{ trait_type: string; value: unknown }>;
}

export interface GenealogyInfo {
  isFromEgg: boolean;
  eggId: number | null;
  parentA: number | null;
  parentB: number | null;
}

// ─── Types internes metadata ──────────────────────────────────────────────────

interface InsectEntry {
  key: string;
  display_name: string;
  family_name: string;
  image: string;
  level: number;
  lore?: string;
  attributes?: Array<{ trait_type: string; value: unknown }>;
}

// ─── Hash → insecte (fallback local uniquement si getInsectAttrs échoue) ────

let _hashMap: Map<string, InsectEntry> | null = null;

function getHashMap(): Map<string, InsectEntry> {
  if (_hashMap) return _hashMap;
  _hashMap = new Map();
  for (const [key, data] of Object.entries(
    nftMetadata as unknown as Record<string, any>
  )) {
    const hash = keccak256(toUtf8Bytes(key)).toLowerCase();
    _hashMap.set(hash, { key, ...(data as object) } as InsectEntry);
  }
  return _hashMap;
}

// ─── Parser l'attrsFragment retourné par InsectImageStorageV2 ────────────────
//
// attrsFragment = '{"trait_type":"Famille","value":"Vulpin"},{"trait_type":"Sprite","value":"VulpinAlpha"},...'
// (sans crochets extérieurs — tel que stocké par finalizeInsect)
//
function parseAttrsFragment(fragment: string): {
  family:      string;
  insectKey:   string;   // valeur de l'attribut "Sprite"
  displayName: string;   // valeur de l'attribut "Insect name"
  attributes:  Array<{ trait_type: string; value: unknown }>;
} {
  if (!fragment) return { family: "", insectKey: "", displayName: "", attributes: [] };
  try {
    const attrs = JSON.parse(`[${fragment}]`) as Array<{ trait_type: string; value: unknown }>;
    return {
      family:      String(attrs.find(a => a.trait_type === "Famille")?.value     ?? ""),
      insectKey:   String(attrs.find(a => a.trait_type === "Sprite")?.value      ?? ""),
      displayName: String(attrs.find(a => a.trait_type === "Insect name")?.value ?? ""),
      attributes:  attrs,
    };
  } catch {
    return { family: "", insectKey: "", displayName: "", attributes: [] };
  }
}

// ─── Décodage tokenURI on-chain → step courant ────────────────────────────────

function parseOnChainTokenURI(raw: string): Omit<EvolutionStep, "timestamp" | "isCurrent"> | null {
  try {
    if (!raw.startsWith("data:application/json;base64,")) return null;
    const b64  = raw.slice("data:application/json;base64,".length);
    const json = JSON.parse(atob(b64));

    const image      = String(json?.image  ?? "");
    const family     = String(json?.family ?? "");
    const attributes = (json?.attributes ?? []) as Array<{ trait_type: string; value: unknown }>;

    const sprite     = attributes.find(a => a.trait_type === "Sprite")?.value     as string | undefined;
    const insectName = attributes.find(a => a.trait_type === "Insect name")?.value as string | undefined;
    const levelAttr  = attributes.find(a => a.trait_type === "Niveau")?.value;
    const level      = levelAttr !== undefined ? Number(levelAttr) : 0;

    return {
      level,
      insectKey:   sprite ?? "",
      displayName: insectName ?? sprite ?? `Insecte LVL ${level}`,
      family,
      imageUrl:    image,
      attributes,
    };
  } catch (e) {
    console.warn("[useEvolutionHistory] parseOnChainTokenURI failed:", e);
    return null;
  }
}

// ─── ABI ─────────────────────────────────────────────────────────────────────

const EVO_ABI = [
  // tokenURI — step courant
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  // insectStorage — adresse du contrat InsectImageStorageV2
  {
    inputs: [],
    name: "insectStorage",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // evolutionHistory — snapshots passés
  {
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "index",   type: "uint256" },
    ],
    name: "evolutionHistory",
    outputs: [
      { name: "insectKeyHash", type: "bytes32" },
      { name: "timestamp",     type: "uint64"  },
      { name: "fromLevel",     type: "uint8"   },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "hatchedFromEgg",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "eggId",  type: "uint256" },
      { name: "index",  type: "uint256" },
    ],
    name: "reproductionParents",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// ABI compatible V2 + V3
// V3 ajoute getInsectAttrs, getInsectLore, getInsectIdentity (getters publics)
// V2 n'a que getInsectImage — les appels aux nouveaux getters feront catch() → fallback JSON local
const STORAGE_ABI = [
  // ── V2 + V3 ──────────────────────────────────────────────────────────────
  {
    inputs: [{ name: "keyHash", type: "bytes32" }],
    name: "getInsectImage",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  // ── V3 uniquement — catch() si contrat V2 ────────────────────────────────
  {
    inputs: [{ name: "insectKeyHash", type: "bytes32" }],
    name: "getInsectAttrs",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "insectKeyHash", type: "bytes32" }],
    name: "getInsectLore",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    // getInsectIdentity — V3 : retourne (insectKey, displayName, family) en un seul appel
    inputs: [{ name: "insectKeyHash", type: "bytes32" }],
    name: "getInsectIdentity",
    outputs: [
      { name: "insectKey",   type: "string" },
      { name: "displayName", type: "string" },
      { name: "family",      type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Toutes les images viennent de la blockchain :
 *   - Step courant  : tokenURI() → image embarquée dans le JSON on-chain
 *   - Steps passés  : InsectImageStorageV2.getInsectImage(keyHash)
 *
 * @param refreshKey  Incrémenter pour forcer un rechargement (ex: après evolve)
 */
export function useEvolutionHistory(
  contractAddress: string,
  tokenId: number | string | undefined,
  refreshKey = 0
) {
  const [pastSteps,   setPastSteps]   = useState<EvolutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<EvolutionStep | null>(null);
  const [genealogy,   setGenealogy]   = useState<GenealogyInfo | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);

  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const rpc = process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!;

    const load = async () => {
      setIsLoading(true);
      try {
        const provider = new JsonRpcProvider(rpc);
        const contract = new Contract(contractAddress, EVO_ABI, provider);
        const hashMap  = getHashMap();

        // ── 1. Appels parallèles : tokenURI + insectStorage + hatchedFromEgg ──
        const [rawTokenURI, insectStorageAddr, eggIdBig] = await Promise.all([
          contract.tokenURI(BigInt(tokenId))          as Promise<string>,
          contract.insectStorage()                    as Promise<string>,
          contract.hatchedFromEgg(BigInt(tokenId))    as Promise<bigint>,
        ]);

        // ── 2. Step courant depuis tokenURI on-chain ──────────────────────────
        const parsed = parseOnChainTokenURI(rawTokenURI);
        if (parsed) {
          setCurrentStep({ ...parsed, timestamp: 0, isCurrent: true });
        }

        // ── 3. Snapshots passés : lire les hashs + timestamps ──────────────────
        const snapshots: Array<{ hash: string; level: number; ts: number }> = [];
        for (let i = 0; ; i++) {
          try {
            const snap = await contract.evolutionHistory(BigInt(tokenId), BigInt(i));
            snapshots.push({
              hash:  snap.insectKeyHash as string,
              level: Number(snap.fromLevel),
              ts:    Number(snap.timestamp),
            });
          } catch {
            break; // fin du tableau on-chain
          }
        }

        // ── 4. Données des steps passés (images + identité) on-chain ────────────
        //
        //  Stratégie de résolution (par ordre de priorité) :
        //    a) V3 : getInsectIdentity(hash) → (insectKey, displayName, family) en 1 appel
        //    b) V2 : getInsectAttrs(hash)    → attrsFragment à parser
        //    c) Fallback local : nft_metadata_clean.json (catalogue statique)
        //
        //  Images : getInsectImage(hash) — toujours on-chain, V2 et V3

        type Identity = {
          insectKey:   string;
          displayName: string;
          family:      string;
          attributes:  Array<{ trait_type: string; value: unknown }>;
        };
        const emptyId: Identity = { insectKey: "", displayName: "", family: "", attributes: [] };

        let images:     string[]   = [];
        let identities: Identity[] = snapshots.map(() => emptyId);

        if (snapshots.length > 0 && insectStorageAddr && insectStorageAddr !== "0x0000000000000000000000000000000000000000") {
          const storageContract = new Contract(insectStorageAddr, STORAGE_ABI, provider);

          // Images + identités + attrs — tout en parallèle
          [images, identities] = await Promise.all([
            // Images toujours depuis la chaîne
            Promise.all(
              snapshots.map(s =>
                (storageContract.getInsectImage(s.hash) as Promise<string>).catch(() => "")
              )
            ),
            // Identité + attributs pour chaque snapshot
            Promise.all(
              snapshots.map(async (s) => {
                let insectKey   = "";
                let displayName = "";
                let family      = "";
                let attributes: Array<{ trait_type: string; value: unknown }> = [];

                // a) V3 : getInsectIdentity → (insectKey, displayName, family)
                try {
                  const res = await storageContract.getInsectIdentity(s.hash) as [string, string, string];
                  if (res[2]) { insectKey = res[0]; displayName = res[1]; family = res[2]; }
                } catch {}

                // b) getInsectAttrs → attrsFragment (toujours, pour avoir les attributs)
                try {
                  const fragment = await storageContract.getInsectAttrs(s.hash) as string;
                  const parsed   = parseAttrsFragment(fragment);
                  if (!family && parsed.family) {
                    insectKey = parsed.insectKey; displayName = parsed.displayName; family = parsed.family;
                  }
                  if (parsed.attributes.length > 0) attributes = parsed.attributes;
                } catch {}

                return { insectKey, displayName, family, attributes };
              })
            ),
          ]);
        }

        // ── 5. Assemblage — fallback catalogue local si on-chain vide ─────────
        const history: EvolutionStep[] = snapshots.map((snap, i) => {
          const id    = identities[i];
          // Catalogue local uniquement si la chaîne n'a pas fourni nom/famille
          const local = (!id.family) ? hashMap.get(snap.hash.toLowerCase()) : null;

          // Attributs : chaîne > catalogue local > tableau vide
          const attrs = id.attributes.length > 0
            ? id.attributes
            : (local?.attributes ?? []);

          return {
            level:       snap.level,
            insectKey:   id.insectKey   || local?.key          || "",
            displayName: id.displayName || local?.display_name || `Insecte LVL ${snap.level}`,
            family:      id.family      || local?.family_name  || "",
            imageUrl:    images[i]      || "",
            timestamp:   snap.ts,
            isCurrent:   false,
            attributes:  attrs,
          };
        });
        setPastSteps(history);

        // ── 6. Généalogie ─────────────────────────────────────────────────────
        const eggId = Number(eggIdBig);
        if (eggId > 0) {
          const pA = Number(await contract.reproductionParents(BigInt(eggId), 0n));
          const pB = Number(await contract.reproductionParents(BigInt(eggId), 1n));
          setGenealogy({ isFromEgg: true, eggId, parentA: pA, parentB: pB });
        } else {
          setGenealogy({ isFromEgg: false, eggId: null, parentA: null, parentB: null });
        }
      } catch (e) {
        console.error("[useEvolutionHistory]", e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, tokenId, refreshKey]);

  return { pastSteps, currentStep, genealogy, isLoading };
}
