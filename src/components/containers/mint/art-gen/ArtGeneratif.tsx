import React, { useState, useEffect } from "react";
import { ChangeEvent } from "react";

import { Box, Button, Input, Text, VStack, Select, Image } from "@chakra-ui/react";
import axios from "axios";
import JSZip from "jszip";
import detectEthereumProvider from "@metamask/detect-provider";
import contractABI from '../../../ABI/ABI_ART.json';  // Assurez-vous que le chemin est correct.
import Web3 from "web3";
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';

const PINATA_GATEWAY = "https://sapphire-central-catfish-736.mypinata.cloud/ipfs/";
const PINATA_API_URL = "https://api.pinata.cloud/pinning";

interface Collection {
  id: bigint;
  name: string;
  type: string;
  owner: string;
  address: string;
}

interface CollectionDetails {
  collectionAddress: string;
  collectionType: string;
}

const GenerativeArtUploader: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;

  const [zipFiles, setZipFiles] = useState<any>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [seed, setSeed] = useState<string>("");
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [editions, setEditions] = useState<number>(1);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null); // Pour stocker l'image blob capturée
  const [metadata, setMetadata] = useState({ artist: "", name: "", description: "", tags: "" });

  useEffect(() => {
    const setupWeb3 = async () => {
      const detectedProvider = (await detectEthereumProvider()) as any;
      if (detectedProvider) {
        setProvider(detectedProvider);
        const web3Instance = new Web3(detectedProvider);
        setWeb3(web3Instance);
        const userAccounts: string[] = await detectedProvider.request({ method: "eth_requestAccounts" });
        setAccounts(userAccounts);
      } else {
        console.error("MetaMask not detected");
      }
    };
    setupWeb3();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const zipFile = event.target.files?.[0];
    if (!zipFile) return;

    const zip = await JSZip.loadAsync(zipFile);
    const files: any = {};
    zip.forEach((relativePath, file) => {
      files[relativePath] = file;
    });
    setZipFiles(files);
    console.log("Contenu du ZIP :", Object.keys(files));
  };


    const fetchCollections = async () => {
      if (!web3) return;
      try {
        setLoading(true);
        const accounts = await web3.eth.getAccounts();
        const userAddress = accounts[0];
        const contract = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
        const result = await contract.methods.getCollectionsByUser(userAddress).call();
        if (Array.isArray(result)) {
          const filteredCollections = result
            .map((collection: any) => ({
              id: collection[0].toString(),
              name: collection[1],
              type: collection[2],
              owner: collection[3],
              address: collection[4],
            }))
            .filter((collection) => collection.type === "Art");
          setCollections(filteredCollections);
          console.log(collections);
        } else {
          console.error('Unexpected result format:');
        }
      } catch (err) {
        console.error("Error fetching collections:");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      if (accounts.length > 0) fetchCollections();
    }, [accounts]);



  const findIndexHtml = async () => {
    if (!zipFiles) return null;

    let basePath = "";
    let fixedHtml = "";

    for (const path in zipFiles) {
      if (path.endsWith("index.html")) {
        const indexFile = zipFiles[path];
        const htmlContent = await indexFile.async("text");

        basePath = path.substring(0, path.lastIndexOf("/") + 1);
        fixedHtml = htmlContent.replace(
            /(src|href)=["'](?!https?:\/\/)([^"']+)["']/g,
            (match: string, attr: string, filePath: string) => {
                const newPath = `${basePath}${filePath}`;
                return `${attr}="${newPath}"`;
            }
        );


        break;
      }
    }

    if (!fixedHtml) {
      console.log("Aucun fichier index.html trouvé.");
      return null;
    }

    const fileBlobs: Record<string, string> = {};
    for (const path in zipFiles) {
      const fileData = await zipFiles[path].async("blob");
      fileBlobs[path] = URL.createObjectURL(fileData);
    }

    fixedHtml = fixedHtml.replace(/(src|href)=["']([^"']+)["']/g, (match, attr, filePath) => {
      if (fileBlobs[filePath]) {
        return `${attr}="${fileBlobs[filePath]}"`;
      }
      return match;
    });

    const htmlBlob = new Blob([fixedHtml], { type: "text/html" });
    return URL.createObjectURL(htmlBlob);
  };

  useEffect(() => {
    const fetchPreviewUrl = async () => {
      const url = await findIndexHtml();
      setPreviewUrl(url);
    };

    if (zipFiles) {
      fetchPreviewUrl();
    }
  }, [zipFiles]);

  const renderPreview = () => {
    if (previewUrl) {
      return (
        <iframe
          id="generativeArtIframe"
          src={previewUrl}
          title="Aperçu Génératif"
          width="250px"
          height="250px"
          style={{ border: 'none' }}
        />
      );
    }
    return <Text>Pas de fichier index.html trouvé dans le ZIP.</Text>;
  };

  const captureCanvas = () => {
    return new Promise<Blob>((resolve, reject) => {
        const iframe = document.getElementById("generativeArtIframe") as HTMLIFrameElement;
        if (!iframe) {
            reject(new Error("Iframe non trouvé"));
            return;
        }

        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDocument) {
            reject(new Error("Impossible d'accéder au document de l'iframe"));
            return;
        }

        const canvas = iframeDocument.getElementById("myCanvas") as HTMLCanvasElement | null;
        if (!canvas) {
            reject(new Error("Canvas non trouvé dans l'iframe"));
            return;
        }

        canvas.toBlob((blob) => {
            if (blob) {
                setImageBlob(blob); // Stocke le blob capturé
                resolve(blob);
            } else {
                reject(new Error("Échec de la capture du canvas"));
            }
        }, "image/png");
    });
};

  const uploadToIPFS = async () => {
    if (!imageBlob) {
      alert("Aucune image capturée à uploader.");
      return;
    }

    setIsUploading(true);
    setUploadMessage("Uploading image to IPFS...");

    const formData = new FormData();
    formData.append("file", imageBlob);

    try {
      const imageResponse = await axios.post<{ IpfsHash: string }>(
        `${PINATA_API_URL}/pinFileToIPFS`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const imageIpfsHash = imageResponse.data.IpfsHash;

      // Construction des métadonnées
      const metadataToUpload = {
        name: metadata.name || "Art", // Assurez-vous d'utiliser les champs de métadonnées
        description: metadata.description || "Description of the art piece",
        image: `${PINATA_GATEWAY}${imageIpfsHash}`, // Lien vers l'image uploadée
        tags: metadata.tags.split(',').map(tag => tag.trim()), // Traitement des tags
      };

      const metadataResponse = await axios.post<{ IpfsHash: string }>(
        `${PINATA_API_URL}/pinJSONToIPFS`,
        metadataToUpload,
        {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
            "Content-Type": "application/json",
          },
        }
      );

      const metadataIpfsHash = metadataResponse.data.IpfsHash;
      setIpfsHash(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
      console.log(ipfsHash);

      console.log("Métadonnées uploadées ! Hash :", metadataIpfsHash);
      alert("Image et métadonnées uploadées avec succès !");
    } catch (error) {
      console.error("Erreur d'upload sur IPFS :", error);
      alert("Échec de l'upload !");
    } finally {
      setIsUploading(false);
    }
    console.log(selectedCollectionId);
  };

  const mintArt = async () => {
  if (!ipfsHash || !selectedCollectionId) {
    alert("Veuillez uploader le projet, fournir une seed et sélectionner une collection.");
    return;
  }

  if (!web3) {
    console.error("Web3 is not initialized.");
    return;
  }

  setUploadMessage("Mint en cours...");
  setIsMinting(true);

  try {
    const accounts = await web3.eth.getAccounts();
    if (!accounts[0]) {
      throw new Error("Aucun compte Ethereum détecté.");
    }

    // 🔹 Définition explicite du type de retour attendu
    type CollectionDetailsType = { collectionAddress?: string } | string[];

    // Récupération des détails de la collection
    const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
    const collectionDetails: CollectionDetailsType = await contractResCollection.methods.getCollection(selectedCollectionId).call();

    console.log("Structure de collectionDetails:", collectionDetails);

    if (!collectionDetails || (Array.isArray(collectionDetails) && collectionDetails.length === 0)) {
      throw new Error("Détails de la collection non trouvés ou format incorrect.");
    }

    let collectionMintAddress: string | null = null;

    if (Array.isArray(collectionDetails)) {
      // Si `collectionDetails` est un tableau, on cherche la première adresse Ethereum valide
      collectionMintAddress = collectionDetails.find((item) => web3.utils.isAddress(item)) || null;
    } else {
      // Si c'est un objet, on vérifie s'il contient bien `collectionAddress`
      collectionMintAddress = collectionDetails.collectionAddress || null;
    }

    if (!collectionMintAddress || !web3.utils.isAddress(collectionMintAddress)) {
      throw new Error(`Adresse de contrat invalide : ${collectionMintAddress}`);
    }

    const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

    // Appel de la fonction de mint
    const mintResult = await mintContract.methods.mint(ipfsHash, editions).send({ from: accounts[0] });

    if (!mintResult.events?.Transfer?.returnValues?.tokenId) {
      throw new Error("Token ID non trouvé dans l'événement de transfert.");
    }

    const tokenId = mintResult.events.Transfer.returnValues.tokenId;

    alert("Félicitations ! Votre œuvre est mintée !");
  } catch (error) {
    console.error("Erreur lors du minting :");
    alert(`Erreur lors du minting`);
  } finally {
    setIsMinting(false);
  }
};



  const handleMetadataChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <VStack spacing={4} p={5}>
      <Input
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        mb={4}
      />
      {renderPreview()}

      <Image src={imageBlob ? URL.createObjectURL(imageBlob) : ''} alt="Captured Preview" mb={3} boxSize="200px" objectFit="cover" />

      <VStack spacing={3} align="stretch">
        <Input placeholder="Artist" name="artist" value={metadata.artist} onChange={handleMetadataChange} />
        <Input placeholder="Name" name="name" value={metadata.name} onChange={handleMetadataChange} />
        <Input placeholder="Description" name="description" value={metadata.description} onChange={handleMetadataChange} />
        <Input placeholder="Tags (comma-separated)" name="tags" value={metadata.tags} onChange={handleMetadataChange} />
      </VStack>

      <Button mt={4} colorScheme="teal" onClick={() => { captureCanvas(); }}>
        Captur
      </Button>
      <Button mt={4} colorScheme="teal" onClick={() => { uploadToIPFS(); }}>
        Upload
      </Button>

      <Select onChange={(e) => setSelectedCollectionId(e.target.value)} placeholder="Sélectionnez une Collection">
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id.toString()}>
            {collection.name}
          </option>
        ))}
      </Select>

      <Input
        type="number"
        placeholder="Nombre d'éditions"
        value={editions}
        onChange={(e) => setEditions(Number(e.target.value))}
        mt={4}
      />

      <Button
        onClick={mintArt}
        colorScheme="green"
        mt={4}
        isDisabled={!ipfsHash || !selectedCollectionId}
      >
        Mint l'art
      </Button>
    </VStack>
  );
};

export default GenerativeArtUploader;
