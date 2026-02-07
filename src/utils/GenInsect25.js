// src/utils/GenInsect25.js - LVL0 UNIQUEMENT pour adhésion/mint initial
import metadataJson from '@/data/nft_metadata_clean.json';

// Fonction utilitaire pour tirer un élément au hasard dans un tableau
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sprite selector : génère un nom de fichier de type 001_Family.gif
function spriteSelector(family) {
  return `${family}.gif`;
}

function genInsect25(level) {
  if (level !== 0) {
    throw new Error("GenInsect25: LVL0 uniquement - utilisez evolutionEngine pour LVL1+");
  }

  // 1️⃣ Filtrer toutes les familles LVL0 depuis nft_metadata.json
  const lvl0Families = Object.entries(metadataJson)
    .filter(([key, data]) => data.level === 0)
    .map(([key, data]) => ({ key, data }));

  if (!lvl0Families.length) {
    throw new Error("Aucune famille LVL0 trouvée dans nft_metadata.json");
  }

  // 2️⃣ Choix aléatoire d'une famille LVL0
  const randomFamily = randomItem(lvl0Families);
  const familyData = { ...randomFamily.data }; // copie des données complètes
  //console.log(familyData);
  const folder = familyData.family_name
  const name =  familyData.name || randomFamily.key;
  // 3️⃣ Sélection du sprite via spriteSelector
  const spriteName = spriteSelector(name);
  //console.log("newPath", folder);

  //console.log("spriteName", spriteName);

  const imageUrl = `/insects/lvl0/${folder}/${spriteName}`;
//console.log(imageUrl);
  // 4️⃣ On ajoute l'URL de l'image sélectionnée et le sprite utilisé
  //console.log(familyData);

  return {
    ...familyData,
    imageUrl,
    spriteName,
    folder
  };
}

export default genInsect25;
