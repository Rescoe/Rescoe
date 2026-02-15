import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Spinner,
  Grid,
  Text,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Divider,
  useMediaQuery,
  Button,
  Input
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import { useRouter } from "next/router";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";

import { resolveIPFS } from "@/utils/resolveIPFS"; // ✅ COMME ART


import { useAuth } from '../../../../utils/authContext';
import { useCollectionSearch } from '../../../../hooks/useCollectionSearch';
import useEthToEur from "../../../../hooks/useEuro";


import TextCard from "../TextCard";

interface Collection {
  id: string;
  name: string;
  imageUrl: string;
  mintContractAddress: string;
  isFeatured: boolean;
}

interface Poem {
  tokenId: string;
  poemText: string;
  creatorAddress: string;
  totalEditions: string;
  mintContractAddress: string;
  price: string;
  priceEur: string; // ← optionnel maintenant
  totalMinted: string;
  availableEditions: string;
  isForSale: boolean;
  tokenIdsForSale: number[];

}

const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;

const PoetryGallery: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [poems, setPoems] = useState<Poem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  const { web3, address } = useAuth();
  const [tokenIdsForSale, setTokenIdsForSale] = useState<number[]>([]);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const pageSize = 10; // 20 collections par page
  const [totalCollections, setTotalCollections] = useState<number>(0);
  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();


  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

{/* Pn passe les information au composant */}
  const {
  searchTerm,
  setSearchTerm,
  searchResults,
  showSearchResults,
  handleSearch,
  handleSearchSubmit,
} = useCollectionSearch(collections);



