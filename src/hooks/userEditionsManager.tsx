// src/components/UserEditionsManager.tsx
import React, { useEffect, useState } from "react";
import { Box, Button, Grid, Heading, Spinner, Text, VStack, HStack, useToast } from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import ABI from '../components/ABI/HaikuEditions.json';

type Edition = {
  tokenId: number;
  haikuUniqueId: number;
  owner: string;
  author?: string;
  text?: string;
  price?: string;
  mintDate?: any;
  isForSale?: boolean;
};

type Props = {
  mintContractAddress: string; // contrat HaikuEditions
  userAddress: string | null | undefined; // adresse à scanner (peut être address du wallet ou d'un profil)
  // handlers (tu peux passer tes fonctions existantes)
  onListForSale?: (tokenId: number, price: string) => Promise<any>;
  onRemoveFromSale?: (tokenId: number) => Promise<any>;
  onBurn?: (tokenId: number) => Promise<any>;
  onBuy?: (tokenId: number) => Promise<any>;
  pageSize?: number; // optionnel : batch size pour le scanning (par défaut 20)
};

export default function UserEditionsManager({
  mintContractAddress,
  userAddress,
  onListForSale,
  onRemoveFromSale,
  onBurn,
  onBuy,
  pageSize = 20,
}: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState<boolean>(false);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mintContractAddress || !userAddress) {
      setEditions([]);
      return;
    }

    let mounted = true;

    const fetchOwnedEditions = async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
        const contract = new Contract(mintContractAddress, ABI, provider);

        // 1) nombre de haiku uniques (ex: _HaikusUnique)
        const lastUnique = await contract.getLastUniqueHaikusMinted(); // retourne uint256
        const lastUniqueNumber = Number(lastUnique || 0);

        const foundEditions: Edition[] = [];

        // 2) pour chaque haiku unique, récupérer intervalle [firstTokenId, firstTokenId + editionsCount - 1]
        // puis parcourir les tokenIds et appeler ownerOf (en batch pour limiter la charge)
        for (let uniqueId = 0; uniqueId < lastUniqueNumber; uniqueId++) {
          // getHaikuInfoUnique(uniqueId) => [firstTokenId, editionsCount]
          const info = await contract.getHaikuInfoUnique(uniqueId);
          const firstTokenId = Number(info[0]);
          const editionsCount = Number(info[1]);

          // parcours en batch des tokenIds de cette série
          // on itère par "pages" de pageSize (ex: 20)
          for (let offset = 0; offset < editionsCount; offset += pageSize) {
            const batchIds = [];
            const upper = Math.min(offset + pageSize, editionsCount);
            for (let k = offset; k < upper; k++) {
              const tokenId = firstTokenId + k;
              batchIds.push(tokenId);
            }

            // pour chaque tokenId du batch on vérifie ownerOf
            // on utilise Promise.allSettled pour que les erreurs ponctuelles n'annulent pas tout
            const ownersResp = await Promise.allSettled(
              batchIds.map((tid) => contract.ownerOf(tid))
            );

            for (let i = 0; i < batchIds.length; i++) {
              const tid = batchIds[i];
              const resp = ownersResp[i];
              if (resp.status === "fulfilled") {
                const ownerAddress = String(resp.value).toLowerCase();
                if (ownerAddress === userAddress.toLowerCase()) {
                  // on récupère quelques infos utiles (getTokenFullDetails) mais attention coût RPC
                  // tu peux commenter pour éviter coûts si tu n'en as pas besoin
                  try {
                    const details = await contract.getTokenFullDetails(tid);
                    // details layout depends on your contract — on suppose le même que tu utilises ailleurs
                    const edition: Edition = {
                      tokenId: tid,
                      haikuUniqueId: uniqueId,
                      owner: ownerAddress,
                      author: details[7]?.toString() ?? undefined,
                      text: details[6] ?? undefined,
                      price: String(details.currentPrice ? formatIfBN(details.currentPrice) : ""), // helper
                      mintDate: details.mintDate ?? undefined,
                      isForSale: Boolean(details[3]),
                    };
                    foundEditions.push(edition);
                  } catch (err) {
                    // si getTokenFullDetails échoue on ajoute au moins tokenId et owner
                    foundEditions.push({
                      tokenId: tid,
                      haikuUniqueId: uniqueId,
                      owner: ownerAddress,
                    });
                  }
                }
              } else {
                // ownerOf may revert for non minted token; ignore silently
                // console.warn(`ownerOf failed for ${tid}`, resp.reason);
              }
            }

            // micro-yield pour éviter bloquer trop longtemps
            await new Promise((r) => setTimeout(r, 50));
          } // end offset loop
        } // end unique loop

        if (!mounted) return;
        // tri par tokenId asc
        foundEditions.sort((a, b) => a.tokenId - b.tokenId);
        setEditions(foundEditions);
      } catch (err: any) {
        console.error("Erreur fetchOwnedEditions:", err);
        setError(err?.message || "Erreur lors de la récupération des éditions");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOwnedEditions();

    return () => {
      mounted = false;
    };
  }, [mintContractAddress, userAddress, pageSize]);

  // petit helper pour normaliser BN -> string (évite imports lourds)
  function formatIfBN(val: any) {
    try {
      // ethers BigNumber -> toString()
      if (val && typeof val.toString === "function") return val.toString();
      return String(val);
    } catch {
      return String(val);
    }
  }

  const handleList = async (tid: number) => {
    if (!onListForSale) return toast({ title: "Handler manquant", status: "warning" });
    try {
      const price = prompt("Prix en ETH pour mettre en vente (ex: 0.1)");
      if (!price) return;
      await onListForSale(tid, price);
      toast({ title: `Token #${tid} mis en vente`, status: "success" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  const handleRemove = async (tid: number) => {
    if (!onRemoveFromSale) return toast({ title: "Handler manquant", status: "warning" });
    try {
      await onRemoveFromSale(tid);
      toast({ title: `Token #${tid} retiré de la vente`, status: "success" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  const handleBurnLocal = async (tid: number) => {
    if (!onBurn) return toast({ title: "Handler manquant", status: "warning" });
    if (!confirm(`Confirmer la destruction du token #${tid} ? Action irréversible.`)) return;
    try {
      await onBurn(tid);
      toast({ title: `Token #${tid} brûlé`, status: "success" });
      // retirer localement
      setEditions((prev) => prev.filter((e) => e.tokenId !== tid));
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  const handleBuyLocal = async (tid: number) => {
    if (!onBuy) return toast({ title: "Handler manquant", status: "warning" });
    try {
      await onBuy(tid);
      toast({ title: `Token #${tid} acheté`, status: "success" });
      // retirer localement
      setEditions((prev) => prev.filter((e) => e.tokenId !== tid));
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  if (loading) return <Spinner />;

  return (
    <Box w="full" p={4} borderWidth="1px" borderRadius="md">
      <Heading size="sm" mb={3}>
        Vos éditions dans cette collection
      </Heading>

      {error && <Text color="red.500">{error}</Text>}

      {editions.length === 0 ? (
        <Text>Aucune édition possédée trouvée pour cette adresse.</Text>
      ) : (
        <Grid templateColumns={{ base: "repeat(1, 1fr)", md: "repeat(2, 1fr)" }} gap={3}>
          {editions.map((ed) => (
            <Box key={ed.tokenId} p={3} borderWidth="1px" borderRadius="md">
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold">Token #{ed.tokenId}</Text>
                {ed.author && <Text fontSize="sm">Auteur: {ed.author}</Text>}
                {ed.text && <Text fontSize="sm" noOfLines={2}>{ed.text}</Text>}
                <Text fontSize="sm">Owner: {ed.owner}</Text>
                {ed.price && <Text fontSize="sm">Prix: {ed.price} wei</Text>}
                <HStack spacing={2} mt={2}>
                  {/* Achetable si isForSale (pour tout le monde) */}
                  <Button size="sm" onClick={() => handleBuyLocal(ed.tokenId)} isDisabled={!ed.isForSale}>
                    Acheter
                  </Button>

                  <Button size="sm" onClick={() => handleList(ed.tokenId)}>
                    Mettre en vente
                  </Button>

                  <Button size="sm" onClick={() => handleRemove(ed.tokenId)}>
                    Retirer de la vente
                  </Button>

                  <Button size="sm" colorScheme="red" onClick={() => handleBurnLocal(ed.tokenId)}>
                    Brûler
                  </Button>
                </HStack>
              </VStack>
            </Box>
          ))}
        </Grid>
      )}
    </Box>
  );
}
