// hooks/useDeployStudio.ts — État et logique du Deploy Studio
import { useState, useCallback, useEffect } from "react";

export interface DeployArg {
  type: "static" | "contract";
  value?: string;
  sourceBlockId?: string;
  /** Texte d'aide affiché en placeholder dans le champ input (ex: "0x... [_artist] artiste, bénéficiaire royalties") */
  hint?: string;
}

export interface ConstructorHint {
  type: string;
  name: string;
  hint: string;
}

export interface DeployBlock {
  id: string;
  contractName: string;
  args: DeployArg[];
  status: "idle" | "deploying" | "done" | "error";
  enabled: boolean;
  deployedAddress?: string;
  constructorHints?: ConstructorHint[];
}

export interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: string;
  timestamp: string;
}

// ── Pipeline Templates ─────────────────────────────────────────────────────

export interface PipelineTemplateBlock {
  contractName: string;
  args: {
    type: "static" | "contract";
    value?: string;
    sourceIndex?: number; // index into template blocks array
    hint?: string;
  }[];
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: "builtin" | "saved";
  blocks: PipelineTemplateBlock[];
}

export const BUILT_IN_TEMPLATES: PipelineTemplate[] = [
  // ─── Pipeline complète (8 contrats) ─────────────────────────────────────
  {
    id: "rescoe_pipeline_complete",
    name: "Rescoe — Pipeline complète (8 contrats)",
    description:
      "Déploiement manuel. Ordre imposé : InsectImageStorageV2 → AdhesionRescoe (3 args) → factories → MasterFactory → ResCoellectionManager → TokenManagement. Câblage post-deploy via Wiring Checker (setAuthorizedCallers, addAdhesionContract).",
    category: "builtin",
    blocks: [
      // 0 — InsectImageStorageV2(initialOwner)
      //     initialOwner = wallet qui paie le gas (RELAYER_PK) ou multisig asso
      {
        contractName: "InsectImageStorageV2",
        args: [
          {
            type: "static",
            hint: "0x... [initialOwner] owner du contrat — wallet RELAYER_PK recommandé (peut transférer après)",
            value: "",
          },
        ],
      },
      // 1 — AdhesionRescoe(initialOwner, _artist, _insectStorage)
      //     ⚠️ 3 arguments — _insectStorage auto-rempli depuis le déploiement [0]
      {
        contractName: "AdhesionRescoe",
        args: [
          {
            type: "static",
            hint: "0x... [initialOwner] owner du contrat — wallet RELAYER_PK recommandé",
            value: "",
          },
          {
            type: "static",
            hint: "0x... [_artist] artiste, bénéficiaire 1.99% royalties NFT (address(0) = asso reçoit tout)",
            value: "",
          },
          // arg 3 : _insectStorage = adresse InsectImageStorageV2 déployé en [0]
          { type: "contract", sourceIndex: 0 },
        ],
      },
      // 2 — ArtFactory(initialOwner, _adhesionContract, _association)
      //     _association = wallet royalties art (= owner asso, pas ResCoellectionManager)
      {
        contractName: "ArtFactory",
        args: [
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
          { type: "contract", sourceIndex: 1 }, // AdhesionRescoe → arg 2
          {
            type: "static",
            hint: "0x... [_association] wallet bénéficiaire royalties art (owner asso)",
            value: "",
          },
        ],
      },
      // 3 — PoetryFactory(initialOwner, _adhesionContract, _association)
      {
        contractName: "PoetryFactory",
        args: [
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
          { type: "contract", sourceIndex: 1 }, // AdhesionRescoe → arg 2
          {
            type: "static",
            hint: "0x... [_association] wallet bénéficiaire royalties poésie (owner asso)",
            value: "",
          },
        ],
      },
      // 4 — MessageFactory(initialOwner, _adhesionContract)
      {
        contractName: "MessageFactory",
        args: [
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
          { type: "contract", sourceIndex: 1 }, // AdhesionRescoe → arg 2
        ],
      },
      // 5 — MasterFactory(initialOwner, _artFactory, _poetryFactory, _messageFactory)
      {
        contractName: "MasterFactory",
        args: [
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
          { type: "contract", sourceIndex: 2 }, // ArtFactory → arg 2
          { type: "contract", sourceIndex: 3 }, // PoetryFactory → arg 3
          { type: "contract", sourceIndex: 4 }, // MessageFactory → arg 4
        ],
      },
      // 6 — ResCoellectionManager(initialOwner, factory_address)
      //     factory_address = adresse MasterFactory (pas 0x0 !)
      {
        contractName: "ResCoellectionManager",
        args: [
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
          { type: "contract", sourceIndex: 5 }, // MasterFactory → arg 2
        ],
      },
      // 7 — TokenManagement(_adhesionContract, initialOwner)
      //     ⚠️ Ordre inversé : arg 1 = AdhesionRescoe, arg 2 = owner
      {
        contractName: "TokenManagement",
        args: [
          { type: "contract", sourceIndex: 1 }, // AdhesionRescoe → arg 1
          { type: "static", hint: "0x... [initialOwner] owner", value: "" },
        ],
      },
    ],
  },

  // ─── Upgrade InsectStorage → V2 ──────────────────────────────────────────
  {
    id: "insect_storage_v2_upgrade",
    name: "⬆ Upgrade InsectStorage → V2",
    description:
      "Déploie uniquement InsectImageStorageV2. Après déploiement : (1) Wiring Checker → setInsectStorage(newAddr) sur AdhesionRescoe. (2) Mettre à jour NEXT_PUBLIC_INSECT_STORAGE dans Rescoe/.env. (3) Redémarrer npm run dev.",
    category: "builtin",
    blocks: [
      // InsectImageStorageV2(initialOwner)
      // initialOwner DOIT être le même wallet que RELAYER_PK
      // (= owner actuel d'AdhesionRescoe = celui qui peut appeler setInsectStorage)
      {
        contractName: "InsectImageStorageV2",
        args: [
          {
            type: "static",
            hint: "0x... [initialOwner] DOIT être le wallet RELAYER_PK — c'est lui qui appellera setInsectStorage sur AdhesionRescoe",
            value: "",
          },
        ],
      },
    ],
  },

  // ─── Upgrade InsectStorage → V3 ──────────────────────────────────────────
  {
    id: "insect_storage_v3_upgrade",
    name: "⬆ Upgrade InsectStorage → V3 (content-addressed + historique)",
    description:
      "Déploie InsectImageStorageV3 — images content-addressed (partage entre insectes), " +
      "getInsectAttrs/getInsectLore/getInsectIdentity on-chain, evolutionHistory embarqué dans tokenURI. " +
      "Rôles : initialOwner = vault asso (admin), uploader = RELAYER_PK (gas minimal, upload uniquement). " +
      "Après déploiement (appels depuis le vault asso) : " +
      "(1) setUploader(RELAYER_PK) — donne le droit d'upload au relayer. " +
      "(2) setAdhesionContract(AdhesionRescoe) — permet la lecture de l'historique. " +
      "(3) Mettre à jour NEXT_PUBLIC_INSECT_STORAGE_V3 dans .env. " +
      "(4) Lancer npx ts-node scripts/migrate-to-v3.ts (avec RELAYER_PK) pour migrer tous les insectes. " +
      "(5) Wiring Checker → setInsectStorage(adresseV3) sur AdhesionRescoe (depuis le vault asso).",
    category: "builtin",
    blocks: [
      {
        contractName: "InsectImageStorageV3",
        args: [
          {
            type: "static",
            hint: "0x... [initialOwner] vault de l'association (owner admin — peut appeler setUploader, setAdhesionContract, transferOwnership). PAS le RELAYER_PK.",
            value: "",
          },
        ],
      },
    ],
  },

  // ─── Adhésion seule ───────────────────────────────────────────────────────
  {
    id: "adhesion_only",
    name: "Adhésion seule (AdhesionRescoe)",
    description:
      "Déploie uniquement AdhesionRescoe. Utiliser address(0) pour _insectStorage si InsectImageStorageV2 pas encore déployé (configurable après via setInsectStorage).",
    category: "builtin",
    blocks: [
      // AdhesionRescoe(initialOwner, _artist, _insectStorage)
      {
        contractName: "AdhesionRescoe",
        args: [
          {
            type: "static",
            hint: "0x... [initialOwner] owner du contrat — wallet RELAYER_PK recommandé",
            value: "",
          },
          {
            type: "static",
            hint: "0x... [_artist] artiste, bénéficiaire 1.99% royalties (address(0) = asso reçoit tout)",
            value: "",
          },
          {
            type: "static",
            hint: "0x... [_insectStorage] adresse InsectImageStorageV2 (0x000...000 = configurer après via setInsectStorage)",
            value: "0x0000000000000000000000000000000000000000",
          },
        ],
      },
    ],
  },
];

