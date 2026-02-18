// ✅ VERSION INTELLIGENTE : badges (level+history) / oeuvres (artist+simple)

import { useState } from "react";

export type UploadScope = "badges" | "oeuvres";

export interface OpenSeaAttribute {
  trait_type: string;
  value: string | number;
}

export interface UploadOptions {
  scope: UploadScope;
  imageFile?: File;
  imageUrl?: string;
  name: string;
  description?: string;  // Oeuvres
  bio?: string;          // Badges
  role?: string;         // Badges
  level?: number;        // Badges (optionnel oeuvres)
  attributes?: OpenSeaAttribute[];
  tags?: string;         // Oeuvres
  maxEditions?: number;
  collectionType?: string;
  artist?: string;       // 🔥 OEUVRES
  family?: string;
  sprite_name?: string;
  color_profile?: unknown;
  previousImage?: string | null;
  evolutionHistory?: any[];
  custom_data?: Record<string, any>;
}

interface UsePinataUploadReturn {
  metadataUri: string | null;
  imageUri: string | null;
  isUploading: boolean;
  error: string | null;
  uploadToIPFS: (options: UploadOptions) => Promise<{
    metadataUri: string;
    imageUri: string;
    metadataHash: string;
    imageHash: string;
  }>;
}

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Impossible de charger l'image (${res.status})`);
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const usePinataUpload = (): UsePinataUploadReturn => {
  const [metadataUri, setMetadataUri] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadToIPFS = async (options: UploadOptions) => {
    setIsUploading(true);
    setError(null);

    try {
      const {
        scope, imageUrl, imageFile, name, description, bio,
        role, level, attributes = [], tags, maxEditions,
        collectionType, artist, family, sprite_name, color_profile,
        previousImage, evolutionHistory = [], custom_data = {}
      } = options;

      // 1. Image → base64
      let fileBase64: string;
      if (imageFile) {
        fileBase64 = await fileToBase64(imageFile);
      } else if (imageUrl) {
        fileBase64 = await urlToBase64(imageUrl);
      } else {
        throw new Error("imageFile ou imageUrl requis");
      }

      // 2. Base commune INTELLIGENTE
      const baseMetadata: any = {
        name,
        ...(level !== undefined && { level }),  // Badges seulement si fourni
        ...(attributes.length > 0 && { attributes }),
        ...(family && { family }),
        ...(sprite_name && { sprite_name }),
        ...(color_profile ? { color_profile: color_profile as any } : {}),
        ...(previousImage !== undefined && { previousImage }),
        ...(evolutionHistory.length > 0 && { evolutionHistory }),
      };

      let metadata: any = { ...baseMetadata };

      // 3. BADGES (complexes)
      if (scope === "badges") {
        metadata = {
          ...metadata,
          bio: bio || "",
          description: `Badge ${role || "Membre"}. ${bio || "Aucune bio fournie."}`,
          role: role || "Membre",
          tags: ["Adhesion", role || "Membre"]
        };
      }
      // 4. OEUVRES (simples + artist)
      //Probleme avec solo et maxedition sici !!!
      // ✅ FIX usePinataUpload.tsx
      else {
        metadata = {
          ...metadata,
          description: description || "",
          ...(artist && { artist }),
          tags: tags ? tags.split(',').map(t => t.trim()) : ["Oeuvre"],
          // 🔥 PRIORITÉ custom_data d'ABORD
          ...custom_data,
          // 🔥 ENSUITE collectionType/maxEditions (avec check explicite)
          collectionType: custom_data?.collectionType || collectionType || "solo",
          maxEditions: custom_data?.maxEditions || maxEditions || 1,
        };
      }

      // 5. Backend
      const res = await fetch("/api/pinata/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, fileBase64, metadata })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Upload IPFS échoué");
      }

      const data = await res.json();
      setImageUri(data.image);
      setMetadataUri(data.metadata);
      return {
        imageUri: data.image,
        metadataUri: data.metadata,
        imageHash: data.imageHash,
        metadataHash: data.metadataHash
      };

    } catch (err: any) {
      console.error("Upload IPFS error:", err);
      setError(err?.message || "Erreur upload IPFS");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    metadataUri,
    imageUri,
    isUploading,
    error,
    uploadToIPFS
  };
};
