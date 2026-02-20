import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Spinner,
  Grid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Input,
  Flex,
  Badge,
  VStack,
  SimpleGrid,
  Card,
  CardBody,
  HStack,
  Tag,
  Skeleton,
  InputGroup,
  InputLeftElement,
  Button,
  Icon
} from '@chakra-ui/react';
import { BsCollectionPlay } from 'react-icons/bs';

import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import { SearchIcon } from '@chakra-ui/icons'; // ✅ AJOUTÉ

import { useAuth } from '@/utils/authContext';
import { resolveIPFS } from "@/utils/resolveIPFS";

import { useRouter } from 'next/router';
import { useMediaQuery } from '@chakra-ui/react';

import ABIRESCOLLECTION from '../../../ABI/ABI_Collections.json';
import ABI_MINT_CONTRACT from '../../../ABI/ABI_ART.json';
import ABI_IReward from '../../../ABI/ABIAdhesion.json';

import NFTCard from '../NFTCard';

interface Collection {
  id: string;
  name: string;
  imageUrl: string; // ✅ CORRIGÉ : imageUrl partout
  mintContractAddress: string;
  isFeatured: boolean;
  creator: string;
  collectionType: string;
}

interface NFT {
  owner: string;
  tokenId: string;
  image: string;
  name: string;
  description: string;
  forSale: boolean;
  priceInWei: string;
  price: number;
  tags: string[];
  mintContractAddress: string;
}

