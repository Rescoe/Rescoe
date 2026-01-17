// utils/evolutionEngine.ts
import metadataJson from '@/data/nft_metadata_clean.json';
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

/* =======================
   CONFIG
======================= */

const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  Taille: 0.14,
  Type: 0.11,
  Stade: 0.10,
  Pattes: 0.10,
  Ailes: 0.10,
  Forme: 0.07,
  Motif: 0.07,
  Poils: 0.05,
  Carapace: 0.05,
  Corps: 0.05,
  Legendaire: 0.04,
  Cornes: 0.03,
  Yeux: 0.03,
  Antennes: 0.03,
};

const PRIORITY_WEIGHTS = {
  familyBonus: 0.35,
  attrsScore: 0.35,
  colorScore: 0.15,
  lineageBonus: 0.10,
  noise: 0.05,
};

const REPETITION_PENALTY = 0.55;

/* =======================
   DATA INDEXING
======================= */

const familiesByName: Record<string, any> = {};
const colorProfilesByFamily: Record<string, any[]> = {};

(function init() {
  Object.values(metadataJson).forEach((d: any) => {
    if (d.new_folder) familiesByName[d.new_folder] = d;
  });

  Object.entries(colorProfilesJson.families || {}).forEach(
    ([fam, profiles]: any) => {
      if (Array.isArray(profiles)) colorProfilesByFamily[fam] = profiles;
    }
  );

  console.log(
    `🧬 EvolutionEngine ready: ${Object.keys(familiesByName).length} families`
  );
})();

/* =======================
   RNG DÉTERMINISTE ROBUSTE
======================= */

function createSeededRNG(seedInput: string): () => number {
  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* =======================
   HELPERS
======================= */

function getAttributes(familyData: any): Record<string, any> {
  const out: any = {};
  (familyData.attributes || []).forEach((a: any) => {
    out[a.trait_type] = a.value;
  });
  return out;
}

function similarity(a1: any, a2: any): number {
  let score = 0;
  let total = 0;

  for (const key of Object.keys(ATTRIBUTE_WEIGHTS)) {
    const w = ATTRIBUTE_WEIGHTS[key];
    total += w;

    if (a1[key] === a2[key]) score += w;
    else if (typeof a1[key] === 'number' && typeof a2[key] === 'number') {
      score += w * Math.max(0, 1 - Math.abs(a1[key] - a2[key]) / 4);
    }
  }

  return score / Math.max(1, total);
}

function extractIPFS(ipfs: any) {
  const attrs = Object.fromEntries(
    (ipfs.attributes || []).map((a: any) => [a.trait_type, a.value])
  );

  return {
    family: attrs.Famille || ipfs.family,
    attributes: attrs,
    history: ipfs.evolutionHistory || [],
  };
}

function imagePath(familyData: any, level: number): string {
  const base = familyData.new_path
    ? familyData.new_path.replace(/lvl\d+/, `lvl${level}`)
    : `lvl${level}/${familyData.new_folder}/`;
  return `/insects/${base}001_${familyData.new_folder}.gif`;
}

/* =======================
   ENGINE FINAL
======================= */

export default function evolutionEngine(
  ipfsMetadata: any,
  currentLevel: number,
  targetLevel: number,
  wallet: string,
  tokenId: string | number
) {
  const { family, attributes, history } = extractIPFS(ipfsMetadata);

  const historyFamilies = new Set(history.map((h: any) => h.family));

  const seed = [
    wallet.toLowerCase(),
    tokenId,
    targetLevel,
    [...historyFamilies].join('|'),
  ].join('::');

  const rng = createSeededRNG(seed);

  const candidates: Record<string, any> = {};

  Object.values(metadataJson).forEach((famData: any) => {
    if (famData.level !== `lvl${targetLevel}`) return;

    const famKey = famData.new_folder;
    const targetAttrs = getAttributes(famData);

    const attrsScore = similarity(attributes, targetAttrs);
    const colorScore = 0.7 + rng() * 0.3;
    const lineageBonus = famKey === family ? 0.15 : 0;
    const familyBonus = famKey === family ? 0.4 : 0.05 * rng();
    const noise = (rng() - 0.5) * 0.1;

    const repetitionFactor = historyFamilies.has(famKey)
      ? REPETITION_PENALTY
      : 1;

    const score =
      (
        familyBonus * PRIORITY_WEIGHTS.familyBonus +
        attrsScore * PRIORITY_WEIGHTS.attrsScore +
        colorScore * PRIORITY_WEIGHTS.colorScore +
        lineageBonus * PRIORITY_WEIGHTS.lineageBonus +
        noise * PRIORITY_WEIGHTS.noise
      ) * repetitionFactor;

    candidates[famKey] = {
      score: Math.max(0.001, score),
      metadata: famData,
    };
  });

  /* =======================
     🎯 TIRAGE PONDÉRÉ
  ======================= */

  const entries = Object.entries(candidates);
  const total = entries.reduce((s, [, d]: any) => s + d.score, 0);
  let pick = rng() * total;

  let selectedKey = entries[0][0];
  let selectedData = entries[0][1];

  for (const [key, data] of entries) {
    pick -= data.score;
    if (pick <= 0) {
      selectedKey = key;
      selectedData = data;
      break;
    }
  }

  const famData = selectedData.metadata;
  const sprite = `001_${famData.new_folder}.gif`;
  const colorProfile =
    colorProfilesByFamily[famData.new_folder]?.[0] || null;

  const attributesOut = [
    ...(famData.attributes || []),
    { trait_type: 'Famille', value: famData.new_folder },
    { trait_type: 'Sprite', value: sprite },
    { trait_type: 'Niveau', value: targetLevel },
  ];

  return {
    success: true,
    level: targetLevel,
    family: famData.new_folder,
    sprite_name: sprite,
    display_name: famData.display_name,
    lore: famData.lore,
    imageUrl: imagePath(famData, targetLevel),
    attributes: attributesOut,
    color_profile: colorProfile,
    evolution_score: selectedData.score,
    seed_debug: seed,
  };
}
