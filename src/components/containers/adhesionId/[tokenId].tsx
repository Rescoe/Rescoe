import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract as EthersContract, formatUnits, BigNumberish } from 'ethers';
import Web3 from 'web3';

import {
  Box,
  Button,
  Heading,
  Image,
  Text,
  VStack,
  HStack,
  Spinner,
  FormControl,
  FormLabel,
  Input,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Divider,
} from '@chakra-ui/react';
import { useRouter } from 'next/router';

import ABI from '@/components/ABI/ABIAdhesionEvolve.json'; // nouvelle ABI
import ABI_Management from '@/components/ABI/ABI_ADHESION_MANAGEMENT.json';
import { useAuth } from '@/utils/authContext';
import { PublicProfile } from "@/components/containers/dashboard";
import genInsect25 from '@/utils/GenInsect25';
import { usePinataUpload } from '@/hooks/usePinataUpload';

import { useTokenEvolution } from '@/hooks/useTokenEvolution';
import { buildEvolutionHistory } from '@/utils/evolutionHistory';
import CopyableAddress from "@/hooks/useCopyableAddress";

import  EvolutionHistoryTimeline  from '@/utils/EvolutionHistoryTimeline'


interface NFTData {
  owner: string;
  role: number;
  mintTimestamp: string;
  price: string; // en ETH (string lisible)
  name: string;
  bio: string;
  remainingTime: string; // déjà formaté (Xj Yh...)
  fin: string;
  forSale: boolean;
  membership: string;
  image?: string;
}

interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
}

interface EvolutionMetadata {
  level: number;
  family?: string;
  sprite_name?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  evolution_history?: Array<{
    level: number;
    image: string;
    timestamp: number;
  }>;
  [key: string]: unknown;
}



const roles: { [key: number]: string } = {
  0: "Artist",
  1: "Poet",
  2: "Contributor",
  3: "Trainee",
};

const roleLabels: Record<string, string> = {
  Artist: "Artiste",
  Poet: "Poète",
  Contributor: "Contributeur",
  Trainee: "Formateur",
};

const contractAdhesionManagement = process.env.NEXT_PUBLIC_RESCOE_ADHERENTSMANAGER as string;
const contractAdhesion = process.env.NEXT_PUBLIC_RESCOE_ADHERENTS as string;

