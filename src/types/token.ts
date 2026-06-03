/**
 * Types partagés entre les API routes /api/token/* et les composants qui les consomment.
 * Séparé des API routes pour éviter les imports cross-boundary (pages/ ← src/).
 */

// ─── Adhesion metadata ────────────────────────────────────────────────────────

export interface AdhesionTokenMetadata {
  tokenURI: string;
  image: string;
  /** Message non-bloquant (ex: InsectStorage pas encore configuré) */
  warning?: string;
  /** Famille de l'insecte (ex: "Vulpin") — extrait du tokenURI on-chain */
  insectFamily?: string;
  /** Nom d'affichage de l'insecte (ex: "VulpinSpectraAlpha | Vulpin") */
  insectDisplayName?: string;
  /** Niveau actuel (0-3) — redondant avec membershipInfo.level, mais pratique côté client */
  insectLevel?: number;
  /** Adresse wallet de l'artiste graphiste (ex: "0x1234…") — attribut "Artiste" du tokenURI */
  insectArtistAddress?: string;
}

// ─── Adhesion state ───────────────────────────────────────────────────────────

export interface MembershipInfo {
  level: number;
  isEgg: boolean;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isAnnual: boolean;
}

export interface AdhesionTokenState {
  owner: string;
  role: number;
  mintTimestamp: string;
  price: string;
  name: string;
  bio: string;
  remainingTime: string;
  fin: string;
  forSale: boolean;
  membership: string;
  membershipInfo: MembershipInfo;
  mintPrice: string;
}

// ─── Art metadata ─────────────────────────────────────────────────────────────

export interface ArtTokenMetadata {
  image: string;
  name: string;
  description: string;
  artist: string;
}

// ─── Art state ────────────────────────────────────────────────────────────────

export interface ArtTransaction {
  oldOwner: string;
  newOwner: string;
  date: string;
  price: string;
}

export interface ArtTokenState {
  owner: string;
  mintDate: string;
  forsale: boolean;
  price: string;
  priceHistory: number[];
  transactions: ArtTransaction[];
  collectionId: number;
}
