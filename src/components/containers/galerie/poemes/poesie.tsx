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
  Input,
  VStack,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  SimpleGrid,
  Center,
  useColorModeValue,
  HStack,
  Image,
  Tag,
  TagLabel
} from "@chakra-ui/react";

import {
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaRedo
} from "react-icons/fa";

import { JsonRpcProvider, Contract, BigNumberish, ethers } from "ethers";
import { useRouter } from "next/router";
import ABIRESCOLLECTION from "../../../ABI/ABI_Collections.json";
import ABI from "../../../ABI/HaikuEditions.json";

import { resolveIPFS } from "@/utils/resolveIPFS"; // ✅ COMME ART
import { effects, gradients, animations, brandHover } from "@styles/theme";


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
        //const mintContractAddress: string = associatedAddresses; // Premier

        let mintContractAddress: string;

        if (Array.isArray(associatedAddresses)) {
          mintContractAddress = associatedAddresses[0];
        } else {
          mintContractAddress = associatedAddresses;
        }

        if (!ethers.isAddress(mintContractAddress)) {
          console.error("Adresse invalide reçue:", mintContractAddress);
          return;
        }


       //console.log([id, name, collectionType, creator, associatedAddresses, , isFeatured]);
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
       //console.log(metadata);

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
      //console.log(nombreHaikusParSerie);
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
          //const tokenIdsForSale = await fetchTokenIdsForSale(collectionContract, Number(firstTokenId), nombreHaikusParSerie);
          //console.log('premierToDernier:', premierToDernier);
          //console.log('premierIDDeLaSerie:', premierIDDeLaSerie, typeof premierIDDeLaSerie);
          //console.log('nombreHaikusParSerie:', nombreHaikusParSerie, typeof nombreHaikusParSerie);
          const tokenIdsForSale = await fetchTokenIdsForSale(collectionContract, premierIDDeLaSerie, nombreHaikusParSerie);
          //console.log('tokenIdsForSale RESULT:', tokenIdsForSale);

          const poem: Poem = {
            tokenId: Number(firstTokenId).toString(),
            poemText: tokenDetails.haiku_,
            creatorAddress: creatorAddress.toString(),
            totalEditions: nombreHaikusParSerie.toString(),
            mintContractAddress: associatedAddress,
            price: tokenDetails.currentPrice.toString(),
            priceEur: priceInEuro ? priceInEuro.toFixed(2) : "0",
            totalMinted: totalMinted.toString(),
            availableEditions: tokenIdsForSale.length.toString(), // ✅ direct
            isForSale: tokenDetails.forSale,
            tokenIdsForSale, // ✅ direct
          };

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