const TokenPage = () => {
  const router = useRouter();
  const { tokenId } = router.query;

  const { address: authAddress, web3: authWeb3 } = useAuth();

  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isForSale, setIsForSale] = useState<boolean>(false);
  const [nftCache, setNFTCache] = useState<{ [key: string]: NFTData }>({});

  const [evolutionRefreshFlag, setEvolutionRefreshFlag] = useState<number>(0);


  function formatSeconds(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const remainingSeconds = seconds % 60;
    return `${days}j ${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  const formatDateTime = (ts: number) =>
    new Date(ts * 1000).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  // FETCH NFT de base
  useEffect(() => {
    if (!router.isReady || !contractAdhesion || tokenId === undefined) return;

    setIsLoading(true);

    const fetchNFT = async () => {
      try {
        const data = await fetchNFTData(contractAdhesion as string, Number(tokenId));
        setNftData(data);
        setIsForSale(data.forSale);
        const remainingTimeInSeconds = Number(data.remainingTime);
        setMembershipStatus(remainingTimeInSeconds > 0 ? 'actif' : 'expiré');
        setName(data.name);
        setBio(data.bio);
        setPrice(data.price);
      } catch (err) {
        console.error('Erreur lors de la récupération du NFT:', err);
        setError('Erreur lors de la récupération des données.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNFT();
  }, [router.isReady, contractAdhesion, tokenId]);



// Usage

const {
  membershipInfo,
  evolvePriceEth,
  isManualEvolveReady,
  previewImageUrl,
  evolveIpfsUrl,
  isUploadingEvolve,
  isEvolving,
  prepareEvolution,
  evolve,
  refreshEvolution,
  updateCurrentMetadata // ✅ AJOUTÉ
} = useTokenEvolution({
  contractAddress: contractAdhesion,
  tokenId: tokenId !== undefined ? Number(tokenId) : undefined,
  currentImage: nftData?.image,
  currentName: nftData?.name || "",
  currentBio: nftData?.bio || "",
  currentRoleLabel: nftData ? (roles[nftData.role] || "Member") : "Member",
  onMetadataLoaded: (metadata: EvolutionMetadata) => console.log("Metadata loaded:", metadata) // Optionnel
});



const fetchNFTData = async (
  contractAdhesionAddress: string,
  tokenIdNumber: number
): Promise<NFTData> => {

    const cacheKey = `${contractAdhesionAddress}_${tokenIdNumber}`;
    if (nftCache[cacheKey]) return nftCache[cacheKey];

    try {
      const rpcProvider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);

      const contract = new EthersContract(contractAdhesionAddress, ABI, rpcProvider);
      const contractManagement = new EthersContract(contractAdhesionManagement, ABI_Management, rpcProvider);

      const [
        owner,
        role,
        mintTimestamp,
        priceWei,
        nameOnChain,
        bioOnChain,
        remainingTime,
        forSale,
      ] = await contract.getTokenDetails(tokenIdNumber);

      console.log(owner,
      role,
      mintTimestamp,
      priceWei,
      nameOnChain,
      bioOnChain,
      remainingTime,
      forSale);

      const [membership, realName, realBio] = await contract.getUserInfo(owner);

      const uri = await contract.tokenURI(tokenIdNumber);
      const ipfsHash = uri.split('/').pop();
      const res = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
      const metadata: EvolutionMetadata = await res.json();

      const finAdhesion = new Date(
        (Number(mintTimestamp) + Number(remainingTime)) * 1000
      ).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

      const nftData: NFTData = {
        ...metadata,
        owner,
        role: Number(role),
        mintTimestamp: formatTimestamp(Number(mintTimestamp)),
        price: formatUnits(priceWei as BigNumberish, 'ether'),
        name: (realName && realName.length > 0) ? realName : nameOnChain,
        bio: (realBio && realBio.length > 0) ? realBio : bioOnChain,
        remainingTime: formatSeconds(Number(remainingTime)),
        fin: finAdhesion,
        forSale: Boolean(forSale),
        membership,
      };


      console.log("uri");

      console.log(uri);



      setNFTCache(prev => ({ ...prev, [cacheKey]: nftData }));

      // À la fin de fetchNFTData, après setNFTCache
      // À la fin de fetchNFTData, APRÈS setNFTCache
      updateCurrentMetadata({
        level: Number(metadata.level || 0),
        family: metadata.family,
        sprite_name: metadata.sprite_name,
        attributes: metadata.attributes || [],
        evolution_history: metadata.evolution_history || [],
        image: metadata.image
      });



      return nftData;
    } catch (err) {
      console.error('Erreur lors de la récupération des données NFT:', err);
      throw new Error('Erreur lors de la récupération des données NFT.');
    }
  };


  // Transactions

  const handleRenewMembership = async () => {
    if (!contractAdhesion || Array.isArray(contractAdhesion)) {
      console.error('Adresse de contrat invalide');
      return;
    }
    if (!authWeb3 || !authAddress) {
      alert('Veuillez vous connecter à MetaMask.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const mintPriceWei: string = await contract.methods.mintPrice().call();
      await contract.methods.renewMembership(Number(tokenId)).send({
        from: authAddress,
        value: mintPriceWei,
      });
      alert('Adhésion renouvelée avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);

      refreshEvolution();

      setEvolutionRefreshFlag(prev => prev + 1);
    } catch (err) {
      console.error('Erreur lors du renouvellement de l\'adhésion:', err);
      alert('Erreur lors du renouvellement. Voir console.');
    }
  };

  const handleUpdateInfo = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      await contract.methods.setNameAndBio(Number(tokenId), name, bio).send({ from: authAddress });
      alert('Informations mises à jour avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);
    } catch (err) {
      console.error('Erreur lors de la mise à jour des informations:', err);
      alert('Erreur lors de la mise à jour. Voir console.');
    }
  };

  const handleListForSale = async () => {
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      alert('Prix invalide.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const priceWei = (authWeb3 as Web3).utils.toWei(price, 'ether');
      await contract.methods.listTokenForSale(Number(tokenId), priceWei).send({ from: authAddress });

      setIsForSale(true);
      alert('NFT mis en vente avec succès.');
    } catch (err) {
      console.error('Erreur lors de la mise en vente du NFT:', err);
      alert('Erreur lors de la mise en vente. Voir console.');
    }
  };

  const handlePurchase = async () => {
    if (!nftData) {
      console.error('nftData is not available.');
      return;
    }
    if (!contractAdhesion || !authWeb3 || !authAddress) {
      alert('Veuillez vous connecter.');
      return;
    }

    try {
      const contract = new (authWeb3 as Web3).eth.Contract(ABI as any, contractAdhesion);
      const valueWei = (authWeb3 as Web3).utils.toWei(nftData.price, 'ether');
      await contract.methods.buyNFT(Number(tokenId)).send({ from: authAddress, value: valueWei });
      alert('NFT acheté avec succès.');
      const updated = await fetchNFTData(contractAdhesion, Number(tokenId));
      setNftData(updated);

      refreshEvolution();

      setIsForSale(updated.forSale);
      setEvolutionRefreshFlag(prev => prev + 1);
    } catch (err) {
      console.error('Erreur lors de l\'achat du NFT:', err);
      alert('Erreur lors de l\'achat. Voir console.');
    }
  };


  // UI
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl" color="red.500">Une erreur est survenue... Tentez de recharger la page</Text>
      </Box>
    );
  }

  if (!nftData) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="2xl">NFT non trouvé.</Text>
      </Box>
    );
  }

  const isOwner = authAddress && authAddress.toLowerCase() === nftData.owner.toLowerCase();
  const isVendable = nftData.remainingTime.startsWith('0j'); // tu peux raffiner ce check
  const canPurchase = !isOwner && isForSale;
  const isready = nftData.remainingTime.startsWith('0j');

  // ET dans le JSX :
  const evolutionHistory = nftData
    ? buildEvolutionHistory(nftData)
    : [];

    const currentImage =
  evolutionHistory.length > 0
    ? evolutionHistory[evolutionHistory.length - 1].image
    : nftData.image;

  return (
    <Box
      textAlign="center"
      mt={10}
      p={6}
      maxW="100vw"
      overflowX="hidden"
    >      <Heading as="h1" fontSize="3xl" mb={6}>
        Carte d'adhésion de {nftData.name}
      </Heading>

      <Image
        src={nftData.image || '/fallback-image.png'}
        alt={nftData.name}
        maxWidth="400px"
        mx="auto"
        mb={6}
      />

      <Tabs variant="enclosed" colorScheme="teal">
        <TabList>
          <Tab>Détails</Tab>
          {isOwner && isVendable && <Tab>Mise en vente</Tab>}
          {isOwner && <Tab>Mise à jour</Tab>}
          {!isOwner && canPurchase && <Tab>Achat</Tab>}
          {isOwner && <Tab>Évolutions</Tab>}
        </TabList>

        <TabPanels>
          {/* Détails */}
          <TabPanel>
            <VStack spacing={4} alignItems="start" mb={6}>
              <Text fontSize="lg"><strong>Nom :</strong> {nftData.name}</Text>
              <Text fontSize="lg"><strong>Adresse du propriétaire :</strong> <CopyableAddress address={nftData.owner}/> </Text>

              <Text fontSize="lg">
                <strong>Rôle :</strong> {roleLabels[roles[nftData.role]] || 'Inconnu'}
              </Text>
              <Text fontSize="lg"><strong>Bio :</strong> {nftData.bio}</Text>
              {isForSale && (
                <Text fontSize="lg">
                  <strong>Prix :</strong> {nftData.price} ETH
                </Text>
              )}
              <Text fontSize="lg"><strong>Durée restante d'adhésion :</strong> {nftData.remainingTime}</Text>
              <Text fontSize="lg"><strong>Soit le :</strong> {nftData.fin}</Text>
              <Text>
                <strong>Niveau actuel :</strong>{" "}
                {membershipInfo ? membershipInfo.level : "—"}
              </Text>
              <Divider my={4} />
              // Remplace ton ancien historique par :
              {evolutionHistory.length > 0 && (
                <EvolutionHistoryTimeline evolutionHistory={evolutionHistory} />
              )}


              {isOwner && (
                <Button colorScheme="blue" mt={4} onClick={handleRenewMembership}>
                  Renouveler adhésion
                </Button>
              )}

              <Divider my={6} borderColor="purple.700" w="95%" mx="auto" />

              {nftData && nftData.owner && <PublicProfile address={nftData.owner} />}
            </VStack>
          </TabPanel>

          {/* Mise en vente */}
          {isOwner && isVendable && (
            <TabPanel>
              <FormControl mt={4}>
                <FormLabel htmlFor="price">Prix pour mise en vente</FormLabel>
                <Input
                  id="price"
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ex: 0.01"
                />
                <Button
                isDisabled={!isManualEvolveReady}
                colorScheme="teal" mt={4} onClick={handleListForSale}>
                  Mettre en vente
                </Button>
              </FormControl>
            </TabPanel>
          )}

          {/* Mise à jour */}
          {isOwner && (
            <TabPanel>
              <FormControl mt={4}>
                <FormLabel htmlFor="name">Nom</FormLabel>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Entrez votre nom"
                />
                <FormLabel htmlFor="bio">Biographie</FormLabel>
                <Input
                  id="bio"
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Entrez votre biographie"
                />
                <Button colorScheme="blue" mt={4} onClick={handleUpdateInfo}>
                  Mettre à jour
                </Button>
              </FormControl>
            </TabPanel>
          )}

          {/* Achat */}
          {!isOwner && canPurchase && (
            <TabPanel>
              <Button colorScheme="green" mt={4} onClick={handlePurchase}>
                Acheter ce NFT
              </Button>
            </TabPanel>
          )}

          {/* Évolutions */}
          {isOwner && (
            <TabPanel>
              <Heading as="h2" fontSize="xl" mb={4}>Évolution du badge</Heading>

              {membershipInfo ? (
                <VStack align="start" spacing={3}>
                <Text>
                  <strong>Niveau actuel :</strong>{" "}
                  {membershipInfo ? membershipInfo.level : "Chargement..."}
                </Text>
                  <Text><strong>Auto-évolution :</strong> {membershipInfo.autoEvolve ? "Oui" : "Non"}</Text>
                  <Text><strong>Années cumulées :</strong> {membershipInfo.totalYears}</Text>
                  <Text><strong>Début de ce niveau :</strong> {formatDateTime(membershipInfo.startTimestamp)}</Text>
                  <Text><strong>Expiration actuelle :</strong> {formatDateTime(membershipInfo.expirationTimestamp)}</Text>
                  <Text><strong>État :</strong> {membershipInfo.locked ? "Verrouillé" : "Ouvert"}</Text>

                  <Divider my={4} />

                  <Text>
                    <strong>Prochaine étape :</strong>{" "}
                    {membershipInfo.level < 3 ? `Niveau ${membershipInfo.level + 1}` : "Niveau max atteint"}
                  </Text>
                  <Text><strong>Prêt à évoluer :</strong> {isready ? "Oui" : "Pas encore"}</Text>
                  <Text><strong>Coût de l'évolution :</strong> {evolvePriceEth} ETH</Text>

                  {membershipInfo.level < 3 && (
                    <>
                      <Button
                        colorScheme="purple"
                        mt={2}
                        //isDisabled={!isready}
                        onClick={prepareEvolution}
                        isLoading={isUploadingEvolve}
                      >
                        Préparer l’image d’évolution
                      </Button>

                      {previewImageUrl && (
                        <>
                          <Text mt={2}>Aperçu de la prochaine forme :</Text>
                          <Image
                            src={previewImageUrl}
                            alt="Prévisualisation évolution"
                            maxW="300px"
                            borderRadius="md"
                          />
                        </>
                      )}

                      <Button
                        colorScheme="teal"
                        mt={4}
                        onClick={evolve}
                        isDisabled={!isManualEvolveReady || !evolveIpfsUrl}
                        isLoading={isEvolving}
                        loadingText="Évolution en cours..."
                      >
                        Faire évoluer le badge
                      </Button>

                    </>
                  )}

                </VStack>
              ) : (
                <Text>Chargement des informations d'évolution…</Text>
              )}
            </TabPanel>

          )}
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default TokenPage;
