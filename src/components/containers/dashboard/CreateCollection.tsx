import React, { useState, useEffect } from "react";
import { Box, Heading, VStack, Input, Button, Text, FormLabel, useToast, Spinner, Tab, TabList, TabPanels, TabPanel, Tabs, Image, Grid, FormControl, Select } from "@chakra-ui/react";
import { JsonRpcProvider, Contract, ethers } from "ethers";
import { useAuth } from '../../../utils/authContext';
import ABIRESCOLLECTION from '../../ABI/ABI_Collections.json';
import axios from "axios";


const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT;

const GestionNFT = () => {
  const { address: authAddress } = useAuth();
  const [address, setAddress] = useState(authAddress || '');
  const [avatarSvg, setAvatarSvg] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [ipfsUrl, setIpfsUrl] = useState(null);
  const [collections, setCollections] = useState([]);
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({ name: "", description: "", tags: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [collectionURI, setCollectionURI] = useState('');
  const [userCollections, setUserCollections] = useState(0);
const [remainingCollections, setRemainingCollections] = useState(0);
const [previewUrl, setPreviewUrl] = useState(null);
const [file, setFile] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [collectionType, setCollectionType] = useState('');





  const toast = useToast();

  useEffect(() => {
    const initialize = async () => {
      if (!address) {
        console.error("L'adresse de l'utilisateur est undefined.");
        return;
      }
      fetchCollections(address); // Chargement des collections
      fetchStatsCollection(address);
    };

    initialize();
  }, [address]);

  // Récupérer les collections
const fetchCollections = async (userAddress) => {
  setIsLoading(true);
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  try {

    // Récupérer toutes les collections paginées
    const collectionsPaginated = await contract.getCollectionsByUser(userAddress);

    const collectionsData = await Promise.all(
      collectionsPaginated.map(async (tuple) => {
        // Déstructuration de chaque tuple
        const [id, name, collectionType, creator, associatedAddresses, isActive, isEditable] = tuple;
        // Logique pour obtenir l'URI de la collection, si elle est présente
        const uri = await contract.getCollectionURI(id); // Par exemple, collectionType pourrait être l'URI

        // Vérifier si les métadonnées sont déjà dans le localStorage
        const cachedMetadata = localStorage.getItem(uri);
        if (cachedMetadata) {
          const metadata = JSON.parse(cachedMetadata);
          return {
            id: id.toString(),
            name: name,
            imageUrl: metadata.image,
          };
        }
        // Appeler ton API route proxy pour récupérer les métadonnées JSON depuis l'IPFS
        const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
        const metadata = await response.json();
        // Stocker les métadonnées dans localStorage
        localStorage.setItem(uri, JSON.stringify(metadata));

        return {
          id: id.toString(),
          name: name,
          imageUrl: metadata.image,
        };
      })
    );

    setCollections(collectionsData);
  } catch (error) {
    console.error('Erreur lors de la récupération des collections :' );
  } finally {
    setIsLoading(false);
  }
};


    // Upload file and metadata to IPFS
    const uploadFileToIPFS = async () => {
      if (file && metadata) {
        setIsUploading(true);

        try {
          const formData = new FormData();
          formData.append('file', file);

          const imageResponse = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
              'Authorization': `Bearer ${process.env.PINATA_JWT}`,

              'Content-Type': 'multipart/form-data'
            }
          });

          const imageUrl = `https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${imageResponse.data.IpfsHash}`;

          const metadataJson = {
            name: metadata.name,
            description: metadata.description,
            image: imageUrl,
            tags: metadata.tags.split(',').map(tag => tag.trim()),
          };

          const metadataResponse = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadataJson, {
            headers: {
              'Authorization': `Bearer ${process.env.PINATA_JWT}`,

              'Content-Type': 'application/json'
            }
          });

          setIpfsUrl(`https://sapphire-central-catfish-736.mypinata.cloud/ipfs/${metadataResponse.data.IpfsHash}`);
        } catch (error) {
          console.error('Error uploading to IPFS:' );
          alert('Error uploading to IPFS: ');
        } finally {
          setIsUploading(false);
        }
      } else {
        alert("Please ensure both file and metadata are set.");
      }
    };

    const handleFileChange = (e) => {
      if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
      }
    };

    // Handle metadata input changes
    const handleMetadataChange = (e) => {
      const { name, value } = e.target;
      setMetadata((prev) => ({ ...prev, [name]: value }));
    };



      const fetchStatsCollection = async (userAddress) => {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS); // Utilisez l'URL Moralis ou votre RPC
        const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider); // Initialisation du contrat

        try {
          // Appel à la fonction Solidity pour récupérer le nombre de collections créées
          const userCollections = await contract.getNumberOfCollectionsByUser(userAddress);

          // Appel à la fonction Solidity pour récupérer le nombre de collections restantes
          const remainingCollections = await contract.getRemainingCollections(userAddress);

          // Si les valeurs retournées sont des BigInt (format "1n", "20n"), vous pouvez les convertir en nombre classique
          const userCollectionsNumber = Number(userCollections.toString());
          const remainingCollectionsNumber = Number(remainingCollections.toString());


          setUserCollections(userCollectionsNumber);
          setRemainingCollections(remainingCollectionsNumber);

          return { userCollections: userCollectionsNumber, remainingCollections: remainingCollectionsNumber };
        } catch (err) {
          console.error("Erreur de récupération des collections:");
          setError("Erreur de récupération des collections.");
        }
      };

      const handleCreateCollection = async () => {
    if (!metadata.name || !ipfsUrl) {
      toast({
        title: "Erreur",
        description: "Le nom de la collection (issu des métadonnées) et l'image (IPFS) ne peuvent pas être vides.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoading(true);

      // Configuration du provider et du signer
      const provider = new ethers.BrowserProvider(window.ethereum); // Utilisation de BrowserProvider pour ethers.js
      const signer = await provider.getSigner(); // Récupère le signer connecté
      const contract = new ethers.Contract(contractRESCOLLECTION, ABIRESCOLLECTION, signer); // Adresse et ABI du contrat

      // Appel au contrat pour créer une collection avec les métadonnées
      const tx = await contract.createCollection(metadata.name, ipfsUrl, collectionType); // Utilise `metadata.name` comme `collectionName`
      await tx.wait();

      toast({
        title: "Succès",
        description: `Collection "${metadata.name}" créée avec succès.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Erreur lors de la création de la collection :" );
      toast({
        title: "Erreur",
        description: "Échec de la création de la collection. Vérifiez vos données.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box p={6} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      <Heading mb={4}>Gestion des collections</Heading>
      <Tabs variant='enclosed'>
        <TabList>
          <Tab>Gérer vos collections</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            {isLoading ? (
              <Spinner />
            ) : (
              <Grid templateColumns="repeat(3, 1fr)" gap={6}>
              {collections.length === 0 ? (
                <Text>Aucune collection trouvée.</Text>
              ) : (
                collections.map((collection) => (
                  <Box
                    key={collection.id}
                    borderWidth="1px"
                    borderRadius="lg"
                    p={4}
                    cursor="pointer"
                    onClick={() => handleCollectionClick(collection.id)}
                  >
                    {collection.imageUrl && (
                      <Box
                        width="100%"
                        height="150px"  // Taille fixe pour toutes les images
                        overflow="hidden"
                        borderRadius="md"
                      >
                        <img
                          src={collection.imageUrl}
                          alt={collection.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',  // Assure que l'image garde son aspect mais se recadre
                          }}
                        />
                      </Box>
                    )}
                    <Text>{collection.name}</Text>
                  </Box>
                ))
              )}
                <Text mt={4}>
                  Vous avez {userCollections} collections créées.
                </Text>
                <Text mt={4}>
                  Vous pouvez créer jusqu'à {remainingCollections} collections restantes.
                </Text>

                </Grid>
            )}
            <FormLabel>Upload File</FormLabel>
            <Input type="file" onChange={handleFileChange} mb={3} />
            {previewUrl && <Image src={previewUrl} alt="Preview" mb={3} boxSize="200px" objectFit="cover" />}

            <VStack spacing={3} align="stretch">
              <Input
                placeholder="Name"
                name="name"
                value={metadata.name}
                onChange={handleMetadataChange}
              />
              <Input
                placeholder="Description"
                name="description"
                value={metadata.description}
                onChange={handleMetadataChange}
              />
              <Input
                placeholder="Tags (comma-separated)"
                name="tags"
                value={metadata.tags}
                onChange={handleMetadataChange}
              />
            </VStack>

            <FormControl mb="4">
              <FormLabel htmlFor="collectionType">Type de collection</FormLabel>
              <Select
                id="collectionType"
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
              >
                <option value="">Sélectionner un type</option>
                <option value="Art">Art</option>
                <option value="Poesie">Poésie</option>
                {/*}<option value="digital">Digital</option>*/}
                {/* Ajouter d'autres types de collection ici */}
              </Select>
            </FormControl>

            <Button mt={4} colorScheme="teal" onClick={uploadFileToIPFS} isLoading={isUploading}>
              Upload to IPFS
            </Button>

            {ipfsUrl && (
              <Text mt={3} wordBreak="break-word">IPFS URL: {ipfsUrl}</Text>
            )}

            <Button colorScheme="blue" onClick={handleCreateCollection} mt={2}>
              Créer une Collection
            </Button>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>

  );
};

export default GestionNFT;