if (!nft.tokenIdsForSale || nft.tokenIdsForSale.length === 0){
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
   //console.log(associatedAddress);

    setSelectedCollectionId(collectionId);
    fetchPoems(collectionId, associatedAddress);
    setCurrentTabIndex(1);
  };

  useEffect(() => {
    fetchPoetryCollections(currentPage);
  }, [currentPage]);

  return (
    <Box p={{ base: 4, md: 6 }}>
      {/* HEADER ÉPURÉ */}
      <VStack spacing={6} align="start" mb={8}>
        <Heading
          size="lg"
          bgGradient={useColorModeValue(
            "linear(to-r, brand.navy, brand.blue)",
            "linear(to-r, brand.gold, brand.cream)"
          )}
          bgClip="text"
        >
          Galerie de Poésie
        </Heading>

        {/* RECHERCHE INTÉGRÉE */}
        <Box w="full" maxW="500px">
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <FaSearch color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Rechercher une collection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              borderRadius="2xl"
              bg="whiteAlpha.100"
              _focus={{ bg: "whiteAlpha.200" }}
            />
            <InputRightElement width="auto">
              <IconButton
                icon={<FaSearch />}
                aria-label="Rechercher"
                size="sm"
                variant="ghost"
                color="brand.gold"
                onClick={() => handleSearchSubmit({} as any)}  // ✅ Ignore TS pour 1 cas
              />
            </InputRightElement>
          </InputGroup>
        </Box>
      </VStack>

      {isLoading && (
        <Center py={12}>
          <Spinner size="xl" color="brand.gold" />
        </Center>
      )}

      {/* TABS ÉPURÉS */}
      <Tabs
        variant="line"
        colorScheme="brand"
        index={currentTabIndex}
        onChange={(index) => {
          setCurrentTabIndex(index);
          if (index === 0) {
            setPoems([]);
            setSelectedCollectionId(null);
          }
        }}
      >
        <TabList justifyContent="center" mb={8}>
          <Tab _selected={{ color: "brand.gold", borderColor: "brand.gold" }}>
            Collections
          </Tab>
          {poems.length > 0 && (
            <Tab _selected={{ color: "brand.gold", borderColor: "brand.gold" }}>
              Poèmes
            </Tab>
          )}
          {showSearchResults && (
            <Tab _selected={{ color: "brand.gold", borderColor: "brand.gold" }}>
              Résultats
            </Tab>
          )}
        </TabList>

        <TabPanels>
          {/* COLLECTIONS */}
          <TabPanel px={0}>
            <SimpleGrid
              columns={{ base: 2, md: 3, lg: 4 }}
              spacing={4}
              mb={8}
            >
              {collections.map((collection) => (
                <Box
                  key={collection.id}
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.2)"
                  borderRadius="lg"
                  p={4}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{
                    boxShadow: "lg",
                    transform: "translateY(-2px)",
                    borderColor: "brand.gold"
                  }}
                  onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
                >
                  {collection.imageUrl && (
                    <Box
                      w="full"
                      h="120px"
                      overflow="hidden"
                      borderRadius="md"
                      mb={3}
                    >
                      <Image
                        src={collection.imageUrl}
                        alt={collection.name}
                        w="full"
                        h="full"
                        objectFit="cover"
                      />
                    </Box>
                  )}
                  <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                    {collection.name}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>

            {/* PAGINATION CENTRÉE */}
            {collections.length > 0 && (
              <Center>
                <HStack spacing={4}>
                  <Button
                    size="sm"
                    leftIcon={<FaChevronLeft />}
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                    isDisabled={currentPage === 0}
                    variant="outline"
                  >
                    Précédent
                  </Button>
                  <Text fontSize="sm" minW="100px" textAlign="center">
                    Page {currentPage + 1} / {Math.ceil(totalCollections / pageSize)}
                  </Text>
                  <Button
                    size="sm"
                    rightIcon={<FaChevronRight />}
                    onClick={() =>
                      setCurrentPage((prev) =>
                        prev + 1 < Math.ceil(totalCollections / pageSize) ? prev + 1 : prev
                      )
                    }
                    isDisabled={currentPage + 1 >= Math.ceil(totalCollections / pageSize)}
                    variant="outline"
                  >
                    Suivant
                  </Button>
                </HStack>
              </Center>
            )}
          </TabPanel>

          {/* POÈMES */}
          <TabPanel px={0}>
            {poems.length > 0 ? (
              <VStack spacing={6} align="start">
                {/* Infos créateur discrètes */}
                <Box
                  p={4}
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.2)"
                  borderRadius="lg"
                  w="full"
                >
                  {isOwner && (
                    <Tag size="sm" colorScheme="orange" mb={2}>
                      <TagLabel>Créateur</TagLabel>
                    </Tag>
                  )}
                  <HStack spacing={4} flexWrap="wrap">
                    <Text fontSize="sm" color="gray.400">
                      <strong>Créateur :</strong> {poems[0].creatorAddress}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                      <strong>Contrat :</strong> {poems[0].mintContractAddress}
                    </Text>
                  </HStack>
                </Box>

                <SimpleGrid
                  columns={{ base: 1, md: 2 }}
                  spacing={6}
                  w="full"
                >
                {poems.map((poem) => (
                  <TextCard
                    key={poem.tokenId}
                    nft={poem}   // ✅ garder les données du poème
                    showBuyButton={true}
                    onBuy={(tokenId) => handleBuy(poem, Number(tokenId))}
                  />
                ))}
                </SimpleGrid>
              </VStack>
            ) : (
              <Center py={12}>
                <Text fontSize="md" opacity={0.7}>
                  Aucun poème disponible pour cette collection.
                </Text>
              </Center>
            )}
          </TabPanel>

          {/* RÉSULTATS RECHERCHE */}
          <TabPanel px={0}>
            {searchResults.length > 0 ? (
              <SimpleGrid
                columns={{ base: 2, md: 3 }}
                spacing={4}
              >
                {searchResults.map((collection) => (
                  <Box
                    key={collection.id}
                    borderWidth={1}
                    borderColor="rgba(255,255,255,0.2)"
                    borderRadius="lg"
                    p={4}
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{
                      boxShadow: "lg",
                      transform: "translateY(-2px)",
                      borderColor: "brand.gold"
                    }}
                    onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
                  >
                    {collection.imageUrl && (
                      <Box
                        w="full"
                        h="120px"
                        overflow="hidden"
                        borderRadius="md"
                        mb={3}
                      >
                        <Image
                          src={collection.imageUrl}
                          alt={collection.name}
                          w="full"
                          h="full"
                          objectFit="cover"
                        />
                      </Box>
                    )}
                    <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                      {collection.name}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            ) : (
              <Center py={12}>
                <Text fontSize="md" opacity={0.7}>
                  Aucune collection trouvée.
                </Text>
              </Center>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );

};

export default PoetryGallery;
