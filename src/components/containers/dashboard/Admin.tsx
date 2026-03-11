// components/AdminPage.js
import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
//import getRandomInsectGif from '@/utils/GenInsect25';
import ABI from '@/components/ABI/ABIAdhesion.json';
import ABICollection from '@/components/ABI/ABI_Collections.json';
import ABIManagementAdhesion from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';

// Ajoutez ces imports en haut
import genInsect25 from '@/utils/GenInsect25'; // ✅ Nouveau générateur

import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

import { usePinataUpload, type OpenSeaAttribute } from '@/hooks/usePinataUpload'; // ✅ Hook Pinata

import { resolveIPFS } from '@/utils/resolveIPFS';  // Ajuste le chemin

// Dans le composant, ajoutez le hook après les useState existants :

import { useAuth } from '@/utils/authContext';

import axios from 'axios';
import {
    Box,
    Button,
    Heading,
    Text,
    Image,
    Center,
    Input,
    VStack,
    HStack,
    Select,
    Divider,
    FormControl,
    FormLabel,
    Textarea,
    NumberInput,
    NumberInputField,
    SimpleGrid
} from '@chakra-ui/react';
import detectEthereumProvider from '@metamask/detect-provider';
import ManageContracts from './ManageSolidity/MasterFactoryManagement'

type FamilyKey = keyof typeof colorProfilesJson.families;

type Collection =  {
  id: string;
  name: string;
  imageUrl: string;
  mintcontractAdhesion: string;
  isFeatured: boolean;
  creator: string;        // Ajouté
  collectionType: string; // Ajouté
}

interface Detail {
    uri: string;
    role: string;
    name?: string;
    bio?: string;
}

interface Adhesion {
    address: string;
    role: string;
    name: string;
    bio: string;
    imageIpfsUrl?: string;
    metadataUri?: string;
}

type ColorProfile = {
  image_path: string;
  filename: string;
  visual_signature: string;

  dominant_colors: {
    hex: string[];
    rgb?: number[][];
  };

  hsv: {
    mean: number[];
  };

  metrics: {
    colorfulness: number;
    contrast: number;
  };

  frame_count: number;
  total_pixels_analyzed: number;

  brightness?: number;
  contrast?: number;
};

interface PinataResult {
  image: string;        // "ipfs://QmIMAGE"
  metadataUri: string;   // "ipfs://QmMETADATA" ← À utiliser
  imageHash: string;
  metadataHash: string;
}

type ColorProfilesJson = {
  families: Record<string, ColorProfile[]>;
};


const AdminPage: React.FC = () => {
    const { address: authAddress } = useAuth();
    const [account, setAccount] = useState<string>('');
    const [recipients, setRecipients] = useState<string>('');
    const [details, setDetails] = useState<Array<{ uri: string; role: string; name?: string; bio?: string }>>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
    const [nftId, setNftId] = useState<number>(0);
    const [salePrice, setSalePrice] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<string>('Roles');
    const [name, setName] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [activeSettingsTab, setActiveSettingsTab] = useState<string>('MintPrice');

    const[prixPoints, setprixPoints] = useState<string>('');
    const [mintPrice, setMintPrice] = useState<number>(0);

    const [searchId, setSearchId] = useState<string>('');
    const [searchedCollection, setSearchedCollection] = useState<any | null>(null);

    const [activeNFTTab, setActiveNFTTab] = useState<string>('ManageFeatured');

    const typedColorProfilesJson = colorProfilesJson as ColorProfilesJson;

    const [newPointPrice, setNewPointPrice] = useState<number>(0);
    const [numberOfAdhesions, setNumberOfAdhesions] = useState<number>(1); // Nombre par défaut
    const [adhesionData, setAdhesionData] = useState<{
        address: string;
        role: string;
        name: string;
        bio: string;
        imageIpfsUrl?: string;
        metadataUri?: string;
    }[]>([{ address: '', role: '', name: '', bio: 'Biographie (modifiable)' }]);

    const { uploadToIPFS, isUploading: pinataUploading, error: pinataError } = usePinataUpload();


    const [featuredCollections, setFeaturedCollections] = useState<number[]>([]);
    const [collectionId, setCollectionId] = useState<string>('');



    const roleMapping: Record<string, number> = {
        Artist: 0,
        Poet: 1,
        Contributor: 2,
        Trainee: 3,
    };

    const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
    const contratRescollection = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
    const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;




    // Assure-toi que Web3 est bien importé et disponible

    useEffect(() => {
        const initWeb3 = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);

                // Récupérer les comptes après avoir initialisé Web3
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0] || ''); // Si aucun compte n'est trouvé, le compte est vide
                fetchPointPrice();
                // Optionnel: récupérer d'autres informations comme le prix de mint
            } else {
                alert('Veuillez installer MetaMask!');
            }
        };

        initWeb3();
    }, []); // Cette dépendance vide assure que ce code ne s'exécute qu'une seule fois au montage du composant

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
    };

