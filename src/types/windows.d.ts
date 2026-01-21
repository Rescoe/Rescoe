declare global {
  interface Window {
    RESCOE_AUTH: {
      isAuthenticated: boolean;
      address: string | null;
      role: string | null;
      isAdmin: boolean;
      isArtist: boolean;
      isPoet: boolean;
      isTrainee: boolean;
      isContributor: boolean;
      isMember: boolean;
      web3: any;
      provider: any;
      connectWallet?: () => void;
      connectWithEmail?: () => void;
      logout?: () => void;
      roleLoading: boolean;
      isLoading: boolean;
    } | null;
  }
}
export {};
