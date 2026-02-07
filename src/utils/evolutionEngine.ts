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

interface ImageCandidate {
  sprite_name: string;
  imageUrl: string;
  family: string;
  folder_path: string;
  name: string;
  display_name?: string;
  lore?: string;
  attributes?: any[];
  image: string;
  metadata: any;
}

const familiesByLevel: Record<number, Record<string, Record<string, ImageCandidate>>> = {
  1: {}, 2: {}, 3: {}
};

const colorProfilesByFamily: Record<string, any[]> = {};

(function indexRealFamilies() {
  //console.log('🔄 Indexation métadonnées réelles...');

  // Color profiles
  Object.entries(colorProfilesJson.families || {}).forEach(([fam, profiles]: any) => {
    colorProfilesByFamily[fam] = profiles;
  });

  // ✅ INDEX PAR NOMS RÉELS DES SPRITES
  let totalIndexed = 0;
  Object.entries(metadataJson).forEach(([spriteName, famData]: [string, any]) => {
    const level = parseInt(famData.level?.toString() || '0');
    if (level < 1 || level > 3) return;

    const family = famData.family_name;
    if (!family) return;

    const imagePath = famData.image || famData.image_path || '';
    const folderPath = imagePath
      ? imagePath.replace(/[^/\\]+\.gif$/i, '').replace(/\\\\/g, '/')
      : `lvl${level}/${family}/`;

    if (!familiesByLevel[level][family]) {
      familiesByLevel[level][family] = {};
    }

    familiesByLevel[level][family][spriteName] = {
      sprite_name: `${spriteName}.gif`,
      imageUrl: `/insects/${imagePath.replace(/\\\\/g, '/')}`,
      family,
      folder_path: folderPath,
      name: famData.name || spriteName,
      display_name: famData.display_name,
      lore: famData.lore,
      attributes: famData.attributes || [],
      image: imagePath,
      metadata: famData
    };

    totalIndexed++;
  });

  /*console.log(`✅ ${totalIndexed} sprites indexés:`, {
    lvl1: Object.keys(familiesByLevel[1]).length,
    lvl2: Object.keys(familiesByLevel[2]).length,
    lvl3: Object.keys(familiesByLevel[3]).length
  });
  */
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
ENGINE PRINCIPAL - 100% FONCTIONNEL
======================== */
export default function evolutionEngine(
  currentData: any,
  currentLevel: number,
  targetLevel: number,
  wallet: string,
  tokenId: string | number
) {
  const currentAttrs = Array.isArray(currentData.attributes)
    ? Object.fromEntries(currentData.attributes.map((a: any) => [a.trait_type, a.value]))
    : currentData.attributes || {};

  const currentFamily = currentData.family_name ||
                       currentAttrs.Famille ||
                       currentAttrs.family ||
                       currentData.source_folder ||
                       'unknown';

  const history = currentData.evolutionHistory || [];

  const historyFamilies = new Set<string>();
  const historySprites = new Set<string>();
  history.forEach((h: any) => {
    if (h.family || h.family_name || h.from_family) {
      historyFamilies.add(h.family || h.family_name || h.from_family);
    }
    if (h.sprite_name) historySprites.add(h.sprite_name);
  });

  const seedStr = [wallet.toLowerCase(), tokenId, targetLevel,
                  [...historyFamilies].join('|'), [...historySprites].join('|')].join('::');
  const rng = createSeededRNG(seedStr);

  //console.log(`🎯 LVL${targetLevel} depuis ${currentFamily} (hist fam:${historyFamilies.size}, sprites:${historySprites.size})`);

  const targetFamilies = familiesByLevel[targetLevel];
  if (!targetFamilies || Object.keys(targetFamilies).length === 0) {
    throw new Error(`❌ Aucune famille lvl${targetLevel}. Vérifiez nft_metadata_clean.json`);
  }

  const familyScores: Array<{family: string, score: number}> = [];

  Object.entries(targetFamilies).forEach(([familyName, images]: [string, Record<string, ImageCandidate>]) => {
    // Prendre le 1er sprite pour les attrs famille
    const firstImageKey = Object.keys(images)[0];
    const famData = images[firstImageKey];
    const targetAttrs = getAttributes(famData.metadata);

    let familyScore = similarity(currentAttrs, targetAttrs);

    if (familyName === currentFamily) familyScore *= 1.3;
    if (historyFamilies.has(familyName)) familyScore *= REPETITION_PENALTY;
    familyScore += (rng() - 0.5) * 0.1;

    familyScores.push({ family: familyName, score: Math.max(0.01, familyScore) });
  });

  // Tirage famille pondéré
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

  // ✅ SÉLECTION SPRITE CORRIGÉE
  const familyImages = targetFamilies[selectedFamily];
  if (!familyImages || Object.keys(familyImages).length === 0) {
    throw new Error(`❌ Aucune image famille ${selectedFamily} lvl${targetLevel}`);
  }

  const imageKeys = Object.keys(familyImages);
  const spritePick = Math.floor(rng() * imageKeys.length);
  const selectedImageKey = imageKeys[spritePick];
  const selectedImage = familyImages[selectedImageKey];

  //console.log(`✅ ${selectedImage.name} (${selectedFamily}) score=${familyScores.find(f => f.family === selectedFamily)?.score?.toFixed(2)} (${imageKeys.length} sprites)`);

  // Color profile MATCH
  const dominantColor = selectedImage.metadata.dominant_color || 'default';
  const colorProfile = colorProfilesByFamily[selectedFamily]?.find((p: any) =>
    p.filename?.includes(selectedImage.name.replace(selectedFamily, '')) ||
    p.filename?.includes(dominantColor) ||
    p.filename === `${selectedFamily}_${dominantColor}.gif`
  ) || colorProfilesByFamily[selectedFamily]?.[0] || null;

  const outputAttrs = [
    ...(selectedImage.attributes || []),
    { trait_type: 'Famille', value: selectedFamily },
    { trait_type: 'Sprite', value: selectedImage.name },
    { trait_type: 'Niveau', value: targetLevel }
  ];

  return {
    success: true,
    level: targetLevel,
    family: selectedFamily,
    family_name: selectedFamily,
    sprite_name: selectedImage.sprite_name,
    display_name: selectedImage.display_name || `${selectedImage.name} | ${selectedFamily}`,
    lore: selectedImage.lore,
    imageUrl: selectedImage.imageUrl,
    attributes: outputAttrs,
    color_profile: colorProfile,
    evolution_score: familyScores.find(f => f.family === selectedFamily)?.score || 0.5,
    seed_debug: seedStr,
    debug: {
      totalFamilies: Object.keys(targetFamilies).length,
      spritesInFamily: imageKeys.length,
      selectedSpriteIndex: spritePick
    }
  };
}
