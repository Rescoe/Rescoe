import { useState, useEffect } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract } from 'ethers';
import { ethers } from 'ethers';

import { BigNumberish } from 'ethers';

import detectEthereumProvider from '@metamask/detect-provider';
import axios from 'axios';
import ABI from '../../ABI/ABIAdhesion.json'; // Votre ABI de contrat ici.
import getRandomInsectGif from '../../../utils/GenInsect24'; // Importer la fonction
import { useRouter } from "next/router";

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
    Input,
    Progress
} from "@chakra-ui/react";
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import { useAuth } from '../../../utils/authContext';


const RoleBasedNFTPage = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [account, setAccount] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isMinting, setIsMinting] = useState<boolean>(false);
    const [roleConfirmed, setRoleConfirmed] = useState<boolean>(false);
    const [mintPrice, setMintPrice] = useState(0); // État pour le prix du mint
    const [showBananas, setShowBananas] = useState(false);  // Add state to control when to show Bananas
    const [name, setName] = useState(''); // Ajouter état pour le nom
    const [bio, setBio] = useState(''); // Ajouter état pour la biographie
    const [isOnSepolia, setIsOnSepolia] = useState<boolean>(false); // État pour vérifier si sur Sepolia
    const [wantsCryptoAdhesion, setWantsCryptoAdhesion] = useState<boolean>(false); // État pour savoir si l'utilisateur veut adhérer en crypto
    const { isAuthenticated } = useAuth();
    const [isMinted, setIsMinted] = useState<boolean>(false);
    const [nftId, setNftId] = useState<string>('');

    const { address } = useAuth();

    const [progress, setProgress] = useState(0);
    const [countdown, setCountdown] = useState(5); // 5 secondes avant redirection

    const [isReadyToMint, setIsReadyToMint] = useState(false);

    const router = useRouter();


    const Bananas = dynamic(() => import('../../modules/Bananas'), { ssr: false });

    const roles = [
        { value: 'Artiste', label: 'Artiste' },
        { value: 'Poete', label: 'Poète' },
        { value: 'Stagiaire', label: 'Stagiaire' },
        { value: 'Contributeur', label: 'Contributeur' },
    ];

    type RoleKey = 'Artiste' | 'Poete' | 'Stagiaire' | 'Contributeur';

    const roleMapping: { [key in RoleKey]: number } = {
        Artiste: 0,
        Poete: 1,
        Stagiaire: 2,
        Contributeur: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS  as string; // Mettez à jour avec votre adresse de contrat

    useEffect(() => {
        const initWeb3 = async () => {
            const provider = (await detectEthereumProvider()) as any;
            if (address) {
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
                const accounts = await web3Instance.eth.getAccounts();
                setAccount(accounts[0]);

                const chainId = await web3Instance.eth.getChainId();
                setIsOnSepolia(Number(chainId) === 11155111); // Vérifier si sur Sepolia

                const storedChoice = localStorage.getItem('wantsCryptoAdhesion');
                if (storedChoice) {
                    setWantsCryptoAdhesion(JSON.parse(storedChoice)); // Charge le choix sauvegardé
                }

                const contract = new web3Instance.eth.Contract(ABI, contractAddress);
                const totalMinted: number = await contract.methods.getTotalMinted().call();
                console.log("totalminted : ", totalMinted.toString());

                setNftId(Number(totalMinted).toString()); // Convertit BigNumber en nombre normal
            }
        };
        initWeb3();
    }, []);

    useEffect(() => {
      if (address) {
          fetchMintPrice();
              }
    }, [address]);

/*
    const fetchMintPrice = async (web3Instance: Web3) => {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

        if (!contractAddress) {
          console.error("L'adresse du contrat n'est pas définie.");
          return;
        }

        const contract = new Contract(contractAddress, ABI, provider);
        // sinon cf "      const priceInEth = web3.utils.fromWei(actualPointPrice.toString(), "ether"); " dans admin.tsx
        //const contract = new web3Instance.eth.Contract(ABI, contractAddress);

      //      const priceInEth = web3.utils.fromWei(actualPointPrice, "ether");
              //console.log("Prix en ETH:", priceInEth);

            //  setprixPoints(priceInEth);
          //

        try {
            const price: BigNumberish = await contract.mintPrice(); // Le prix est renvoyé en wei sous forme de string
            console.log(price);
            const ethPrice: string = web3Instance.utils.fromWei(price, 'ether'); // Converti en ethers sous forme de string
            setMintPrice(Number(ethPrice));//Number(price)/1000000000000000000); // Stocke le prix dans l'état local
        } catch (error) {
            console.error("Erreur lors de la récupération du prix du mint :", error);
        }
    };

*/

const fetchMintPrice = async () => {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

    if (!contractAddress) {
        console.error("L'adresse du contrat n'est pas définie.");
        return;
    }

    const contract = new Contract(contractAddress, ABI, provider);

    try {
        // Récupération du prix de mint en Wei depuis le contrat
        const price: BigNumberish = await contract.mintPrice(); // Le prix est en Wei
        console.log("Prix de mint en Wei:", price);

        // Conversion manuelle du prix de Wei en Ether
        const ethPrice = Number(price) / 1e18; // Division par 10^18 pour convertir de Wei vers Ether

        // Stocker le prix dans l'état local
        setMintPrice(ethPrice);
        console.log(`Prix de mint récupéré: ${ethPrice} ETH`);
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

            const imageIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

            // Métadonnées
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

            setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
        } catch (error) {
            console.error("Error uploading to IPFS:", error);
            alert("Erreur lors de l'upload sur IPFS.");
        } finally {
            setIsUploading(false);
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
                const transaction = await contract.methods.safeMint(ipfsUrl, roleValue, name, bio).send({ from: account, value: priceInWei });

                console.log('Transaction réussie:', transaction);
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
        let progress = 0;
        let countdown = 5; // Temps avant redirection
        setProgress(progress);
        setCountdown(countdown);

        const progressInterval = setInterval(() => {
            setProgress((oldProgress) => {
                if (oldProgress >= 100) {
                    clearInterval(progressInterval);
                    return 100;
                }
                return oldProgress + 2; // Augmente par paliers de 20%
            });
        }, 1000);


        const countdownInterval = setInterval(() => {
            setCountdown((oldCount) => {
                if (oldCount <= 1) {
                    clearInterval(countdownInterval);
                    setIsMinted(true);
                    router.push(`/AdhesionId/${contractAddress}/${nftId}`);
                }
                return oldCount - 1;
            });
        }, 1000);
    };


    const switchToSepolia = async () => {
        if (web3 && web3.currentProvider) { // Vérifiez également que currentProvider est défini
            try {
                await web3.currentProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }],
                });
                window.location.reload(); // Rafraîchir la page
            } catch (error) {
                console.error(error);
                alert("Erreur lors du changement de réseau. Assurez-vous que Sepolia est ajouté à Metamask.");
            }
        } else {
            console.error("Web3 n'est pas initialisé ou currentProvider est non défini.");
            alert("Web3 n'est pas disponible. Veuillez vous assurer que vous avez une extension Ethereum installée.");
        }
    };


        const handleCryptoAdhesion = async () => {
          if(address){
            setWantsCryptoAdhesion(true); // L'utilisateur veut adhérer en crypto

            const provider = await detectEthereumProvider();
            if (provider) {
                const web3Instance = new Web3(provider);
                const chainId = await web3Instance.eth.getChainId(); // Vérifiez le chain ID ici
                // Utilisez directement chainId pour la condition
                if (Number(chainId) !== 11155111) {
                    await switchToSepolia(); // Change le réseau uniquement si nécessaire
                } else {
                    // Si déjà sur Sepolia, continuez à afficher les champs
                    console.log("Champs de données pour l'adhésion en crypto affichés.");
                    // Si vous voulez prouver que vous êtes sur le bon réseau ici, vous pouvez
                    // mettre à jour l'état directement également
                    setIsOnSepolia(true);
                }
            }
            console.log(isOnSepolia);
            localStorage.setItem('wantsCryptoAdhesion', String(true));
          }
          else{
            alert("Vous devez vous connecter avec votre wallet pour adhérer par crypto")
          } // Sauvegarde le choix en tant que chaîne
        };


        const handleRegularAdhesion = async () => {
            setWantsCryptoAdhesion(false); // L'utilisateur veut adhérer en crypto
            localStorage.setItem('wantsCryptoAdhesion', String(false)); // Sauvegarde le choix
        };

        return (
              <Box p={5} textAlign="center">
                  <Center>
                      <Heading mb={5}>Mint votre NFT basé sur un rôle</Heading>
                  </Center>

                  <Button colorScheme="blue" onClick={handleCryptoAdhesion} mb={4}>
                      Adhérer en Crypto (Sepolia)
                  </Button>

                  <Button colorScheme="green" onClick={handleRegularAdhesion} mb={4}>
                      Adhérer par Carte Bancaire
                  </Button>

                  {(isAuthenticated || (wantsCryptoAdhesion && isOnSepolia)) && (
                      <>
                          <Select
                              placeholder="Choisissez un rôle"
                              onChange={(e) => {
                                  setSelectedRole(e.target.value);
                                  generateImage(); // Générez l'image lorsque l'utilisateur choisit un rôle
                              }}
                          >
                              {roles.map(role => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                              ))}
                          </Select>

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
                              Confirmer le rôle
                          </Button>

                          {generatedImageUrl && (
                              <Box mt={5}>
                                  <Text fontSize="lg">Vous serez rediriger vers votre insecte après l'adhesion</Text>
                              </Box>
                          )}

                          <Text mt={4}>Prix de mint : {mintPrice} ETH</Text>
                          <Button
                              onClick={handleMint}
                              colorScheme="teal"
                              isLoading={isMinting || isUploading}
                              loadingText="Minting..."
                              mb={5}
                              isDisabled={!ipfsUrl || !roleConfirmed} // Désactiver le bouton mint tant que l'upload n'est pas terminé
                          >
                              Adhérer
                          </Button>
                      </>

                  )}



                  {showBananas && (

                      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
                          <Canvas
                              camera={{ near: 0.1, far: 100 }}
                              style={{
                                  backgroundColor: 'transparent',
                                  position: 'fixed',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  zIndex: -1,
                              }}
                          >
                              <Bananas />
                          </Canvas>
                      </div>
                  )}
              </Box>
          );
      };

      export default RoleBasedNFTPage;