//########################################################################### Systeme de generation des badge d'adheion (images insectes) et upload IPFS
const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = parseInt(e.target.value);
    if (!isNaN(count) && count >= 1 && count <= 100) { // ✅ Max 100
        setNumberOfAdhesions(count);
        setAdhesionData(Array.from({ length: count }, (_, index) => ({
            address: '',
            role: '',
            name: `Membre ${index + 1}`,
            bio: index === 0 ? 'Biographie (modifiable)' : '',
            imageIpfsUrl: '',
            metadataUri: ''
        })));
    } else {
        setNumberOfAdhesions(1);
        setAdhesionData([{
            address: '',
            role: '',
            name: '',
            bio: 'Biographie (modifiable)',
            imageIpfsUrl: '',
            metadataUri: ''
        }]);
    }
};


const handleAdhesionChange = (index: number, field: 'address' | 'role' | 'name' | 'bio', value: string) => {
  const updatedData = [...adhesionData];
  updatedData[index][field] = value;
  setAdhesionData(updatedData);
};


const handleConfirmRole = async (): Promise<void> => {
  if (adhesionData.length === 0) {
    alert('Aucune adhésion à traiter.');
    return;
  }
  if (pinataError) {
    alert(`Erreur Pinata: ${pinataError}`);
    return;
  }
  setIsUploading(true);

  try {
    // 1. GÉNÉRER insectes LVL0 pour CHAQUE adhésion
    const generatedInsects = await Promise.all(adhesionData.map(async (adhesion, index) => {
      const insectData = await genInsect25(0);  // LVL 0
      const previewUrl = resolveIPFS(insectData.imageUrl, true);
     //console.log(`Insecte ${index}:`, insectData.spriteName, previewUrl);
      return { imageUrl: previewUrl, data: insectData };
    }));

    // 2. UPLOAD avec 35+ ATTRIBUTS ALIGNÉS V1 pour CHAQUE adhésion
    const metadataUris = await Promise.all(adhesionData.map(async (adhesion, index) => {
      const { imageUrl, data: insectData } = generatedInsects[index];

      // 🔥 PROFIL COULEUR EXACT (aligné V1)
      const spriteFilename = insectData.spriteName;
      const familyKey = (insectData.folder) as FamilyKey;  // Comme V1

      const profiles = colorProfilesJson.families[familyKey];  // Même source que V1

      const colorProfile = profiles?.find(p => p.filename === spriteFilename) ?? profiles?.[0];

      // ✅ ATTRIBUTS MORPHO + MÉTAS (aligné V1)
      const insectAttributes = [
        ...insectData.attributes,  // 15 morpho
        { trait_type: "Famille", value: familyKey },
        { trait_type: "1er Propriétaire", value: adhesion.name || "Membre" },  // Aligné V1
        { trait_type: "Insect name", value: insectData.display_name },  // Aligné V1
        { trait_type: "Lore", value: insectData.lore },
        { trait_type: "TotalFamille", value: insectData.total_in_family },
        { trait_type: "Sprite", value: spriteFilename }
      ];

      // 🔥 COULEURS COMPLÈTES V1 (20+)
      const colorAttributes = colorProfile ? [
        // Couleurs dominantes (Top 5)
        { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
        { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
        { trait_type: "Couleur3", value: colorProfile.dominant_colors.hex[2] },
        { trait_type: "Couleur4", value: colorProfile.dominant_colors.hex[3] },
        { trait_type: "Couleur5", value: colorProfile.dominant_colors.hex[4] },
        // HSV complet
        { trait_type: "Teinte", value: Math.round(colorProfile.hsv.mean[0]) + "°" },
        { trait_type: "Saturation", value: Math.round(colorProfile.hsv.mean[1] * 100) + "%" },
        { trait_type: "Luminosité", value: Math.round(colorProfile.hsv.mean[2] * 100) + "%" },
        // Métriques techniques
        { trait_type: "Colorful", value: Math.round(colorProfile.metrics.colorfulness * 100) + "%" },
        { trait_type: "Contraste", value: Math.round(colorProfile.metrics.contrast) },
        { trait_type: "Nettete", value: Math.round(colorProfile.metrics.sharpness) },
        { trait_type: "Entropie", value: Math.round(colorProfile.metrics.entropy * 10) / 10 },
        // Tech GIF
        { trait_type: "Frames", value: colorProfile.frame_count },
        { trait_type: "Pixels", value: colorProfile.total_pixels_analyzed.toLocaleString() },
        { trait_type: "TailleBytes", value: (colorProfile.gif_info.size_bytes / 1000).toFixed(1) + "KB" }
      ] : [];

      // 🔥 FULL ATTRIBUTS (aligné V1 + admin)
      const fullAttributes = [
        ...insectAttributes.filter(attr => !["Niveau", "Level"].includes(attr.trait_type)),  // Robuste
        { trait_type: "Niveau", value: 0 },
        ...colorAttributes,  // 🔥 20+ couleur
      ];

      // 🔥 UPLOAD (même params que V1)
      const result = await uploadToIPFS({
        scope: "badges",
        imageUrl,
        name: adhesion.name || `Membre ${index + 1}`,
        bio: adhesion.bio || "",
        role: adhesion.role,
        level: 0,
        attributes: fullAttributes,  // 35+ alignés !
        family: familyKey,
        sprite_name: spriteFilename,
        previousImage: null,
        evolutionHistory: [],
        color_profile: colorProfile
      });

      return result.metadataUri;
    }));

    // 3. MAJ ÉTAT (comme avant)
    setAdhesionData(prev => prev.map((adhesion, index) => ({
      ...adhesion,
      imageIpfsUrl: generatedInsects[index].imageUrl,
      metadataUri: metadataUris[index],
      insectData: generatedInsects[index].data
    })));

   //console.log(adhesionData);
    if (generatedInsects[0]?.imageUrl) setGeneratedImageUrl(generatedInsects[0].imageUrl);

    alert(`✅ ${adhesionData.length} NFTs READY !\n35+ attributs (alignés single mint)`);

  } catch (error: any) {
    console.error('❌ Admin échoué:', error);
    alert(`❌ Échec: ${error.message || 'Erreur inconnue'}`);
  } finally {
    setIsUploading(false);
  }
};




// Nouvelle fonction pour générer des images par adhésion
// ✅ NOUVEAU : Utilise GenInsect25 (LVL 0 uniquement)
const generateImageForAdhesion = async (adhesion: Adhesion): Promise<string> => {
    try {
        // Génère un insecte LVL0 unique avec GenInsect25
        const insectData = await genInsect25(0); // level 0 obligatoire
        //console.log('🪲 Insect généré:', insectData);

        // Retourne directement l'URL publique de l'insecte
        return insectData.imageUrl;
    } catch (error) {
        console.error('❌ Erreur génération insecte:', error);
        throw new Error(`Génération insecte échouée: ${error}`);
    }
};




const handleMintMultiple = async (): Promise<void> => {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum as any);
        const contract = new web3.eth.Contract(ABI, contractAdhesion);

        // Récupérer les détails au moment de l'appel de mint
        const details = adhesionData.map(adhesion => ({
            address: adhesion.address.trim(),
            role: roleMapping[adhesion.role],
            name: adhesion.name || "",
            bio: adhesion.bio || "",
        }));

        try {
            const accounts: string[] = await web3.eth.getAccounts();

            // Préparer les tableaux pour le contrat
            const recipientsArray: string[] = details.map(adhesion => adhesion.address);
            const rolesArray: number[] = details.map(adhesion => adhesion.role);
            const nameArray: string[] = details.map(adhesion => adhesion.name);
            const bioArray: string[] = details.map(adhesion => adhesion.bio);

            // Créer un tableau d'URIs basé sur ce qui a été préalablement généré
            // ATTENTION: Utiliser les URIs déjà générées par handleConfirmRole
            const urisArray: string[] = adhesionData
              .map(adhesion => adhesion.metadataUri)
              .filter((uri): uri is string => typeof uri === "string");

            // Vérifications conformes au contrat Solidity
            const length = recipientsArray.length;

            if (length === 0) {
                alert('Aucune adhésion à mint.');
                return;
            }

            if (length > 100) {
                alert('Maximum 100 adhésions par batch.');
                return;
            }

            if (recipientsArray.length !== rolesArray.length ||
                recipientsArray.length !== urisArray.length ||
                recipientsArray.length !== nameArray.length ||
                recipientsArray.length !== bioArray.length) {
                alert('Les tableaux ont des longueurs différentes.');
                return;
            }

            // Vérifier les adresses valides et rôles valides (0-3)
            for (let i = 0; i < length; i++) {
                if (!web3.utils.isAddress(recipientsArray[i])) {
                    alert(`Adresse invalide à l'index ${i}: ${recipientsArray[i]}`);
                    return;
                }
                if (rolesArray[i] > 3) {
                    alert(`Rôle invalide à l'index ${i}: ${rolesArray[i]} (max 3)`);
                    return;
                }
            }

            /*console.log('Minting params:', {
                recipients: recipientsArray.length,
                uris: urisArray.length,
                roles: rolesArray,
                names: nameArray.length,
                bios: bioArray.length
            });
*/
            // Appel du contrat avec les paramètres exacts

            // Estimate gas (simulation sans exécution complète)
            const gasEstimate = await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray)
            .estimateGas({ from: accounts[0] });

            const gasPrice = await web3.eth.getGasPrice();

           //console.log("gasEstimate");

            const tx = await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray)
            .send({
                  from: accounts[0],
                  gas: Math.floor(Number(gasEstimate) * 1).toString(),
                  gasPrice: gasPrice.toString()
                });

/*
                const tx = await contract.methods
                    .mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray)
                    .send({ from: accounts[0] });
*/
            //console.log('Transaction hash:', tx.transactionHash);
            alert(`✅ ${length} NFTs mintés avec succès!\nTX: ${tx.transactionHash}`);

            // Optionnel: reset après succès
            // setAdhesionData([]);
            // setNumberOfAdhesions(0);

        } catch (error: any) {
            console.error("Minting failed:", error);
            const errorMsg = error.message || error.reason || 'Erreur inconnue';
            alert(`❌ Mint échoué: ${errorMsg}`);
        }
    } else {
        alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
    }
};



