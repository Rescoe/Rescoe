export interface EvolutionStep {
  lvlPrevious?: number;
  image: string;
  uri?: string;  // ✅ URI JSON ajouté pour current + history
  timestamp?: number;
  from_family?: string;
  evolved_to?: string;
  evolution_score?: number;
  fullMetadata?: any;
  loading?: boolean;
  error?: string;
}

export interface FullNFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
  level?: number;
  evolutionHistory?: EvolutionStep[];
  famille?: string;
}

export const fetchIPFSMetadata = async (uri: string): Promise<FullNFTMetadata | null> => {
  try {
    let cid = uri;
    if (uri.includes('ipfs://')) cid = uri.replace('ipfs://', '');
    else if (uri.includes('/ipfs/')) cid = uri.split('/ipfs/')[1]?.split('/')[0] || '';

    const metadataUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
    const res = await fetch(metadataUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const enrichHistoryWithRealMetadata = async (history: EvolutionStep[]): Promise<EvolutionStep[]> => {
  console.log('🔍 Enriching', history.length, 'steps');

  const enriched = await Promise.all(
    history.map(async (step): Promise<EvolutionStep> => {
      step.loading = true;
      let metadataUri = step.uri || step.image;  // ✅ Priorité URI, fallback image

      if (metadataUri?.includes('ipfs://')) metadataUri = metadataUri.replace('ipfs://', '');
      else if (metadataUri?.includes('/ipfs/')) metadataUri = metadataUri.split('/ipfs/')[1]?.split('/')[0] || '';
      else if (metadataUri?.includes('pinata.cloud/ipfs/')) metadataUri = metadataUri.split('/ipfs/')[1]?.split('/')[0] || '';

      try {
        const metadata = await fetchIPFSMetadata(`https://gateway.pinata.cloud/ipfs/${metadataUri}`);
        step.fullMetadata = metadata || {
          name: `Niveau ${step.lvlPrevious}`,
          description: 'Étape d\'évolution',
          image: step.image,
          attributes: [],
          level: step.lvlPrevious,
          famille: 'unknown'
        };
      } catch (e) {
        console.warn('❌ Metadata fetch failed for', step.image || step.uri, e);
        step.fullMetadata = {
          name: `Niveau ${step.lvlPrevious}`,
          description: 'Étape d\'évolution',
          image: step.image,
          attributes: [],
          level: step.lvlPrevious,
          famille: 'unknown'
        };
      }
      step.loading = false;
      return step;
    })
  );
  return enriched;
};


export const buildEvolutionHistory = (metadata: any): EvolutionStep[] => {
 console.log('🔍 RAW metadata:', metadata);
 let history: EvolutionStep[] = [];

 // 1. HISTORIQUE : supporte entry.level OU lvlPrevious
 if (metadata.evolutionHistory && Array.isArray(metadata.evolutionHistory)) {
   history = metadata.evolutionHistory.map((entry: any) => ({
     lvlPrevious: entry.lvlPrevious || entry.level || entry.niveau || 0,  // ✅ FIX undefined lvl
     image: entry.image,
     uri: entry.uri || entry.metadataUri || entry.image.replace('ipfs://', ''),  // ✅ URI flexible
     timestamp: entry.timestamp,
     from_family: entry.from_family,
     evolved_to: entry.evolved_to,
     evolution_score: entry.evolution_score,
     loading: true
   }));
   console.log('✅ History parsed:', history.map(h => h.lvlPrevious));  // [0,1]
 }

 // 2. CURRENT DERNIER : level fiable + tokenURI
 const currentLevel = Number(metadata.membershipInfo?.level ?? metadata.level ?? 0);
 if (metadata.image && currentLevel >= 0 && (metadata.tokenURI || metadata.uri)) {
   history.push({
     lvlPrevious: currentLevel,
     image: metadata.image,
     uri: metadata.tokenURI || metadata.uri || metadata.image,
     timestamp: metadata.timestamp || Date.now() / 1000,
     loading: true
   });
   console.log('✅ CURRENT lvl DERNIER:', currentLevel, metadata.tokenURI);
 }

 console.log('✅ FINAL history:', history.map(h => ({ lvl: h.lvlPrevious, uri: h.uri?.slice(0,20) })));
 return history;
};
