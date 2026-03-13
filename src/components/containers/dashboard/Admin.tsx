// components/AdminPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import ABI from '@/components/ABI/ABIAdhesion.json';
import ABICollection from '@/components/ABI/ABI_Collections.json';
import ABIManagementAdhesion from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import genInsect25 from '@/utils/GenInsect25';
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import { resolveIPFS } from '@/utils/resolveIPFS';
import { useAuth } from '@/utils/authContext';
import {
    Box, Button, Heading, VStack, HStack, Divider
} from '@chakra-ui/react';

import detectEthereumProvider from '@metamask/detect-provider';

import ManageContracts from './ManageSolidity/MasterFactoryManagement';
import ManageRoles from './ManageRoles/ManageRoles';
import ManageNFT from './ManageNFT/ManageNFT';
import Settings from './ManageSettings/Settings';

type FamilyKey = keyof typeof colorProfilesJson.families;

type Collection = {
  id: string;
  name: string;
  imageUrl: string;
  mintcontractAdhesion: string;
  isFeatured: boolean;
  creator: string;
  collectionType: string;
}

interface Adhesion {
    address: string;
    role: string;
    name: string;
    bio: string;
    imageIpfsUrl?: string;
    metadataUri?: string;
}

const AdminPage: React.FC = () => {
    const { address: authAddress } = useAuth();
    const [account, setAccount] = useState<string>('');
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [activeTab, setActiveTab] = useState<string>('Roles');

    // État pour ManageRoles
    const [numberOfAdhesions, setNumberOfAdhesions] = useState<number>(1);
    const [adhesionData, setAdhesionData] = useState<Adhesion[]>([{
        address: '',
        role: '',
        name: '',
        bio: 'Biographie (modifiable)',
        imageIpfsUrl: '',
        metadataUri: ''
    }]);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    // État pour ManageNFT
    const [nftId, setNftId] = useState<number>(0);
    const [salePrice, setSalePrice] = useState<number>(0);
    const [activeNFTTab, setActiveNFTTab] = useState<string>('ManageFeatured');
    const [searchId, setSearchId] = useState<string>('');
    const [searchedCollection, setSearchedCollection] = useState<any | null>(null);
    const [featuredCollections, setFeaturedCollections] = useState<number[]>([]);

    // État pour Settings
    const [mintPrice, setMintPrice] = useState<number>(0);
    const [prixPoints, setprixPoints] = useState<string>('');
    const [newPointPrice, setNewPointPrice] = useState<number>(0);
    const [activeSettingsTab, setActiveSettingsTab] = useState<string>('MintPrice');

    // État pour durées
    const [levelDurations, setLevelDurations] = useState<{
        days: number;
        hours: number;
        minutes: number;
    }[]>([
        { days: 30, hours: 0, minutes: 0 },
        { days: 60, hours: 0, minutes: 0 },
        { days: 90, hours: 0, minutes: 0 },
        { days: 185, hours: 0, minutes: 0 }
    ]);
    const [durationSeconds, setDurationSeconds] = useState<bigint[]>([0n, 0n, 0n, 0n]);
    const [isUpdatingDurations, setIsUpdatingDurations] = useState(false);

    const { uploadToIPFS, isUploading: pinataUploading, error: pinataError } = usePinataUpload();

    const roleMapping: Record<string, number> = {
        Artist: 0,
        Poet: 1,
        Contributor: 2,
        Trainee: 3,
    };

    const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
    const contratRescollection = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT as string;
    const contratAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;

    // ✅ INITIALISATION WEB3
    useEffect(() => {
        const initWeb3 = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0] || '');
                await fetchPointPrice();
            } else {
                alert('Veuillez installer MetaMask!');
            }
        };
        initWeb3();
    }, []);

    // ✅ CALCUL DURÉES EN DIRECT
    useEffect(() => {
        const seconds = levelDurations.map(({ days, hours, minutes }) => {
            const totalSec = BigInt(days * 86400 + hours * 3600 + minutes * 60);
            return totalSec;
        });
        setDurationSeconds(seconds);
    }, [levelDurations]);

    // ✅ FETCH FEATURED COLLECTIONS
    useEffect(() => {
        if (web3) {
            fetchFeaturedCollections();
        }
    }, [web3]);

    // ========== HANDLERS PARTAGÉS ==========

    const fetchPointPrice = async () => {
        if (web3 && account) {
            const contract = new web3.eth.Contract(ABIManagementAdhesion, contratAdhesionManagement);
            try {
                const actualPointPrice = await contract.methods.pointPrice().call() as string;
                const priceInEth = web3.utils.fromWei(actualPointPrice, "ether");
                setprixPoints(priceInEth);
            } catch (err) {
                console.error("Erreur fetch point price", err);
            }
        }
    };

    const fetchFeaturedCollections = async () => {
        if (web3) {
            try {
                const contract = new web3.eth.Contract(ABICollection, contratRescollection);
                const total = await contract.methods.getTotalCollectionsMinted().call() as string;
                const featured: number[] = [];

                for (let i = 0; i < parseInt(total); i++) {
                    const collection = await contract.methods.collections(i).call() as Collection;
                    if (collection && collection.isFeatured) {
                        featured.push(parseInt(collection.id, 10));
                    }
                }
                setFeaturedCollections(featured);
            } catch (err) {
                console.error('Erreur collections en vedette:', err);
            }
        }
    };

    const fetchCollectionById = async (id: string) => {
        if (!web3) return null;
        try {
            const contract = new web3.eth.Contract(ABICollection, contratRescollection);
            const collection = await contract.methods.getCollection(id).call() as Collection;
            const uri = await contract.methods.getCollectionURI(id).call() as string;
            const normalizedUri = resolveIPFS(uri, true);

            if (!normalizedUri) throw new Error('URI IPFS invalide');

            const res = await fetch(normalizedUri);
            if (!res.ok) throw new Error(`Fetch échoué: ${res.status}`);
            const metadata = await res.json();
            const image = resolveIPFS(metadata.image, true) || '';

            return {
                id,
                uri: normalizedUri,
                image,
                name: metadata.name,
                description: metadata.description || '',
                type: collection.collectionType,
                isFeatured: collection.isFeatured,
            };
        } catch (error) {
            console.error(`Erreur collection ${id}:`, error);
            return null;
        }
    };

    // ========== PASSEZ TOUT AUX ENFANTS ==========

    const sharedProps = {
        web3,
        account,
        contractAdhesion,
        contratRescollection,
        contratAdhesionManagement,
        roleMapping,
        uploadToIPFS,
        genInsect25,
        colorProfilesJson,
        resolveIPFS,
    };

    const rolesProps = {
        ...sharedProps,
        numberOfAdhesions,
        setNumberOfAdhesions,
        adhesionData,
        setAdhesionData,
        generatedImageUrl,
        setGeneratedImageUrl,
        isUploading,
        setIsUploading,
        loading,
        setLoading,
        pinataError,
        levelDurations,
        setLevelDurations,
        durationSeconds,
        setDurationSeconds,
        isUpdatingDurations,
        setIsUpdatingDurations,
    };

    const nftProps = {
        ...sharedProps,
        nftId,
        setNftId,
        salePrice,
        setSalePrice,
        activeNFTTab,
        setActiveNFTTab,
        searchId,
        setSearchId,
        searchedCollection,
        setSearchedCollection,
        featuredCollections,
        setFeaturedCollections,
        fetchCollectionById,
        fetchFeaturedCollections,
    };

    const settingsProps = {
        ...sharedProps,
        mintPrice,
        setMintPrice,
        prixPoints,
        setprixPoints,
        newPointPrice,
        setNewPointPrice,
        activeSettingsTab,
        setActiveSettingsTab,
        fetchPointPrice,
    };

    return (
        <Box p={6} display="flex" justifyContent="center" alignItems="center">
            <VStack spacing={4} maxW="1200px" w="full">
                <Heading size="md">Gestion Administrative</Heading>

                <HStack spacing={4} mb={6} flexWrap="wrap">
                    <Button
                        onClick={() => setActiveTab('Roles')}
                        variant={activeTab === 'Roles' ? 'solid' : 'outline'}
                    >
                        Adhérents
                    </Button>
                    <Button
                        onClick={() => setActiveTab('NFT')}
                        variant={activeTab === 'NFT' ? 'solid' : 'outline'}
                    >
                        Collections & Oeuvres
                    </Button>
                    <Button
                        onClick={() => setActiveTab('Settings')}
                        variant={activeTab === 'Settings' ? 'solid' : 'outline'}
                    >
                        Économie
                    </Button>
                    <Button
                        onClick={() => setActiveTab('Contrats')}
                        variant={activeTab === 'Contrats' ? 'solid' : 'outline'}
                    >
                        Contrats
                    </Button>
                </HStack>

                <Divider />

                <Box mt={6} w="full">
                    {activeTab === 'Roles' && <ManageRoles {...rolesProps} />}
                    {activeTab === 'NFT' && <ManageNFT {...nftProps} />}
                    {activeTab === 'Settings' && <Settings {...settingsProps} />}
                    {activeTab === 'Contrats' && <ManageContracts />}
                </Box>
            </VStack>
        </Box>
    );
};

export default AdminPage;
