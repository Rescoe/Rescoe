import React, { useState, useEffect, ChangeEvent } from "react";
import { Box, Button, Input, Text, VStack, Select, Image } from "@chakra-ui/react";
import axios from "axios";
import JSZip from "jszip";
import detectEthereumProvider from "@metamask/detect-provider";
import contractABI from '../../../ABI/ABI_GENERATIVE_ART.json';
import Web3 from "web3";
import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import html2canvas from 'html2canvas';

// Constantes de l'API Pinata
const PINATA_GATEWAY = "https://purple-managerial-ermine-688.mypinata.cloud/ipfs/";
const PINATA_API_URL = "https://api.pinata.cloud/pinning";

interface Collection {
  id: string; // Changement de bigint à string pour correspondre à la façon dont les IDs sont récupérés
  name: string;
  type: string;
  owner: string;
  address: string;
}

interface Metadata {
  artist: string;
  name: string;
  description: string;
  tags: string;
}

interface NFT {
  tokenId: string;
  owner: any; // Vous pourriez typiquement préciser le type ici (par exemple string)
  name: any; // Comme ci-dessus, spécifiez le type réel
  description: any; // Spécifiez le type ici
  price: any; // Spécifiez le type ou utilisez un type numérique
  tags: any; // Envisagez d'utiliser un tableau de chaînes si c'est nécessaire
  mintContractAddress: string;
  tokenURI: any; // Si vous avez un type spécifique pour tokenURI, utilisez-le.
}

interface CollectionDetails {
  collectionAddress: string;
  collectionType: string;
}

