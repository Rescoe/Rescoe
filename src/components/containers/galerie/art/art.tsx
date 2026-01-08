import React, { useState, useEffect } from 'react';
import { Box, Heading, Spinner, Grid, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Input } from '@chakra-ui/react';
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";

import { useAuth } from '../../../../utils/authContext'; // Importez votre AuthContext


import { useRouter } from 'next/router';
import { useMediaQuery } from '@chakra-ui/react';

import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';
import ABI_IReward from  '../../../ABI/ABIAdhesion.json';

import NFTCard from '../NFTCard';

interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
  creator: string;        // Ajouté
  collectionType: string; // Ajouté
}



interface NFT {
  owner: string;
  tokenId: string;
  image: string;
  name: string;
  description: string;
  forSale:boolean;
  priceInWei: string;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

interface UniqueArtGalerieProps {
    selectedCollectionId: string;
    creator: string; // Ajoutez ceci
}


const UniqueArtGalerie: React.FC = () => {
  const [isMobile] = useMediaQuery('(max-width: 768px)'); // Ajuster la largeur selon vos besoins
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<Collection[]>([]); // État pour stocker les résultats de la recherche
  const [showSearchResults, setShowSearchResults] = useState(false); // État pour contrôler l'affichage des résultats de recherche
  const [searchTerm, setSearchTerm] = useState<string>(''); // État pour stocker le terme de recherche

  const router = useRouter();
  const { web3, address } = useAuth();

  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const total: number = await contract.getTotalCollectionsMinted();
      const collectionsPaginated: any[] = await contract.getCollectionsPaginated(0, total);

      // Utiliser Promise.all et filtrer les résultats non nulls
      const collectionsData = (await Promise.all(
        collectionsPaginated.map(async (tuple: any) => {
          const [id, name, collectionType, creator, collectionAddress, isActive, isFeatured] = tuple;

          // Vérifier ici si le type de collection est "Art"
          if (collectionType !== "Art") return null;

          const uri: string = await contract.getCollectionURI(id);
          const mintContractAddress: string = collectionAddress;

          const cachedMetadata = localStorage.getItem(uri);
          if (cachedMetadata) {
            const metadata = JSON.parse(cachedMetadata);
            return {
              id: id.toString(),
              name,
              collectionType,
              creator,
              imageUrl: metadata.image,
              mintContractAddress,
              isFeatured,
            };
          }

          const response = await fetch(`/api/proxyPinata?ipfsHash=${uri.split('/').pop()}`);
          const metadata = await response.json();
          localStorage.setItem(uri, JSON.stringify(metadata));
          return {
            id: id.toString(),
            name,
            imageUrl: metadata.image,
            mintContractAddress,
            isFeatured,
          };
        })
      )).filter((collection): collection is Collection => collection !== null); // Filtrer les valeurs nulles ici

      // Définir les collections uniquement si le type est Collection
      setCollections(collectionsData.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
    } catch (error) {
      console.error('Erreur lors de la récupération des collections :', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNFTs = async (collectionId: string, associatedAddress: string) => {
      setIsLoading(true);
      try {
          const collectionContract = new Contract(associatedAddress, ABI_MINT_CONTRACT, provider);
          const tokenIds: string[] = await collectionContract.getTokenPaginated(0, 19);

          const nftsData = await Promise.all(
              tokenIds.map(async (tokenId: string) => {
                  try {
                      let tokenURI: string;

                      try {
                          // Essayez d'accéder au tokenURI
                          tokenURI = await collectionContract.tokenURI(tokenId);
                      } catch (error) {
                          // Si on ne trouve pas le token, loguer et passer au suivant
                          console.warn(`Le token avec le tokenId ${tokenId} n'existe pas.`);
                          return null; // Retourne null pour cet NFT
                      }

                      // Si le tokenURI est correctement récupéré, continuez avec le reste de la logique
                      const cachedMetadata = localStorage.getItem(tokenURI);
                      const metadata = cachedMetadata
                          ? JSON.parse(cachedMetadata)
                          : await (await fetch(`/api/proxyPinata?ipfsHash=${tokenURI.split('/').pop()}`)).json();

                      const priceInWei: BigNumberish = await collectionContract.getTokenPrice(tokenId);
                      const isForSale: boolean = await collectionContract.isNFTForSale(tokenId);
                      const priceInEthers = Number(priceInWei) / 1e18;
                      const proprietaire = await collectionContract.ownerOf(tokenId);

                      if (!cachedMetadata) {
                          localStorage.setItem(tokenURI, JSON.stringify(metadata));
                      }

                      return {
                          owner: proprietaire,
                          tokenId: tokenId.toString(),
                          image: metadata.image,
                          name: metadata.name,
                          description: metadata.description,
                          priceInWei: priceInWei.toString(),
                          price: priceInEthers || 0,
                          forSale: isForSale,
                          tags: metadata.tags || [],
                          mintContractAddress: associatedAddress,
                      };
                  } catch (error) {
                      console.error(`Erreur pour le tokenId ${tokenId}:`, error);
                      return null; // En cas d'autres erreurs, retourner null
                  }
              })
          );

          const filteredNFTsData = nftsData.filter((nft): nft is NFT => nft !== null);
          setNfts(filteredNFTsData);
      } catch (error) {
          console.error('Erreur lors de la récupération des NFTs :', error);
      } finally {
          setIsLoading(false);
      }
  };


  const buyNFT = async (nft: NFT) => {
    if (!web3 || !address) {
      console.error("Web3 n'est pas initialisé ou l'utilisateur n'est pas connecté.");
      return;
    }

    const contract = new web3.eth.Contract(ABI_MINT_CONTRACT, nft.mintContractAddress);

    // 🔍 DEBUG LOGS AVANT TX
    //console.log("=== 🔍 DEBUG BUY NFT ===");
    //console.log("nft:", { tokenId: nft.tokenId, priceInWei: nft.priceInWei, forSale: nft.forSale, address });

    const artNFT = new web3.eth.Contract(ABI_MINT_CONTRACT, nft.mintContractAddress);

    // 1️⃣ EXISTS ?
    const exists = await artNFT.methods.doesTokenExist(nft.tokenId).call();
    //console.log("✅ 1. exists:", exists);

    // 2️⃣ FOR SALE ?
    const forSale = await artNFT.methods.isNFTForSale(nft.tokenId).call();
    //console.log("✅ 2. forSale:", forSale);

    // 3️⃣ PRICE
    const price = await artNFT.methods.getTokenPrice(nft.tokenId).call();
    //console.log("✅ 3. price contract:", price.toString(), "envoyé:", nft.priceInWei);

    // 4️⃣ OWNER
    let owner;
    try {
      owner = await artNFT.methods.ownerOf(nft.tokenId).call();
      //console.log("✅ 4. owner:", owner, "!= buyer?", owner.toLowerCase() !== address.toLowerCase());
    } catch(e) {
      //console.log("❌ 4. ownerOf FAIL:", e.message);
    }

    // 5️⃣ ARTIST
    const artist = await artNFT.methods.tokenCreator(nft.tokenId).call();
    //console.log("✅ 5. artist:", artist);

    // 6️⃣ ASSOCIATION
    const association = await artNFT.methods.associationAddress().call();
    //console.log("✅ 6. association:", association);

    // 7️⃣ EXTRAS LENGTH (getter extraPercents[0] pour test length)
    try {
      const extra0 = await artNFT.methods.extraRecipients(0).call();
      //console.log("✅ 7. extra[0]:", extra0);
    } catch(e) {
      //console.log("✅ 7. extra vide/OK");
    }

    // 8️⃣ REWARD CONTRACT
    const rewardContractAddr = "0xE66583156B665A9B125b34A18Ec57F5Effd197D0"; // ResCoeManager
      //const pendingTest = await new web3.eth.Contract(ABI_IReward, rewardContractAddr).methods.getPendingPoints("0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879").call();
      //console.log("✅ ResCoeManager pending OK");


    try {
      const priceInWei = nft.priceInWei;
      //console.log("🚀 TX avec gas=600k");

      const transaction = await contract.methods.buyNFT(nft.tokenId)
        .send({
          from: address,
          value: priceInWei,
          gas: "600000",
        });

      //console.log("✅ BUY SUCCESS:", transaction.transactionHash);
    } catch (error: any) {
      console.error("❌ BUY FAIL:", error.message);
    }
  };


  // Pour déclencher une recherche manuelle (formulaire)
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm) return;

    // Mettre à jour l'URL (shallow: true évite le rechargement complet)
    router.push(`?search=${searchTerm}`, undefined, { shallow: true });

    // Déclencher la recherche
    handleSearch(searchTerm);
  };

  // Fonction centrale pour filtrer
  const handleSearch = (term: string) => {
    const results = collections.filter((collection) =>
      collection.name.toLowerCase().includes(term.toLowerCase()) ||
      collection.creator.toLowerCase().includes(term.toLowerCase()) ||
      collection.collectionType.toLowerCase().includes(term.toLowerCase()) ||
      collection.id.toLowerCase().includes(term.toLowerCase())
    );

    setSearchResults(results);
    setShowSearchResults(true);
    setCurrentTabIndex(3); // Onglet "Résultats"
  };

  // Effet pour capter les paramètres URL
  useEffect(() => {
    if (!router.isReady) return;

    const { search } = router.query;
    if (typeof search === 'string' && search.trim() !== '') {
      setSearchTerm(search);
      handleSearch(search);
    }
  }, [router.isReady, router.query, collections]);


  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
    setSelectedCollectionId(collectionId);
    fetchNFTs(collectionId, associatedAddress);
    setCurrentTabIndex(2);
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <Box p={6}>
      <Heading mb={4}>Galerie</Heading>
      <form onSubmit={handleSearchSubmit}>
                  <Input
                      placeholder="Rechercher une collection..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      mb={4}
                  />
              </form>
              <Tabs index={currentTabIndex} onChange={(index) => setCurrentTabIndex(index)}>
              <TabList>
                  <Tab>Accueil</Tab>
                  <Tab>Collections</Tab>
                  <Tab isDisabled={!selectedCollectionId}>
                  {selectedCollectionId ? collections.find(c => c.id === selectedCollectionId)?.name || 'NFTs' : 'NFTs'}
                  </Tab>
                  <Tab isDisabled={!showSearchResults}>
                    {showSearchResults ? 'Résultats de recherche' : ''}
                  </Tab>
                </TabList>


        <TabPanels>
          {/* Collections mises en avant */}
          <TabPanel>
            {isLoading ? (
              <Spinner />
            ) : (
              <Grid templateColumns={isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)"} gap={6}>
                {collections.filter((collection) => collection.isFeatured).length === 0 ? (
                  <Text>Aucune collection mise en avant trouvée.</Text>
                ) : (
                  collections
                    .filter((collection) => collection.isFeatured)
                    .map((collection) => (
                      <Box
                        key={collection.id}
                        borderWidth="1px"
                        borderRadius="lg"
                        p={4}
                        cursor="pointer"
                        onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
                      >
                        {collection.imageUrl && (
                          <Box width="100%" height="150px" overflow="hidden" borderRadius="md">
                            <img
                              src={collection.imageUrl}
                              alt={collection.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          </Box>
                        )}
                        <Text>{collection.name}</Text>
                      </Box>
                    ))
                )}
              </Grid>
            )}
          </TabPanel>

          {/* Collections */}
          <TabPanel>
            {isLoading ? (
              <Spinner />
            ) : (
              <Grid templateColumns={isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)"} gap={6}>
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
                      onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
                    >
                      {collection.imageUrl && (
                        <Box width="100%" height="150px" overflow="hidden" borderRadius="md">
                          <img
                            src={collection.imageUrl}
                            alt={collection.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Box>
                      )}
                      <Text>{collection.name}</Text>
                    </Box>
                  ))
                )}
              </Grid>
            )}
          </TabPanel>

          <TabPanel>
        {selectedCollectionId ? (
          isLoading ? (
            <Spinner />
          ) : (
            <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6} justifyItems="center">
              {nfts.length === 0 ? (
                <Text>Aucun NFT trouvé.</Text>
              ) : (
                nfts.map((nft) => (
                  <Box
                    key={nft.tokenId}
                    onClick={() => router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)}
                    cursor="pointer"
                    width="100%"
                  >
                    <NFTCard
                      nft={nft}
                      buyNFT={() => buyNFT(nft)}
                      isForSale={nft.forSale}
                      proprietaire={nft.owner}
                    />
                  </Box>
                ))
              )}
            </Grid>
          )
        ) : (
          <Text>Sélectionnez une collection pour afficher les NFTs.</Text>
        )}
      </TabPanel>

      {/* Tab 3: Résultats de recherche */}
      <TabPanel>
        {showSearchResults ? (
          searchResults.length > 0 ? (
            <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={6}>
              {searchResults.map((collection) => (
                <Box
                  key={collection.id}
                  borderWidth="1px"
                  borderRadius="lg"
                  p={4}
                  cursor="pointer"
                  onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
                >
                  <Text fontWeight="bold">{collection.name}</Text>
                  <img
                    src={collection.imageUrl}
                    alt={collection.name}
                    style={{ width: '100%', height: 'auto' }}
                  />
                </Box>
              ))}
            </Grid>
          ) : (
            <Text>Aucune collection trouvée.</Text>
          )
        ) : (
          <Text>Veuillez effectuer une recherche.</Text>
        )}
      </TabPanel>


        </TabPanels>
      </Tabs>
    </Box>
  );

};

export default UniqueArtGalerie;
