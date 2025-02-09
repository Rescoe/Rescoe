// src/types/global.d.ts
declare global {
  interface Window {
    ethereum: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      // Si tu veux plus de méthodes, ajoute-les ici
      on: (event: string, callback: Function) => void;
      removeListener: (event: string, callback: Function) => void;
      enable: () => Promise<string[]>;
    };
  }
}

export {}; // Nécessaire pour que ce fichier soit un module TypeScript valide
