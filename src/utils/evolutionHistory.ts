export interface EvolutionStep {
  lvlPrevious?: number;
  image: string;
  uri?: string;                    // ✅ URI JSON ajouté
  timestamp?: number;
  fullMetadata?: FullNFTMetadata;
  loading?: boolean;
}

export interface FullNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
  level?: number;
  famille?: string;
}

// ✅ CORRIGÉ : EXTRAI uri ET image
export const buildEvolutionHistory = (metadata: any): EvolutionStep[] => {
  console.log('🔍 RAW metadata.evolutionHistory:', metadata.evolutionHistory);

  if (!metadata?.evolutionHistory?.length) return [];

  return metadata.evolutionHistory.map((entry: any, idx: number) => ({
    lvlPrevious: entry.niveau ?? idx,
    image: entry.image,           // GIF pour affichage
    uri: entry.uri,               // ✅ JSON METADATA !
    timestamp: entry.horodatage,
    loading: true
  }));
};

// ✅ FETCH URI (JSON) au lieu d'image (GIF)
export const fetchRealMetadataFromUri = async (uri: string): Promise<FullNFTMetadata | null> => {
  try {
    console.log('🔍 Fetch URI:', uri);
    const res = await fetch(uri);
    if (!res.ok) {
      console.log('❌ URI 404');
      return null;
    }

    const data = await res.json();
    console.log('✅ METADATA:', data.name, data.attributes?.length || 0);

    const familleAttr = data.attributes?.find((attr: any) => attr.trait_type === 'Famille');

    return {
      name: data.name || '',
      description: data.description || data.bio || data.lore || '',
      image: data.image || '',
      attributes: data.attributes || [],
      level: data.level,
      famille: familleAttr?.value || 'unknown'
    };
  } catch (e) {
    console.error('❌ URI fetch failed:', uri, e);
    return null;
  }
};

// ✅ ENRICHIT avec URI
export const enrichHistoryWithRealMetadata = async (history: EvolutionStep[]): Promise<EvolutionStep[]> => {
  console.log('🔍 Enriching history:', history.map(h => ({ lvl: h.lvlPrevious, uri: h.uri })));

  const enriched = await Promise.all(
    history.map(async (step) => {
      let metadata = null;
      if (step.uri) {
        metadata = await fetchRealMetadataFromUri(step.uri);
      }
      return {
        ...step,
        fullMetadata: metadata || {
          name: `Étape ${step.lvlPrevious}`,
          description: '',
          image: step.image,
          attributes: [],
          level: step.lvlPrevious,
          famille: 'unknown'
        },
        loading: false
      };
    })
  );

  console.log('✅ ENRICHED:', enriched.map(e => e.fullMetadata?.name));
  return enriched;
};
