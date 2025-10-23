// src/components/containers/ateliers/Ateliers.tsx

import React, { useEffect, useState } from "react";
import { Box, Button, useToast } from "@chakra-ui/react";
import Web3 from "web3";
import MessageEditions from '../../../ABI/MessageEditions.json';

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  timestamp: string;
  attachments: { url: string; content_type?: string }[];
}

const CONTRACT_ADDRESS = "0x65abd40953Bb7BF88e188d158ae171835825bbd0"; // Remplace par ton adresse ?

// Parse les règles d’un message atelier à partir du contenu (doit commencer par /atelier)
const parseAtelierRules = (content: string) => {
  if (!content.startsWith("/atelier")) return null;

  const prixMatch = content.match(/\/prix (\d+(\.\d+)?)/i);
  const placesMatch = content.match(/\/places (\d+)/i);
  const dureeMatch = content.match(/\/duree (\S+)/i);
  const splitMatch = content.match(/\/split (0x[a-fA-F0-9]{40})/i);

  return {
    price: prixMatch ? parseFloat(prixMatch[1]) : undefined,
    maxEditions: placesMatch ? parseInt(placesMatch[1], 10) : undefined,
    duration: dureeMatch ? dureeMatch[1] : undefined,
    splitAddress: splitMatch ? splitMatch[1] : undefined,
  };
};

