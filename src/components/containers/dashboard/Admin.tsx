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

const AdminPage = () => {
    const [account, setAccount] = useState('');
    const [recipients, setRecipients] = useState('');
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [ipfsUrl, setIpfsUrl] = useState(null);
    const [mintPrice, setMintPrice] = useState(0);
    const [nftId, setNftId] = useState(0);
    const [salePrice, setSalePrice] = useState(0);
    const [activeTab, setActiveTab] = useState('Roles');
    const [name, setName] = useState(''); // Ajouter état pour le nom
        const [bio, setBio] = useState(''); // Ajouter état pour la biographie

    const roleMapping = {
        Artist: 0,
        Poet: 1,
        Contributor: 2,
        Trainee: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS;

    useEffect(() => {
        const loadAccount = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0]);
            } else {
                alert('Veuillez installer MetaMask !');
            }
        };
        loadAccount();
    }, []);

    const generateImage = () => {
      /*
        const gifUrl = getRandomInsectGif();
        setGeneratedImageUrl(gifUrl);
        */
        //Je ne sais pas pourquoi mais ca ne fonctionne pas avec le geninsect... probleme de promise object je comprend pas d'ou ca viens
        loadGifFromFile();
    };

    const loadGifFromFile = async () => {
        const response = await fetch('/gifs/Scarabe.gif');  // Charge le fichier GIF via fetch
        const blob = await response.blob();  // Convertir la réponse en un blob
        const gifURL = URL.createObjectURL(blob);  // Créer une URL à partir du blob
        setGeneratedImageUrl(gifURL);  // Utiliser l'URL dans ton application
    };


    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    const handleConfirmRole = async () => {
        if (generatedImageUrl) {
            await uploadFileToIPFS(generatedImageUrl);
        } else {
            alert("Veuillez vous assurer que l'image est générée.");
        }
    };

    const uploadFileToIPFS = async (imageUrl) => {
        setIsUploading(true);
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const formData = new FormData();
            formData.append('file', blob, 'insect.gif');

            const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                headers: {
                  'Authorization': `Bearer ${process.env.PINATA_JWT}`,

                    'Content-Type': 'multipart/form-data'
                }
            });

            const imageIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;
            setIpfsUrl(imageIpfsUrl);

            const metadataJson = {
                name: name,
                bio:bio,
                description: "Rescoe vous à attribué de role suivant : " + selectedRole,
                image: imageIpfsUrl,
                role: selectedRole,
                tags: ["Adhesion", "Minted by Rescoe", selectedRole],
            };

            const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
                headers: {
                  'Authorization': `Bearer ${process.env.PINATA_JWT}`,

                    'Content-Type': 'application/json'
                }
            });

            const metadataIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`;
            setDetails(prevDetails => [...prevDetails, { uri: metadataIpfsUrl, role: selectedRole }]);
        } catch (error) {
            console.error('Error uploading to IPFS:' );
        } finally {
            setIsUploading(false);
        }
    };

    const handleMintMultiple = async () => {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            const accounts = await web3.eth.getAccounts();
            const recipientsArray = recipients.split(',').map(addr => addr.trim());

            // Assurez-vous que details est bien défini et contient les champs attendus
            const urisArray = details.map(detail => detail.uri);
            const rolesArray = details.map(detail => parseInt(roleMapping[detail.role]));
            const nameArray = details.map(detail => detail.name || ""); // Défaut à une chaîne vide si nom n'est pas fourni
            const bioArray = details.map(detail => detail.bio || ""); // Défaut à une chaîne vide si bio n'est pas fournie

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
            console.error("Minting failed: " );
            alert('Minting failed: '); // Affichez le message d'erreur pour plus de clarté
        }
    };

    const handleSetMintPrice = async () => {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            await contract.methods.setMintPrice(Web3.utils.toWei(mintPrice.toString(), 'ether')).send({ from: account });
            alert('Prix de mint mis à jour avec succès!');
        } catch (error) {
            console.error("Erreur lors de la mise à jour du prix: " );
            alert("La mise à jour a échoué!");
        }
    };

    const handleWithdraw = async () => {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            await contract.methods.withdraw().send({ from: account });
            alert('Retrait réussi!');
        } catch (error) {
            console.error("Erreur lors du retrait: " );
            alert("Retrait échoué!");
        }
    };

    const handlePutNFTForSale = async () => {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            await contract.methods.putNFTForSale(nftId, Web3.utils.toWei(salePrice.toString(), 'ether')).send({ from: account });
            alert('NFT mis en vente avec succès!');
        } catch (error) {
            console.error("Erreur lors de la mise en vente du NFT: " );
            alert("Echec de la mise en vente!");
        }
    };

    const handleBurnNFT = async () => {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(ABI, contractAddress);
        try {
            await contract.methods.burnNFT(nftId).send({ from: account });
            alert('NFT brûlé avec succès!');
        } catch (error) {
            console.error("Erreur lors de la combustion du NFT: " );
            alert("Echec de la combustion du NFT!");
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
                    setSelectedRole(Object.keys(roleMapping)[e.target.value]);
                    generateImage();
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
                onChange={(e) => setNftId(e.target.value)}
                type="number"
            />
            <Input
                placeholder="Prix de vente (ETH)"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
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
                onChange={(e) => setMintPrice(e.target.value)}
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
