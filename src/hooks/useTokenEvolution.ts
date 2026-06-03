// hooks/useTokenEvolution.ts — full on-chain, no IPFS
import { useState, useEffect, useCallback } from "react";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import Web3 from "web3";
import ABI from "../components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import { useRouter } from "next/router";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
  isAnnual: boolean;
}

interface PendingInsect {
  insectKey: string;
  displayName: string;
  family: string;
  imageUrl: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTokenEvolution = ({
  contractAddress,
  tokenId,
  currentFamily,
  onMetadataLoaded,
}: {
  contractAddress: string;
  tokenId: number | string | undefined;
  walletAddress?: string;   // ignoré — on utilise useAuth() en interne
  currentImage?: string;    // legacy compat
  currentName?: string;     // legacy compat
  currentBio?: string;      // legacy compat
  currentRoleLabel?: string; // legacy compat
  currentFamily?: string;   // famille actuelle pour sélectionner l'insecte suivant
  onMetadataLoaded?: (meta: any) => void;
}) => {
  const [membershipInfo, setMembershipInfo]   = useState<MembershipInfo | null>(null);
  const [evolvePriceEth, setEvolvePriceEth]   = useState(0);
  const [levelDuration, setLevelDuration]     = useState(0); // durée minimale au niveau courant (secondes)
  const [isEvolving, setIsEvolving]           = useState(false);
  const [pendingInsect, setPendingInsect]     = useState<PendingInsect | null>(null);

  const { address: account, web3, isAuthenticated } = useAuth();
  const router = useRouter();

  // ── 1. Lire membershipInfo + prix d'évolution (ethers.js + Moralis RPC) ───
  useEffect(() => {
    if (!contractAddress || tokenId === undefined) return;

    const fetchInfo = async () => {
      try {
        const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
        const contract = new EthersContract(contractAddress, ABI, provider);

        // FIX: était contract.methods.getMembershipInfo(tokenId).call() via Web3
        //      → remplacé par le getter public membershipInfo(uint256) via ethers.js
        const raw = await contract.membershipInfo(Number(tokenId));

        const info: MembershipInfo = {
          level:               Number(raw.level),
          autoEvolve:          Boolean(raw.autoEvolve),
          startTimestamp:      Number(raw.startTimestamp),
          expirationTimestamp: Number(raw.expirationTimestamp),
          totalYears:          Number(raw.totalYears),
          locked:              Boolean(raw.locked),
          isEgg:               Boolean(raw.isEgg),
          isAnnual:            Boolean(raw.isAnnual),
        };
        setMembershipInfo(info);

        // Prix d'évolution + durée minimale — uniquement pour les tokens non-œuf en dessous du niveau max
        if (!info.isEgg && info.level < 3) {
          try {
            const [basePriceWei, dur] = await Promise.all([
              contract.baseEvolvePrice(info.level),
              contract.levelDurations(info.level),
            ]);
            let finalPrice = Number(basePriceWei);
            // Réduction pour les membres fidèles sans auto-évolution
            if (!info.autoEvolve && info.totalYears >= 1) {
              finalPrice = Math.floor(finalPrice / 10);
            }
            setEvolvePriceEth(finalPrice / 1e18);
            setLevelDuration(Number(dur));
          } catch (e) {
            console.warn("[useTokenEvolution] baseEvolvePrice/levelDurations failed:", e);
            setEvolvePriceEth(0);
          }
        }
      } catch (e) {
        console.error("[useTokenEvolution] fetchInfo error:", e);
        setMembershipInfo({
          level: 0, autoEvolve: false, startTimestamp: 0,
          expirationTimestamp: 0, totalYears: 0,
          locked: false, isEgg: false, isAnnual: false,
        });
      }
    };

    fetchInfo();
  }, [contractAddress, tokenId]);

  // ── 2. Pré-charger l'insecte suivant (preview + params tx) ────────────────
  //    Requiert : membershipInfo (niveau courant) + account
  useEffect(() => {
    if (!membershipInfo || !account) return;
    if (membershipInfo.isEgg || membershipInfo.level >= 3) return; // pas d'évolution possible

    const fetchPendingInsect = async () => {
      try {
        const url =
          `/api/token/next-evolution` +
          `?currentLevel=${membershipInfo.level}` +
          `&wallet=${account}` +
          `&tokenId=${tokenId ?? ""}` +
          `&reroll=0`;

        const r = await fetch(url);
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(err.error ?? `HTTP ${r.status}`);
        }
        const d = await r.json();
        setPendingInsect({
          insectKey:   String(d.insectKey),
          displayName: String(d.displayName),
          family:      String(d.family),
          imageUrl:    String(d.imageUrl),
        });
      } catch (e: any) {
        // Non-bloquant — on peut évoluer sans preview (fetch au moment du clic)
        console.warn("[useTokenEvolution] fetch pending insect failed:", e.message);
      }
    };

    fetchPendingInsect();
  }, [membershipInfo?.level, membershipInfo?.isEgg, account, tokenId]);