const Ateliers: React.FC = () => {
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [limit, setLimit] = useState(20);
  const [mintingIds, setMintingIds] = useState<string[]>([]);
  const toast = useToast();

  // Remplacer par l’ID du channel Discord dédié aux ateliers
  const channelId = "1430956664936468540";

  // Convertit la durée écrite (ex: 7j, 3h, 15m) en secondes
  const parseDurationToSeconds = (dur: string | undefined): number => {
    if (!dur) return 7 * 24 * 3600; // 7 jours par défaut

    if (dur.endsWith("j")) return parseInt(dur) * 24 * 3600;
    if (dur.endsWith("h")) return parseInt(dur) * 3600;
    if (dur.endsWith("m")) return parseInt(dur) * 60;
    const val = parseInt(dur);
    return isNaN(val) ? 7 * 24 * 3600 : val;
  };

  // FETCH des messages Discord du channel Ateliers
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/channel/${channelId}?limit=${limit}`);
      const data = await res.json();
      const messagesArray = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
      setMessages(messagesArray);
    } catch (err) {
      console.error("Erreur fetch Discord:", err);
      toast({ title: "Erreur de chargement des ateliers", status: "error", duration: 4000, isClosable: true });
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [channelId, limit]);

  // Fonction de mint adaptée aux ateliers
  const mintAtelierTicket = async (msg: DiscordMessage) => {
    if (!(window as any).ethereum) {
      toast({ title: "Wallet non détecté", status: "error", duration: 4000, isClosable: true });
      return;
    }

    const atelierRules = parseAtelierRules(msg.content);
    if (!atelierRules) {
      toast({ title: "Ce message n'est pas un atelier", status: "warning", duration: 4000, isClosable: true });
      return;
    }

    try {
      setMintingIds((prev) => [...prev, msg.id]);

      const ethereum = (window as any).ethereum;
      await ethereum.request({ method: "eth_requestAccounts" });
      const web3 = new Web3(ethereum);
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      const contract = new web3.eth.Contract((MessageEditions as any).abi ?? MessageEditions, CONTRACT_ADDRESS);


      // Calcul keccak256 bytes32 du message ID Discord
      const keccak = web3.utils.soliditySha3({ type: "string", value: msg.id }) as string | null;
      if (!keccak) throw new Error("Impossible de calculer le keccak du message id");

      const priceInEth = atelierRules.price ?? 0.001;
      const priceInWei = web3.utils.toWei(priceInEth.toString(), "ether");
      const maxEditions = atelierRules.maxEditions ?? 10;
      const isOpenEdition = maxEditions === 0;
      const durationInSeconds = parseDurationToSeconds(atelierRules.duration);
      const splitAddress = atelierRules.splitAddress ?? account;

      const imageUrl = msg.attachments?.[0]?.url || ""; // ✅ correction ici

      const messageTimestamp = Math.floor(new Date(msg.timestamp).getTime() / 1000);

      // Estimation gas puis envoi de la transaction mint
      const gasEstimate = await contract.methods
        .mint(
          keccak,
          msg.content,
          priceInWei,
          splitAddress,
          imageUrl,
          messageTimestamp,
          durationInSeconds,
          maxEditions,
          isOpenEdition
        )
        .estimateGas({ from: account, value: priceInWei });

      await contract.methods
        .mint(
          keccak,
          msg.content,
          priceInWei,
          splitAddress,
          imageUrl,
          messageTimestamp,
          durationInSeconds,
          maxEditions,
          isOpenEdition
        )
        .send({ from: account, value: priceInWei, gas: gasEstimate.toString() });

      toast({ title: "Ticket réservé", description: `Atelier minté avec succès !`, status: "success", duration: 4000, isClosable: true });
    } catch (err: any) {
      console.error("Mint échoué:", err);
      toast({ title: "Erreur mint", description: err?.message || "Erreur inconnue", status: "error", duration: 6000, isClosable: true });
    } finally {
      setMintingIds((prev) => prev.filter((id) => id !== msg.id));
    }
  };

  return (
    <Box maxWidth="700px" mx="auto" p={4}>
      <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>Ateliers & Réservations</h2>

      {messages.length === 0 && <Box color="#bbb" textAlign="center">Chargement des ateliers...</Box>}

      {messages.map((msg) => {
        const atelier = parseAtelierRules(msg.content);
        if (!atelier) {
          // Message classique
          return (
            <Box
              key={msg.id}
              border="1px solid #333"
              borderRadius="12px"
              p={4}
              mb={4}
              bg="#111"
              color="#fff"
            >
              <Box display="flex" alignItems="center" mb={2}>
                <img
                  src={
                    msg.author.avatar
                      ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                      : "/default-avatar.png"
                  }
                  alt={msg.author.username}
                  style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
                />
                <strong>{msg.author.username}</strong>
                <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aaa" }}>
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
              </Box>
              <Box whiteSpace="pre-wrap" mb={2}>{msg.content}</Box>
              {msg.attachments.map(
                (att, i) =>
                  att.content_type?.startsWith("image/") && (
                    <Box key={i} mb={2}>
                      <img
                        src={att.url}
                        alt="attachment"
                        style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
                      />
                    </Box>
                  )
              )}
              {/* Pas de bouton mint ici */}
            </Box>
          );
        }

        // Carte Atelier
        return (
          <Box
            key={msg.id}
            border="1px solid #2c7a7b"
            borderRadius="12px"
            p={4}
            mb={4}
            bg="#023537"
            color="#cef2f2"
          >
            <Box display="flex" alignItems="center" mb={2}>
              <img
                src={
                  msg.author.avatar
                    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
                    : "/default-avatar.png"
                }
                alt={msg.author.username}
                style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
              />
              <strong>{msg.author.username}</strong>
              <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#aadada" }}>
                {new Date(msg.timestamp).toLocaleString()}
              </span>
            </Box>

            {/* Contenu : Affichage compact sans les lignes /param */}
            <Box whiteSpace="pre-wrap" mb={3} style={{ maxHeight: 100, overflowY: "auto", backgroundColor: "#014241", padding: 8, borderRadius: 6 }}>
              {msg.content.split("\n").filter(line => !line.startsWith("/")).join("\n")}
            </Box>

            <Box fontSize="sm" mb={3}>
              <strong>Prix :</strong> {atelier.price ? atelier.price + " ETH" : "Non défini"} <br />
              <strong>Places disponibles :</strong>{" "}
              {atelier.maxEditions ? atelier.maxEditions : "Illimité (open edition)"} <br />
              <strong>Durée :</strong> {atelier.duration ?? "7j (par défaut)"} <br />
              {atelier.splitAddress && (
                <>
                  <strong>Adresse de split :</strong> {atelier.splitAddress} <br />
                </>
              )}
            </Box>

            <Button
              size="sm"
              colorScheme="teal"
              onClick={() => mintAtelierTicket(msg)}
              isLoading={mintingIds.includes(msg.id)}
            >
              Réserver ce ticket
            </Button>
          </Box>
        );
      })}

      {messages.length >= limit && (
        <Button mt={2} onClick={() => setLimit((prev) => prev + 10)}>
          Voir plus
        </Button>
      )}
    </Box>
  );
};

export default Ateliers;
