// components/AdminPage.js
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import getRandomInsectGif from '../../../utils/GenInsect24';
import ABI from '../../ABI/ABIAdhesion.json';
import ABICollection from '../../ABI/ABI_Collections.json';
import ABIManagementAdhesion from '../../ABI/ABI_ADHESION_MANAGEMENT.json';

import { useAuth } from '../../../utils/authContext';

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

interface Adhesion {
    address: string;
    role: string;
    name: string;
    bio: string;
}


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

    const [newPointPrice, setNewPointPrice] = useState<number>(0);
    const [numberOfAdhesions, setNumberOfAdhesions] = useState<number>(1); // Nombre par défaut
    const [adhesionData, setAdhesionData] = useState<{ address: string; role: string; name: string; bio: string }[]>([{ address: '', role: '', name: '', bio: 'Biographie (modifiable)' }]);


    const roleMapping: Record<string, number> = {
        Artist: 0,
        Poet: 1,
        Contributor: 2,
        Trainee: 3,
    };

    const contractAddress = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;
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
    if (!isNaN(count) && count >= 1) {
        setNumberOfAdhesions(count);
        const updatedAdhesionData: Adhesion[] = Array.from({ length: count }, (_, index) => ({
            address: '',
            role: '',
            name: '',
            bio: index === 0 ? 'Biographie (modifiable)' : '',
        }));
        setAdhesionData(updatedAdhesionData);
    } else {
        setNumberOfAdhesions(1);
        setAdhesionData([{ address: '', role: '', name: '', bio: 'Biographie (modifiable)' }]);
    }
};

const handleAdhesionChange = (index: number, field: 'address' | 'role' | 'name' | 'bio', value: string) => {
  const updatedData = [...adhesionData];
  updatedData[index][field] = value;
  setAdhesionData(updatedData);
};

const generateImage = () => {
  loadGifFromFile();
};

const loadGifFromFile = async () => {
  const response = await fetch('/gifs/Scarabe.gif');
  const blob = await response.blob();
  const gifURL = URL.createObjectURL(blob);
  setGeneratedImageUrl(gifURL);
};

const handleConfirmRole = async () => {
    const generatedImageUrls = await Promise.all(
        adhesionData.map(async (adhesion) => {
            await generateImageForAdhesion(adhesion); // Ajoutez cette ligne pour générer et stocker chaque image
            return generatedImageUrl; // Retourne l'URL générée
        })
    );

    // Ensuite, téléversez les images et les données pour chaque adhérent
    for (let index = 0; index < adhesionData.length; index++) {
        if (generatedImageUrls[index]) {
            const imageUrl = generatedImageUrls[index];
            if (imageUrl) {
                await uploadFileToIPFS(imageUrl, adhesionData[index]);
            } else {
                alert("Erreur: l'URL de l'image générée est nulle.");
            }
        } else {
            alert("Veuillez vous assurer que les images sont générées.");
        }
    }

};

// Nouvelle fonction pour générer des images par adhésion
const generateImageForAdhesion = async (adhesion: Adhesion) => {
    const response = await fetch('/gifs/Scarabe.gif'); // Ou le chemin de votre image
    const blob = await response.blob();
    const gifURL = URL.createObjectURL(blob);
    setGeneratedImageUrl(gifURL); // Met à jour l'URL de l'image générée
    return gifURL; // Retourne l'URL pour l'utiliser dans le téléversement
};


