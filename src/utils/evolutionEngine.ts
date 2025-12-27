// REMPLACEZ TOUT (copie-colle COMPLET)

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

// 🔥 INDEX PAR new_folder (Chronyx, Vesporyns...)
const familiesByName: Record<string, any> = {};
const colorProfilesByFamily: Record<string, any[]> = {};

function initData() {
  // Index nft_metadata_clean.json par new_folder
  Object.values(metadataJson).forEach((data: any) => {
    if (data.new_folder) {
      familiesByName[data.new_folder] = data;
    }
  });

  // Index color profiles
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

// 🔥 EXTRACTION IPFS → REAL FAMILY
function extractFromIPFS(ipfsMetadata: any): {
  family: string;           // "Chronyx" (new_folder)
  currentLevel: number;
  attributes: Record<string, any>;
} {
  const attributesArray = ipfsMetadata.attributes || [];
  const attributes = Object.fromEntries(attributesArray.map((a: any) => [a.trait_type, a.value]));

  // ✅ new_folder = VRAIE family (Chronyx, Vesporyns)
  const familyKey = attributes.Famille || attributes.family || ipfsMetadata.family;
  const familyData = getFamilyData(familyKey);
  const realFamily = familyData?.new_folder || familyKey || 'Vesporyns';

  return {
    family: realFamily,
    currentLevel: Number(ipfsMetadata.level) || 0,
    attributes
  };
}

// 🔥 PICK REAL IMAGE (new_path)
function getRealImagePath(familyData: any, level: number): string {
  const path = familyData.new_path ?
    familyData.new_path.replace(/lvl\d+/, `lvl${level}`) :
    `lvl${level}/${familyData.new_folder}/`;
  const sprite = `001_${familyData.new_folder}.gif`;
  return `/insects/${path}${sprite}`;
}

// ✅ ENGINE = SIMULATEUR 100%
export default function evolutionEngine(
  ipfsMetadata: any,
  currentLevel: number,
  targetLevel: number
): any {
  console.log('🚀 evolutionEngine:', { currentLevel, targetLevel });

  // ✅ IPFS → REAL FAMILY DATA
  const { family, attributes } = extractFromIPFS(ipfsMetadata);
  const currentFamilyData = getFamilyData(family);

  console.log('🔍 CURRENT:', { family, taille: attributes.Taille, new_folder: currentFamilyData?.new_folder });

  // ✅ CANDIDATS LVL+1 (comme simulateur)
  const familyCandidates: Record<string, any> = {};

  Object.values(metadataJson).forEach((familyData: any) => {
    if (familyData.level !== `lvl${targetLevel}`) return;

    const targetAttrs = getAttributes(familyData);
    const attrsScore = attributeSimilarity(attributes, targetAttrs);

    // ✅ Simple couleur (comme simulateur)
    const colorScore = 0.85 + Math.random() * 0.15; // 85-100%

    // ✅ Bonus famille
    const familyBonus = familyData.new_folder === family ? 0.45 : 0;

    const score = familyBonus * PRIORITY_WEIGHTS.familyBonus +
                  attrsScore * PRIORITY_WEIGHTS.attrsScore +
                  colorScore * PRIORITY_WEIGHTS.colorScore;

    familyCandidates[familyData.new_folder] = {
      score: Math.max(0.01, score),
      attrsScore,
      colorScore,
      familyBonus,
      bestProfile: {
        family: familyData.new_folder,
        filename: `001_${familyData.new_folder}.gif`,
        imagePath: getRealImagePath(familyData, targetLevel)
      },
      isLegendary: targetAttrs.Legendaire === "Oui",
      metadata: familyData
    };
  });

  console.log(`🎯 ${Object.keys(familyCandidates).length} candidats LVL${targetLevel}`);

  // ✅ TOP 1 (comme simulateur)
  const sorted = Object.entries(familyCandidates)
    .sort((a: any, b: any) => b[1].score - a[1].score);
  const [selectedFamilyKey, selectedData] = sorted[0];
  const selectedFamilyData = selectedData.metadata;

  // 🔥 RETOUR 35+ ATTRIBUTS (comme admin)
const spriteFilename = `001_${selectedFamilyData.new_folder}.gif`;
const familyKey = selectedFamilyData.new_folder;

// 🔥 PROFIL COULEUR EXACT (comme admin)
const colorProfile = colorProfilesByFamily[familyKey]?.find(
  (p: any) => p.filename === spriteFilename
) || colorProfilesByFamily[familyKey]?.[0];

// ✅ ATTRIBUTS MORPHO (15 traits)
const morphoAttributes = selectedFamilyData.attributes || [];

// 🔥 MÉTAS INSECTE
const insectAttributes = [
  ...morphoAttributes,
  { trait_type: "Famille", value: familyKey },
  { trait_type: "DisplayName", value: selectedFamilyData.display_name },
  { trait_type: "Lore", value: selectedFamilyData.lore },
  { trait_type: "TotalFamille", value: selectedFamilyData.total_in_family },
  { trait_type: "Sprite", value: spriteFilename }
];

// 🔥 COULEURS MAX (20+ traits OpenSea)
const colorAttributes = colorProfile ? [
  // 🎨 COULEURS DOMINANTES (Top 5)
  { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
  { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
  { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
  { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
  { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },

  // 🌈 HSV COMPLET
  { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
  { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
  { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },

  // 📊 MÉTRIQUES TECHNIQUES
  { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
  { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
  { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness || 0) },
  { trait_type: "Entropie", value: Math.round((colorProfile.metrics.entropy || 0) * 10) / 10 },

  // 🎬 TECH GIF
  { trait_type: "Frames", value: colorProfile.frame_count || 2 },
  { trait_type: "Pixels", value: (colorProfile.total_pixels_analyzed || 60000).toLocaleString() },
  { trait_type: "TailleBytes", value: ((colorProfile.gif_info?.size_bytes || 35000) / 1000).toFixed(1) + "KB" }
] : [];

const fullAttributes = [
  ...insectAttributes.filter(attr => !["Niveau"].includes(attr.trait_type as string)),
  { trait_type: "Niveau", value: targetLevel },
  ...colorAttributes
];

console.log(`🚀 LVL${targetLevel}: ${fullAttributes.length} attributs OpenSea générés !`);

const imageUrl = getRealImagePath(selectedFamilyData, targetLevel);

return {
  success: true,
  imageUrl,
  level: targetLevel,
  family: familyKey,                           // ✅ "Chronyx"
  sprite_name: spriteFilename,                 // ✅ "001_Chronyx.gif"
  display_name: selectedFamilyData.display_name,
  lore: selectedFamilyData.lore,

  // 🔥 35+ ATTRIBUTS PRÊTS OpenSea
  attributes: fullAttributes,                  // ✅ Morpho + 20+ couleur
  color_profile: colorProfile,                 // ✅ Full HSV/RGB/HEX

  evolution_score: selectedData.score,
  best_profile: selectedData.bestProfile,
  all_candidates: familyCandidates,
  probability: selectedData.score / Object.values(familyCandidates).reduce((sum: number, c: any) => sum + c.score, 0)
};
}