//############################################################# => Gestion du prix des adhesion et des points de récompense
const setPointPrice = async (newPrice: number) => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);
        try {

          const priceInWei = web3.utils.toWei(newPrice.toString(), 'ether'); // Convertir le prix en wei
          await contract.methods.setPointPrice(priceInWei).send({ from: account });
            // Appel de la fonction Solidity pour modifier le prix des points
            alert('Prix des points mis à jour avec succès !');
        } catch (error) {
            console.error("Erreur lors de la mise à jour du prix des points:", error);
            alert("La mise à jour a échoué !");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const fetchPointPrice = async () => {
  if (window.ethereum && web3 && account) {
    const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);

    try {
      const actualPointPrice = await contract.methods.pointPrice().call() as string; // ✅ cast en string
      //////console.log("Prix en wei:", actualPointPrice);

      const priceInEth = web3.utils.fromWei(actualPointPrice, "ether");
      //////console.log("Prix en ETH:", priceInEth);

      setprixPoints(priceInEth);

    } catch (err) {
      alert("Erreur lors de la recuperation du prix des points ");

    }
  }
};


const fetchFeaturedCollections = async (web3Instance: Web3, userAccount: string) => {
  if (web3) {
    try {
      const contract = new web3.eth.Contract(ABICollection, contratRescollection);
      const total = await contract.methods.getTotalCollectionsMinted().call() as string;


        const featured: number[] = [];

        for (let i = 0; i < parseInt(total); i++) {
          const collection = await contract.methods.collections(i).call() as Collection;
            if (collection && collection.isFeatured) {
              fetchCollectionById(collection.id);
              featured.push(parseInt(collection.id, 10));
            }
        }

        setFeaturedCollections(featured);
    } catch (err) {
        console.error('Erreur lors du chargement des collections en vedette :', err);
    }
  }
};



