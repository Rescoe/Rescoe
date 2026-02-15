import { resolveIPFS } from "@/utils/resolveIPFS";


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
    const url = resolveIPFS(uri, true); // -> /api/ipfs/...
    if (!url) return null;

    const res = await fetch(url);
    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
};

export const enrichHistoryWithRealMetadata = async (
  history: EvolutionStep[]
): Promise<EvolutionStep[]> => {
  const enriched = await Promise.all(
    history.map(async (step): Promise<EvolutionStep> => {
      step.loading = true;

      const metadataUri = step.uri || step.image; // ipfs://..., cid, etc.

      try {
        const metadata =
          metadataUri ? await fetchIPFSMetadata(metadataUri) : null;

        step.fullMetadata =
          metadata || {
            name: `Niveau ${step.lvlPrevious}`,
            description: "Étape d'évolution",
            image: step.image,
            attributes: [],
            level: step.lvlPrevious,
            famille: "unknown",
          };
      } catch (e) {
        console.warn("❌ Metadata fetch failed for", metadataUri, e);
        step.fullMetadata = {
          name: `Niveau ${step.lvlPrevious}`,
          description: "Étape d'évolution",
          image: step.image,
          attributes: [],
          level: step.lvlPrevious,
          famille: "unknown",
        };
      }

      step.loading = false;
      return step;
    })
  );

  return enriched;
};


export const buildEvolutionHistory = (metadata: any): EvolutionStep[] => {
  let history: EvolutionStep[] = [];

  // 1. Historique passé
  if (metadata.evolutionHistory && Array.isArray(metadata.evolutionHistory)) {
    history = metadata.evolutionHistory.map((entry: any): EvolutionStep => {
      const lvlPrevious =
        entry.lvlPrevious ??
        entry.level ??
        entry.niveau ??
        0;

      // On garde l'URI "propre"
      const rawUri =
        entry.uri ||
        entry.metadataUri ||
        entry.image || // si c'est du ipfs://...
        "";

      return {
        lvlPrevious,
        image: resolveIPFS(entry.image, true) || "", // pour affichage direct
        uri: rawUri,                                  // pour fetch metadata
        timestamp: entry.timestamp,
        from_family: entry.from_family,
        evolved_to: entry.evolved_to,
        evolution_score: entry.evolution_score,
        loading: true,
      };
    });
  }

  // 2. État courant
  const currentLevel = Number(
    metadata.membershipInfo?.level ?? metadata.level ?? 0
  );

  if (metadata.image && (metadata.tokenURI || metadata.uri)) {
    const currentUri = metadata.tokenURI || metadata.uri;

    history.push({
      lvlPrevious: currentLevel,
      image: resolveIPFS(metadata.image, true) || "",
      uri: currentUri,
      timestamp: metadata.timestamp || Date.now() / 1000,
      loading: true,
    });
  }

  return history;
};