const fetchPoetryCollections = async (page: number) => {
  setIsLoading(true);
  try {
    const total: BigNumberish = await contract.getTotalCollectionsMinted();
    const totalNumber = Number(total);
    setTotalCollections(totalNumber);

    const startId = totalNumber - (page + 1) * pageSize;
    const adjustedStartId = Math.max(startId, 0);
    let endId = totalNumber - page * pageSize - 1;
    endId = Math.min(endId, totalNumber - 1);

    const collectionsPaginated = await contract.getCollectionsByType(
      "Poesie",
      adjustedStartId,
      endId
    );

    const collectionsData: Collection[] = await Promise.all(
      collectionsPaginated.map(async (tuple: any) => {
        const [id, name, collectionType, creator, associatedAddresses, , isFeatured] = tuple;
        const uri: string = await contract.getCollectionURI(id);
        const mintContractAddress: string = associatedAddresses[0]; // Premier

        // 🔥 1. CACHE
        const cached = localStorage.getItem(uri);
        if (cached) {
          const metadata = JSON.parse(cached);
          return {
            id: id.toString(),
            name,
            imageUrl: resolveIPFS(metadata.image, true), // ✅ COMME ART
            mintContractAddress,
            isFeatured,
          };
        }

        // 🔥 2. RESOLVE IPFS DIRECT (comme Art)
        const hash = uri.replace('ipfs://', '').split('/')[0];
        const res = await fetch(`/api/metadata/${hash}`); // Même API Art
        const metadata = await res.json();
        localStorage.setItem(uri, JSON.stringify(metadata));

        return {
          id: id.toString(),
          name,
          imageUrl: resolveIPFS(metadata.image, true), // ✅ TRUE gateway
          mintContractAddress,
          isFeatured,
        };
      })
    );

    setCollections(
      collectionsData
        .filter(Boolean)
        .sort((a, b) => Number(b.id) - Number(a.id))
    );

  } catch (error) {
    console.error("Collections error:", error);
  } finally {
    setIsLoading(false);
  }
};




  // --- Fonction utilitaire pour récupérer les IDs en vente ---
  const fetchTokenIdsForSale = async (
    collectionContract: Contract,
    premierIDDeLaSerie: number,
    nombreHaikusParSerie: number
  ): Promise<number[]> => {
    const tokenIdsForSale: number[] = [];

    for (let id = premierIDDeLaSerie; id < premierIDDeLaSerie + nombreHaikusParSerie; id++) {
      const forSale: boolean = await collectionContract.isNFTForSale(id);
      if (forSale) {
        tokenIdsForSale.push(id);
      }
    }

    return tokenIdsForSale;
  };

  // --- Fonction principale ---
  const fetchPoems = async (collectionId: string, associatedAddress: string) => {
    setIsLoading(true);

    try {
      const collectionContract = new Contract(associatedAddress, ABI, provider);
      const uniqueHaikuCount: BigNumberish = await collectionContract.getLastUniqueHaikusMinted();

      const poemsData: Poem[] = await Promise.all(
        Array.from({ length: Number(uniqueHaikuCount) }, (_, i) => i).map(async (uniqueHaikuId) => {
          const premierToDernier = await collectionContract.getHaikuInfoUnique(uniqueHaikuId);
          const premierIDDeLaSerie = Number(premierToDernier[0]);
          const nombreHaikusParSerie = Number(premierToDernier[1]);

          const availableEditions = await collectionContract.getRemainingEditions(uniqueHaikuId);
          let totalEditions = await collectionContract.getLastMintedTokenId();
          totalEditions = Number(totalEditions) + 1;

          // 📌 On récupère d'abord toutes les infos "immédiates"
          const [firstTokenId] = await collectionContract.getHaikuInfoUnique(uniqueHaikuId);
          const tokenDetails = await collectionContract.getTokenFullDetails(firstTokenId);

          const creatorAddress = await collectionContract.owner();
          const totalMinted = totalEditions - Number(availableEditions);
          setIsOwner(address?.toLowerCase() === creatorAddress.toLowerCase());

          const priceInEuro = convertEthToEur(tokenDetails.currentPrice.toString()) ?? 0;


          // 📌 On construit un poème avec `tokenIdsForSale` et `availableEditions` en "pending"
          const poem: Poem = {
            tokenId: Number(firstTokenId).toString(),
            poemText: tokenDetails.haiku_,
            creatorAddress: creatorAddress.toString(),
            totalEditions: nombreHaikusParSerie.toString(),
            mintContractAddress: associatedAddress,
            price: tokenDetails.currentPrice.toString(),
            priceEur: priceInEuro ? priceInEuro.toFixed(2) : "0",
            totalMinted: totalMinted.toString(),
            availableEditions: "...", // ⏳ placeholder
            isForSale: tokenDetails.forSale,
            tokenIdsForSale: [], // ⏳ placeholder
          };

          // 🔹 On lance la récupération "asynchrone" après coup
          fetchTokenIdsForSale(collectionContract, premierIDDeLaSerie, nombreHaikusParSerie)
            .then((tokenIdsForSale) => {
              const nbAVendre = tokenIdsForSale.length;

              // Mise à jour en remplaçant uniquement les champs dépendants
              setPoems((prevPoems) =>
                prevPoems.map((p) =>
                  p.tokenId === poem.tokenId
                    ? { ...p, availableEditions: nbAVendre.toString(), tokenIdsForSale }
                    : p
                )
              );
            });

          return poem; // On renvoie déjà la version "incomplète"
        })
      );

      setPoems(poemsData); // Première maj de l'état avec les données directes
    } catch (error) {
      console.error("Erreur lors de la récupération des poèmes :", error);
      alert("Une erreur est survenue lors de la récupération des poèmes.");
    } finally {
      setIsLoading(false);
    }
  };


  const handleBuy = async (nft: Poem, tokenId: number) => {
    if (!web3 || !address) {
        alert("Connectez votre wallet pour acheter un haiku.");
        return;
    }

    //console.log(`Début du processus d'achat pour le haiku avec l'ID de token : ${tokenId}`);

    try {
        const contract = new web3.eth.Contract(ABI, nft.mintContractAddress);
        const isForSale = await contract.methods.isNFTForSale(tokenId).call();
        //console.log(`Le haiku ${tokenId} est-il à vendre ? ${isForSale}`);

        if (!isForSale) {
            alert("Ce haiku n'est pas en vente.");
            return;
        }



        if (Number(nft.tokenIdsForSale) <= 0) {
            alert("Plus d'éditions disponibles.");
            return;
        }

        const receipt = await contract.methods.buyEdition(tokenId).send({ from: address, value: nft.price });
        alert("Haiku acheté avec succès !");
        //console.log("Détails de la transaction :", receipt);

        // Rafraîchir la liste après achat
        if (selectedCollectionId) {
            await fetchPoems(selectedCollectionId, nft.mintContractAddress);
        }
    } catch (error: any) {
        console.error("Erreur lors de l'achat :", error);
        alert("Erreur lors de l'achat : " + (error.message || "inconnue"));
    }
};

