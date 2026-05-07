// utils/hatchEngine.ts
// Moteur dédié à l'éclosion des œufs → pioche un insecte lvl0
// N'interfère pas avec evolutionEngine (qui gère lvl1→3)

import metadataJson from '@/data/nft_metadata_clean.json';
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

/* ------------------------------------------------------------------ */
/* INDEX LVL0                                                          */
/* ------------------------------------------------------------------ */

interface Lvl0Candidate {
  sprite_name: string;   // "nom_sprite.gif"
  imageUrl: string;      // "/insects/..."
  family: string;
  display_name: string;
  lore: string;
  attributes: any[];
  metadata: any;
}

// Index : family → spriteName → candidate
const lvl0ByFamily: Record<string, Record<string, Lvl0Candidate>> = {};

(function indexLvl0() {
  let total = 0;

  Object.entries(metadataJson).forEach(([spriteName, data]: [string, any]) => {
    const level = parseInt(data.level?.toString() || '-1');
    if (level !== 0) return;

    const family: string = data.family_name || data.family || 'Unknown';
    const imagePath: string = data.image || data.image_path || '';

    if (!lvl0ByFamily[family]) lvl0ByFamily[family] = {};

    lvl0ByFamily[family][spriteName] = {
      sprite_name:  `${spriteName}.gif`,
      imageUrl:     `/insects/${imagePath.replace(/\\\\/g, '/')}`,
      family,
      display_name: data.display_name || data.name || spriteName,
      lore:         data.lore || '',
      attributes:   data.attributes || [],
      metadata:     data,
    };

    total++;
  });

  console.log(`[hatchEngine] ${total} sprites lvl0 indexés dans ${Object.keys(lvl0ByFamily).length} familles`);
})();

/* ------------------------------------------------------------------ */
/* RNG DÉTERMINISTE (même algo que evolutionEngine)                    */
/* ------------------------------------------------------------------ */

function createSeededRNG(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* HATCH ENGINE                                                        */
/* ------------------------------------------------------------------ */

export interface HatchResult {
  success: boolean;
  family_name: string;
  sprite_name: string;
  display_name: string;
  lore: string;
  imageUrl: string;
  attributes: any[];
  color_profile: any | null;
}

/**
 * Sélectionne un insecte lvl0 cohérent avec la famille de l'œuf.
 *
 * @param eggFamily  Famille de l'œuf (ex: "Thalorydes")
 * @param wallet     Adresse du propriétaire (pour le seed)
 * @param tokenId    ID du token œuf (pour le seed)
 */
export default function hatchEngine(
  eggFamily: string,
  wallet: string,
  tokenId: string | number
): HatchResult {
  console.log('[hatchEngine] Éclosion famille:', eggFamily, '| familles lvl0 dispo:', Object.keys(lvl0ByFamily));

  if (Object.keys(lvl0ByFamily).length === 0) {
    throw new Error('hatchEngine : aucun sprite lvl0 trouvé dans nft_metadata_clean.json');
  }

  const seed = `${wallet.toLowerCase()}::${tokenId}::hatch::${eggFamily}`;
  const rng  = createSeededRNG(seed);

  // Priorité : famille exacte → sinon toutes familles lvl0 confondues
  const exactMatch = lvl0ByFamily[eggFamily];
  const pool: Record<string, Lvl0Candidate> = exactMatch
    ? exactMatch
    : Object.values(lvl0ByFamily).reduce((acc, fam) => ({ ...acc, ...fam }), {});

  const keys = Object.keys(pool);
  if (keys.length === 0) {
    throw new Error(`hatchEngine : aucun sprite lvl0 pour la famille "${eggFamily}"`);
  }

  console.log(`[hatchEngine] Pool : ${keys.length} sprites (famille exacte: ${!!exactMatch})`);

  const picked  = keys[Math.floor(rng() * keys.length)];
  const insect  = pool[picked];
  const family  = insect.family;

  // Profil couleur
  const profiles     = (colorProfilesJson.families as any)[family] as any[] | undefined;
  const colorProfile = profiles?.find((p) => p.filename === insect.sprite_name)
    ?? profiles?.[0]
    ?? null;

  console.log('[hatchEngine] Insecte sélectionné:', {
    sprite_name:  insect.sprite_name,
    display_name: insect.display_name,
    family,
    colorProfile: !!colorProfile,
  });

  return {
    success:       true,
    family_name:   family,
    sprite_name:   insect.sprite_name,
    display_name:  insect.display_name,
    lore:          insect.lore,
    imageUrl:      insect.imageUrl,
    attributes:    insect.attributes,
    color_profile: colorProfile,
  };
}
