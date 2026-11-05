/**
 * AUDIT — artefacts : tailles / EIP-170, divergences ABI, contrats SANS SOURCE testés en boîte noire
 * (MasterFactory et TokenManagement sont déployés localement depuis le bytecode d'artifact Remix).
 */
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { ethers, ZERO, actors, deploy, deployStack } = require("./helpers/fixtures");
const hre = require("hardhat");

const ROOT = path.resolve(__dirname, "..", "..");
const REPO = path.resolve(ROOT, "..");
const remix = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "artifacts", `${n}.json`), "utf8"));
const feAbi = (f) => {
  const j = JSON.parse(fs.readFileSync(path.join(REPO, "src", "components", "ABI", f), "utf8"));
  return Array.isArray(j) ? j : j.abi;
};
const fnSigs = (abi) => abi.filter((x) => x.type === "function").map((f) => `${f.name}(${f.inputs.map((i) => i.type).join(",")})`);

async function fromRemix(name, signer, ...args) {
  const a = remix(name);
  const F = new ethers.ContractFactory(a.abi, a.data.bytecode.object, signer);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  return c;
}

describe("Artefacts — taille de bytecode (EIP-170 / EIP-3860)", () => {
  const LIMIT = 24576;
  const INIT = 49152;
  for (const name of ["AdhesionRescoe", "ResCoellectionManager", "ArtFactory", "ArtNFT", "MessageFactory", "MessageEditions", "SepoliaFaucet"]) {
    it(`${name} : bytecode déployé < 24 576 o et initcode < 49 152 o (compilation Hardhat locale)`, async () => {
      const art = await hre.artifacts.readArtifact(name);
      const dep = (art.deployedBytecode.length - 2) / 2;
      const ini = (art.bytecode.length - 2) / 2;
      console.log(`        ${name}: déployé=${dep} o (${((dep / LIMIT) * 100).toFixed(1)} %), initcode=${ini} o (${((ini / INIT) * 100).toFixed(1)} %)`);
      expect(dep).to.be.lt(LIMIT);
      expect(ini).to.be.lt(INIT);
    });
  }

  it("[F-ART-13] MessageFactory est à 96,4 % de la limite EIP-170 (marge ~0,9 Ko) : toute évolution de MessageEditions (embarqué dans la factory) la fera dépasser", async () => {
    const art = await hre.artifacts.readArtifact("MessageFactory");
    const dep = (art.deployedBytecode.length - 2) / 2;
    expect(LIMIT - dep).to.be.lt(1024);
    // ArtFactory embarque ArtNFT : marge ~4,8 Ko
    const af = await hre.artifacts.readArtifact("ArtFactory");
    expect(LIMIT - (af.deployedBytecode.length - 2) / 2).to.be.lt(6000);
  });

  it("le bytecode compilé par Hardhat = artifact Remix (hors hash de métadonnées) pour 4 contrats ; les factories embarquent des métadonnées d'enfants", async () => {
    const strip = (h) => { h = h.replace(/^0x/, ""); const l = parseInt(h.slice(-4), 16); return h.slice(0, h.length - (l + 2) * 2); };
    const maskAll = (h) => h.replace(/a2646970667358221220[0-9a-f]{64}64736f6c63430008[0-9a-f]{2}0033/g, "META");
    const same = async (n) => strip((await hre.artifacts.readArtifact(n)).deployedBytecode) === strip("0x" + remix(n).data.deployedBytecode.object.replace(/^0x/, ""));
    for (const n of ["AdhesionRescoe", "ResCoellectionManager", "ArtNFT", "SepoliaFaucet"]) expect(await same(n), n).to.equal(true);
    for (const n of ["ArtFactory", "MessageFactory"]) {
      const a = maskAll((await hre.artifacts.readArtifact(n)).deployedBytecode.replace(/^0x/, ""));
      const b = maskAll(remix(n).data.deployedBytecode.object.replace(/^0x/, ""));
      expect(a, n).to.equal(b); // identiques une fois TOUS les blobs CBOR de métadonnées masqués
    }
  });
});