const TEMPLATES_LS_KEY = "rescoe_deploy_templates";

function loadTemplatesFromLS(): PipelineTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEMPLATES_LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PipelineTemplate[];
  } catch {
    return [];
  }
}

function saveTemplatesToLS(templates: PipelineTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TEMPLATES_LS_KEY, JSON.stringify(templates));
}

// ── Full Relayer Pipeline ──────────────────────────────────────────────────

export interface FullPipelineResult {
  success: boolean;
  network?: string;
  owner?: string;
  artist?: string;
  relayer?: string;
  contracts?: Record<string, string>;
  error?: string;
  stdout?: string;
}

// ── Cost Estimation ────────────────────────────────────────────────────────

export interface EstimatedCost {
  gasTotal: bigint;
  ethCost: number;
  eurCost: number | null;
}

type Network = "hardhat" | "baseSepolia" | "base";
type DeployMode = "hardhat" | "metamask";

const BASE_PATH = "/api/admin/deploy";

const RPC_URLS: Record<Network, string> = {
  baseSepolia: "https://sepolia.base.org",
  base: "https://mainnet.base.org",
  hardhat: "http://localhost:8545",
};

export function useDeployStudio() {
  const [blocks, setBlocks] = useState<DeployBlock[]>([]);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>([]);
  const [availableContracts, setAvailableContracts] = useState<string[]>([]);
  const [network, setNetwork] = useState<Network>("baseSepolia");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [hardhatRunning, setHardhatRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Deploy mode
  const [deployMode, setDeployMode] = useState<DeployMode>("metamask");

  // Saved templates
  const [savedTemplates, setSavedTemplates] = useState<PipelineTemplate[]>([]);

  // Cost estimation
  const [estimatedCost, setEstimatedCost] = useState<EstimatedCost | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Full relayer pipeline
  const [isFullPipelineDeploying, setIsFullPipelineDeploying] = useState(false);
  const [fullPipelineResult, setFullPipelineResult] = useState<FullPipelineResult | null>(null);

  // Load saved templates from localStorage on mount
  useEffect(() => {
    setSavedTemplates(loadTemplatesFromLS());
  }, []);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("fr-FR");
    setLogs((prev) => [...prev.slice(-300), `[${ts}] ${msg}`]);
  }, []);

  // ── Nœud Hardhat ──────────────────────────────────────────────────────────
  const checkHardhatStatus = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_PATH}/hardhat/status`);
      const { running } = await r.json();
      setHardhatRunning(running);
    } catch {
      setHardhatRunning(false);
    }
  }, []);

  const startHardhat = useCallback(async () => {
    addLog("🔄 Démarrage nœud Hardhat local...");
    try {
      const r = await fetch(`${BASE_PATH}/hardhat/start`, { method: "POST" });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      addLog(`✅ Nœud démarré (PID ${data.pid})`);
      setTimeout(checkHardhatStatus, 2000);
    } catch (e: unknown) {
      addLog(`❌ Démarrage échoué : ${(e as Error).message}`);
    }
  }, [addLog, checkHardhatStatus]);

  const stopHardhat = useCallback(async () => {
    addLog("🛑 Arrêt nœud Hardhat...");
    try {
      await fetch(`${BASE_PATH}/hardhat/stop`, { method: "POST" });
      setHardhatRunning(false);
      addLog("✅ Nœud arrêté");
    } catch (e: unknown) {
      addLog(`❌ Arrêt échoué : ${(e as Error).message}`);
    }
  }, [addLog]);

  // ── Contrats disponibles ───────────────────────────────────────────────────
  const fetchAvailableContracts = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_PATH}/contracts/list`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setAvailableContracts(data.contracts ?? []);
      addLog(`📋 ${data.contracts?.length ?? 0} contrats disponibles`);
    } catch (e: unknown) {
      addLog(`⚠️ Liste contrats : ${(e as Error).message}`);
    }
  }, [addLog]);

  // ── Contrats déployés (persistés) ─────────────────────────────────────────
  const fetchDeployedContracts = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_PATH}/deployed`);
      const data = await r.json();
      setDeployedContracts(data.contracts ?? []);
    } catch {
      // ignoré silencieusement
    }
  }, []);

  const removeDeployedContract = useCallback(async (id: string) => {
    try {
      await fetch(`${BASE_PATH}/deployed`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDeployedContracts((prev) => prev.filter((c) => c.id !== id));
      addLog(`🗑️ Contrat supprimé de l'historique`);
    } catch (e: unknown) {
      addLog(`❌ Suppression : ${(e as Error).message}`);
    }
  }, [addLog]);

  const purgeAllContracts = useCallback(async () => {
    const ids = deployedContracts.map((c) => c.id);
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        await fetch(`${BASE_PATH}/deployed`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }
      setDeployedContracts([]);
      addLog(`🗑️ ${ids.length} contrat(s) purgé(s) de l'historique`);
    } catch (e: unknown) {
      addLog(`❌ Purge : ${(e as Error).message}`);
    }
  }, [deployedContracts, addLog]);

  // ── Compilation ───────────────────────────────────────────────────────────
  const compile = useCallback(async () => {
    setIsCompiling(true);
    addLog("🔨 Compilation Hardhat...");
    try {
      const r = await fetch(`${BASE_PATH}/contracts/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "global" }),
      });
      const data = await r.json();
      if (data.success) {
        addLog("✅ Compilation réussie");
        addLog(data.stdout?.split("\n").slice(-3).join(" | ") ?? "");
      } else {
        addLog(`❌ Erreur compilation`);
        addLog(data.stderr?.split("\n").filter(Boolean).slice(-5).join("\n") ?? data.error);
      }
      await fetchAvailableContracts();
    } catch (e: unknown) {
      addLog(`❌ ${(e as Error).message}`);
    } finally {
      setIsCompiling(false);
    }
  }, [addLog, fetchAvailableContracts]);

  // ── Blocs de déploiement ──────────────────────────────────────────────────
  const addBlock = useCallback(async (contractName: string) => {
    addLog(`🔍 Chargement ABI ${contractName}...`);
    let hints: ConstructorHint[] = [];
    try {
      const r = await fetch(
        `${BASE_PATH}/contracts/abi?name=${encodeURIComponent(contractName)}`
      );
      const data = await r.json();
      hints = data.argHints ?? [];
      addLog(`✅ ${contractName} : ${hints.length} arg(s) constructeur`);
    } catch {
      addLog(`⚠️ ABI non trouvé — le contrat est-il compilé ?`);
    }

    const args: DeployArg[] = hints.map((h) => ({
      type: "static",
      value: h.hint ?? "",
    }));

    const block: DeployBlock = {
      id: crypto.randomUUID(),
      contractName,
      args,
      status: "idle",
      enabled: true,
      constructorHints: hints,
    };

    setBlocks((prev) => [...prev, block]);
  }, [addLog]);

  const updateBlock = useCallback((updated: DeployBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const toggleBlock = useCallback((id: string, enabled: boolean) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, enabled } : b))
    );
  }, []);

  // ── Pipeline Templates ────────────────────────────────────────────────────

  const loadTemplate = useCallback(async (template: PipelineTemplate) => {
    addLog(`📂 Chargement template "${template.name}"...`);
    setBlocks([]);

    // First pass: create all blocks with static args; we'll patch contract refs after
    const newBlocks: DeployBlock[] = [];

    for (const tBlock of template.blocks) {
      let hints: ConstructorHint[] = [];
      try {
        const r = await fetch(
          `${BASE_PATH}/contracts/abi?name=${encodeURIComponent(tBlock.contractName)}`
        );
        const data = await r.json();
        hints = data.argHints ?? [];
      } catch {
        // continue without hints
      }

      const args: DeployArg[] = tBlock.args.map((tArg) => {
        if (tArg.type === "static") {
          return {
            type: "static",
            value: tArg.value ?? "",
            // Stocker le hint du template pour l'afficher en placeholder dans DeployBlock
            hint: tArg.hint,
          };
        }
        // contract ref — resolve sourceIndex to block id after all blocks are created
        return { type: "contract", sourceBlockId: "__placeholder__" };
      });

      const block: DeployBlock = {
        id: crypto.randomUUID(),
        contractName: tBlock.contractName,
        args,
        status: "idle",
        enabled: true,
        constructorHints: hints,
      };
      newBlocks.push(block);
    }

    // Second pass: resolve sourceIndex references to actual block UUIDs
    template.blocks.forEach((tBlock, blockIdx) => {
      tBlock.args.forEach((tArg, argIdx) => {
        if (tArg.type === "contract" && typeof tArg.sourceIndex === "number") {
          const sourceBlock = newBlocks[tArg.sourceIndex];
          if (sourceBlock) {
            newBlocks[blockIdx].args[argIdx] = {
              type: "contract",
              sourceBlockId: sourceBlock.id,
            };
          }
        }
      });
    });

    setBlocks(newBlocks);
    addLog(`✅ Template chargé : ${newBlocks.length} bloc(s)`);
  }, [addLog]);

  const saveCurrentPipeline = useCallback((name: string) => {
    if (!blocks.length) {
      addLog("⚠️ Aucun bloc à sauvegarder");
      return;
    }

    const templateBlocks: PipelineTemplateBlock[] = blocks.map((block) => ({
      contractName: block.contractName,
      args: block.args.map((arg) => {
        if (arg.type === "static") {
          return { type: "static" as const, value: arg.value ?? "" };
        }
        // Convert sourceBlockId back to sourceIndex
        const sourceIndex = blocks.findIndex((b) => b.id === arg.sourceBlockId);
        return { type: "contract" as const, sourceIndex: sourceIndex >= 0 ? sourceIndex : 0 };
      }),
    }));

    const newTemplate: PipelineTemplate = {
      id: crypto.randomUUID(),
      name,
      description: `Pipeline sauvegardée le ${new Date().toLocaleDateString("fr-FR")}`,
      category: "saved",
      blocks: templateBlocks,
    };

    setSavedTemplates((prev) => {
      const updated = [...prev, newTemplate];
      saveTemplatesToLS(updated);
      return updated;
    });

    addLog(`💾 Pipeline "${name}" sauvegardée`);
  }, [blocks, addLog]);

  const deleteTemplate = useCallback((id: string) => {
    setSavedTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveTemplatesToLS(updated);
      return updated;
    });
    addLog("🗑️ Template supprimé");
  }, [addLog]);

  // ── MetaMask Deploy ───────────────────────────────────────────────────────

  const deployWithMetaMask = useCallback(async (
    block: DeployBlock,
    resolvedArgs: string[]
  ): Promise<string> => {
    addLog(`🦊 MetaMask — récupération ABI ${block.contractName}...`);

    const abiRes = await fetch(
      `${BASE_PATH}/contracts/abi?name=${encodeURIComponent(block.contractName)}`
    );
    const abiData = await abiRes.json();
    if (!abiData.abi || !abiData.bytecode) {
      throw new Error(`ABI/bytecode introuvable pour ${block.contractName}`);
    }

    const { BrowserProvider, ContractFactory } = await import("ethers");

    const ethereum = (window as { ethereum?: unknown }).ethereum;
    if (!ethereum) throw new Error("MetaMask non détecté");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new BrowserProvider(ethereum as any);
    const signer = await provider.getSigner();

    addLog(`🦊 MetaMask — déploiement ${block.contractName} (confirmation requise)...`);
    const factory = new ContractFactory(abiData.abi, abiData.bytecode, signer);
    const contract = await factory.deploy(...resolvedArgs);

    addLog(`⏳ ${block.contractName} — attente confirmation blockchain...`);
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    return address;
  }, [addLog]);

  // ── Déploiement pipeline ──────────────────────────────────────────────────
  const deployPipeline = useCallback(async () => {
    const enabled = blocks.filter((b) => b.enabled);
    if (!enabled.length) {
      addLog("⚠️ Aucun bloc activé dans la pipeline");
      return;
    }

    setIsDeploying(true);
    addLog(
      `🚀 PIPELINE [${network}] [${deployMode}] : ${enabled.map((b) => b.contractName).join(" → ")}`
    );

    const resolved: Record<string, string> = {};

    for (const block of enabled) {
      addLog(`🔄 Déploiement ${block.contractName}...`);
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === block.id ? { ...b, status: "deploying" } : b
        )
      );

      try {
        const resolvedArgs = block.args.map((arg) => {
          if (arg.type === "static") return arg.value ?? "";
          return resolved[arg.sourceBlockId ?? ""] ?? "";
        });

        addLog(
          `📤 Args : [${resolvedArgs.map((a) => a.slice(0, 20) || '""').join(", ")}]`
        );

        let address: string;

        if (deployMode === "metamask") {
          address = await deployWithMetaMask(block, resolvedArgs);
        } else {
          // Hardhat script mode — existing API call
          const r = await fetch(`${BASE_PATH}/contracts/deploy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: block.contractName,
              args: resolvedArgs,
              mode: network,
            }),
          });

          const data = await r.json();
          if (!data.success || !data.address) {
            throw new Error(data.error ?? "Adresse manquante");
          }
          address = data.address;
        }

        resolved[block.id] = address;

        // Sauvegarder dans l'historique
        await fetch(`${BASE_PATH}/deployed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract: {
              name: block.contractName,
              address,
              network,
            },
          }),
        });

        setBlocks((prev) =>
          prev.map((b) =>
            b.id === block.id
              ? { ...b, status: "done", deployedAddress: address }
              : b
          )
        );

        addLog(`✅ ${block.contractName} → ${address}`);
        await fetchDeployedContracts();
      } catch (e: unknown) {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === block.id ? { ...b, status: "error" } : b
          )
        );
        addLog(`❌ ${block.contractName} : ${(e as Error).message}`);
        break;
      }
    }

    setIsDeploying(false);
    addLog("🏁 Pipeline terminée");
  }, [blocks, network, deployMode, addLog, fetchDeployedContracts, deployWithMetaMask]);

  // ── Pipeline complète via Relayer ─────────────────────────────────────────

  const deployFullPipeline = useCallback(
    async (ownerAddress: string, artistAddress: string) => {
      setIsFullPipelineDeploying(true);
      setFullPipelineResult(null);

      addLog("⚡ ═══════════════════════════════════════════");
      addLog(`⚡ PIPELINE COMPLÈTE RELAYER [${network}]`);
      addLog(`⚡ Owner  : ${ownerAddress}`);
      addLog(`⚡ Artist : ${artistAddress}`);
      addLog("⚡ ═══════════════════════════════════════════");

      try {
        const r = await fetch(`${BASE_PATH}/full-pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerAddress, artistAddress, network }),
        });

        const data: FullPipelineResult = await r.json();

        if (!data.success) {
          throw new Error(data.error ?? "Pipeline échouée (raison inconnue)");
        }

        setFullPipelineResult(data);
        addLog("✅ PIPELINE COMPLÈTE — tous les contrats déployés !");
        addLog(`   Relayer : ${data.relayer ?? "—"}`);
        addLog(`   Réseau  : ${data.network ?? network}`);
        if (data.contracts) {
          for (const [name, addr] of Object.entries(data.contracts)) {
            addLog(`   ✅ ${name.padEnd(25)} → ${addr}`);
          }
        }
        addLog("⚡ Propriété transférée à l'association ✅");

        await fetchDeployedContracts();
      } catch (e: unknown) {
        const msg = (e as Error).message;
        addLog(`❌ Pipeline complète : ${msg}`);
        setFullPipelineResult({ success: false, error: msg });
      } finally {
        setIsFullPipelineDeploying(false);
      }
    },
    [network, addLog, fetchDeployedContracts]
  );

  // ── Cost Estimation ───────────────────────────────────────────────────────

  const estimatePipelineCost = useCallback(async () => {
    const enabled = blocks.filter((b) => b.enabled);
    if (!enabled.length) {
      addLog("⚠️ Aucun bloc activé pour l'estimation");
      return;
    }

    setIsEstimating(true);
    setEstimatedCost(null);
    addLog("💰 Estimation du coût en cours...");

    try {
      let totalGas = 0n;

      for (const block of enabled) {
        const r = await fetch(
          `${BASE_PATH}/contracts/abi?name=${encodeURIComponent(block.contractName)}`
        );
        const data = await r.json();
        const bytecode: string = data.bytecode ?? "0x";

        // Istanbul/Berlin gas schedule for contract creation
        const codeBytes = BigInt((bytecode.length - 2) / 2);
        const gas = 32000n + codeBytes * 68n;
        totalGas += gas;
        addLog(`⛽ ${block.contractName} : ~${gas.toString()} gas`);
      }

      // Get gas price from network RPC
      const rpcUrl = RPC_URLS[network];
      const feeResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_gasPrice",
          params: [],
          id: 1,
        }),
      });
      const feeData = await feeResponse.json();
      const gasPriceHex: string = feeData.result ?? "0x1";
      const gasPrice = BigInt(gasPriceHex);

      const ethCost = Number(totalGas * gasPrice) / 1e18;

      // Try CoinGecko for EUR price
      let eurCost: number | null = null;
      try {
        const cgRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur"
        );
        const cgData = await cgRes.json();
        const eurPerEth: number = cgData?.ethereum?.eur ?? null;
        if (eurPerEth) {
          eurCost = ethCost * eurPerEth;
        }
      } catch {
        // CoinGecko unavailable, skip EUR
      }

      const result: EstimatedCost = { gasTotal: totalGas, ethCost, eurCost };
      setEstimatedCost(result);

      addLog(
        `💰 Estimation : ${totalGas.toString()} gas | ${ethCost.toFixed(6)} ETH${
          eurCost !== null ? ` | €${eurCost.toFixed(2)}` : ""
        }`
      );
    } catch (e: unknown) {
      addLog(`❌ Estimation échouée : ${(e as Error).message}`);
    } finally {
      setIsEstimating(false);
    }
  }, [blocks, network, addLog]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkHardhatStatus();
    fetchAvailableContracts();
    fetchDeployedContracts();

    const interval = setInterval(checkHardhatStatus, 10_000);
    return () => clearInterval(interval);
  }, [checkHardhatStatus, fetchAvailableContracts, fetchDeployedContracts]);

  return {
    // state
    blocks,
    deployedContracts,
    availableContracts,
    network,
    setNetwork,
    isDeploying,
    isCompiling,
    hardhatRunning,
    logs,
    deployMode,
    setDeployMode,
    // templates
    savedTemplates,
    loadTemplate,
    saveCurrentPipeline,
    deleteTemplate,
    // cost estimation
    estimatedCost,
    isEstimating,
    estimatePipelineCost,
    // full relayer pipeline
    isFullPipelineDeploying,
    fullPipelineResult,
    deployFullPipeline,
    // actions
    addLog,
    addBlock,
    updateBlock,
    removeBlock,
    toggleBlock,
    deployPipeline,
    compile,
    startHardhat,
    stopHardhat,
    checkHardhatStatus,
    fetchAvailableContracts,
    fetchDeployedContracts,
    removeDeployedContract,
    purgeAllContracts,
  };
}
