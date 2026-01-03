// hooks/useHatchEgg.ts
import { useState, useCallback, useEffect } from "react";
import Web3 from "web3";
import { JsonRpcProvider, Contract as EthersContract } from "ethers";
import ABI from "@/components/ABI/ABIAdhesionEvolve.json";
import { useAuth } from "@/utils/authContext";
import axios from "axios";
import getRandomInsectGif from "@/utils/GenInsect25";
import colorProfilesJson from '@/data/gif_profiles_smart_colors.json';

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

interface EvolutionOption {
  id: number;
  imageUrl: string;
  displayName: string;
  attributes: any[];
  spriteName: string;
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

  // 🔍 1. VÉRIF ŒUF + DEBUG MAX
  const checkIsEggReady = useCallback(async (): Promise<TokenInfo | null> => {
    console.log("🔍 CHECK ŒUF #", eggTokenId);

    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS!);
    const contract = new EthersContract(contractAddress, ABI, provider);

    try {
      // CONTRAT RAW
      const infoRaw = await contract.getMembershipInfo(eggTokenId);
      console.log("🔍 RAW contrat:", infoRaw);

      const info: MembershipInfo = {
        level: Number(infoRaw.level),
        autoEvolve: Boolean(infoRaw.autoEvolve),
        startTimestamp: Number(infoRaw.startTimestamp),
        expirationTimestamp: Number(infoRaw.expirationTimestamp),
        totalYears: Number(infoRaw.totalYears),
        locked: Boolean(infoRaw.locked),
        isEgg: Boolean(infoRaw.isEgg)  // ← CLÉ !
      };

      console.log("🔍 PARSED info:", info);

      // VÉRIFS
      if (!info.isEgg) {
        const msg = `❌ #${eggTokenId} isEgg=${info.isEgg} (contrat)`;
        console.error(msg);
        setError(msg);
        return null;
      }

      if (info.level !== 0) {
        setError(`❌ Niveau ${info.level} (attendu 0)`);
        return null;
      }

      // TIMER 2min DEV
      const readyTime = info.startTimestamp + 120;
      const now = Date.now() / 1000;
      if (now < readyTime) {
        setError(`⏳ ${Math.ceil(readyTime - now)}s`);
        return null;
      }

      // METADATA BONUS
      const uri = await contract.tokenURI(eggTokenId);
      console.log("🔍 URI:", uri);

      const ipfsHash = uri.split("/").pop() || "";
      const res = await fetch(`/api/proxyPinata?ipfsHash=${ipfsHash}`);
      const metadata = await res.json();
      console.log("📄 Metadata:", metadata.name);

      console.log("✅ ŒUF PRÊT #", eggTokenId);
      return { tokenId: eggTokenId, membershipInfo: info, metadata };

    } catch (e: any) {
      console.error("🔥 CHECK ERROR:", e);
      setError(`Erreur contrat: ${e.message}`);
      return null;
    }
  }, [contractAddress, eggTokenId]);

  // 2. 3 ÉVOLUTIONS lvl0
  const generateEvolutionOptions = useCallback(async (family: string) => {
    console.log("🐛 Génération options:", family);

    const options: EvolutionOption[] = [];
    for (let i = 0; i < 3; i++) {
      const insectData = getRandomInsectGif(0);
      const spriteFilename = insectData.spriteName;
      const colorProfile = colorProfilesJson.families[family as FamilyKey]
        ?.find(p => p.filename === spriteFilename);

      options.push({
        id: i,
        imageUrl: insectData.imageUrl,
        displayName: insectData.display_name,
        attributes: insectData.attributes,
        spriteName: spriteFilename,
        family,
        colorProfile
      });
    }

    console.log("🐛 OPTIONS:", options.length);
    setEvolutionOptions(options);
    return options;
  }, []);

  // 3. URI lvl0 complète
  const generateInsectMetadata = useCallback(async (evolution: EvolutionOption) => {
    console.log("🛠️ Génération metadata:", evolution.displayName);

    const colorProfile = evolution.colorProfile;
    const fullAttributes = [
      ...evolution.attributes.filter(a => !["Niveau"].includes(a.trait_type)),
      { trait_type: "Niveau", value: 0 },
      { trait_type: "Famille", value: evolution.family },
      { trait_type: "DisplayName", value: evolution.displayName },
      { trait_type: "Lore", value: `Insecte F1 #${eggTokenId}` },
      { trait_type: "TotalFamille", value: 42 },
      { trait_type: "Sprite", value: evolution.spriteName },

      ...(colorProfile ? [
        { trait_type: "Couleur1", value: colorProfile.dominant_colors.hex[0] },
        { trait_type: "Couleur2", value: colorProfile.dominant_colors.hex[1] },
        // ... 15+ couleur traits
      ] : [])
    ];

    const metadata = {
      name: evolution.displayName,
      bio: `Insecte F1 éclos #${eggTokenId}`,
      description: `Insecte lvl0 prêt à évoluer`,
      image: evolution.imageUrl,
      level: 0,
      attributes: fullAttributes,
      evolutionHistory: [],
      eggOrigin: eggTokenId
    };

    const pinataJwt = process.env.NEXT_PUBLIC_PINATA_JWT!;
    const res = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      { headers: { Authorization: `Bearer ${pinataJwt}` } }
    );

    const uri = `https://purple-managerial-ermine-688.mypinata.cloud/ipfs/${res.data.IpfsHash}`;
    console.log("✅ URI lvl0:", uri);
    return uri;
  }, [eggTokenId]);

  // 4. HATCH
  const hatchEgg = useCallback(async () => {
    if (!account || !selectedEvolution) {
      setError("Sélectionnez évolution");
      return;
    }

    console.log("🚀 HATCH START");
    setIsHatching(true);
    setError(null);

    try {
      const eggInfo = await checkIsEggReady();
      if (!eggInfo) return;

      const insectUri = await generateInsectMetadata(selectedEvolution);

      const web3 = new Web3((window as any).ethereum);
      const contract = new web3.eth.Contract(ABI as any, contractAddress);

      const tx = await contract.methods
        .hatchEgg(eggTokenId, insectUri)
        .send({ from: account });

      console.log("🎉 HATCH OK:", tx.transactionHash);
      setTxHash(tx.transactionHash);

    } catch (e: any) {
      console.error("💥 HATCH:", e);
      setError(e.message);
    } finally {
      setIsHatching(false);
    }
  }, [account, contractAddress, eggTokenId, checkIsEggReady, generateInsectMetadata, selectedEvolution]);

  // 5. INIT
  useEffect(() => {
    console.log("🔄 INIT HATCH #", eggTokenId);
    const init = async () => {
      const eggInfo = await checkIsEggReady();
      if (eggInfo?.metadata) {
        const family = eggInfo.metadata.attributes?.find((a: any) => a.trait_type === "Famille")?.value || "Thalorydes";
        await generateEvolutionOptions(family);
      }
    };
    init();
  }, [checkIsEggReady, generateEvolutionOptions, eggTokenId]);

  return {
    isHatching, txHash, error,
    evolutionOptions, selectedEvolution, setSelectedEvolution,
    checkIsEggReady, hatchEgg,
    isReady: !!selectedEvolution && !error
  };
};
