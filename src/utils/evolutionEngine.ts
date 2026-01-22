import metadataJson from '@/data/nft_metadata_clean.json';
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  Taille: 0.14, Type: 0.11, Stade: 0.10, Pattes: 0.10, Ailes: 0.10,
  Forme: 0.07, Motif: 0.07, Poils: 0.05, Carapace: 0.05, Corps: 0.05,
  Legendaire: 0.04, Cornes: 0.03, Yeux: 0.03, Antennes: 0.03,
};

const PRIORITY_WEIGHTS = {
  familyBonus: 0.35, attrsScore: 0.35, colorScore: 0.15, lineageBonus: 0.10, noise: 0.05,
};

const REPETITION_PENALTY = 0.4;

/* =======================
INDEX RÉEL : 1 DOSSIER = 1 FAMILLE
======================== */
interface ImageCandidate {
  sprite_name: string;  // "023_Tenebroryns.gif"
  imageUrl: string;
  family: string;       // "Tenebroryns" (new_folder)
  folder_path: string;  // "lvl2/Tenebroryns/"
  metadata: any;
}

const familiesByLevel: Record<number, Record<string, ImageCandidate[]>> = {
  1: {}, 2: {}, 3: {}
};

const colorProfilesByFamily: Record<string, any[]> = {};

(function indexRealFamilies() {
  // Color profiles
  Object.entries(colorProfilesJson.families || {}).forEach(([fam, profiles]: any) => {
    colorProfilesByFamily[fam] = profiles;
  });

  // ✅ SCAN RÉEL : new_folder → dossier + vraies images 001-999
  Object.values(metadataJson).forEach((famData: any) => {
    const level = parseInt(famData.level?.replace('lvl', '') || '0');
    if (level < 1 || level > 3) return;

    const family = famData.new_folder;  // "Tenebroryns"
    const folderPath = famData.new_path || `lvl${level}/${family}/`;  // "lvl1/Tenebroryns/"

    if (!familiesByLevel[level][family]) familiesByLevel[level][family] = [];

    // Génération limitée par total_in_family ou max 200
    const maxImages = Math.min(200, famData.total_in_family || 999);
    for (let i = 1; i <= maxImages; i++) {
      const num = i.toString().padStart(3, '0');
      const spriteName = `${num}_${family}.gif`;
      const imageUrl = `/insects/${folderPath}${spriteName}`;

      familiesByLevel[level][family].push({
        sprite_name: spriteName,
        imageUrl,
        family,
        folder_path: folderPath,
        metadata: famData
      });
    }
  });

})();

function createSeededRNG(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  let state = s;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

function getAttributes(data: any): Record<string, string> {
  const attrs: Record<string, string> = {};
  (data.attributes || []).forEach((a: any) => { attrs[a.trait_type] = a.value; });
  return attrs;
}

function similarity(currentAttrs: Record<string, string>, targetAttrs: Record<string, string>): number {
  let score = 0, totalWeight = 0;

  Object.keys(ATTRIBUTE_WEIGHTS).forEach(key => {
    const weight = ATTRIBUTE_WEIGHTS[key];
    totalWeight += weight;

    if (currentAttrs[key] === targetAttrs[key]) {
      score += weight;
    } else if (currentAttrs[key] && targetAttrs[key] &&
               !isNaN(Number(currentAttrs[key])) && !isNaN(Number(targetAttrs[key]))) {
      const diff = Math.abs(Number(currentAttrs[key]) - Number(targetAttrs[key]));
      score += weight * Math.max(0, 1 - diff / 10);
    }
  });

  return totalWeight > 0 ? score / totalWeight : 0;
}

/* =======================
ENGINE PRINCIPAL - 100% SUCCÈS
======================== */
export default function evolutionEngine(
  currentData: any,  // {family, attributes} DIRECT
  currentLevel: number,
  targetLevel: number,
  wallet: string,
  tokenId: string | number
) {
  const currentFamily = currentData.family || 'unknown';
  const currentAttrs = currentData.attributes || {};
  const history = currentData.history || [];

  // History précis : familles + sprites vus
  const historyFamilies = new Set<string>();
  const historySprites = new Set<string>();
  history.forEach((h: any) => {
    if (h.family || h.from_family) historyFamilies.add(h.family || h.from_family);
    if (h.sprite_name) historySprites.add(h.sprite_name);
  });

  // ✅ SEED INCLUS SPRITES VUS
  const seedStr = [wallet.toLowerCase(), tokenId, targetLevel,
                  [...historyFamilies].join('|'), [...historySprites].join('|')].join('::');
  const rng = createSeededRNG(seedStr);

  console.log(`🎯 LVL${targetLevel} depuis ${currentFamily} (hist fam:${historyFamilies.size}, sprites:${historySprites.size})`);

  // ✅ TOUTES FAMILLES DISPONIBLES LVL cible
  const targetFamilies = familiesByLevel[targetLevel];
  if (!targetFamilies || Object.keys(targetFamilies).length === 0) {
    throw new Error(`Aucune famille lvl${targetLevel}`);
  }

  const familyScores: Array<{family: string, score: number}> = [];

  // Score chaque famille
  Object.entries(targetFamilies).forEach(([familyName, images]: any) => {
    const famData = images[0].metadata;
    const targetAttrs = getAttributes(famData);

    let familyScore = similarity(currentAttrs, targetAttrs);

    // Bonus/Pénalités
    if (familyName === currentFamily) familyScore *= 1.3;  // Lineage
    if (historyFamilies.has(familyName)) familyScore *= REPETITION_PENALTY;  // Anti-repeat

    // Noise RNG pour diversité
    familyScore += (rng() - 0.5) * 0.1;

    familyScores.push({ family: familyName as string, score: Math.max(0.01, familyScore) });
  });

  // 🎯 TIRAGE FAMILLE PONDERÉ
  const totalScore = familyScores.reduce((sum, f) => sum + f.score, 0);
  let pick = rng() * totalScore;
  let selectedFamily = familyScores[0]?.family;

  for (const {family, score} of familyScores) {
    pick -= score;
    if (pick <= 0) {
      selectedFamily = family;
      break;
    }
  }

  if (!selectedFamily) {
    console.warn('🔄 FALLBACK 1ère famille');
    selectedFamily = familyScores[0]?.family || Object.keys(targetFamilies)[0];
  }

  // 🎲 SPRITE ALÉATOIRE dans famille sélectionnée
  const familyImages = targetFamilies[selectedFamily];
  const spritePick = Math.floor(rng() * familyImages.length);
  const selectedImage = familyImages[spritePick];

  console.log(`✅ ${selectedImage.sprite_name} (${selectedFamily}) score=${familyScores.find(f => f.family === selectedFamily)?.score?.toFixed(2)}`);

  // ✅ OUTPUT COHÉRENT
  const colorProfile = colorProfilesByFamily[selectedFamily]?.[0] || null;
  const outputAttrs = [
    ...selectedImage.metadata.attributes,
    { trait_type: 'Famille', value: selectedFamily },
    { trait_type: 'Sprite', value: selectedImage.sprite_name },
    { trait_type: 'Niveau', value: targetLevel }
  ];

  return {
    success: true,
    level: targetLevel,
    family: selectedFamily,
    sprite_name: selectedImage.sprite_name,
    display_name: selectedImage.metadata.display_name,
    lore: selectedImage.metadata.lore,
    imageUrl: selectedImage.imageUrl,
    attributes: outputAttrs,
    color_profile: colorProfile,
    evolution_score: familyScores.find(f => f.family === selectedFamily)?.score || 0.5,
    seed_debug: seedStr
  };
}