describe("Artefacts — incohérences ABI frontend / compilé (sources récupérées)", () => {
  const compiled = (n) => remix(n).abi;

  it("[ABI-01] AdhesionRescoe : 31 fonctions de l'ABI frontend n'existent pas dans le contrat compilé/audité (evolve, hatchEgg, relayerMint, mintRelayer, insectStorage…)", () => {
    const comp = new Set(fnSigs(compiled("AdhesionRescoe")));
    const missing = fnSigs(feAbi("ABIAdhesion.json")).filter((s) => !comp.has(s));
    expect(missing.length).to.be.gte(30);
    for (const must of ["evolve(uint256,string,string,string)", "hatchEgg(uint256,string,string,string)", "relayerMint(address,string,string,string,uint256,string,string,bool,bool)", "mintRelayer()", "insectStorage()", "spendPoints(uint256)"]) {
      expect(missing, must).to.include(must);
    }
  });

  it("[ABI-02] AdhesionRescoe : le constructeur frontend (3 args) ≠ constructeur compilé (1 arg) ; safeMint a une signature différente (8 vs 6 paramètres)", () => {
    const fe = feAbi("ABIAdhesion.json").find((x) => x.type === "constructor");
    const co = compiled("AdhesionRescoe").find((x) => x.type === "constructor");
    expect(fe.inputs.length).to.equal(3);
    expect(co.inputs.length).to.equal(1);
    const feMint = feAbi("ABIAdhesion.json").find((x) => x.name === "safeMint");
    const coMint = compiled("AdhesionRescoe").find((x) => x.name === "safeMint");
    expect(feMint.inputs.length).to.equal(8);
    expect(coMint.inputs.length).to.equal(6);
  });

  it("[ABI-03] trois versions d'Adhesion coexistent : compilée (87 entrées), épinglée Base Sepolia (71), frontend (141)", () => {
    const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", ".deploys", "pinned-contracts", "84532", "0x83848a57947b36e51787ded31554d43fd2417eaa.json"), "utf8"));
    expect(compiled("AdhesionRescoe").length).to.equal(87);
    expect(pinned.abi.length).to.equal(71);
    expect(feAbi("ABIAdhesion.json").length).to.equal(141);
    expect(fnSigs(pinned.abi)).to.include("duration()"); // fonction absente des deux autres versions
  });

  it("[ABI-04] ArtFactory frontend attend setAuthorizedCallers/masterFactoryAuthorized/resCollectionsAuthorized : absents du contrat compilé ET épinglé (createDynamicCollection ouvert)", () => {
    const comp = new Set(fnSigs(compiled("ArtFactory")));
    const fe = fnSigs(feAbi("Factories/ABI_ART_FACTORY.json"));
    for (const f of ["setAuthorizedCallers(address,address)", "masterFactoryAuthorized()", "resCollectionsAuthorized()"]) {
      expect(fe, f).to.include(f);
      expect(comp.has(f), f).to.equal(false);
    }
  });

  it("[ABI-05] ResCoellectionManager frontend attend registerCollection/authorizedCollections/addPendingPoints/rewardRelayer : absents du contrat déployé/compilé", () => {
    const comp = new Set(fnSigs(compiled("ResCoellectionManager")));
    const fe = fnSigs(feAbi("ABI_Collections.json"));
    for (const f of ["registerCollection(address)", "authorizedCollections(address)", "addPendingPoints(address,uint256)", "rewardRelayer()", "claimPendingToRewards()"]) {
      expect(fe, f).to.include(f);
      expect(comp.has(f), f).to.equal(false);
    }
  });

  it("[ABI-06] MasterFactory : constructeur frontend à 4 factories (generativeFactory) vs 3 dans le bytecode Remix/épinglé ; ArtFactory et PoetryFactory ont une ABI frontend IDENTIQUE", () => {
    const fe = feAbi("Factories/ABI_MasterFactory.json").find((x) => x.type === "constructor");
    const co = compiled("MasterFactory").find((x) => x.type === "constructor");
    expect(fe.inputs.length).to.equal(4);
    expect(co.inputs.length).to.equal(3);
    expect(JSON.stringify(feAbi("Factories/ABI_ART_FACTORY.json"))).to.equal(JSON.stringify(feAbi("Factories/ABI_POESIE_FACTORY.json")));
  });

  it("[ABI-07] MessageEditions : l'ABI frontend (mintDiscord, mintEdition, soulbound…) ne ressemble pas au contrat compilé (mint 11 paramètres, buyEdition…)", async () => {
    const comp = new Set(fnSigs((await hre.artifacts.readArtifact("MessageEditions")).abi));
    const fe = fnSigs(feAbi("MessageEditions.json"));
    for (const f of ["mintEdition(uint256,string)", "convertToSoulbound(uint256)", "addResidentManager(address)", "mintDiscord(bytes32,string,uint256,string,uint256,uint256,uint256,bool,address[],uint256[])"]) {
      expect(fe, f).to.include(f);
      expect(comp.has(f), f).to.equal(false);
    }
    expect(fe.filter((f) => !comp.has(f)).length).to.be.gte(12);
  });

  it("[ABI-08] les ABI frontend de TokenManagement, Faucet, MessageFactory(épinglée), ArtNFT/Manager/ArtFactory épinglés = ABI compilées (versions cohérentes pour ces contrats)", () => {
    const sig = (a) => JSON.stringify(fnSigs(a).sort());
    expect(sig(feAbi("ABI_ADHESION_MANAGEMENT.json"))).to.equal(sig(compiled("TokenManagement")));
    expect(sig(feAbi("Faucet.json"))).to.equal(sig(compiled("SepoliaFaucet")));
    for (const [pin, n] of [["0xd0b6772E0DE3e9772492ebF15764744ACD9a3964", "ArtNFT"], ["0xc06670dccae878d67a7ed596e8e35298d8b91ade", "ResCoellectionManager"], ["0xe9aa1178ef6c14DAc173a11e35d51ACeaF09D9Fc", "ArtFactory"], ["0x72b5547985e1d764681b0788879e0a4c7707e4fe", "MessageFactory"], ["0x449f77c72c359ec52391830babb22eb5823aeeac", "MasterFactory"]]) {
      const p = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", ".deploys", "pinned-contracts", "84532", `${pin}.json`), "utf8"));
      expect(sig(p.abi), n).to.equal(sig(compiled(n)));
    }
  });
});

