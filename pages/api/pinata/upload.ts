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

   /*console.log("📥 API reçue:", {
      scope,
      fileSize: fileBase64.length / 1000 / 1000 + "Mo base64"
    });
*/
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
        timeout: 60000 // 60s
      }
    );
    console.timeEnd("pinata_image");

    const imageCid = imageRes.data.IpfsHash;
   //console.log("✅ Image CID:", imageCid);

    // 🔥 2. METADATA PROPRE (fix crash)
    const cleanMetadata = {
      name: metadata.name || "Untitled",
      description: metadata.description || "",
      image: `ipfs://${imageCid}`,
      // ✅ UNIQUEMENT champs Pinata-safe
      ...(metadata.level && { level: metadata.level }),
      ...(metadata.artist && { artist: metadata.artist }),
      ...(Array.isArray(metadata.tags) && metadata.tags.length && { tags: metadata.tags }),
      ...(metadata.maxEditions && { maxEditions: metadata.maxEditions }),
      ...(metadata.collectionType && { collectionType: metadata.collectionType }),
      attributes: Array.isArray(metadata.attributes)
        ? metadata.attributes.filter((attr: { trait_type?: string; value?: string | number | boolean }) =>
            attr.trait_type && attr.value !== undefined
          )
        : []

    };

   //console.log("📄 Metadata envoyée:", cleanMetadata);

    // 🔥 3. UPLOAD METADATA
    console.time("pinata_metadata");
    const metadataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      cleanMetadata, // ✅ Nettoyé
      {
        headers: {
          Authorization: `Bearer ${pinataJwt}`,
        },
        timeout: 30000
      }
    );
    console.timeEnd("pinata_metadata");

   //console.log("✅ Metadata CID:", metadataRes.data.IpfsHash);

    return res.status(200).json({
      image: `ipfs://${imageCid}`,
      metadata: `ipfs://${metadataRes.data.IpfsHash}`,
      imageHash: imageCid,
      metadataHash: metadataRes.data.IpfsHash
    });

  } catch (err: any) {
    console.error("🚨 API ERROR:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      timeout: err.code === 'ECONNABORTED'
    });

    return res.status(500).json({
      error: err.message || "Upload failed",
      details: err.response?.data
    });
  }
}
