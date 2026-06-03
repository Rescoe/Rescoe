/**
 * /api/token/next-evolution
 *
 * Sélectionne de manière déterministe l'insecte du niveau suivant.
 * La sélection est basée uniquement sur l'adresse du wallet — pas de contrainte de famille.
 * Le même wallet + même niveau + même reroll → toujours le même insecte.
 *
 * Params GET :
 *   currentLevel — niveau actuel (0 → retourne un insecte lvl 1, 1 → lvl 2)
 *   wallet       — adresse ETH du propriétaire (seed principal)
 *   tokenId      — id du token qui évolue (même wallet, deux tokens différents → résultats différents)
 *   reroll       — entier ≥ 0 (incrémenté pour un résultat différent, défaut 0)
 *   family       — ignoré (conservé pour rétrocompatibilité)
 *
 * Réponse :
 *   insectKey    — clé unique de l'insecte  (ex: "VulpinAlpha")
 *   displayName  — nom d'affichage          (ex: "VulpinAlpha | Vulpin")
 *   family       — famille                  (ex: "Vulpin")
 *   imageUrl     — chemin local             (ex: "/insects/lvl1/Vulpin/VulpinAlpha.gif")
 *   level        — niveau du nouvel insecte (currentLevel + 1)
 *
 * Erreurs :
 *   400 — niveau max dépassé
 *   404 — aucun insecte trouvé au niveau cible
 */

import type { NextApiRequest, NextApiResponse } from "next";
import nftMetadata from "@/data/nft_metadata_clean.json";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InsectData {
  level: number;
  name: string;
  display_name: string;
  family_name: string;
  image: string;      // "lvl1\\Vulpin\\VulpinAlpha.gif" (Windows backslash)
  lore?: string;
  attributes?: Array<{ trait_type: string; value: unknown }>;
}

export interface NextEvolutionResponse {
  insectKey: string;
  displayName: string;
  family: string;
  imageUrl: string;
  level: number;
}

// ─── RNG déterministe (même algo que generate-onchain-uri) ────────────────────

function rngFromSeed(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) {
    s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<NextEvolutionResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    currentLevel = "0",
    wallet = "",
    tokenId = "",
    reroll = "0",
  } = req.query;

  const level = Number(currentLevel);
  const nextLevel = level + 1;

  if (nextLevel > 3) {
    return res.status(400).json({
      error: `Niveau maximum atteint (niveau ${level} → évolution impossible au-delà de 3)`,
    });
  }

  // Tous les insectes au niveau cible — pas de filtre par famille
  const candidates = Object.entries(
    nftMetadata as unknown as Record<string, InsectData>
  ).filter(
    ([, d]) => Number(d.level) === nextLevel
  );

  if (candidates.length === 0) {
    return res.status(404).json({
      error: `Aucun insecte au niveau ${nextLevel}`,
    });
  }

  // Sélection déterministe : même wallet + même tokenId + même niveau + même reroll → toujours le même insecte
  // Deux tokens différents du même wallet évoluent en insectes différents.
  const seed = `${String(wallet).toLowerCase().trim()}::t${String(tokenId)}::l${nextLevel}::r${String(reroll)}::evolve`;
  const rng = rngFromSeed(seed);
  const [key, data] = candidates[Math.floor(rng() * candidates.length)];

  // Chemin local pour preview React — "/" séparateurs, dossier public/insects
  const imageUrl = `/insects/${data.image.replace(/\\/g, "/")}`;

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  return res.status(200).json({
    insectKey:   key,
    displayName: data.display_name,
    family:      data.family_name,
    imageUrl,
    level:       nextLevel,
  });
}