const handleBurn = async (nft: Poem, tokenId: number) => {
  if (!web3 || !address) {
      alert("Connectez votre wallet pour acheter un haiku.");
      return;
  }

  try {
    if (!contract) return;

    const tx = await contract.burn(tokenId);
    await tx.wait();
    alert(`Poème ${tokenId} brûlé avec succès !`);
    // Optionnel : rafraîchir la liste des poèmes ici
  } catch (error) {
    console.error("Erreur lors du burn :", error);
    alert("Erreur lors du burn du poème.");
  }
};


  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
    setSelectedCollectionId(collectionId);
    fetchPoems(collectionId, associatedAddress);
    setCurrentTabIndex(1);
  };

  useEffect(() => {
    fetchPoetryCollections(currentPage);
  }, [currentPage]);


  return (
    <Box p={6}>
      <Heading mb={4}>Galerie de Poésie</Heading>

      <form onSubmit={handleSearchSubmit}>
  <Input
    placeholder="Rechercher une collection..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    mb={4}
  />
</form>

      {isLoading && <Spinner />}

      {showSearchResults && (
  <Box mt={4}>
    {searchResults.length > 0 ? (
      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={6}>
        {searchResults.map((collection) => (
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
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
            )}
            <Text fontWeight="bold">{collection.name}</Text>
          </Box>
        ))}
      </Grid>
    ) : (
      <Text>Aucune collection trouvée.</Text>
    )}
  </Box>
)}



      <Tabs index={currentTabIndex} onChange={(index) => {
        setCurrentTabIndex(index);
        if (index === 0) {
          setPoems([]);
          setSelectedCollectionId(null);
        }
      }}>
      <TabList>
        <Tab>Collections</Tab>
        {poems.length > 0 && <Tab>Poèmes</Tab>}
        {showSearchResults && <Tab>Résultats</Tab>} {/* Nouvel onglet pour la recherche */}
      </TabList>

      <TabPanels>
        <TabPanel>
          {/* Collections normales */}
          <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={6}>
            {collections.map((collection) => (
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
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </Box>
                )}
                <Text>{collection.name}</Text>
              </Box>
            ))}
          </Grid>

          {/* Pagination */}
          <Box mt={4} display="flex" justifyContent="center" gap={4}>
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
              isDisabled={currentPage === 0}
            >
              Précédent
            </Button>

            <Text>
              {currentPage + 1} / {Math.ceil(totalCollections / pageSize)}
            </Text>

            <Button
              onClick={() =>
                setCurrentPage((prev) =>
                  prev + 1 < Math.ceil(totalCollections / pageSize) ? prev + 1 : prev
                )
              }
              isDisabled={currentPage + 1 >= Math.ceil(totalCollections / pageSize)}
            >
              Suivant
            </Button>
          </Box>
        </TabPanel>

        <TabPanel>
          {/* Poèmes */}
          {isLoading && <Spinner />}
          {poems.length > 0 ? (
            <>
              {/* Bloc infos du premier poème */}
              <Box p={4} border="1px solid #ccc" borderRadius="10px" mb={4}>
                {isOwner && (
                  <Text color="orange.300" fontSize="sm" mb={2}>
                    Vous êtes le créateur de ce recueil
                  </Text>
                )}

                <Box>
                  <Text fontSize="1rem" color="#aaa" mb={1}>
                    <strong>Créateur :</strong> {poems[0].creatorAddress}
                  </Text>
                  <Text fontSize="1rem" color="#aaa" mb={1}>
                    <strong>Contrat de Mint :</strong> {poems[0].mintContractAddress}
                  </Text>
                </Box>
              </Box>

              <Divider mb={3} />

              <Grid templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)' }} gap={6}>
                {poems.map((poem) => (
                  <TextCard
                    key={poem.tokenId}
                    nft={poem}
                    showBuyButton={true}
                    onBuy={(tokenId) => handleBuy(poem, Number(tokenId))}
                  />
                ))}
              </Grid>
            </>
          ) : (
            <Text>Aucun poème disponible pour cette collection.</Text>
          )}
        </TabPanel>

        <TabPanel>
          {/* Résultats de recherche */}
          {searchResults.length > 0 ? (
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={6}>
              {searchResults.map((collection) => (
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
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </Box>
                  )}
                  <Text fontWeight="bold">{collection.name}</Text>
                </Box>
              ))}
            </Grid>
          ) : (
            <Text>Aucune collection trouvée.</Text>
          )}
        </TabPanel>
      </TabPanels>

      </Tabs>
    </Box>
  );
};

export default PoetryGallery;
