import { useState, useEffect } from "react";
import Web3 from "web3";
import detectEthereumProvider from '@metamask/detect-provider';
import axios from 'axios';
import ABI from '../../ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.
import getRandomInsectGif from '../../../utils/GenInsect24'; // Importer la fonction
import {
    Box,
    Button,
    Center,
    Heading,
    Text,
    Select,
    Image,
    FormControl,
    FormLabel,
    Input // Ajout de Input pour le prix si nécessaire
} from "@chakra-ui/react";
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';

const RoleBasedNFTPage = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [account, setAccount] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isMinting, setIsMinting] = useState<boolean>(false);
    const [roleConfirmed, setRoleConfirmed] = useState<boolean>(false);
    const [mintPrice, setMintPrice] = useState<string>(''); // État pour le prix du mint
    const [showBananas, setShowBananas] = useState(false);  // Add state to control when to show Bananas
    const [name, setName] = useState(''); // Ajouter état pour le nom
        const [bio, setBio] = useState(''); // Ajouter état pour la biographie

    const Bananas = dynamic(() => import('../../modules/Bananas'), { ssr: false });


    const roles = [
        { value: 'Artiste', label: 'Artiste' },
        { value: 'Poete', label: 'Poète' },
        { value: 'Stagiaire', label: 'Stagiaire' },
        { value: 'Contributeur', label: 'Contributeur' },
    ];

    const roleMapping = {
        Artiste: 0,
        Poete: 1,
        Stagiaire: 2,
        Contributeur: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS; // Mettez à jour avec votre adresse de contrat

    useEffect(() => {
        const initWeb3 = async () => {
            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0]);
                await fetchMintPrice(web3Instance); // Récupérer le prix lors de l'initialisation
            } else {
                alert('Veuillez installer MetaMask !');
            }
        };
        initWeb3();
    }, []);

    const fetchMintPrice = async (web3Instance) => {
        const contract = new web3Instance.eth.Contract(ABI, contractAddress);
        const price = await contract.methods.mintPrice().call(); // Récupérez le prix du mint
        const ethPrice = web3Instance.utils.fromWei(price, 'ether'); // Utilisez web3Instance au lieu de web3
        setMintPrice(ethPrice); // Stockez le prix dans l'état local
    };


    const generateImage = async () => {
        const gifUrl = await getRandomInsectGif(); // Attendre que le GIF soit généré
        setGeneratedImageUrl(gifUrl); // Met à jour l’état avec l’URL obtenue
    };


    const handleConfirmRole = async () => {
      if (!name || !bio) {
    alert("Veuillez entrer un nom et une biographie.");
    return;
}
        setRoleConfirmed(true);
        await uploadFileToIPFS(generatedImageUrl);
    };

    const uploadFileToIPFS = async (imageUrl) => {
        setIsUploading(true); // Assurez-vous de suivre l'état de téléchargement

        try {

            if (imageUrl) {
                const formData = new FormData();
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                formData.append('file', blob, 'insect.gif');

                // Upload du GIF sur IPFS
                const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
                    headers: {
                      'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });

                const imageIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

                // Créer l'objet de métadonnées
                const metadataJson = {
                    name: name,
                    bio:bio,
                    description: "Vous êtes " + selectedRole,
                    image: imageIpfsUrl,
                    role: selectedRole,
                    tags: ["Adhesion", selectedRole],
                };

                // Upload des métadonnées sur IPFS
                const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
                    headers: {
                        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                        'Content-Type': 'application/json'
                    }
                });

                setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
            } else {
                alert("Veuillez vous assurer que l'image est générée.");
            }
        } catch (error) {
            console.error('Error uploading to IPFS:');
            alert('Error uploading to IPFS: ');
        } finally {
            setIsUploading(false);
        }
    };

    const mintNFT = async () => {
        if (ipfsUrl && web3) {
            setIsMinting(true);
            try {
                const contract = new web3.eth.Contract(ABI, contractAddress);
                const priceInWei = web3.utils.toWei(mintPrice, 'ether'); // Convertir le prix en wei

                // Envoyer le prix lors de la méthode mint
                await contract.methods.safeMint(ipfsUrl, roleMapping[selectedRole], name, bio).send({ from: account, value: priceInWei });
                setShowBananas(true);


            } catch (error) {
                console.error('Error minting NFT:' );
                alert('Error minting NFT:');
            } finally {
                setIsMinting(false);
            }
        } else {
            alert("Veuillez assurez-vous que l'URL IPFS est définie.");
        }
    };

    return (
        <Box p={5} textAlign="center">
            <Center>
                <Heading mb={5}>Mint votre NFT basé sur un rôle</Heading>
            </Center>
            <Select
                placeholder="Choisissez un rôle"
                onChange={(e) => {
                    setSelectedRole(e.target.value);
                    generateImage(); // Générez l'image lorsque l'utilisateur choisit un rôle
                    setRoleConfirmed(false); // Réinitialiser le statut de confirmation
                }}
            >
                {roles.map(role => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                ))}
            </Select>

            {/* Ajout de champs pour le nom et la biographie */}
<FormControl mt={4}>
    <FormLabel htmlFor="name">Nom</FormLabel>
    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Entrez votre nom" />
</FormControl>
<FormControl mt={4}>
    <FormLabel htmlFor="bio">Biographie</FormLabel>
    <Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Entrez votre biographie" />
</FormControl>


            <Button
                onClick={handleConfirmRole}
                colorScheme="blue"
                isDisabled={!selectedRole || roleConfirmed}
                mt={2}
            >
                Choisir ce rôle
            </Button>
            {generatedImageUrl && (
                <Box mt={5}>
                    <Text fontSize="lg">Aperçu de l'image générée pour le rôle sélectionné :</Text>
                    <Image src={generatedImageUrl} alt="Aperçu du rôle" boxSize="128px" />
                </Box>
            )}
            <Text mt={4}>Prix de mint: {mintPrice} ETH</Text> {/* Afficher le prix de mint */}
            <Button
                onClick={mintNFT}
                colorScheme="teal"
                isLoading={isMinting || isUploading}
                loadingText="Minting..."
                mb={5}
                isDisabled={!ipfsUrl || !roleConfirmed} // Désactiver le bouton mint tant que l'upload n'est pas terminé
            >
                Mint NFT
            </Button>
            {showBananas && (
              <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
                <Canvas
                  camera={{ near: 0.1, far: 100 }}
                  style={{
                              backgroundColor: 'transparent',
                              position: 'fixed', // Cela rend le Canvas fixé à l'écran
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              zIndex: -1, // Mise en arrière-plan
                            }}
                >
                  <Bananas />
                </Canvas>
              </div>
            )}

            {ipfsUrl && (
                <Text mt={3}>URL IPFS: {ipfsUrl}</Text>
            )}
        </Box>
    );
};

export default RoleBasedNFTPage;