const uploadFileToIPFS = async (imageUrl: string, adhesion: Adhesion) => {
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
            name: adhesion.name,
            bio: adhesion.bio,
            description: `Rescoe vous a attribué le rôle suivant : ${adhesion.role}`,
            image: imageIpfsUrl,
            role: adhesion.role,
            tags: ["Adhesion", "Minted by Rescoe", adhesion.role],
        };

        const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
            headers: {
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                'Content-Type': 'application/json',
            },
        });

        const metadataIpfsUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`;
        // Stocke les détails des métadonnées pour chaque adhérent
        setDetails((prevDetails) => [...prevDetails, { uri: metadataIpfsUrl, role: adhesion.role, name: adhesion.name, bio: adhesion.bio }]);
    } catch (error) {
        console.error('Error uploading to IPFS:', error);
    } finally {
        setIsUploading(false);
    }
};


const handleMintMultiple = async (): Promise<void> => {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum as any);
        const contract = new web3.eth.Contract(ABI, contractAddress);

        // Récupérer les détails au moment de l'appel de mint
        const details = adhesionData.map(adhesion => ({
            address: adhesion.address.trim(),
            role: roleMapping[adhesion.role],
            name: adhesion.name || "",
            bio: adhesion.bio || "",
        }));

        try {
            const accounts: string[] = await web3.eth.getAccounts();
            const recipientsArray: string[] = details.map(adhesion => adhesion.address);
            const rolesArray: number[] = details.map(adhesion => adhesion.role);
            const nameArray: string[] = details.map(adhesion => adhesion.name);
            const bioArray: string[] = details.map(adhesion => adhesion.bio);

            // Créer un tableau d'URIs basé sur ce qui a été préalablement généré
            const urisArray: string[] = await Promise.all(adhesionData.map(async (adhesion, index) => {
                const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                    name: adhesion.name,
                    bio: adhesion.bio,
                    description: `Rescoe vous a attribué le rôle suivant : ${adhesion.role}`,
                    image: ipfsUrl, // Assurez-vous que cette URL est déjà définie
                    role: adhesion.role,
                    tags: ["Adhesion", "Minted by Rescoe", adhesion.role],
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
                        'Content-Type': 'application/json',
                    },
                });

                return `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`;
            }));

            // Vérifier que tous les tableaux ont la même longueur
            if (recipientsArray.length !== rolesArray.length ||
                recipientsArray.length !== urisArray.length ||
                recipientsArray.length !== nameArray.length ||
                recipientsArray.length !== bioArray.length) {
                alert('Le nombre d\'adresses, d\'URIs, de rôles, de noms et de bios doit être le même.');
                return;
            }

            await contract.methods.mintMultiple(recipientsArray, urisArray, rolesArray, nameArray, bioArray).send({ from: accounts[0] });
            alert('NFTs mintés avec succès !');
        } catch (error) {
            console.error("Minting failed:", error);
            alert('Minting failed: ');
        }
    } else {
        alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
    }
};

/*
//############################################################################# => Systeme de mint multiple accessible uniquement a l'admin
// Vérification si window.ethereum est défini
const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const count = parseInt(e.target.value);
        if (!isNaN(count) && count >= 1) {
            setNumberOfAdhesions(count);
            const updatedAdhesionData = Array.from({ length: count }, (_, index) => ({
                address: '',
                role: '',
                name: '',
                bio: index === 0 ? 'Biographie (modifiable)' : '',
            }));
            setAdhesionData(updatedAdhesionData);
        } else {
            setNumberOfAdhesions(1);
            setAdhesionData([{ address: '', role: '', name: '', bio: 'Biographie (modifiable)' }]);
        }
    };

    const handleAdhesionChange = (index: number, field: 'address' | 'role' | 'name' | 'bio', value: string) => {
        const updatedData = [...adhesionData];
        updatedData[index][field] = value;
        setAdhesionData(updatedData);
    };

    const handleMintMultiple = async (): Promise<void> => {
        if (window.ethereum) {
            const web3 = new Web3(window.ethereum as any);
            const contract = new web3.eth.Contract(ABI, contractAddress);

            try {
                const accounts: string[] = await web3.eth.getAccounts();

                const recipientsArray: string[] = adhesionData.map(adhesion => adhesion.address.trim());
                const rolesArray: number[] = adhesionData.map(adhesion => roleMapping[adhesion.role]); // Assurez-vous que le rôle est correctement décodé
                const nameArray: string[] = adhesionData.map(adhesion => adhesion.name || "");
                const bioArray: string[] = adhesionData.map(adhesion => adhesion.bio || "");

                // Vérifier que chaque tableau a la même longueur
                if (recipientsArray.length !== rolesArray.length || recipientsArray.length !== nameArray.length || recipientsArray.length !== bioArray.length) {
                    alert('Le nombre d\'adresses, de rôles, de noms et de bios doit être le même.');
                    return;
                }

                await contract.methods.mintMultiple(recipientsArray, rolesArray, nameArray, bioArray).send({ from: accounts[0] });
                alert('NFTs mintés avec succès !');
            } catch (error) {
                console.error("Minting failed:");
                alert('Minting failed: ');
            }
        } else {
            alert('MetaMask ou un autre fournisseur Web3 n\'est pas installé.');
        }
    };

*/
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
      console.log("Prix en wei:", actualPointPrice);

      const priceInEth = web3.utils.fromWei(actualPointPrice, "ether");
      console.log("Prix en ETH:", priceInEth);

      setprixPoints(priceInEth);

    } catch (err) {
      alert("Erreur lors de la recuperation du prix des points ");

    }
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


//############################################################# => Gestion du retrait de l'argent des adhesions
const handleWithdrawAdhesion = async (): Promise<void> => {
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

const ManageFeaturedCollections = () => {
    const [collectionId, setCollectionId] = useState<string>('');

    const handleFeature = async (isFeatured: boolean) => {
        if (!collectionId) return alert('Veuillez renseigner un ID de collection.');

        if (window.ethereum && web3 && account) {
            try {
                const contract = new web3.eth.Contract(ABICollection, contratRescollection);
                await contract.methods.featureCollection(parseInt(collectionId), isFeatured).send({ from: account });
                alert(`La collection ${collectionId} a été ${isFeatured ? 'mise en avant' : 'retirée des mises en avant'}.`);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la mise en avant :', error);
                alert('Erreur lors de la mise à jour de la collection.');
            }
        } else {
            alert("Assurez-vous d'être connecté et d'avoir une instance Web3 disponible.");
        }
    };

    return (
        <VStack spacing={4} align="start">
            <Heading size="md">Mettre une collection en avant</Heading>
            <Input
                placeholder="ID de la collection"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
            />
            <HStack>
                <Button colorScheme="green" onClick={() => handleFeature(true)}>Mettre en avant</Button>
                <Button colorScheme="red" onClick={() => handleFeature(false)}>Retirer</Button>
            </HStack>
        </VStack>
    );
};




    const ManageRoles = () => (
      <VStack>
            <Heading size="md">Générer des adhésions</Heading>
            <FormControl mt={4}>
                <FormLabel htmlFor="adhesion-count">Nombre d'adhésions :</FormLabel>
                <Input
                    id="adhesion-count"
                    type="number"
                    value={numberOfAdhesions}
                    onChange={handleNumberChange}
                    min={1}
                />
            </FormControl>

            {adhesionData.map((adhesion, index) => (
                <VStack key={index} spacing={2} mt={4}>
                    <FormControl>
                        <FormLabel htmlFor={`address-${index}`}>Adresse</FormLabel>
                        <Input
                            id={`address-${index}`}
                            value={adhesion.address}
                            onChange={(e) => handleAdhesionChange(index, 'address', e.target.value)}
                            placeholder="Entrez l'adresse du destinataire"
                        />
                    </FormControl>
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
                    <FormControl>
                        <FormLabel htmlFor={`name-${index}`}>Nom</FormLabel>
                        <Input
                            id={`name-${index}`}
                            value={adhesion.name}
                            onChange={(e) => handleAdhesionChange(index, 'name', e.target.value)}
                            placeholder="Entrez votre nom"
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel htmlFor={`bio-${index}`}>Biographie</FormLabel>
                        <Input
                            id={`bio-${index}`}
                            value={adhesion.bio}
                            onChange={(e) => handleAdhesionChange(index, 'bio', e.target.value)}
                            placeholder="Entrez votre biographie"
                        />
                    </FormControl>
                </VStack>
            ))}

            <Center>
                {generatedImageUrl && <Image src={generatedImageUrl} alt="Generated Insect" boxSize="150px" />}
            </Center>

            <Button onClick={handleConfirmRole} isLoading={isUploading} colorScheme="teal">
                Confirmer les adhésions et téléverser sur IPFS
            </Button>
            <Button onClick={handleMintMultiple} isLoading={loading} colorScheme="teal">
                Mint Multiple adhérents addresses
            </Button>
        </VStack>
    );

    const ManageNFT = () => {
        const [activeNFTTab, setActiveNFTTab] = useState<string>('ManageNFT');

        return (
            <VStack>
                <HStack spacing={4}>
                    <Button
                        onClick={() => setActiveNFTTab('ManageNFT')}
                        variant={activeNFTTab === 'ManageNFT' ? 'solid' : 'outline'}
                    >
                        Gérer les NFTs
                    </Button>
                    <Button
                        onClick={() => setActiveNFTTab('ManageFeatured')}
                        variant={activeNFTTab === 'ManageFeatured' ? 'solid' : 'outline'}
                    >
                        Collections mises en avant
                    </Button>
                </HStack>
                {activeNFTTab === 'ManageNFT' && (
                    <>
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
