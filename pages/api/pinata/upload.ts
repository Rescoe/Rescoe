// /api/pinata/upload.ts - VERSION TOTALE FLEXIBLE
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import FormData from "form-data";

type UploadScope = "badges" | "oeuvres";

function getPinataJwt(scope: UploadScope) {
  if (scope === "badges") return process.env.PINATA_JWT_BADGES;
  if (scope === "oeuvres") return process.env.PINATA_JWT_ARTWORKS;
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileBase64, metadata, scope } = req.body as {
      fileBase64: string;
      metadata: any;
      scope: UploadScope;
    };

    if (!scope || !["badges", "oeuvres"].includes(scope)) {
      throw new Error("Scope invalide");
    }

    const pinataJwt = getPinataJwt(scope);
    if (!pinataJwt) {
      throw new Error(`JWT manquant: ${scope}`);
    }

    // 🔥 1. UPLOAD IMAGE
    console.time("pinata_image");
    const formData = new FormData();
    formData.append(
      "file",
      Buffer.from(fileBase64, "base64"),
      scope === "oeuvres" ? "artwork.png" : "badge.gif"
    );

    const imageRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
          ...formData.getHeaders(),
        },
        timeout: 60000
      }
    );
    console.timeEnd("pinata_image");

    const imageCid = imageRes.data.IpfsHash;

    // 🔥 2. METADATA FLEXIBLE PAR SCOPE
    let cleanMetadata: any;

    if (scope === "badges") {
      // ✅ BADGES : BASE + TOUT CE QUI VIENT DE PREPAREEVOLUTION
      cleanMetadata = {
        name: metadata.name || "Badge Rescoe",
        description: `Badge ${metadata.role || "Membre"}. ${metadata.bio || "Aucune bio."}`,
        image: `ipfs://${imageCid}`,
        bio: metadata.bio || "",
        role: metadata.role || "Membre",
        level: metadata.level,
        tags: ["Adhesion", metadata.role || "Membre"],
        family: metadata.family,
        sprite_name: metadata.sprite_name,
        color_profile: metadata.color_profile,
        previousImage: metadata.previousImage,
        evolutionHistory: Array.isArray(metadata.evolutionHistory) ? metadata.evolutionHistory : [],
        attributes: Array.isArray(metadata.attributes)
          ? metadata.attributes.filter((attr: any) => attr?.trait_type && attr.value !== undefined)
          : [],
        // 🔥 TOUT LE RESTE (lore, full_path, dominant_color, etc.)
        ...metadata
      };

      // Nettoyage (supprime les undefined/null)
      Object.keys(cleanMetadata).forEach(key => {
        if (cleanMetadata[key] === null || cleanMetadata[key] === undefined || cleanMetadata[key] === "") {
          delete cleanMetadata[key];
        }
      });

    } else {
      // OEUVRES (inchangé)
      cleanMetadata = {
        name: metadata.name || "Untitled",
        description: metadata.description || "",
        image: `ipfs://${imageCid}`,
        artist: metadata.artist || "",
        tags: Array.isArray(metadata.tags) ? metadata.tags : ["Oeuvre"],
        collectionType: metadata.collectionType || "solo",
        maxEditions: metadata.maxEditions || 1,
        attributes: Array.isArray(metadata.attributes)
          ? metadata.attributes.filter((attr: any) => attr?.trait_type && attr.value !== undefined)
          : [],
        ...metadata.custom_data
      };
    }

    console.log(`📄 [${scope.toUpperCase()}] Keys finales:`, Object.keys(cleanMetadata));

    // 🔥 3. UPLOAD METADATA
    console.time("pinata_metadata");
    const metadataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      cleanMetadata,
      {
        headers: { Authorization: `Bearer ${pinataJwt}` },
        timeout: 30000
      }
    );
    console.timeEnd("pinata_metadata");

    return res.status(200).json({
      image: `ipfs://${imageCid}`,
      metadata: `ipfs://${metadataRes.data.IpfsHash}`,
      imageHash: imageCid,
      metadataHash: metadataRes.data.IpfsHash
    });

  } catch (err: any) {
    console.error("🚨 API ERROR:", {
      scope: req.body.scope,
      message: err.message,
      status: err.response?.status,
      data: err.response?.data
    });
    return res.status(500).json({
      error: err.message || "Upload failed"
    });
  }
}