useEffect(() => {

  const fetchFeaturedCollections = async () => {
    if (window.ethereum && web3) {
      try {
        const contract = new web3.eth.Contract(ABICollection, contratRescollection);
        const total = await contract.methods.getTotalCollectionsMinted().call() as string;


          const featured: number[] = [];

          for (let i = 0; i < parseInt(total); i++) {
            const collection = await contract.methods.collections(i).call() as Collection;
              if (collection && collection.isFeatured) {
                fetchCollectionById(collection.id);
                featured.push(parseInt(collection.id, 10));
              }
          }

          setFeaturedCollections(featured);
      } catch (error) {
        console.error('Erreur lors du chargement des collections mises en avant :', error);
      }
    }
  };

  fetchFeaturedCollections();
}, [web3]);


const fetchCollectionById = async (id: string) => {
  if (!web3) return null;
  try {
    const contract = new web3.eth.Contract(ABICollection, contratRescollection);
    const collection = await contract.methods.getCollection(id).call() as Collection;
    const type = collection.collectionType;
    const uri = await contract.methods.getCollectionURI(id).call() as string;

    // ✅ CORRIGÉ : utilise ton proxy API
    const normalizedUri = resolveIPFS(uri, true);
    if (!normalizedUri) throw new Error('URI IPFS invalide');

    const res = await fetch(normalizedUri);
    if (!res.ok) throw new Error(`Fetch échoué: ${res.status}`);
    const metadata = await res.json();

    // ✅ Image via proxy aussi
    const image = resolveIPFS(metadata.image, true) || '';

    return {
      id,
      uri: normalizedUri,
      image,
      name: metadata.name,
      description: metadata.description || '',
      tags: metadata.tags || [],
      type,
    };
  } catch (error) {
    console.error(`Erreur collection ${id}:`, error);
    return null;
  }
};



const handleSearch = async () => {
  const id = parseInt(searchId);
  if (isNaN(id)) return alert("ID invalide");

  const result = await fetchCollectionById(id.toString());
  if (result) {
    setSearchedCollection(result);
  } else {
    alert("Collection non trouvée.");
    setSearchedCollection(null);
  }
};


