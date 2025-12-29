// REMPLACEZ TOUT (copie-colle COMPLET) - ✅ SEED WALLET + TOKEN_ID UNIQUEMENT
import metadataJson from '@/data/nft_metadata_clean.json';
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  Taille: 0.142, Type: 0.113, Stade: 0.094, Pattes: 0.094, Ailes: 0.094,
  Forme: 0.075, Motif: 0.075, Poils: 0.057, Carapace: 0.057, Corps: 0.047,
  Legendaire: 0.047, Cornes: 0.028, Yeux: 0.028, Antennes: 0.028, Filtre: 0.019
};

const PRIORITY_WEIGHTS = {
  familyBonus: 0.40, attrsScore: 0.35, colorScore: 0.15, lineageBonus: 0.10
};

// 🔥 SEED RANDOM (déterministe par wallet+token UNIQUEMENT)
function createSeededRNG(walletAddress: string, tokenId: string | number): () => number {
  // Hash simple wallet+token → seed fixe
  const seedString = `${walletAddress.toLowerCase()}-${tokenId}`.replace(/0x/g, '');
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) + seedString.charCodeAt(i)) >>> 0;  // Hash 32bit
  }

  // Simple LCG PRNG (déterministe, rapide)
  let state = seed >>> 0;
  return function rng() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;  // [0,1)
  };
}

// 🔥 INDEX PAR new_folder (Chronyx, Vesporyns...)
const familiesByName: Record<string, any> = {};
const colorProfilesByFamily: Record<string, any[]> = {};

function initData() {
  Object.values(metadataJson).forEach((data: any) => {
    if (data.new_folder) {
      familiesByName[data.new_folder] = data;
    }
  });

  const colors = colorProfilesJson.families || {};
  for (const [family, profiles] of Object.entries(colors)) {
    if (Array.isArray(profiles)) colorProfilesByFamily[family] = profiles;
  }

  console.log(`✅ ${Object.keys(familiesByName).length} families, ${Object.keys(colorProfilesByFamily).length} colorProfiles`);
}
initData();

function getFamilyData(familyName: string): any {
  return familiesByName[familyName] || metadataJson[familyName as keyof typeof metadataJson];
}

function getAttributes(familyData: any): Record<string, any> {
  const out: Record<string, any> = {};
  (familyData.attributes || []).forEach((a: any) => (out[a.trait_type] = a.value));
  return out;
}

const attributeSimilarity = (a1: Record<string, any>, a2: Record<string, any>): number => {
  let s = 0, w = 0;
  ["Taille", "Stade", "Type", "Pattes", "Ailes"].forEach((k) => {
    const wt = ATTRIBUTE_WEIGHTS[k];
    if (!wt) return;
    w += wt;
    if (a1[k] === a2[k]) s += wt;
    else if (k === "Pattes" || k === "Ailes") {
      s += wt * Math.max(0, 1 - Math.abs(Number(a1[k]) - Number(a2[k])) / 4);
    }
  });
  return s / Math.max(1, w);
};

function extractFromIPFS(ipfsMetadata: any): {
  family: string;
  currentLevel: number;
  attributes: Record<string, any>;
  tokenId?: string | number;
} {
  const attributesArray = ipfsMetadata.attributes || [];
  const attributes = Object.fromEntries(attributesArray.map((a: any) => [a.trait_type, a.value]));

  const familyKey = attributes.Famille || attributes.family || ipfsMetadata.family;
  const familyData = getFamilyData(familyKey);
  const realFamily = familyData?.new_folder || familyKey || 'Vesporyns';

  return {
    family: realFamily,
    currentLevel: Number(ipfsMetadata.level) || 0,
    attributes,
    tokenId: ipfsMetadata.token_id || ipfsMetadata.tokenId
  };
}

function getRealImagePath(familyData: any, level: number): string {
  const path = familyData.new_path ?
    familyData.new_path.replace(/lvl\d+/, `lvl${level}`) :
    `lvl${level}/${familyData.new_folder}/`;
  const sprite = `001_${familyData.new_folder}.gif`;
  return `/insects/${path}${sprite}`;
}

