import { useState, useEffect } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract } from 'ethers';
import { BigNumberish } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import axios from 'axios';
import ABI from '../../ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.
import getRandomInsectGif from '../../../utils/GenInsect24'; // Importer la fonction
import { useRouter } from "next/router";
import { FaAward, FaWallet, FaClock, FaUserShield, FaStar } from "react-icons/fa";
import { Canvas } from '@react-three/fiber';


import {
    Box,
    Button,
    Center,
    Heading,
    Text,
    Select,
    FormControl,
    FormLabel,
    Input,
    List,
    ListItem,
    Stack,
    Icon,
    Image,
    VStack,
    Collapse,
    useDisclosure,
    Divider,
} from "@chakra-ui/react";
import { FaCheckCircle } from 'react-icons/fa'; // Exemple d'icône pour les éléments de liste

import dynamic from 'next/dynamic';
import useEthToEur from "../../../hooks/useEuro";
import { useAuth } from '../../../utils/authContext';

const RoleBasedNFTPage = () => {
    const { address: account, web3, isAuthenticated } = useAuth();
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isMinting, setIsMinting] = useState<boolean>(false);
    const [roleConfirmed, setRoleConfirmed] = useState<boolean>(false);

    const [mintPrice, setMintPrice] = useState(0); // État pour le prix du mint
    const [priceEur, setEuroPrice] = useState(0); // État pour le prix du mint

    const [showBananas, setShowBananas] = useState(false); // État pour afficher les Bananas
    const [name, setName] = useState(''); // État pour le nom
    const [bio, setBio] = useState(''); // État pour la biographie
    const [isOnSepolia, setIsOnSepolia] = useState<boolean>(false); // État pour vérifier si sur Sepolia
    const [nftId, setNftId] = useState<string>('');
    const [isReadyToMint, setIsReadyToMint] = useState(false);
    const { convertEthToEur, loading: loadingEthPrice } = useEthToEur();

    const router = useRouter();
    const Bananas = dynamic(() => import('../../modules/Bananas'), { ssr: false });

    const { isOpen, onToggle } = useDisclosure();


    const roles = [
        { value: 'Artiste', label: 'Artiste' },
        { value: 'Poete', label: 'Poète' },
        /*
        { value: 'Stagiaire', label: 'Stagiaire' },
        { value: 'Contributeur', label: 'Contributeur' },
        */
    ];

    type RoleKey = 'Artiste' | 'Poete' | 'Stagiaire' | 'Contributeur';
    const roleMapping: { [key in RoleKey]: number } = {
        Artiste: 0,
        Poete: 1,
        Stagiaire: 2,
        Contributeur: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string; // Mettez à jour avec votre adresse de contrat

    useEffect(() => {
        if (!account) return; // attendre la connexion

        const checkNetwork = async () => {
            if (!web3) return;
            const chainId = await web3.eth.getChainId();
            setIsOnSepolia(Number(chainId) === 11155111);

            const contract = new web3.eth.Contract(ABI, contractAddress);
            const totalMinted = await contract.methods.getTotalMinted().call();
            setNftId(Number(totalMinted).toString());
        };

        checkNetwork();
    }, [account, web3]);

    useEffect(() => {
        if (account && !loadingEthPrice) {
            fetchMintPrice();
        }
    }, [account, loadingEthPrice]);

    const fetchMintPrice = async () => {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

        if (!contractAddress) {
            console.error("L'adresse du contrat n'est pas définie.");
            return;
        }

        const contract = new Contract(contractAddress, ABI, provider);

        try {
            const price: BigNumberish = await contract.mintPrice(); // Le prix est en Wei
            const ethPrice = Number(price) / 1e18; // Conversion de Wei vers Ether
            const priceEur = await convertEthToEur(ethPrice);
            setMintPrice(ethPrice);
            setEuroPrice(priceEur ?? 0);
        } catch (error) {
            console.error("Erreur lors de la récupération du prix du mint :", error);
        }
    };

    const generateImage = async () => {
        const gifUrl = await getRandomInsectGif(); // Attendre que le GIF soit généré
        setGeneratedImageUrl(gifUrl); // Met à jour l'état avec l'URL obtenue
    };

    const handleConfirmRole = async () => {
        if (!name || !bio) {
            alert("Veuillez entrer un nom et une biographie.");
            return;
        }
        setRoleConfirmed(true);
        await uploadFileToIPFS(generatedImageUrl);
    };

    const uploadFileToIPFS = async (imageUrl: string | null) => {
        setIsUploading(true);
        try {
            if (!imageUrl) {
                alert("Veuillez vous assurer que l'image est générée.");
                setIsUploading(false);
                return;
            }

            const formData = new FormData();
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            formData.append("file", blob, "insect.gif");

            const imageResponse = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
                headers: {
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                    "Content-Type": "multipart/form-data"
                }
            });

            const imageIpfsUrl = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

            const metadataJson = {
                name: name || "Nom inconnu",
                bio: bio || "Aucune bio",
                description: `Vous êtes ${selectedRole}`,
                image: imageIpfsUrl,
                role: selectedRole || "Membre",
                tags: ["Adhesion", selectedRole || "Membre"]
            };

            const metadataResponse = await axios.post(
                "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                metadataJson,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            setIpfsUrl(`https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
        } catch (error) {
            console.error("Erreur lors de l'upload sur IPFS:", error);
            alert("Erreur lors de l'upload sur IPFS.");
        } finally {
            setIsUploading(false);
            setIsReadyToMint(true);
        }
    };

    const mintNFT = async () => {
        if (!ipfsUrl || !selectedRole || !web3 || !account) {
            alert("Assurez-vous d'être connecté, d'avoir généré une URL IPFS et que le rôle est sélectionné.");
            return;
        }

        try {
            const contract = new web3.eth.Contract(ABI, contractAddress);
            const priceInWei = web3.utils.toWei(mintPrice.toString(), 'ether');

            if (roleMapping.hasOwnProperty(selectedRole)) {
                const roleValue = roleMapping[selectedRole as RoleKey];

                // Minting NFT
                await contract.methods.safeMint(ipfsUrl, roleValue, name, bio).send({ from: account, value: priceInWei });

                setShowBananas(true);
                setIsMinting(true);
                startLoadingAndRedirect();
            } else {
                console.error(`Rôle sélectionné "${selectedRole}" non trouvé dans le mapping`);
            }
        } catch (error) {
            console.error('Erreur lors du minting NFT:', error);
            alert('Erreur lors du minting NFT. Vérifiez la console pour plus de détails.');
        } finally {
            setIsMinting(false);
        }
    };

    const handleMint = async () => {
        if (isReadyToMint) {
            await mintNFT(); // Appelez mintNFT lorsque nous savons que tout est prêt
        } else {
            alert("Les conditions ne sont pas remplies pour mint");
        }
    };

    const startLoadingAndRedirect = () => {
        const countdownInterval = setInterval(() => {
            router.push(`/AdhesionId/${contractAddress}/${nftId}`);
            clearInterval(countdownInterval); // On arrête l'intervalle
        }, 5000); // Redirection après 5 secondes
    };

    const switchToSepolia = async () => {
        if (web3 && web3.currentProvider) {
            try {
                await web3.currentProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }],
                });
                window.location.reload();
            } catch (error) {
                console.error(error);
                alert("Erreur lors du changement de réseau. Assurez-vous que Sepolia est ajouté à Metamask.");
            }
        } else {
            console.error("Web3 n'est pas initialisé ou currentProvider est non défini.");
            alert("Web3 n'est pas disponible. Veuillez vous assurer que vous avez une extension Ethereum installée.");
        }
    };

    return (
        <Box p={5} textAlign="center">
        <Box p={5} borderRadius="lg" boxShadow="md" mb={4} maxWidth="800px" mx="auto">
              <Heading size="lg" mb={4} textAlign="center">
              Adhésion
              </Heading>
              <Text fontSize="md" mb={4} textAlign="center">
                  En tant que membre de notre réseau unique, vous aurez l'opportunité de participer à une communauté dynamique d'artistes et de collectionneurs engagés dans l'innovation et la créativité.
              </Text>

              <Heading size="l" mb={4} textAlign="center">
              Recevez un badge d'adhérent unique !
              </Heading>
              <Image
                  src="/gifs/Scarabe.gif"
                  alt="Badge d'adhésion animé"
                  borderRadius="md"
                  mb={4}
                  boxSize="300px"
                  objectFit="cover"
                  mx="auto"
              />


              <Button onClick={onToggle} width="full" mb={4}>
                  {isOpen ? "Masquer les détails" : "Voir les détails de l'adhésion"}
              </Button>

              <Collapse in={isOpen}>



                  <VStack align="start" spacing={4} mb={5}>

                      <Box>
                          <List spacing={3}>
                              <ListItem display="flex" alignItems="center">
                                  <Icon as={FaClock} boxSize={5} />
                                  <Text ml={2}>
                                      <strong>Durée de l'adhésion :</strong> 365 jours (1 an)
                                  </Text>
                              </ListItem>
                              <ListItem display="flex" alignItems="center">
                                  <Icon as={FaWallet} boxSize={5} />
                                  <Text ml={2}>
                                      <strong>Prix de l'adhésion :</strong> 0.005 ETH (environ 15 euros)
                                  </Text>
                              </ListItem>
                              <ListItem display="flex" alignItems="center">
                                  <Icon as={FaAward} boxSize={5} />
                                  <Text ml={2}>
                                      <strong>Points de récompense :</strong> Bénéficiez de 15 points attribués dès votre adhésion.
                                  </Text>
                              </ListItem>
                              <ListItem display="flex" alignItems="center">
                                  <Icon as={FaUserShield} boxSize={5} />
                                  <Text ml={2}>
                                      <strong>Rôles disponibles :</strong> Artiste, Poète, Stagiaire, Contributeur
                                  </Text>
                              </ListItem>
                              <ListItem display="flex" alignItems="center">
                                  <Icon as={FaStar} boxSize={5} />
                                  <Text ml={2}>
                                      <strong>Accès à la création de collections :</strong> Créez des collections uniques et dynamisez votre art !
                                  </Text>
                              </ListItem>
                          </List>
                      </Box>

                      <Text fontSize="lg" fontWeight="bold" mt={4}>
                          Pourquoi rejoindre RESCOE ?
                      </Text>
                      <Text>- Accès direct aux outils de la blockchain et à des ressources pédagogiques pour enrichir votre pratique artistique.</Text>
                      <Text>- Opportunités de collaboration avec d'autres artistes et créateurs au sein de notre réseau.</Text>
                      <Text>- Formation et ateliers sur le Web3, la blockchain et la création artistique.</Text>
                      <Text>- Possibilité de participer à des événements exposant des œuvres numériques et physiques.</Text>
                      <Text>- Développez une présence dans le monde numérique tout en renforçant les liens avec l’art traditionnel.</Text>
                  </VStack>

                  <Text textAlign="center" mb={4}>
                      En devenant membre, vous contribuerez à un réseau qui valorise l’art, la technologie et la créativité tout en favorisant un environnement d'apprentissage et d'échange.
                  </Text>
                  <Text textAlign="center" fontWeight="bold">
                      Ensemble, concrétisons vos idées et vos œuvres dans un écosystème innovant.
                  </Text>

                  <Divider mb="10" />
                  <Heading size="l" mb={4} textAlign="center">
                  Connectez vous pour pouvoir adhérer
                  </Heading>

              </Collapse>
          </Box>


            {isAuthenticated && (
                <>
                    <FormControl mb={3}>
                        <FormLabel>Choisissez un rôle</FormLabel>
                        <Select
                            placeholder="Sélectionnez votre rôle"
                            onChange={(e) => { setSelectedRole(e.target.value); generateImage(); }}
                        >
                            {roles.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl mb={3}>
                        <FormLabel>Nom</FormLabel>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Entrez votre nom" />
                    </FormControl>

                    <FormControl mb={3}>
                        <FormLabel>Biographie</FormLabel>
                        <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Entrez votre biographie" />
                    </FormControl>

                    <Button
                        colorScheme="blue"
                        onClick={handleConfirmRole}
                        isDisabled={!selectedRole || roleConfirmed}
                        mb={3}
                    >
                        Confirmer le rôle
                    </Button>

                    {generatedImageUrl && (
                        <Text mb={3}>Votre insecte animé sera généré après confirmation du rôle.</Text>
                    )}

                    <Text mb={3}>Prix de l'adhésion : {mintPrice} ETH (~{priceEur} €)</Text>

                    <Button
                        colorScheme="teal"
                        onClick={handleMint}
                        isLoading={isMinting || isUploading}
                        loadingText="Création du badge..."
                        isDisabled={!ipfsUrl || !roleConfirmed}
                    >
                        Adhérer
                    </Button>
                </>
            )}

            {showBananas && (
              <Box
                position="fixed"
                top={0}
                left={0}
                width="100%"
                height="100%"
                zIndex={-1}
              >
                <Canvas>
                  <Bananas />
                </Canvas>
              </Box>
            )}

        </Box>
    );
};

export default RoleBasedNFTPage;