describe("MasterFactory (SANS SOURCE) — boîte noire depuis le bytecode Remix", () => {
  async function fx() {
    const a = await actors();
    const reward = await deploy("RewardMock", a.deployer);
    const art = await deploy("ArtFactory", a.deployer, await reward.getAddress(), a.vault.address);
    const poetry = await deploy("ArtFactory", a.deployer, await reward.getAddress(), a.vault.address); // ABI identique à PoetryFactory (cf. ABI-06)
    const message = await deploy("MessageFactory", a.deployer, await reward.getAddress());
    const master = await fromRemix("MasterFactory", a.deployer, await art.getAddress(), await poetry.getAddress(), await message.getAddress());
    await art.configureCollection("X", 5, [], []);
    return { ...a, reward, art, poetry, message, master };
  }

  it("câblage : clés « Art », « Poesie » et « Social » (PAS « Message ») ; owner = déployeur", async () => {
    const { master, art, poetry, message, deployer } = await fx();
    expect(await master.owner()).to.equal(deployer.address);
    expect(await master.collectionFactories("Art")).to.equal(await art.getAddress());
    expect(await master.collectionFactories("Poesie")).to.equal(await poetry.getAddress());
    expect(await master.collectionFactories("Social")).to.equal(await message.getAddress());
    expect(await master.collectionFactories("Message")).to.equal(ZERO); // le ResCoellectionManager n'autorise que Art/Poesie : "Social" doit y être ajouté
  });

  it("[F-MST-01] createDynamicCollection est appelable par n'importe qui (aucun contrôle d'accès) et déploie une collection au nom d'un tiers", async () => {
    const { master, attacker, memberA: victim, art } = await fx();
    await master.connect(attacker).createDynamicCollection("X", "Art", victim.address, 777);
    expect((await art.getCollections()).length).to.equal(1);
    const col = await ethers.getContractAt("ArtNFT", (await art.getCollections())[0]);
    expect(await col.owner()).to.equal(victim.address);
    await expect(master.connect(attacker).createDynamicCollection("X", "Inconnu", victim.address, 1)).to.be.revertedWith("Factory not found");
  });

  it("updateFactory : réservé à l'owner (« Not authorized ») ; mais aucune validation de contrat : un EOA bloque ensuite toute création", async () => {
    const { master, attacker, deployer, extra1 } = await fx();
    await expect(master.connect(attacker).updateFactory("Art", attacker.address)).to.be.revertedWith("Not authorized");
    await master.connect(deployer).updateFactory("Art", extra1.address);
    await expect(master.connect(attacker).createDynamicCollection("X", "Art", attacker.address, 1)).to.be.reverted;
  });

  it("[F-MST-02] MasterFactory n'a pas de transferOwnership/renounceOwnership : l'owner (clé de déploiement) est définitif", async () => {
    const { master } = await fx();
    expect(master.interface.hasFunction("transferOwnership")).to.equal(false);
    expect(master.interface.hasFunction("renounceOwnership")).to.equal(false);
  });
});