const handleSetMintPrice = async (): Promise<void> => {
  const sender = account || authAddress;

    if (window.ethereum && web3 && sender) {
        const contract = new web3.eth.Contract(ABI, contractAdhesion);
        try {
            const priceInWei = web3.utils.toWei(mintPrice.toString(), 'ether'); // Convertir le prix en wei
            await contract.methods.setMintPrice(priceInWei).send({ from: sender });
            alert('Prix de mint mis à jour avec succès!');
        } catch (error) {
            console.error("Erreur lors de la mise à jour du prix:", error);
            alert("La mise à jour a échoué!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

//############################################################# => Gestion de la durée des adhesions
// État des durées (par niveau)
const [levelDurations, setLevelDurations] = useState<{
  days: number;
  hours: number;
  minutes: number;
}[]>([
  { days: 30, hours: 0, minutes: 0 },  // LVL0
  { days: 60, hours: 0, minutes: 0 },  // LVL1
  { days: 90, hours: 0, minutes: 0 },  // LVL2
  { days: 185, hours: 0, minutes: 0 }  // LVL3
]);

const [durationSeconds, setDurationSeconds] = useState<bigint[]>([0n, 0n, 0n, 0n]);
const [isUpdatingDurations, setIsUpdatingDurations] = useState(false);

// Mise à jour d'un niveau
const updateDuration = useCallback((index: number, newDuration: any) => {
  setLevelDurations(prev => {
    const newLevels = [...prev];
    newLevels[index] = newDuration;
    return newLevels;
  });
}, []);

// Calcul secondes en live
useEffect(() => {
  const seconds = levelDurations.map(({ days, hours, minutes }) => {
    const totalSec = BigInt(days * 86400 + hours * 3600 + minutes * 60);
    return totalSec;
  });
  setDurationSeconds(seconds);
}, [levelDurations]);

// Vérif si au moins une durée valide
const hasValidDurations = (): boolean => {
  return durationSeconds.some(sec => sec > 0n);
};

// Formatage affichage
const formatDuration = (seconds: bigint): string => {
  const days = Number(seconds / 86400n);
  const hours = Number((seconds % 86400n) / 3600n);
  const minutes = Number((seconds % 3600n) / 60n);
  return `${days}d ${hours}h ${minutes}m`;
};



const handleSetLevelDurations = async (durations: bigint[]): Promise<void> => {
  if (window.ethereum && web3 && account) {
    const contract = new web3.eth.Contract(ABI, contractAdhesion);

    try {
      // Conversion bigint → string array pour web3 (uint256[])
      const durationsStr = durations.map(bn => bn.toString());


      const gasEstimate = await contract.methods.setLevelDurations(durationsStr)
      .estimateGas({ from: account});

      const gasPrice = await web3.eth.getGasPrice();

     //console.log("gasEstimate");

      const tx = await contract.methods.setLevelDurations(durationsStr)
      .send({
            from: account,
            gas: Math.floor(Number(gasEstimate) * 1).toString(),
            gasPrice: gasPrice.toString()
          });



      alert('✅ Durées des niveaux mises à jour !');
    } catch (error: any) {
      console.error('Erreur setLevelDurations:', error);

      // Messages d'erreur plus précis
      if (error.message.includes('onlyOwner')) {
        alert('❌ Seulement le owner peut modifier !');
      } else if (error.message.includes('Must provide 4 durations')) {
        alert('❌ Exactement 4 durées requises !');
      } else {
        alert(`❌ Échec : ${error.message}`);
      }
    }
  } else {
    alert('⚠️ Connectez-vous d\'abord avec MetaMask');
  }
};


const handleUpdateDurations = async () => {
  setIsUpdatingDurations(true);

  // Filtre les 0 et vérifie 4 durées
  const validDurations = durationSeconds.filter(sec => sec > 0n);
  if (validDurations.length !== 4) {
    alert('❌ Remplissez exactement 4 durées (laissez 0 si pas utilisé)');
    setIsUpdatingDurations(false);
    return;
  }

  // Appel direct avec bigint[]
  await handleSetLevelDurations(durationSeconds);

  setIsUpdatingDurations(false);
  alert('✅ Durées appliquées avec succès !');
};



//############################################################# => Gestion du retrait de l'argent des adhesions
const handleWithdrawAdhesion = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABI, contractAdhesion);

        try {
            await contract.methods.withdraw().send({ from: account });

            alert('Retrait réussi!');
        } catch (error) {
            console.error("Erreur lors du retrait:", error);
            alert("Retrait échoué!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const handleWithdrawPoints = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);

        try {
            await contract.methods.withdraw().send({ from: account });

            alert('Retrait réussi!');
        } catch (error) {
            console.error("Erreur lors du retrait:", error);
            alert("Retrait échoué!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const handlePutNFTForSale = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABI, contractAdhesion);
        try {
            const salePriceInWei = web3.utils.toWei(salePrice.toString(), 'ether'); // Convertir le prix en wei
            await contract.methods.putNFTForSale(nftId, salePriceInWei).send({ from: account });
            alert('NFT mis en vente avec succès!');
        } catch (error) {
            console.error("Erreur lors de la mise en vente du NFT:", error);
            alert("Echec de la mise en vente!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const handleBurnNFT = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABI, contractAdhesion);
        try {
            await contract.methods.burnNFT(nftId).send({ from: account });
            alert('NFT brûlé avec succès!');
        } catch (error) {
            console.error("Erreur lors de la combustion du NFT:", error);
            alert("Echec de la combustion du NFT!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const ManageFeaturedCollections = () => {
    const [collectionId, setCollectionId] = useState<string>('');


    const handleFeature = async (isFeatured: boolean) => {
        if (!collectionId) return alert('Veuillez renseigner un ID de collection.');
        if (web3 && account) {
            try {
                const contract = new web3.eth.Contract(ABICollection as any, contratRescollection);

                // Estimate gas (simulation sans exécution complète)
                const gasEstimate = await contract.methods.featureCollection(
                  parseInt(collectionId),
                   isFeatured
                 ).estimateGas({ from: account });

                const gasPrice = await web3.eth.getGasPrice();


                await contract.methods.featureCollection(
                  parseInt(collectionId),
                   isFeatured
                 ).send({
                    from: account,
                    gas: Math.floor(Number(gasEstimate) * 1).toString(),
                    gasPrice: gasPrice.toString()
                  });

                alert(`La collection ${collectionId} a été ${isFeatured ? 'mise en avant' : 'retirée des mises en avant'}.`);
                setCollectionId('');
                await fetchFeaturedCollections(web3, account); // Refresh after update
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la mise en avant :', error);
                alert('Erreur lors de la mise à jour de la collection.');
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    return (
      <VStack spacing={8} align="stretch" maxW="800px" mx="auto" py={6}>
        {/* Formulaire de recherche */}
        <Box>
          <Heading size="md" mb={4}>
            Rechercher une collection par ID
          </Heading>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
          >
            <HStack>
              <Input
                autoFocus
                placeholder="ID de la collection"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <Button type="submit" colorScheme="blue">
                Rechercher
              </Button>
            </HStack>
          </form>
        </Box>

        {/* Résultat de la recherche */}
        {searchedCollection && (
          <Box
            borderWidth="1px"
            borderRadius="lg"
            p={4}
            boxShadow="sm"
            bg="black.500"
          >
            <HStack align="start" spacing={6}>
              {/* Texte */}
              <Box flex="1">
                <Text><strong>Type :</strong> {searchedCollection.type}</Text>
                {searchedCollection.name && (
                  <Text><strong>Nom :</strong> {searchedCollection.name}</Text>
                )}
                <Text>
                  <strong>Featured :</strong>{' '}
                  {searchedCollection.isFeatured ? '✅ Oui' : '❌ Non'}
                </Text>
                <Button
                  mt={3}
                  size="sm"
                  colorScheme="teal"
                  onClick={() => setCollectionId(searchedCollection.id.toString())}
                >
                  Utiliser cet ID
                </Button>
              </Box>

              {/* Image */}
              {searchedCollection.image && (
                <Box>
                  <img
                    src={searchedCollection.image}
                    alt="Poème"
                    style={{
                      width: '160px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                    }}
                  />
                </Box>
              )}
            </HStack>
          </Box>
        )}

        <Divider />

        {/* Collections mises en avant */}
        <Box>
          <Heading size="md" mb={2}>Collections mises en avant</Heading>
          {featuredCollections.length === 0 ? (
            <Text>Aucune collection n’est mise en avant pour le moment.</Text>
          ) : (
            <Box as="ul" pl={4}>
            {featuredCollections.map((id) => (
              <Text key={id}>Collection {id}</Text>
            ))}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Mise en avant */}
        <Box>
          <Heading size="md" mb={2}>Mettre une collection en avant</Heading>
          <VStack align="stretch" spacing={3}>
            <Input
              placeholder="ID de la collection"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            />
            <HStack>
              <Button colorScheme="green" onClick={() => handleFeature(true)}>
                Mettre en avant
              </Button>
              <Button colorScheme="red" onClick={() => handleFeature(false)}>
                Retirer
              </Button>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    );
};


    const ManageRoles = () => (
      <VStack>
      <Heading size="md">Générer des adhésions</Heading>

      <FormControl mt={4}>
          <FormLabel>Nombre d'adhésions (max 100):</FormLabel>
          <Input
              type="number"
              value={numberOfAdhesions}
              onChange={handleNumberChange}
              min={1}
              max={100}
          />
      </FormControl>

      {adhesionData.map((adhesion, index) => (
          <VStack key={index} spacing={2} p={4} borderWidth={1} borderRadius="md" w="full">
              <Text fontWeight="bold">Adhésion #{index + 1}</Text>

              <FormControl isInvalid={!web3?.utils.isAddress(adhesion.address)}>
                  <FormLabel>Adresse</FormLabel>
                  <Input
                      value={adhesion.address}
                      onChange={(e) => handleAdhesionChange(index, 'address', e.target.value)}
                      placeholder="0x..."
                  />
              </FormControl>

              <HStack spacing={4}>
              <FormControl>
                  <FormLabel htmlFor={`role-${index}`}>Rôle</FormLabel>
                  <Select
                      id={`role-${index}`}
                      value={adhesion.role}
                      onChange={(e) => handleAdhesionChange(index, 'role', e.target.value)}
                      placeholder="Choisir un rôle"
                  >
                      {Object.keys(roleMapping).map(role => (
                          <option key={role} value={role}>
                              {role}
                          </option>
                      ))}
                  </Select>
              </FormControl>
                  <FormControl w="50%">
                      <FormLabel>URI IPFS</FormLabel>
                      <Input
                          value={adhesion.metadataUri || 'À générer...'}
                          isReadOnly
                          title={adhesion.metadataUri || ''}
                      />
                  </FormControl>
              </HStack>

              <FormControl>
                  <FormLabel>Nom</FormLabel>
                  <Input
                      value={adhesion.name}
                      onChange={(e) => handleAdhesionChange(index, 'name', e.target.value)}
                  />
              </FormControl>

              <FormControl>
                  <FormLabel>Bio</FormLabel>
                  <Textarea
                      value={adhesion.bio}
                      onChange={(e) => handleAdhesionChange(index, 'bio', e.target.value)}
                      placeholder="Biographie..."
                      rows={3}
                  />
              </FormControl>
          </VStack>
      ))}

      {generatedImageUrl && (
          <Center mt={4}>
              <Image src={generatedImageUrl} alt="Insecte" boxSize="150px" borderRadius="md" />
          </Center>
      )}

      <HStack spacing={4} mt={6}>
          <Button
              onClick={handleConfirmRole}
              isLoading={isUploading}
              colorScheme="blue"
          >
              📤 Confirmer & IPFS
          </Button>
          <Button
              onClick={handleMintMultiple}
              isLoading={loading}
              colorScheme="green"
              isDisabled={adhesionData.some(ad => !ad.metadataUri)}
          >
              🪲 Mint Multiple ({adhesionData.length}/100)
          </Button>
          <Button
              onClick={() => { setAdhesionData([]); setNumberOfAdhesions(0); }}
              colorScheme="gray"
              variant="outline"
          >
              🔄 Reset
          </Button>
      </HStack>

      {adhesionData.length > 0 && (
          <Text fontSize="sm" color="gray.500" mt={2}>
              Prêt pour mint: {adhesionData.filter(ad => ad.metadataUri).length}/{adhesionData.length} URIs générées
          </Text>
      )}

      <Divider />

      <Box mt={6} p={6} borderWidth={1} borderRadius="lg" boxShadow="md">
        <Heading size="md" mb={4}>Durées des niveaux</Heading>

        <VStack spacing={6} align="stretch">
          <Text fontSize="sm" color="gray.600">
            Remplissez jours/heure/minutes. Laissez 0 si pas utilisé.
          </Text>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
    {[
      { label: 'Niveau 0', key: 0 },
      { label: 'Niveau 1', key: 1 },
      { label: 'Niveau 2', key: 2 },
      { label: 'Niveau 3', key: 3 }
    ].map(({ label, key }) => {
      const level = levelDurations[key];

      return (
        <FormControl key={`level-${key}`} id={`level-${key}`}>
          <FormLabel fontSize="sm">{label}</FormLabel>
          <HStack spacing={3}>
            {/* JOURS */}
            <NumberInput
              min={0} max={365}
              value={level.days}
              onChange={(v) => updateDuration(key, { ...level, days: Number(v) })}
              w="90px"
              keepWithinRange clampValueOnBlur
            >
              <NumberInputField id={`days-${key}`} />
            </NumberInput>
            <Text fontSize="sm" color="gray.500">j</Text>

            {/* HEURES */}
            <NumberInput
              min={0} max={23}
              value={level.hours}
              onChange={(v) => updateDuration(key, { ...level, hours: Number(v) })}
              w="90px"
              keepWithinRange clampValueOnBlur
            >
              <NumberInputField id={`hours-${key}`} />
            </NumberInput>
            <Text fontSize="sm" color="gray.500">h</Text>

            {/* MINUTES */}
            <NumberInput
              min={0} max={59}
              value={level.minutes}
              onChange={(v) => updateDuration(key, { ...level, minutes: Number(v) })}
              w="90px"
              keepWithinRange clampValueOnBlur
            >
              <NumberInputField id={`min-${key}`} />
            </NumberInput>
            <Text fontSize="sm" color="gray.500">min</Text>
          </HStack>

          {durationSeconds[key] > 0n && (
            <Text fontSize="xs" color="green.600" mt={1}>
              {formatDuration(durationSeconds[key])} ({durationSeconds[key]}s)
            </Text>
          )}
        </FormControl>
      );
    })}
  </SimpleGrid>

          <Button
            colorScheme="green"
            size="lg"
            onClick={handleUpdateDurations}
            isLoading={isUpdatingDurations}
            isDisabled={!hasValidDurations()}
          >
            {isUpdatingDurations ? 'Application...' : 'Appliquer'}
          </Button>
        </VStack>
      </Box>

  </VStack>

    );

    const ManageNFT = () => {

        return (
            <VStack>
                <HStack spacing={4}>

                <Button
                    onClick={() => setActiveNFTTab('ManageFeatured')}
                    variant={activeNFTTab === 'ManageFeatured' ? 'solid' : 'outline'}
                >
                    Collections mises en avant
                </Button>

                    <Button
                        onClick={() => setActiveNFTTab('ManageNFT')}
                        variant={activeNFTTab === 'ManageNFT' ? 'solid' : 'outline'}
                    >
                        Gérer les NFTs
                    </Button>

                </HStack>
                {activeNFTTab === 'ManageNFT' && (
                    <>
                        <Heading size="md">Gérer les NFTs</Heading>
                        <Text>Id du NFT a gérer : </Text>

                        <Input
                            placeholder="ID du NFT à mettre en vente"
                            value={nftId}
                            onChange={(e) => setNftId(Number(e.target.value))}
                            type="number"
                        />
                        <Text>Prix de vente : </Text>

                        <Input
                            placeholder="Prix de vente (ETH)"
                            value={salePrice}
                            onChange={(e) => setSalePrice(Number(e.target.value))}
                            type="number"
                        />
                        <Button onClick={handlePutNFTForSale} colorScheme="green" mb={3}>
                            Mettre NFT en vente
                        </Button>
                        <Button onClick={handleBurnNFT} colorScheme="red" mb={3}>
                            Brûler un NFT
                        </Button>
                    </>
                )}
                {activeNFTTab === 'ManageFeatured' && <ManageFeaturedCollections />}
            </VStack>
        );
    };


    const Settings = () => (

      <VStack>
        <HStack spacing={4}>
          <Button
            onClick={() => setActiveSettingsTab('MintPrice')}
            variant={activeSettingsTab === 'MintPrice' ? 'solid' : 'outline'}
          >
            Changer le prix de l'adhésion
          </Button>
          <Button
            onClick={() => setActiveSettingsTab('PointPrice')}
            variant={activeSettingsTab === 'PointPrice' ? 'solid' : 'outline'}
          >
            Changer le prix des points de récompense
          </Button>

          <Button
            onClick={() => setActiveSettingsTab('Withdraw')}
            variant={activeSettingsTab === 'Withdraw' ? 'solid' : 'outline'}
          >
            Retirer des fonds
          </Button>
        </HStack>


                  <Divider />

                  {activeSettingsTab === 'MintPrice' && (
                      <VStack>
                          <Heading size="md">Changer le prix de mint</Heading>
                          <Text>Saisissez le nouveau prix de mint (ETH):</Text>
                          <Input
                              placeholder="Nouveau prix de mint (ETH)"
                              value={mintPrice}
                              onChange={(e) => setMintPrice(Number(e.target.value))}
                              type="number"
                          />
                          <Button onClick={() => setMintPrice(mintPrice)} colorScheme="blue" mb={3}>
                              Changer le prix de mint
                          </Button>
                      </VStack>
                  )}

                  {activeSettingsTab === 'PointPrice' && (
                      <VStack>
                          <Heading size="md">Changer le prix des points</Heading>
                          <Text mt={4}>prix actuel d'un point: {prixPoints}ETH .</Text>

                          <Text>Saisissez le nouveau prix des points:</Text>
                          <Input
                              placeholder="Nouveau prix des points"
                              value={newPointPrice}
                              onChange={(e) => setNewPointPrice(Number(e.target.value))}
                              type="number"
                          />
                          <Button onClick={() => setPointPrice(newPointPrice)} colorScheme="blue" mb={3}>
                              Changer le prix des points
                          </Button>
                      </VStack>
                  )}


                  {activeSettingsTab === 'Withdraw' && (
                      <VStack>
                          <Heading size="md">Retirer des fonds</Heading>
                          <Text>Appuyez sur le bouton ci-dessous pour retirer les fonds disponibles.</Text>
                          <HStack>
                          <Button onClick={handleWithdrawAdhesion} colorScheme="red" mb={3}>
                              Retirer les fonds d'adhesion
                          </Button>
                          <Button onClick={handleWithdrawPoints} colorScheme="red" mb={3}>
                              Retirer les fonds d'achat de points
                          </Button>
                          </HStack>
                      </VStack>
                  )}
              </VStack>
    );

    return (
        <Box p={6} display="flex" justifyContent="center" alignItems="center">

            <VStack spacing={4}>
            <Heading size="md">Gestion Administrative</Heading>

                <HStack spacing={4} mb={6}>
                    <Button
                        onClick={() => handleTabChange('Roles')}
                        variant={activeTab === 'Roles' ? 'solid' : 'outline'}
                    >
                        Adhérents
                    </Button>
                    <Button
                        onClick={() => handleTabChange('NFT')}
                        variant={activeTab === 'NFT' ? 'solid' : 'outline'}
                    >
                        Collections & Oeuvres
                    </Button>
                    <Button
                        onClick={() => handleTabChange('Settings')}
                        variant={activeTab === 'Settings' ? 'solid' : 'outline'}
                    >
                        Economie
                    </Button>
                    <Button
                        onClick={() => handleTabChange('Contrats')}
                        variant={activeTab === 'Contrats' ? 'solid' : 'outline'}
                    >
                        Contrats
                    </Button>
                </HStack>

                <Divider />

                <Box mt={6}>
                {activeTab === 'Roles' && <ManageRoles />}
                {activeTab === 'NFT' && <ManageNFT />}
                {activeTab === 'Settings' && <Settings />}
                {activeTab === 'Contrats' && <ManageContracts />}

                </Box>
            </VStack>
        </Box>
    );
};

export default AdminPage;
