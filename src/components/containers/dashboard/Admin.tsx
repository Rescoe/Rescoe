// components/AdminPage.js
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import getRandomInsectGif from '../../../utils/GenInsect24';
import ABI from '../../ABI/ABIAdhesion.json';
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
} from '@chakra-ui/react';
import detectEthereumProvider from '@metamask/detect-provider';


interface Detail {
    uri: string;
    role: string;
    name?: string;
    bio?: string;
}


const AdminPage: React.FC = () => {
    const [account, setAccount] = useState<string>('');
    const [recipients, setRecipients] = useState<string>('');
    const [details, setDetails] = useState<Array<{ uri: string; role: string; name?: string; bio?: string }>>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
    const [mintPrice, setMintPrice] = useState<number>(0);
    const [nftId, setNftId] = useState<number>(0);
    const [salePrice, setSalePrice] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<string>('Roles');
    const [name, setName] = useState<string>('');
    const [bio, setBio] = useState<string>('');
    const [web3, setWeb3] = useState<Web3 | null>(null);


    const roleMapping: Record<string, number> = {
        Artist: 0,
        Poet: 1,
        Contributor: 2,
        Trainee: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;


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

                // Optionnel: récupérer d'autres informations comme le prix de mint
            } else {
                alert('Veuillez installer MetaMask!');
            }
        };

        initWeb3();
    }, []); // Cette dépendance vide assure que ce code ne s'exécute qu'une seule fois au montage du composant


        const generateImage = () => {
            loadGifFromFile();
        };

        const loadGifFromFile = async () => {
            const response = await fetch('/gifs/Scarabe.gif');
            const blob = await response.blob();
            const gifURL = URL.createObjectURL(blob);
            setGeneratedImageUrl(gifURL);
        };

        const handleTabChange = (tab: string) => {
            setActiveTab(tab);
        };

        const handleConfirmRole = async () => {
            if (generatedImageUrl) {
                await uploadFileToIPFS(generatedImageUrl);
            } else {
                alert("Veuillez vous assurer que l'image est générée.");
            }
        };

        const uploadFileToIPFS = async (imageUrl: string) => {
            setIsUploading(true);
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const formData = new FormData();
                formData.append('file', blob, 'insect.gif');

                const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                    headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });

                const imageIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
                setIpfsUrl(imageIpfsUrl);

                const metadataJson = {
                    name,
                    bio,
                    description: `Rescoe vous a attribué le rôle suivant : ${selectedRole}`,
                    image: imageIpfsUrl,
                    role: selectedRole,
                    tags: ["Adhesion", "Minted by Rescoe", selectedRole],
                };

                const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
                    headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                        'Content-Type': 'application/json',
                    },
                });

                const metadataIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`;
                setDetails((prevDetails) => [...prevDetails, { uri: metadataIpfsUrl, role: selectedRole, name, bio }]);
            } catch (error) {
                console.error('Error uploading to IPFS:', error);
            } finally {
                setIsUploading(false);
            }
        };


// Vérification si window.ethereum est défini
const handleMintMultiple = async (): Promise<void> => {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum as any);  // Casting de window.ethereum

        const contract = new web3.eth.Contract(ABI, contractAddress);

        try {
            const accounts: string[] = await web3.eth.getAccounts();
            const recipientsArray: string[] = recipients.split(',').map(addr => addr.trim());

            const urisArray: string[] = details.map((detail: Detail) => detail.uri);

            const rolesArray: number[] = details.map((detail: Detail) => {
              const role = roleMapping[detail.role];
              return typeof role === 'number' ? role : parseInt(role, 10);  // On vérifie si c'est déjà un nombre
          });


            const nameArray: string[] = details.map((detail: Detail) => detail.name || "");
            const bioArray: string[] = details.map((detail: Detail) => detail.bio || "");

            if (recipientsArray.length !== rolesArray.length ||
                recipientsArray.length !== urisArray.length ||
                recipientsArray.length !== nameArray.length ||
                recipientsArray.length !== bioArray.length) {
                alert('Le nombre d\'adresses, de rôles, d\'URIs, de noms et de bios doit être le même.');
                return;
            }

            await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray).send({ from: accounts[0] });
            alert('NFTs mintés avec succès !');
        } catch (error) {
            console.error("Minting failed:");
            alert('Minting failed: ');
        }
    } else {
        alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
    }
};




const handleSetMintPrice = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            const priceInWei = web3.utils.toWei(mintPrice.toString(), 'ether'); // Convertir le prix en wei
            await contract.methods.setMintPrice(priceInWei).send({ from: account });
            alert('Prix de mint mis à jour avec succès!');
        } catch (error) {
            console.error("Erreur lors de la mise à jour du prix:", error);
            alert("La mise à jour a échoué!");
        }
    } else {
        alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
    }
};

const handleWithdraw = async (): Promise<void> => {
    if (window.ethereum && web3 && account) {
        const contract = new web3.eth.Contract(ABI, contractAddress);
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
        const contract = new web3.eth.Contract(ABI, contractAddress);
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
        const contract = new web3.eth.Contract(ABI, contractAddress);
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


    const ManageRoles = () => (
        <VStack>
            <Heading size="md">Gérer les Rôles</Heading>
            <Input
                placeholder="Adresse du destinataire (séparez par des virgules)"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
            />
            <Select
                placeholder="Choisissez un rôle"
                onChange={(e) => {
                    const index = parseInt(e.target.value, 10); // Conversion en nombre

                    if (!isNaN(index)) {
                        setSelectedRole(Object.keys(roleMapping)[index]);
                        generateImage();
                    }
                }}
                value={selectedRole}
            >
                {Object.keys(roleMapping).map((role) => (
                    <option key={role} value={roleMapping[role]}>
                        {role}
                    </option>
                ))}
            </Select>
            <Center>
                {generatedImageUrl && <Image src={generatedImageUrl} alt="Generated Insect" boxSize="150px" />}
            </Center>

            {/* Ajout de champs pour le nom et la biographie */}
<FormControl mt={4}>
    <FormLabel htmlFor="name">Nom</FormLabel>
    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Entrez votre nom" />
</FormControl>
<FormControl mt={4}>
    <FormLabel htmlFor="bio">Biographie</FormLabel>
    <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Entrez votre biographie" />
</FormControl>


            <Button onClick={handleConfirmRole} isLoading={isUploading} colorScheme="teal">
                Confirmer le rôle et téléverser sur IPFS
            </Button>
            {ipfsUrl && <Text>IPFS URL: {ipfsUrl}</Text>}
            {details.map((detail, index) => (
                <Text key={index}>URI: {detail.uri} | Rôle: {detail.role}</Text>
            ))}
            <Button onClick={handleMintMultiple} isLoading={loading} colorScheme="teal">
                Mint Multiple adhérents addresses
            </Button>
        </VStack>
    );

    const ManageNFT = () => (
        <VStack>
            <Heading size="md">Gérer les NFTs</Heading>
            <Input
                placeholder="ID du NFT à mettre en vente"
                value={nftId}
                onChange={(e) => setNftId(Number(e.target.value))}
                type="number"
            />

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
        </VStack>
    );

    const Settings = () => (
        <VStack>
            <Heading size="md">Paramètres</Heading>
            <Input
                placeholder="Nouveau prix de mint (ETH)"
                value={mintPrice}
                onChange={(e) => setMintPrice(Number(e.target.value))}
                type="number"
            />
            <Button onClick={handleSetMintPrice} colorScheme="blue" mb={3}>Changer le prix de mint</Button>
            <Button onClick={handleWithdraw} colorScheme="red" mb={3}>Retirer les fonds</Button>
        </VStack>
    );

    return (
        <Box p={6} display="flex" justifyContent="center" alignItems="center">
            <VStack spacing={4}>
                <HStack spacing={4} mb={6}>
                    <Button
                        onClick={() => handleTabChange('Roles')}
                        variant={activeTab === 'Roles' ? 'solid' : 'outline'}
                    >
                        Gérer les Rôles
                    </Button>
                    <Button
                        onClick={() => handleTabChange('NFT')}
                        variant={activeTab === 'NFT' ? 'solid' : 'outline'}
                    >
                        Gérer les NFT
                    </Button>
                    <Button
                        onClick={() => handleTabChange('Settings')}
                        variant={activeTab === 'Settings' ? 'solid' : 'outline'}
                    >
                        Paramètres
                    </Button>
                </HStack>

                <Divider />

                <Box mt={6}>
                    {activeTab === 'Roles' && <ManageRoles />}
                    {activeTab === 'NFT' && <ManageNFT />}
                    {activeTab === 'Settings' && <Settings />}
                </Box>
            </VStack>
        </Box>
    );
};

export default AdminPage;