const GenerativeArtUploader: React.FC = () => {
  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;

  const [canvasName, setCanvasName] = useState<string>('');
  const [zipFiles, setZipFiles] = useState<Record<string, JSZip.JSZipObject> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [animationUrl, setAnimationUrl] = useState<string>("");

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
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({ artist: "", name: "", description: "", tags: "" });

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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const zip = await JSZip.loadAsync(selectedFile);
    const files: Record<string, JSZip.JSZipObject> = {};
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
        const filteredCollections = result.map((collection: any) => ({
          id: collection[0].toString(),
          name: collection[1],
          type: collection[2],
          owner: collection[3],
          address: collection[4],
        })).filter((collection) => collection.type === "Generative");
        setCollections(filteredCollections);
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

  const findIndexHtml = async (): Promise<string | null> => {
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

  const captureCanvas = () => {
    return new Promise<Blob>((resolve, reject) => {
      const iframe = document.getElementById("generativeArtIframe") as HTMLIFrameElement | null;
      if (!iframe) {
        reject(new Error("Iframe non trouvé"));
        return;
      }

      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) {
        reject(new Error("Impossible d'accéder au document de l'iframe"));
        return;
      }

      const canvas = iframeDocument.getElementById(canvasName) as HTMLCanvasElement | null;
      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            resolve(blob);
          } else {
            reject(new Error("Échec de la capture du canvas"));
          }
        }, "image/png");
      } else {
        console.log(`Canvas "${canvasName}" non trouvé, capture du preview`);
        capturePreview().then(resolve).catch(reject);
      }
    });
  };

  const capturePreview = () => {
    return new Promise<Blob>((resolve, reject) => {
      const iframe = document.getElementById("generativeArtIframe") as HTMLIFrameElement | null;
      if (!iframe) {
        reject(new Error("Iframe non trouvé"));
        return;
      }

      const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDocument) {
        reject(new Error("Impossible d'accéder au document de l'iframe"));
        return;
      }

      html2canvas(iframeDocument.body).then((canvas) => {
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            resolve(blob);
          } else {
            reject(new Error("Échec de la capture du preview"));
          }
        }, "image/png");
      }).catch(reject);
    });
  };

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

  const uploadToIPFS = async () => {
    if (!file) {
      console.error('No ZIP file selected');
      return;
    }

    try {
      const zip = await JSZip.loadAsync(file);
      const files = Object.values(zip.files);
      const cids: string[] = [];

      for (const zipFile of files) {
        if (!zipFile.dir) {
          const fileData = await zipFile.async('blob');
          const formData = new FormData();
          formData.append('file', fileData, zipFile.name);

          try {
            const response = await axios.post<{ IpfsHash: string }>(
              "https://api.pinata.cloud/pinning/pinFileToIPFS",
              formData,
              {
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                  "Content-Type": "multipart/form-data",
                },
              }
            );
            cids.push(response.data.IpfsHash);
          } catch (error) {
            console.error('Error uploading file to IPFS:');
          }
        }
      }

      const CID = cids[0];
      const animationUrl = `https://ipfs.io/ipfs/${CID}/index.html`;
      const ipfsHash = cids.join(',');
      const artData = {
        name: canvasName,
        artist: metadata.artist,
        description: metadata.description,
        tags: metadata.tags.split(','),
        imageUrl: imageBlob ? URL.createObjectURL(imageBlob) : '',
        collectionId: selectedCollectionId,
        editions,
      };

      console.log('Art data:', artData);
      console.log('IPFS URL:', animationUrl);
      console.log('Uploaded CIDs:', ipfsHash);
      setIpfsHash(CID);
    } catch (error) {
      console.error('Error processing ZIP file:');
    }
  };

  const ArtisteInitialize = async () => {
    console.log("CID avant minting:", ipfsHash);
    console.log("selectedCollectionId:", selectedCollectionId);

    if (!ipfsHash || !selectedCollectionId) {
      alert("Veuillez uploader le projet et sélectionner une collection.");
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

      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

      // Typage du résultat pour s'assurer qu'il correspond à notre interface
      const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

      let collectionMintAddress: string | null = null;

      if (Array.isArray(collectionDetails)) {
        collectionMintAddress = collectionDetails.find((item: any) => web3.utils.isAddress(item)) || null;
      } else {
        collectionMintAddress = collectionDetails.collectionAddress || null; // Assurez-vous que collectionDetails a le bon type
      }

      if (!collectionMintAddress || !web3.utils.isAddress(collectionMintAddress)) {
        throw new Error(`Adresse de contrat invalide : ${collectionMintAddress}`);
      }

      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

      const isInitialized = await mintContract.methods.isInitialized().call();
      if (!isInitialized) {
        await mintContract.methods.initialize(ipfsHash, editions).send({ from: accounts[0] });
      }
      console.log("Mint réussi !");
    } catch (error) {
      console.error("Erreur lors du minting :");
      alert(`Erreur lors du minting :`);
    } finally {
      setIsMinting(false);
    }
  };

  const mintIterations = async (editions: number) => { // Typage du paramètre éditions
    if (!ipfsHash || !web3) {
      console.error("IPFS hash inapproprié ou Web3 non initialisé.");
      return;
    }

    try {
      const accounts = await web3.eth.getAccounts();
      if (!accounts[0]) {
        throw new Error("Aucun compte Ethereum détecté.");
      }

      const contractResCollection = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);
      const collectionDetails: CollectionDetails = await contractResCollection.methods.getCollection(selectedCollectionId).call();

      let collectionMintAddress: string | null = null;

      if (Array.isArray(collectionDetails)) {
        collectionMintAddress = collectionDetails.find((item: any) => web3.utils.isAddress(item)) || null;
      } else {
        collectionMintAddress = collectionDetails.collectionAddress || null;
      }

      if (!collectionMintAddress || !web3.utils.isAddress(collectionMintAddress)) {
        throw new Error(`Adresse de contrat invalide : ${collectionMintAddress}`);
      }

      const mintContract = new web3.eth.Contract(contractABI, collectionMintAddress);

      const editionsAsNumber = Number(editions);
      if (isNaN(editionsAsNumber) || editionsAsNumber <= 0) {
        throw new Error("Le nombre d'éditions doit être un nombre positif valide.");
      }

      for (let i = 0; i < editionsAsNumber; i++) {
        console.log(`Minting édition ${i + 1}...`);
        const mintResult = await mintContract.methods
          .mint(ipfsHash) // Vous devriez passer la bonne URL ou l'IPFS ici
          .send({ from: accounts[0] });

        if (!mintResult.events?.NFTMinted?.returnValues?.tokenId) {
          throw new Error("Token ID non trouvé dans l'événement de minting.");
        }

        const tokenId = mintResult.events.NFTMinted.returnValues.tokenId;
        console.log(`Mint réussi pour Token ID: ${tokenId}`);
      }

      alert(`Félicitations ! Vous avez minté ${editionsAsNumber} éditions.`);
    } catch (error) {
      console.error("Erreur lors du minting des itérations :");
      alert(`Erreur lors de l'opération de mint:`);
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

      <Image
        src={imageBlob ? URL.createObjectURL(imageBlob) : ''}
        alt="Captured Preview"
        mb={3}
        boxSize="200px"
        objectFit="cover"
      />

      <Input
        type="text"
        placeholder="Entrez le nom du canvas"
        value={canvasName}
        onChange={(e) => setCanvasName(e.target.value)}
        mb={4}
      />

      <VStack spacing={3} align="stretch">
        <Input placeholder="Artist" name="artist" value={metadata.artist} onChange={handleMetadataChange} />
        <Input placeholder="Name" name="name" value={metadata.name} onChange={handleMetadataChange} />
        <Input placeholder="Description" name="description" value={metadata.description} onChange={handleMetadataChange} />
        <Input placeholder="Tags (comma-separated)" name="tags" value={metadata.tags} onChange={handleMetadataChange} />
      </VStack>

      <Button mt={4} colorScheme="teal" onClick={captureCanvas}>
        Capture
      </Button>

      <Button mt={4} colorScheme="teal" onClick={uploadToIPFS}>
        Upload
      </Button>

      <Select onChange={(e) => setSelectedCollectionId(e.target.value)} placeholder="Sélectionnez une Collection">
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </Select>

      <Input
        type="number"
        placeholder="Nombre d'éditions"
        value={editions}
        onChange={(e) => {
          const value = Number(e.target.value);
          if (!isNaN(value) && value > 0) {
            setEditions(value);
          } else {
            setEditions(1);
          }
        }}
        mt={4}
      />

      <Button
        onClick={ArtisteInitialize}
        colorScheme="green"
        mt={4}
        isDisabled={!ipfsHash || !selectedCollectionId}
      >
        Initialize
      </Button>

      <Button
        onClick={() => mintIterations(editions)}
        colorScheme="green"
        mt={4}
        isDisabled={!ipfsHash || !selectedCollectionId || isMinting}
      >
        Mint l'art
      </Button>
    </VStack>
  );
};

export default GenerativeArtUploader;
