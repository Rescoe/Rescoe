/**
 * Types partagés entre les API routes /api/token/* et les composants qui les consomment.
 * Séparé des API routes pour éviter les imports cross-boundary (pages/ ← src/).
 */

// ─── Adhesion metadata ────────────────────────────────────────────────────────

export interface AdhesionTokenMetadata {
  tokenURI: string;
  image: string;
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