  // ── 3. Évoluer on-chain ───────────────────────────────────────────────────
  const evolve = useCallback(async () => {
    if (!contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }
    if (!membershipInfo) return;

    // ── Guard : vérification côté client avant d'appeler le contrat ──────────
    if (levelDuration > 0) {
      const now = Math.floor(Date.now() / 1000);
      const readyAt = membershipInfo.startTimestamp + levelDuration;
      if (now < readyAt) {
        const daysLeft = Math.ceil((readyAt - now) / 86400);
        throw new Error(
          `Durée minimum non écoulée. Encore ${daysLeft} jour${daysLeft > 1 ? "s" : ""} avant l'évolution.`
        );
      }
    }

    setIsEvolving(true);

    try {
      // Récupérer le prochain insecte si le pré-chargement a échoué
      let insect = pendingInsect;
      if (!insect) {
        const url =
          `/api/token/next-evolution` +
          `?currentLevel=${membershipInfo.level}` +
          `&wallet=${account}` +
          `&tokenId=${tokenId ?? ""}` +
          `&reroll=0`;

        const r = await fetch(url);
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
          throw new Error(err.error ?? "Impossible de sélectionner le prochain insecte");
        }
        const d = await r.json();
        insect = {
          insectKey:   String(d.insectKey),
          displayName: String(d.displayName),
          family:      String(d.family),
          imageUrl:    String(d.imageUrl),
        };
        setPendingInsect(insect);
      }

      // ── Upload du GIF du NOUVEL insecte AVANT d'appeler evolve() ────────────
      // Sans ça, tokenURI() retournerait une image vide après évolution
      // (InsectImageStorage.generateTokenURI retourne "" si keyHash inconnu).
      const uploadRes = await fetch("/api/token/upload-insect-relayer-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insectKey: insect.insectKey }),
      });
      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => ({}));
        throw new Error(
          uploadErr.error ?? `Erreur upload image insecte évolué (HTTP ${uploadRes.status})`
        );
      }

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      // FIX: 4 paramètres requis — tokenId + insectKey + displayName + family
      const receipt = await contract.methods
        .evolve(tokenId, insect.insectKey, insect.displayName, insect.family)
        .send({
          from: account,
          value: web3.utils.toWei(evolvePriceEth.toString(), "ether"),
          gasPrice: gasPrice.toString(),
        });

      // Évolution in-place : le tokenId ne change pas.
      setPendingInsect(null);

      // Purger le cache serveur (nouvelle image + nouveau niveau)
      try {
        await fetch("/api/token/invalidate-insect-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: account }),
        });
      } catch {}

      // Notifier InsectSelector + Header : cache sessionStorage → re-fetch avec bust=1
      try { window.dispatchEvent(new CustomEvent("RESCOE_DATA_CHANGED")); } catch {}

      // La navigation/refresh est gérée par l'appelant via onEvolutionSuccess()
      // → ne pas faire router.push ici (le tokenId est identique avant/après).
    } catch (e: any) {
      console.error("[useTokenEvolution] evolve error:", e);
      throw e; // ré-émet pour que l'appelant puisse afficher le message
    } finally {
      setIsEvolving(false);
    }
  }, [
    contractAddress, tokenId, membershipInfo, evolvePriceEth, levelDuration,
    account, web3, isAuthenticated, pendingInsect,
  ]);

  // ── 4. Éclore un œuf on-chain (legacy — preferably use useHatchEgg) ───────
  const hatchEgg = useCallback(async () => {
    if (!contractAddress || tokenId === undefined) return;
    if (!isAuthenticated || !account || !web3) {
      alert("Connexion requise");
      return;
    }

    setIsEvolving(true);

    try {
      // Pour l'œuf : niveau 0, déterministe par wallet
      const r = await fetch(`/api/token/generate-onchain-uri?wallet=${account}&reroll=0`);
      if (!r.ok) throw new Error("Impossible de sélectionner un insecte pour l'éclosion");
      const d = await r.json();

      // ── Upload du GIF de l'insecte éclos AVANT d'appeler hatchEgg() ─────────
      // Même raison que pour evolve() : sans ça tokenURI retourne image vide.
      const uploadRes = await fetch("/api/token/upload-insect-relayer-v3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insectKey: String(d.insectName) }),
      });
      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.json().catch(() => ({}));
        throw new Error(
          uploadErr.error ?? `Erreur upload image insecte éclos (HTTP ${uploadRes.status})`
        );
      }

      const gasPrice = await web3.eth.getGasPrice();
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      // FIX: 4 paramètres requis — eggId + insectKey + displayName + family
      const receipt = await contract.methods
        .hatchEgg(tokenId, String(d.insectName), String(d.displayName), String(d.family))
        .send({ from: account, value: "0", gasPrice: gasPrice.toString() });

      // Purger le cache serveur + sessionStorage InsectSelector
      try {
        await fetch("/api/token/invalidate-insect-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: account }),
        });
      } catch {}
      try {
        Object.keys(sessionStorage)
          .filter(k => k.startsWith("insect_data_"))
          .forEach(k => sessionStorage.removeItem(k));
      } catch {}
      try { window.dispatchEvent(new CustomEvent("RESCOE_DATA_CHANGED")); } catch {}

      let newTokenId: string = (Number(tokenId) + 1).toString();
      if (receipt.events?.LevelEvolved?.returnValues?.tokenId) {
        newTokenId = receipt.events.LevelEvolved.returnValues.tokenId.toString();
      }

      router.push(`/AdhesionId/${contractAddress}/${newTokenId}`);
    } catch (e: any) {
      console.error("[useTokenEvolution] hatchEgg error:", e);
      throw e;
    } finally {
      setIsEvolving(false);
    }
  }, [contractAddress, tokenId, account, web3, isAuthenticated, router]);

  const updateCurrentMetadata = useCallback(
    (metadata: any) => { onMetadataLoaded?.(metadata); },
    [onMetadataLoaded]
  );

  // Prêt à évoluer ? (temps écoulé + niveau < max + non-œuf + non-locked)
  const isEvolutionReady = !!membershipInfo &&
    !membershipInfo.isEgg &&
    membershipInfo.level < 3 &&
    !membershipInfo.locked &&
    (levelDuration === 0 ||
      Math.floor(Date.now() / 1000) >= membershipInfo.startTimestamp + levelDuration);

  return {
    membershipInfo,
    evolvePriceEth,
    hatchPriceEth: 0,
    isEvolving,
    isEgg: membershipInfo?.isEgg ?? false,
    isEvolutionReady,
    /** Durée minimale au niveau courant (secondes) — 0 tant que non chargé */
    levelDuration,
    /** URL locale pour preview de l'insecte suivant */
    previewImageUrl: pendingInsect?.imageUrl ?? null,
    // Champs legacy (compatibilité EvolutionTab)
    isManualEvolveReady:  false,
    isUploadingEvolve:    false,
    evolveImageUri:       null,
    evolveMetadataUri:    null,
    getReadyState:        () => ({ isReady: false, metadataUri: null, imageUri: null }),
    prepareEvolution:     async () => ({ imageUri: null, metadataUri: null, isReady: false }),
    refreshEvolution:     () => {},
    evolve,
    hatchEgg,
    updateCurrentMetadata,
  };
};
