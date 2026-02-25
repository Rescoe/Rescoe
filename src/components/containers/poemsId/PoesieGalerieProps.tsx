import React, { useState, useEffect } from "react";
import { Box, Spinner } from "@chakra-ui/react";
import { JsonRpcProvider, Contract, BigNumberish } from "ethers";
import { useAuth } from "../../../utils/authContext";
import TextCard from "../galerie/TextCard";
import ABI from '../../../components/ABI/HaikuEditions.json';
import useEthToEur from "../../../hooks/useEuro";

interface PoetryGalleryProps {
  collectionAddress: string;
}

interface Poem {
  tokenId: string;
  poemText: string;
  creatorAddress: string;
  totalEditions: string;
  price: string;
  priceEur: string;  // <-- ajouté
  mintContractAddress: string;
  totalMinted: string;
  availableEditions: string;
  isForSale: boolean;
  tokenIdsForSale?: number[];
};

const PoetryGallery: React.FC<PoetryGalleryProps> = ({ collectionAddress }) => {
  const [poems, setPoems] = useState<Poem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { web3, address } = useAuth();

  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
  const contract = new Contract(collectionAddress, ABI, provider);

  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();




  useEffect(() => {
    const loadPoems = async () => {
      setIsLoading(true);
      try {
        const uniqueHaikuCount: BigNumberish = await contract.getLastUniqueHaikusMinted();


        const poemsData: Poem[] = await Promise.all(
          Array.from({ length: Number(uniqueHaikuCount) }, (_, i) => i).map(async (uniqueHaikuId) => {
            const [firstTokenId, nombreHaikusParSerie] = await contract.getHaikuInfoUnique(uniqueHaikuId);
            const availableEditions = await contract.getRemainingEditions(uniqueHaikuId);
            const tokenDetails = await contract.getTokenFullDetails(firstTokenId);

            const priceEur = convertEthToEur(tokenDetails.currentPrice.toString());

            // ⭐ IMPORTANT — même logique que galerie
            const tokenIdsForSale = await fetchTokenIdsForSale(
              contract,
              Number(firstTokenId),
              Number(nombreHaikusParSerie)
            );

            return {
              tokenId: firstTokenId.toString(),
              poemText: tokenDetails.haiku_,
              creatorAddress: await contract.owner(),
              totalEditions: nombreHaikusParSerie.toString(),
              mintContractAddress: collectionAddress,
              price: tokenDetails.currentPrice.toString(),
              priceEur: priceEur ? priceEur.toFixed(2) : "0", // €
              totalMinted: (Number(nombreHaikusParSerie) - Number(availableEditions)).toString(),
              availableEditions: availableEditions.toString(),
              isForSale: tokenIdsForSale.length > 0,
              tokenIdsForSale,
            };
          })
        );

        console.log(poemsData);

        setPoems(poemsData);
      } catch (err) {
        console.error("Erreur fetchPoems :", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPoems();
  }, [collectionAddress]);

  const fetchTokenIdsForSale = async (
    collectionContract: Contract,
    premierIDDeLaSerie: number,
    nombreHaikusParSerie: number
  ): Promise<number[]> => {
    const tokenIdsForSale: number[] = [];

    for (let id = premierIDDeLaSerie; id < premierIDDeLaSerie + nombreHaikusParSerie; id++) {
      console.log(nombreHaikusParSerie);
      const forSale: boolean = await collectionContract.isNFTForSale(id);
      if (forSale) {
        tokenIdsForSale.push(id);
      }
    }

    return tokenIdsForSale;
  };


  // Fonction d'achat
  const handleBuy = async (tokenId: string) => {
    if (!web3 || !address) {
      //console.log("Utilisateur non connecté");
      return;
    }
    try {
      const tx = await contract.buyToken(tokenId, { from: address });
      await tx.wait();
      //console.log("Token acheté avec succès !", tokenId);
      // Optionnel: Recharger les poèmes ou mettre à jour l'état
    } catch (error) {
      console.error("Erreur lors de l'achat du token:", error);
    }
  };


  return (
    <Box>
      {isLoading ? (
        <Spinner />
      ) : (
        poems.map((poem) => (  // ✅ poem défini ICI dans .map()
          <TextCard
            key={poem.tokenId}
            nft={poem}
            showBuyButton={poem.isForSale}  // ✅ Dynamique
            onBuy={handleBuy}  // ✅ Direct (1 paramètre)
          />
        ))
      )}
    </Box>
  );
};

export default PoetryGallery;