describe("TokenManagement (SANS SOURCE) — boîte noire depuis le bytecode Remix", () => {
  it("[F-TMG-02] même défaut de constructeur qu'Adhesion : initialOwner != msg.sender ⇒ revert OwnableUnauthorizedAccount(msg.sender)", async () => {
    const { adhesion, deployer, vault } = await deployStack();
    const a = remix("TokenManagement");
    const F = new ethers.ContractFactory(a.abi, a.data.bytecode.object, deployer);
    await expect(F.deploy(await adhesion.getAddress(), vault.address))
      .to.be.revertedWithCustomError({ interface: new ethers.Interface(a.abi) }, "OwnableUnauthorizedAccount")
      .withArgs(deployer.address);
  });

  it("contrôle d'accès : withdraw/updateAdhesionContract/transferOwnership réservés à l'owner", async () => {
    const { adhesion, deployer, attacker, vault } = await deployStack();
    const tm = await fromRemix("TokenManagement", deployer, await adhesion.getAddress(), deployer.address);
    await tm.connect(deployer).transferOwnership(vault.address);
    expect(await tm.owner()).to.equal(vault.address);
    expect(await tm.adhesionContractAddress()).to.equal(await adhesion.getAddress());
    const denied = (p) => expect(p).to.be.revertedWithCustomError(tm, "OwnableUnauthorizedAccount");
    await denied(tm.connect(attacker).withdraw());
    await denied(tm.connect(attacker).updateAdhesionContract(attacker.address));
    await denied(tm.connect(attacker).transferOwnership(attacker.address));
  });

  it("[F-TMG-01] compilé contre un AUTRE Adhesion.sol (hash différent dans sa métadonnée) : getTokensPaginated échoue avec l'Adhesion récupéré (totalSupply récursif)", async () => {
    const { adhesion, deployer, memberA, vault } = await deployStack();
    const tm = await fromRemix("TokenManagement", deployer, await adhesion.getAddress(), deployer.address);
    await adhesion.connect(memberA).safeMint("ipfs://m", 1, "A", "b", true, true, { value: ethers.parseEther("0.0051") });
    let failed = false;
    try { await tm.getTokensPaginated(0, 10, { gasLimit: 5_000_000 }); } catch { failed = true; }
    expect(failed).to.equal(true); // résultat observé : la pagination échoue contre l'Adhesion récupéré
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "artifacts", "TokenManagement_metadata.json"), "utf8"));
    const a = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts", "artifacts", "AdhesionRescoe_metadata.json"), "utf8"));
    expect(m.sources["Adhesion.sol"].keccak256).to.not.equal(a.sources["Adhesion.sol"].keccak256); // versions divergentes d'Adhesion.sol
  });
});
