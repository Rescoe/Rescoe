// hooks/useHatchEgg.ts
import { useState, useCallback, useEffect, useRef } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesion.json";
import { useAuth } from "@/utils/authContext";
import axios from "axios";
import getRandomInsectGif from "@/utils/GenInsect25";
import colorProfilesJson from "@/data/gif_profiles_smart_colors.json";

type FamilyKey = keyof typeof colorProfilesJson.families;

interface MembershipInfo {
  level: number;
  autoEvolve: boolean;
  startTimestamp: number;
  expirationTimestamp: number;
  totalYears: number;
  locked: boolean;
  isEgg: boolean;
}

interface TokenInfo {
  tokenId: number;
  membershipInfo: MembershipInfo;
  metadata?: any;
}

interface InsectData {
  imageUrl: string;
  display_name: string;
  attributes: any[];
  spriteName: string;
}

interface EvolutionOption {
  id: string;
  insect: InsectData;
  family: string;
  colorProfile?: any;
}

export const useHatchEgg = (contractAddress: string, eggTokenId: number) => {
  const { address: account } = useAuth();

  const [isHatching, setIsHatching] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [evolutionOptions, setEvolutionOptions] = useState<EvolutionOption[]>([]);
  const [selectedEvolution, setSelectedEvolution] = useState<EvolutionOption | null>(null);

  const eggInfoRef = useRef<TokenInfo | null>(null);

  /* ------------------------------------------------------------------ */
  /* 1. CHECK ŒUF                                                        */
  /* ------------------------------------------------------------------ */
  const checkIsEggReady = useCallback(async (): Promise<TokenInfo | null> => {
    if (eggInfoRef.current) return eggInfoRef.current;

    try {
      const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
      const contract = new EthersContract(contractAddress, ABI, provider);

      const raw = await contract.getMembershipInfo(eggTokenId);
      const TT = contract.getMembershipInfo(25);
      //console.log("coucou");
      //console.log(raw);
      //console.log(TT);

      const info: MembershipInfo = {
        level: Number(raw.level),
        autoEvolve: Boolean(raw.autoEvolve),
        startTimestamp: Number(raw.startTimestamp),
        expirationTimestamp: Number(raw.expirationTimestamp),
        totalYears: Number(raw.totalYears),
        locked: Boolean(raw.locked),
        isEgg: Boolean(raw.isEgg),
      };

      if (!info.isEgg) throw new Error("Token n'est pas un œuf");
      if (info.level !== 0) throw new Error("Niveau invalide");

      const readyTime = info.startTimestamp + 120;
      const now = Date.now() / 1000;
      if (now < readyTime) throw new Error(`Œuf pas encore prêt (${Math.ceil(readyTime - now)}s)`);

      const uri = await contract.tokenURI(eggTokenId);
      const ipfsHash = uri.split("/").pop();
      const res = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
      const metadata = await res.json();

      const tokenInfo = { tokenId: eggTokenId, membershipInfo: info, metadata };
      eggInfoRef.current = tokenInfo;

      return tokenInfo;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [contractAddress, eggTokenId]);

  /* ------------------------------------------------------------------ */
  /* 2. GÉNÉRATION DES 3 ÉVOLUTIONS (FIGÉES & UNIQUES)                   */
  /* ------------------------------------------------------------------ */
  const generateEvolutionOptions = useCallback((family: string) => {
    const options: EvolutionOption[] = [];
    const usedSprites = new Set<string>();

    while (options.length < 3) {

      const insect = getRandomInsectGif(0);

      if (usedSprites.has(insect.spriteName)) continue;
      usedSprites.add(insect.spriteName);

      const colorProfile =
        colorProfilesJson.families[family as FamilyKey]?.find(
          p => p.filename === insect.spriteName
        );

      options.push({
        id: crypto.randomUUID(),
        insect,
        family,
        colorProfile,
      });
    }

    setEvolutionOptions(options);
  }, [eggTokenId]);

  /* ------------------------------------------------------------------ */
  /* 3. MÉTADATA FINAL (1 SOURCE DE VÉRITÉ)                              */
  /* ------------------------------------------------------------------ */
  const generateInsectMetadata = useCallback(async (evolution: EvolutionOption) => {
    const { insect, family, colorProfile } = evolution;

    const attributes = [
      ...insect.attributes.filter(a => a.trait_type !== "Niveau"),
      { trait_type: "Niveau", value: 0 },
      { trait_type: "Famille", value: family },
      { trait_type: "DisplayName", value: insect.display_name },
      { trait_type: "Sprite", value: insect.spriteName },
      { trait_type: "Lore", value: `Insecte F1 #${eggTokenId}` },
      ...(colorProfile
        ? [
            { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
            { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
          ]
        : []),
    ];

    const metadata = {
      name: insect.display_name,
      description: "Insecte lvl0 éclos",
      image: insect.imageUrl,
      level: 0,
      attributes,
      evolutionHistory: [],
      eggOrigin: eggTokenId,
    };

    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      { headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT_OEUVRES}` } }
    );

    return `https://harlequin-key-marmot-538.mypinata.cloud/ipfs/${res.data.IpfsHash}`;
  }, [eggTokenId]);

  /* ------------------------------------------------------------------ */
  /* 4. HATCH                                                           */
  /* ------------------------------------------------------------------ */
  const hatchEgg = useCallback(async () => {
    if (!account || !selectedEvolution) {
      setError("Évolution non sélectionnée");
      return;
    }

    setIsHatching(true);
    setError(null);

    try {
      const egg = await checkIsEggReady();
      if (!egg) throw new Error("Œuf invalide");

      const insectUri = await generateInsectMetadata(selectedEvolution);

      const web3 = new Web3((window as any).ethereum);
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      const tx = await contract.methods
        .hatchEgg(eggTokenId, insectUri)
        .send({ from: account });

      setTxHash(tx.transactionHash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsHatching(false);
    }
  }, [
    account,
    contractAddress,
    eggTokenId,
    selectedEvolution,
    checkIsEggReady,
    generateInsectMetadata,
  ]);

  /* ------------------------------------------------------------------ */
  /* 5. INIT                                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    (async () => {
      const egg = await checkIsEggReady();
      if (!egg?.metadata) return;

      const family =
        egg.metadata.attributes?.find((a: any) => a.trait_type === "Famille")?.value
        || "Thalorydes";

      generateEvolutionOptions(family);
    })();
  }, [checkIsEggReady, generateEvolutionOptions]);

  return {
    isHatching,
    txHash,
    error,
    evolutionOptions,
    selectedEvolution,
    setSelectedEvolution,
    hatchEgg,
    isReady: !!selectedEvolution && !error,
  };
};
