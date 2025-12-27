// src/hooks/usePinataUpload.ts - ✅ FIXÉ : retourne URI + interface correcte
import { useState } from "react";
import axios from "axios";

export interface OpenSeaAttribute {
  trait_type: string;
  value: string | number;
}

export interface UploadOptions {
  imageUrl: string;
  name: string;
  bio: string;
  role: string;
  level: number;

  previousImage?: string | null;
  rarityTier?: string;
  rarityScore?: number;
  attributes?: OpenSeaAttribute[];
  evolutionHistory?: any;

  // ✅ AJOUTS STRUCTURANTS
  family?: string;
  sprite_name?: string;
  color_profile?: unknown; // ou ColorProfile si tu veux typer fort
}

interface UsePinataUploadReturn {
  ipfsUrl: string | null;
  imageIpfsUrl: string | null;
  isUploading: boolean;
  error: string | null;
  uploadToIPFS: (options: UploadOptions) => Promise<{ipfsHash: string, url: string}>;  // ✅ FIXÉ : retourne URI
}

async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Impossible de charger l'image : ${res.status}`);
  return await res.blob();
}

export const usePinataUpload = (): UsePinataUploadReturn => {
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [imageIpfsUrl, setImageIpfsUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadToIPFS = async (options: UploadOptions) => {
    const {
      imageUrl,
      name,
      bio,
      role,
      previousImage,
      level,
      rarityTier,
      rarityScore,
      attributes,
      evolutionHistory,
    } = options;

    setIsUploading(true);
    setError(null);

    try {
      if (!imageUrl) {
        throw new Error("Veuillez vous assurer que l'image est générée.");
      }

      const blob = await urlToBlob(imageUrl);
      const formData = new FormData();
      formData.append("file", blob, "insect.gif");

      const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT;
      if (!pinataJwt) {
        throw new Error("PINATA_JWT manquant dans les variables d'environnement.");
      }

      // 1) Upload de l'image
      const imageResponse = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const gatewayBase = "https://purple-managerial-ermine-688.mypinata.cloud/ipfs/";
      const imageHash = imageResponse.data.IpfsHash;
      const imageIpfsUrlLocal = `${gatewayBase}${imageHash}`;
      setImageIpfsUrl(imageIpfsUrlLocal);

      // 2) Construction des métadatas JSON
      const metadataJson: any = {
        name: name || "Nom inconnu",
        bio: bio || "Aucune bio",
        description: `Vous êtes ${role || "Membre"}`,
        image: imageIpfsUrlLocal,
        level,
        role: role || "Membre",
        rarityTier: rarityTier || "Common",
        rarityScore: rarityScore ?? 1,
        tags: ["Adhesion", role || "Membre"],
      };

      if (attributes && attributes.length > 0) {
        metadataJson.attributes = attributes;
      }

      if (evolutionHistory) {
        metadataJson.evolutionHistory = evolutionHistory;
      } else {
        metadataJson.evolutionHistory = [];
      }

      if (previousImage && !evolutionHistory) {
        metadataJson.previousImage = previousImage;
        metadataJson.evolutionHistory = [
          {
            lvlPrevious: level - 1,
            image: previousImage,
            timestamp: Math.floor(Date.now() / 1000),
          },
        ];
      }

      // 3) Upload du JSON de métadatas
      const metadataResponse = await axios.post(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        metadataJson,
        {
          headers: {
            Authorization: `Bearer ${pinataJwt}`,
            "Content-Type": "application/json",
          },
        }
      );

      const metadataHash = metadataResponse.data.IpfsHash;
      const metadataIpfsUrl = `${gatewayBase}${metadataHash}`;
      setIpfsUrl(metadataIpfsUrl);

      // ✅ RETOURNE DIRECT l'URI
      return { ipfsHash: metadataHash, url: metadataIpfsUrl };

    } catch (err: any) {
      console.error("Erreur lors de l'upload sur IPFS:", err);
      setError(err?.message || "Erreur lors de l'upload sur IPFS.");
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    ipfsUrl,
    imageIpfsUrl,
    isUploading,
    error,
    uploadToIPFS,
  };
};