const UniqueArtGalerie: React.FC = () => {
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Collection[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const router = useRouter();
  const { web3, address } = useAuth();

  const contractRESCOLLECTION = process.env.NEXT_PUBLIC_RESCOLLECTIONS_CONTRACT!;
  const FALLBACK_IMAGE = "/fallback-placeholder.png";
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(contractRESCOLLECTION, ABIRESCOLLECTION, provider);

  // ✅ AJOUTÉ : variables dérivées pour la galerie
  const featured = collections.filter(c => c.isFeatured);
  const others = collections.filter(c => !c.isFeatured);
  const filtered = searchResults.length > 0 ? searchResults : collections;
  const gridCols = isMobile ? 1 : featured.length > 0 ? 4 : 3;

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const total: number = await contract.getTotalCollectionsMinted();
      const collectionsPaginated: any[] = await contract.getCollectionsPaginated(0, total);

      const collectionsData = (await Promise.all(
          collectionsPaginated.map(async (tuple: any) => {
            const [id, name, collectionType, creator, collectionAddress, isActive, isFeatured] = tuple;

            if (collectionType !== "Art") return null;

            const uri: string = await contract.getCollectionURI(id);
            const mintContractAddress: string = collectionAddress;

            // ✅ CACHE
            const cachedMetadata = localStorage.getItem(uri);
            if (cachedMetadata) {
              const metadata = JSON.parse(cachedMetadata);
              return {
                id: id.toString(),
                name,
                imageUrl: resolveIPFS(metadata.image, true), // ← TRUE !
                mintContractAddress,
                isFeatured,
                creator,
                collectionType,
              };
            }

            // ✅ FETCH
            const hash = uri.replace('ipfs://', '').split('/')[0];
            const res = await fetch(`/api/metadata/${hash}`);
            const metadata = await res.json();
            localStorage.setItem(uri, JSON.stringify(metadata));

            return {
              id: id.toString(),
              name,
              imageUrl: resolveIPFS(metadata.image, true), // ← TRUE !
              mintContractAddress,
              isFeatured,
              creator,        // ✅ AJOUTÉ (manquant avant)
              collectionType, // ✅ AJOUTÉ (manquant avant)
            };
          })
        )).filter((collection): collection is Collection => collection !== null);

        setCollections(collectionsData.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)));
       //console.log(collections);

    } catch (error) {
      console.error('Erreur lors de la récupération des collections :', error);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchNFTs = async (collectionId: string, associatedAddress: string) => {
    if (!associatedAddress || associatedAddress === "0") {
      console.error("Adresse de collection invalide :", associatedAddress);
      return;
    }
   //console.log("fetchNFTs called", { collectionId, associatedAddress });


    setIsLoading(true);

    try {
      const collectionContract = new Contract(
        associatedAddress,
        ABI_MINT_CONTRACT,
        provider
      );

      const tokenIds: string[] =
        await collectionContract.getTokenPaginated(0, 19);

      const nftsData = await Promise.all(
        tokenIds.map(async (tokenId: string) => {
          try {
            let tokenURI: string;

            try {
              tokenURI = await collectionContract.tokenURI(tokenId);
            } catch {
              console.warn(
                `Le token avec le tokenId ${tokenId} n'existe pas.`
              );
              return null;
            }

            // Nettoyage URI IPFS
            const cleanURI = tokenURI.replace("ipfs://", "");
            const cid = cleanURI.split("/")[0];

            if (!cid) {
              console.error("CID invalide pour token :", tokenId);
              return null;
            }

            let metadata;

            const cachedMetadata = localStorage.getItem(tokenURI);

            if (cachedMetadata) {
              metadata = JSON.parse(cachedMetadata);
            } else {
              const response = await fetch(`/api/ipfs/${cid}`);

              if (!response.ok) {
                console.error(
                  `Erreur API metadata (${response.status}) pour CID:`,
                  cid
                );
                return null;
              }

              const text = await response.text();

              try {
                metadata = JSON.parse(text);
              } catch (err) {
                console.error("Réponse non JSON reçue :", text);
                return null;
              }

              localStorage.setItem(tokenURI, JSON.stringify(metadata));
            }

            const priceInWei = await collectionContract.getTokenPrice(tokenId);
            const isForSale = await collectionContract.isNFTForSale(tokenId);
            const proprietaire = await collectionContract.ownerOf(tokenId);

            const priceInEthers = Number(priceInWei) / 1e18;

            return {
              owner: proprietaire,
              tokenId: tokenId.toString(),
              image: resolveIPFS(metadata.image, true),
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
            return null;
          }
        })
      );

     //console.log(nftsData);
      const filteredNFTsData = nftsData.filter(
        (nft): nft is NFT => nft !== null
      );

      setNfts(filteredNFTsData);
    } catch (error) {
      console.error("Erreur lors de la récupération des NFTs :", error);
    } finally {
      setIsLoading(false);
    }
  };


  const buyNFT = async (nft: NFT) => {
    if (!web3 || !address) return;

    const artNFT = new web3.eth.Contract(ABI_MINT_CONTRACT, nft.mintContractAddress);
    const rescoeManager = new web3.eth.Contract(ABIRESCOLLECTION, contractRESCOLLECTION);

    const artist = await artNFT.methods.tokenCreator(nft.tokenId).call();
    const association = await artNFT.methods.associationAddress().call();
    const extra0 = await artNFT.methods.extraRecipients(0).call().catch(() => "empty");

    try {
      const rewardAddr = await artNFT.methods.rewardContract().call();
    } catch (e) {
     //console.log("❌ NO rewardContract() dans ArtNFT ABI");
    }

    const isAuth = await rescoeManager.methods.authorizedCollections(nft.mintContractAddress).call();

    try {
      await artNFT.methods.buyNFT(nft.tokenId).call({
        from: address,
        value: nft.priceInWei
      });
    } catch (staticError: any) {
      console.error("❌ STATIC FAIL:", staticError.message);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!searchTerm) return;
    router.push(`?search=${searchTerm}`, undefined, { shallow: true });
    handleSearch(searchTerm);
  };

  const handleSearch = (term: string) => {
    const results = collections.filter((collection) =>
      collection.name.toLowerCase().includes(term.toLowerCase()) ||
      collection.creator.toLowerCase().includes(term.toLowerCase()) ||
      collection.collectionType.toLowerCase().includes(term.toLowerCase()) ||
      collection.id.toLowerCase().includes(term.toLowerCase())
    );
    setSearchResults(results);
    setShowSearchResults(true);
  };

  useEffect(() => {
    if (!router.isReady) return;
    const { search } = router.query;
    if (typeof search === 'string' && search.trim() !== '') {
      setSearchTerm(search);
      handleSearch(search);
    }
  }, [router.isReady, router.query, collections]);

  const handleCollectionClick = (collectionId: string, associatedAddress: string) => {
   //console.log("CLICK collection", { collectionId, associatedAddress });
    setSelectedCollectionId(collectionId);
    fetchNFTs(collectionId, associatedAddress);
    setCurrentTabIndex(2);
  };


  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <Box minH="100vh" py={12} px={{ base: 4, md: 8 }}>
      {/* Search */}
      <Flex justify="center" mb={16}>
        <form onSubmit={handleSearchSubmit}>
          <InputGroup maxW="lg">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Rechercher par nom, artiste ou type d'art..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!e.target.value) setShowSearchResults(false);
              }}
              size="lg"
              bg="white"
              boxShadow="2xl"
              _dark={{ bg: 'gray.800' }}
            />
          </InputGroup>
        </form>
      </Flex>

      {/* Stats */}
      <Flex justify="space-between" mb={16} flexWrap="wrap" gap={4}>
        <Heading size="xl">Galerie</Heading>
        <Badge colorScheme="purple" fontSize="lg" p={3}>
          {filtered.length} collections trouvées
        </Badge>
      </Flex>

      {/* Featured */}
      {featured.length > 0 && (
        <Box mb={20}>
          <Heading size="lg" mb={8}>⭐ Collections mises en avant</Heading>
          <SimpleGrid columns={gridCols} spacing={8}>
            {featured.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
              />
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* All Collections */}
      <Box>
        <Heading size="lg" mb={8}>
          Toutes les collections {featured.length > 0 && `(${others.length})`}
        </Heading>
        {isLoading && !selectedCollectionId ? (
          <SimpleGrid columns={gridCols} spacing={8}>
            {Array(12).fill(0).map((_, i) => <CollectionCardSkeleton key={i} />)}
          </SimpleGrid>
        ) : others.length === 0 ? (
          <VStack py={20} spacing={6}>
            <Text fontSize="xl" color="gray.500">
              {searchTerm ? `Aucune collection pour "${searchTerm}"` : 'Aucune autre collection'}
            </Text>
            {!searchTerm && <Text fontSize="sm" color="gray.400">Les mises en avant sont ci-dessus</Text>}
          </VStack>
        ) : (
          <SimpleGrid columns={gridCols} spacing={8}>
            {others.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => handleCollectionClick(collection.id, collection.mintContractAddress)}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      {/* 🆕 SECTION NFTs - L'INTÉGRATION MANQUANTE */}
      {selectedCollectionId && (
        <Box mt={24} mb={12}>
          <Flex align="center" mb={8} gap={4}>
            <Heading size="lg">
              🎨 NFTs de la collection "
              {collections.find((c) => c.id === selectedCollectionId)?.name}"
            </Heading>
            <Badge colorScheme="green" fontSize="md">
              {nfts.length} œuvres disponibles
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCollectionId(null);
                setNfts([]);
              }}
            >
              ← Retour collections
            </Button>
          </Flex>

          {isLoading ? (
            <Flex justify="center" py={20}>
              <Spinner size="xl" thickness="4px" color="purple.500" />
            </Flex>
          ) : nfts.length === 0 ? (
            <VStack py={20} spacing={6} color="gray.500">
              <Icon as={BsCollectionPlay} boxSize={16} />
              <Text fontSize="xl" textAlign="center">
                Aucun NFT trouvé dans cette collection
              </Text>
              <Text fontSize="md" textAlign="center">
                Peut-être que la collection est vide ou en cours de minting...
              </Text>
            </VStack>
          ) : (
            <SimpleGrid columns={isMobile ? 1 : 2} spacing={8}>
              {nfts.map((nft) => (
                <Box
                  key={nft.tokenId}
                  cursor="pointer"
                  onClick={() =>
                    router.push(`/oeuvresId/${nft.mintContractAddress}/${nft.tokenId}`)
                  }
                  _hover={{ transform: "translateY(-2px)" }}
                  transition="all 0.2s"
                >
                  <NFTCard
                    nft={nft}
                    buyNFT={() => buyNFT(nft)}
                    isForSale={nft.forSale}
                    proprietaire={nft.owner}
                  />
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Box>
      )}
    </Box>
  );

};

// ✅ CORRIGÉ : CollectionCard avec props onClick et imageUrl
interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => (
  <Card
    h="full"
    cursor="pointer"
    _hover={{ transform: 'translateY(-4px)', boxShadow: 'xl' }}
    transition="all 0.3s"
    onClick={onClick}
  >
    <CardBody p={0}>
      <Box h="280px" overflow="hidden" borderRadius="lg">
        <img
          src={collection.imageUrl} // ✅ CONSISTANT
          alt={collection.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Box>
      <Box p={6}>
        <HStack justify="space-between" mb={3}>
          <Tag size="sm" colorScheme="blue">{collection.collectionType}</Tag>
          <Text fontSize="xs" color="gray.500">{collection.creator.slice(0, 10)}...</Text>
        </HStack>
        <Heading size="md" mb={2} noOfLines={1}>{collection.name}</Heading>
      </Box>
    </CardBody>
  </Card>
);

const CollectionCardSkeleton = () => (
  <Card h="full">
    <CardBody p={0}>
      <Skeleton h="280px" />
      <Box p={6}>
        <Skeleton h="20px" w="60%" mb={3} />
        <Skeleton h="16px" w="40%" />
      </Box>
    </CardBody>
  </Card>
);

export default UniqueArtGalerie;
