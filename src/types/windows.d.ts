declare global {
  interface Window {
    /** Ton RESCOE_AUTH existant */
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

    /** MetaMask EIP-1193 Provider */
    ethereum?: {
      /** RPC calls */
      request(params: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }): Promise<unknown>;

      /** Events */
      on(eventName: string, handler: (...args: unknown[]) => void): void;
      removeListener(eventName: string, handler: (...args: unknown[]) => void): void;
      off?(eventName: string, handler: (...args: unknown[]) => void): void;

      /** MetaMask props */
      isMetaMask?: boolean;
      isConnected?: () => boolean;
      isUnlocked?: () => Promise<boolean>;
      selectedAddress?: string;
      chainId?: string;
      networkVersion?: string;
      accounts?: string[];
    };
  }
}

export {};