// 🔥 ENGINE = SIMULATEUR 100% + SEED WALLET+TOKEN
export default function evolutionEngine(
  ipfsMetadata: any,
  currentLevel: number,
  targetLevel: number,
  walletAddress: string,      // 🔥 ADRESSE WALLET
  tokenId: string | number    // 🔥 TOKEN_ID UNIQUEMENT
): any {
  // Ligne 114 → Remplace par :
  console.log('🚀 evolutionEngine SEEDÉ:', {
    walletAddress: walletAddress ? walletAddress.slice(0,8)+'...' : 'undefined',
    tokenId,
    currentLevel,
    targetLevel

  });

  // 🔥 EXTRACTION + SEED RNG UNIQUE (wallet+token)
  const { family, attributes, tokenId: metadataTokenId } = extractFromIPFS(ipfsMetadata);
  const finalTokenId = metadataTokenId || tokenId;
  const rng = createSeededRNG(walletAddress, finalTokenId.toString());

  const currentFamilyData = getFamilyData(family);
  console.log('🔍 CURRENT:', { family, taille: attributes.Taille, new_folder: currentFamilyData?.new_folder });

  // ✅ CANDIDATS LVL+1 (SEEDÉS!)
  const familyCandidates: Record<string, any> = {};

  Object.values(metadataJson).forEach((familyData: any) => {
    if (familyData.level !== `lvl${targetLevel}`) return;

    const targetAttrs = getAttributes(familyData);
    const attrsScore = attributeSimilarity(attributes, targetAttrs);

    // 🔥 RNG SEEDÉ → UNIQUES PAR WALLET+TOKEN!
    const colorScore = 0.7 + rng() * 0.3;           // 70-100% (plus varié)
    const lineageBonus = ipfsMetadata.parent_token_id ? 0.1 * rng() : 0;
    const familyBonus = familyData.new_folder === family ? 0.45 : 0.02 * rng(); // Bonus faible random

    // 🔥 SCORE COMPLET + BRUIT
    const noise = 0.05 * (rng() - 0.5);  // ±2.5%
    const score = familyBonus * PRIORITY_WEIGHTS.familyBonus +
                  attrsScore * PRIORITY_WEIGHTS.attrsScore +
                  colorScore * PRIORITY_WEIGHTS.colorScore +
                  lineageBonus * PRIORITY_WEIGHTS.lineageBonus + noise;

    familyCandidates[familyData.new_folder] = {
      score: Math.max(0.01, score),
      attrsScore,
      colorScore,
      familyBonus,
      lineageBonus,
      noise,
      bestProfile: {
        family: familyData.new_folder,
        filename: `001_${familyData.new_folder}.gif`,
        imagePath: getRealImagePath(familyData, targetLevel)
      },
      isLegendary: targetAttrs.Legendaire === "Oui",
      metadata: familyData
    };
  });

  console.log(`🎯 ${Object.keys(familyCandidates).length} candidats LVL${targetLevel} (SEED: ${walletAddress.slice(0,8)}-${finalTokenId})`);

  // ✅ TOP 1 (déterministe par seed → unique!)
  const sorted = Object.entries(familyCandidates)
    .sort((a: any, b: any) => b[1].score - a[1].score);
  const [selectedFamilyKey, selectedData] = sorted[0];
  const selectedFamilyData = selectedData.metadata;

  // 🔥 RETOUR 35+ ATTRIBUTS
  const spriteFilename = `001_${selectedFamilyData.new_folder}.gif`;
  const familyKey = selectedFamilyData.new_folder;

  const colorProfile = colorProfilesByFamily[familyKey]?.find(
    (p: any) => p.filename === spriteFilename
  ) || colorProfilesByFamily[familyKey]?.[0];

  const morphoAttributes = selectedFamilyData.attributes || [];
  const insectAttributes = [
    ...morphoAttributes,
    { trait_type: "Famille", value: familyKey },
    { trait_type: "DisplayName", value: selectedFamilyData.display_name },
    { trait_type: "Lore", value: selectedFamilyData.lore },
    { trait_type: "TotalFamille", value: selectedFamilyData.total_in_family },
    { trait_type: "Sprite", value: spriteFilename }
  ];

  const colorAttributes = colorProfile ? [
    { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
    { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
    { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
    { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
    { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },
    { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
    { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
    { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },
    { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
    { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
    { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness || 0) },
    { trait_type: "Entropie", value: Math.round((colorProfile.metrics.entropy || 0) * 10) / 10 },
    { trait_type: "Frames", value: colorProfile.frame_count || 2 },
    { trait_type: "Pixels", value: (colorProfile.total_pixels_analyzed || 60000).toLocaleString() },
    { trait_type: "TailleBytes", value: ((colorProfile.gif_info?.size_bytes || 35000) / 1000).toFixed(1) + "KB" }
  ] : [];

  const fullAttributes = [
    ...insectAttributes.filter(attr => !["Niveau"].includes(attr.trait_type as string)),
    { trait_type: "Niveau", value: targetLevel },
    ...colorAttributes
  ];

  console.log(`🚀 LVL${targetLevel}: ${fullAttributes.length} attributs (SEED ${walletAddress.slice(0,8)}-${finalTokenId})`);

  const imageUrl = getRealImagePath(selectedFamilyData, targetLevel);

  return {
    success: true,
    imageUrl,
    level: targetLevel,
    family: familyKey,
    sprite_name: spriteFilename,
    display_name: selectedFamilyData.display_name,
    lore: selectedFamilyData.lore,
    attributes: fullAttributes,
    color_profile: colorProfile,
    evolution_score: selectedData.score,
    best_profile: selectedData.bestProfile,
    all_candidates: familyCandidates,
    seed_info: { wallet: walletAddress.slice(0,8), tokenId: finalTokenId },
    probability: selectedData.score / Object.values(familyCandidates).reduce((sum: number, c: any) => sum + c.score, 0)
  };
}
