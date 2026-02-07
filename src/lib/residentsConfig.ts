// src/config/residentsConfig.ts (ou lib/residentsConfig.ts)
export type ResidentData = {
  address: string;
  name: string;
  avatar?: string;
  role?: string;
  bio?: string;
};

export const RESIDENTS_CONFIG: ResidentData[] = [
  {
    address: "0x552C63E3B89ADf749A5C1bB66fE574dF9203FfB4",
    name: "Roubzi",
    avatar: "/avatars/roubzi.png",
    role: "Artiste & Dresseur de Shtern",
    bio: "Créateur de l'écosystème RESCOE",
  },
  {
    address: "0x1234567890abcdef1234567890abcdef12345678", // Exemple
    name: "May Santot",
    avatar: "/avatars/maysantot.png",
    role: "Poétesse en résidence",
    bio: "Maître des mots et des silences",
  },
  // ✅ Ajoute tes résidents ici
];

export const RESIDENT_ADDRESSES =
  RESIDENTS_CONFIG.map(r => r.address.toLowerCase());
