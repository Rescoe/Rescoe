// src/components/UserEditionsManager.tsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  Heading,
  Spinner,
  Text,
  VStack,
  HStack,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Input,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  List,
  ListItem,
  Divider,
} from "@chakra-ui/react";
import { JsonRpcProvider, Contract } from "ethers";
import ABI from "../components/ABI/HaikuEditions.json";
import CopyableAddress from "./useCopyableAddress";
import useEthToEur from "./useEuro";

import { ethers } from "ethers";



type Edition = {
  tokenId: number;
  haikuUniqueId: number;
  owner: string;          // adresse (string)
  author?: string;        // adresse (string) — on résout ENS séparément
  text?: string;
  price?: string;
  priceEur?: string;   // EUR
  mintDate?: any;
  isForSale?: boolean;
};

type GroupedEdition = {
  haikuUniqueId: number;
  text?: string;
  author?: string; // adresse
  editions: Edition[];
};

type Props = {
  mintContractAddress: string;
  userAddress: string | null | undefined;
  onListForSale?: (tokenId: number, price: string) => Promise<any>;
  onRemoveFromSale?: (tokenId: number) => Promise<any>;
  onBurn?: (tokenId: number) => Promise<any>;
  onBuy?: (tokenId: number) => Promise<any>;
  pageSize?: number;
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
  const [ensMap, setEnsMap] = useState<Record<string, string>>({});

  // state pour modals
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const { convertEthToEur } = useEthToEur();


  const {
    isOpen: isListOpen,
    onOpen: onListOpen,
    onClose: onListClose,
  } = useDisclosure();
  const {
    isOpen: isBurnOpen,
    onOpen: onBurnOpen,
    onClose: onBurnClose,
  } = useDisclosure();
  const cancelRef = React.useRef<HTMLButtonElement>(null);

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
        const provider = new JsonRpcProvider(
          process.env.NEXT_PUBLIC_URL_SERVER_MORALIS
        );
        const contract = new Contract(mintContractAddress, ABI, provider);

        const lastUnique = await contract.getLastUniqueHaikusMinted();
        const lastUniqueNumber = Number(lastUnique || 0);

        const foundEditions: Edition[] = [];

        for (let uniqueId = 0; uniqueId < lastUniqueNumber; uniqueId++) {
          const info = await contract.getHaikuInfoUnique(uniqueId);
          const firstTokenId = Number(info[0]);
          const editionsCount = Number(info[1]);

          for (let offset = 0; offset < editionsCount; offset += pageSize) {
            const batchIds: number[] = [];
            const upper = Math.min(offset + pageSize, editionsCount);
            for (let k = offset; k < upper; k++) {
              batchIds.push(firstTokenId + k);
            }

            const ownersResp = await Promise.allSettled(
              batchIds.map((tid) => contract.ownerOf(tid))
            );

            for (let i = 0; i < batchIds.length; i++) {
              const tid = batchIds[i];
              const resp = ownersResp[i];
              if (resp.status === "fulfilled") {
                // owner returned as address string
                const ownerAddress = String(resp.value).toLowerCase();
                if (ownerAddress === userAddress.toLowerCase()) {
                  try {
                    const details = await contract.getTokenFullDetails(tid);
                    // détails : on garde l'adresse auteur (string), on ne met PAS l'objet ensMap
                    const authorAddress = details[7] ? String(details[7]).toLowerCase() : undefined;

                    const edition: Edition = {
                      tokenId: tid,
                      haikuUniqueId: uniqueId,
                      owner: ownerAddress,
                      author: authorAddress, // adresse — ENS resolved later
                      text: details[6] ?? undefined,
                      price: details.currentPrice ? ethers.formatEther(details.currentPrice) : "", // ETH directement
                      priceEur: details.currentPrice
  ? (convertEthToEur(Number(ethers.formatEther(details.currentPrice)))?.toFixed(2) ?? "")
  : "",
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
                // ownerOf may revert for non minted tokens — ignore
              }
            }

            // micro-yield pour éviter bloquer trop longtemps
            await new Promise((r) => setTimeout(r, 50));
          } // end offset loop
        } // end unique loop

        if (!mounted) return;

        // Tri et set
        foundEditions.sort((a, b) => a.tokenId - b.tokenId);

        // --- RÉSOLVE ENS EN LOT pour les adresses rencontrées (owners + authors) ---
        const addressesToResolve = new Set<string>();
        foundEditions.forEach((fe) => {
          if (fe.owner) addressesToResolve.add(fe.owner.toLowerCase());
          if (fe.author) addressesToResolve.add(fe.author.toLowerCase());
        });

        if (addressesToResolve.size > 0) {
          await fetchENSForAddresses(Array.from(addressesToResolve));
        }

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

  function formatIfBN(val: any) {
    try {
      if (val && typeof val.toString === "function") return val.toString();
      return String(val);
    } catch {
      return String(val);
    }
  }

  const openListModal = (tid: number) => {
    setSelectedToken(tid);
    setPriceInput("");
    onListOpen();
  };

  const confirmList = async () => {
    if (!onListForSale || selectedToken == null) return;
    try {
      await onListForSale(selectedToken, priceInput);
      toast({ title: `Token #${selectedToken} mis en vente`, status: "success" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    } finally {
      onListClose();
    }
  };

  const openBurnDialog = (tid: number) => {
    setSelectedToken(tid);
    onBurnOpen();
  };

  const confirmBurn = async () => {
    if (!onBurn || selectedToken == null) return;
    try {
      await onBurn(selectedToken);
      toast({ title: `Token #${selectedToken} brûlé`, status: "success" });
      setEditions((prev) => prev.filter((e) => e.tokenId !== selectedToken));
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    } finally {
      onBurnClose();
    }
  };

  const handleRemove = async (tid: number) => {
    if (!onRemoveFromSale) return;
    try {
      await onRemoveFromSale(tid);
      toast({ title: `Token #${tid} retiré de la vente`, status: "success" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  const handleBuyLocal = async (tid: number) => {
    if (!onBuy) return;
    try {
      await onBuy(tid);
      toast({ title: `Token #${tid} acheté`, status: "success" });
      setEditions((prev) => prev.filter((e) => e.tokenId !== tid));
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Erreur", status: "error" });
    }
  };

  const fetchENSForAddresses = async (addresses: string[]) => {
    try {
      const provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_URL_SERVER_MORALIS as string
      );
      const newMap: Record<string, string> = {};
      await Promise.all(
        addresses.map(async (addrRaw) => {
          if (!addrRaw) return;
          const addr = addrRaw.toLowerCase();
          // skip if already present
          if (ensMap[addr]) {
            newMap[addr] = ensMap[addr];
            return;
          }
          try {
            const name = await provider.lookupAddress(addr);
            newMap[addr] = name || formatAddress(addr);
          } catch {
            newMap[addr] = formatAddress(addr);
          }
        })
      );
      setEnsMap((prev) => ({ ...prev, ...newMap })); // merge
    } catch (err) {
      console.error("fetchENSForAddresses error:", err);
    }
  };

  if (loading) return <Spinner />;

  const formatAddress = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  // regroupement par haikuUniqueId
  const grouped: GroupedEdition[] = editions.reduce((acc, ed) => {
    let group = acc.find((g) => g.haikuUniqueId === ed.haikuUniqueId);
    if (!group) {
      group = {
        haikuUniqueId: ed.haikuUniqueId,
        text: ed.text,
        author: ed.author,
        editions: [],
      };
      acc.push(group);
    }
    group.editions.push(ed);
    return acc;
  }, [] as GroupedEdition[]);

  return (
    <Box w="full" p={4} borderWidth="1px" borderRadius="md" overflowX="hidden">
      <Heading size="sm" mb={3}>
        Vos poèmes dans cette collection :
      </Heading>

      {error && <Text color="red.500">{error}</Text>}

      {grouped.length === 0 ? (
        <Text>Aucune édition possédée trouvée.</Text>
      ) : (
        <Accordion allowMultiple w="100%">
          {grouped.map((group) => (
            <AccordionItem key={group.haikuUniqueId}>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Text fontWeight="bold">Haiku #{group.haikuUniqueId}</Text>
                    {group.author && (
                      <Text fontSize="sm">
                        Auteur: <CopyableAddress address={group.author} />
                      </Text>
                    )}

                    <Divider mt={2} />

                    {group.text && (
                      <Text fontSize="sm" noOfLines={3} whiteSpace="pre-line">
                        {group.text}
                      </Text>
                    )}

                    <Divider mt={2} />

                    <Text fontSize="xs" color="gray.500">
                      {group.editions.length} édition(s) possédée(s)
                    </Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>

              <AccordionPanel w="100%">
                <List spacing={2}>
                  {group.editions.map((ed) => (
                    <ListItem key={ed.tokenId}>
                      {/* ✅ conteneur scrollable si trop large */}
                      <Box w="100%" overflowX="auto">
                        <HStack
                          spacing={3}
                          align="center"
                          w="max-content" // permet le scroll horizontal
                          minW="100%" // occupe au moins la largeur de l’écran
                          flexWrap={{ base: "wrap", md: "nowrap" }} // wrap sur mobile
                        >
                          <Text>Edition #{ed.tokenId}</Text>

                          <VStack spacing={1}>
                            <Button
                              size="xs"
                              onClick={() => handleBuyLocal(ed.tokenId)}
                              isDisabled={!ed.isForSale}
                            >
                              Acheter
                            </Button>
                            <Button size="xs" onClick={() => openListModal(ed.tokenId)}>
                              Mettre en vente
                            </Button>

                            <Button size="xs" onClick={() => handleRemove(ed.tokenId)}>
                              Retirer de la vente
                            </Button>
                            <Button
                              size="xs"
                              colorScheme="red"
                              onClick={() => openBurnDialog(ed.tokenId)}
                            >
                              Brûler
                            </Button>
                          </VStack>
                        </HStack>
                      </Box>

                      <Text>
                        {ed.price
                          ? `• Prix : ${ed.price} ETH ${ed.priceEur ? `(~${ed.priceEur} €)` : ""}`
                          : null}
                        </Text>

                      <Divider mt={2} />
                    </ListItem>
                  ))}
                </List>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Modal mise en vente */}
      <Modal isOpen={isListOpen} onClose={onListClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Mettre en vente</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Prix en ETH (ex: 0.1)"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onListClose} mr={3}>
              Annuler
            </Button>
            <Button colorScheme="blue" onClick={confirmList}>
              Confirmer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Dialog burn */}
      <AlertDialog isOpen={isBurnOpen} leastDestructiveRef={cancelRef} onClose={onBurnClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Confirmation</AlertDialogHeader>
            <AlertDialogBody>
              Êtes-vous sûr de vouloir brûler le token #{selectedToken} ? Cette action est irréversible.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onBurnClose}>
                Annuler
              </Button>
              <Button colorScheme="red" onClick={confirmBurn} ml={3}>
                Brûler
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );


}
