/**
 * Fixtures d'audit. Tout est LOCAL (réseau Hardhat en mémoire) : aucune tx publique, aucun RPC.
 *
 * Acteurs :
 *   deployer     déploie (et devient `admin` du ResCoellectionManager : msg.sender du constructeur)
 *   vault        vault / association : owner() d'AdhesionRescoe, reçoit les frais d'association
 *   artist       artiste (créateur de collections d'art)
 *   relayer      relayer (reçoit DUST_ETH à chaque mint / évolution)
 *   mintRelayer  « mint relayer » (rôle présent dans l'ABI frontend, ABSENT du contrat récupéré)
 *   memberA/B    adhérents
 *   buyer        acheteur
 *   attacker     attaquant (EOA sans aucun droit)
 */
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const DUST = ethers.parseEther("0.0001");
const MINT_PRICE = ethers.parseEther("0.005");
const DAY = 24 * 3600;
const YEAR = 365 * DAY;
const ZERO = ethers.ZeroAddress;

async function actors() {
  const s = await ethers.getSigners();
  return {
    deployer: s[0],
    vault: s[1],
    artist: s[2],
    relayer: s[3],
    mintRelayer: s[4],
    memberA: s[5],
    memberB: s[6],
    buyer: s[7],
    attacker: s[8],
    extra1: s[9],
    extra2: s[10],
    extra3: s[11],
    others: s.slice(12),
  };
}

async function deploy(name, signer, ...args) {
  const F = await ethers.getContractFactory(name, signer);
  const c = await F.deploy(...args);
  await c.waitForDeployment();
  return c;
}

/**
 * AdhesionRescoe seul. Le constructeur appelle transferOwnership(initialOwner) (onlyOwner) : il ne se déploie QUE si
 * initialOwner == msg.sender [F-ADH-17]. On déploie donc avec le deployer puis on transfère à `vault`. relayer câblé par défaut.
 */
async function deployAdhesion({ wireRelayer = true } = {}) {
  const a = await actors();
  const adhesion = await deploy("AdhesionRescoe", a.deployer, a.deployer.address);
  await adhesion.connect(a.deployer).transferOwnership(a.vault.address);
  if (wireRelayer) await adhesion.connect(a.vault).setRelayer(a.relayer.address);
  return { ...a, adhesion };
}

/** Pile complète : Adhesion + ResCoellectionManager + ArtFactory + MessageFactory (câblage « correct »). */
async function deployStack() {
  const a = await actors();
  const adhesion = await deploy("AdhesionRescoe", a.deployer, a.deployer.address);
  await adhesion.connect(a.deployer).transferOwnership(a.vault.address);
  await adhesion.connect(a.vault).setRelayer(a.relayer.address);

  // Manager : owner = vault, admin = deployer (msg.sender du constructeur)
  const manager = await deploy("ResCoellectionManager", a.deployer, a.vault.address, ZERO);
  const artFactory = await deploy("ArtFactory", a.deployer, await adhesion.getAddress(), a.vault.address);
  const messageFactory = await deploy("MessageFactory", a.deployer, await adhesion.getAddress());

  await manager.connect(a.vault).addAdhesionContract(await adhesion.getAddress());
  await manager.connect(a.deployer).updateFactoryAddress(await artFactory.getAddress());

  return { ...a, adhesion, manager, artFactory, messageFactory };
}

/** Crée une collection ArtNFT via la factory (appel DIRECT : la factory n'a pas de contrôle d'accès). */
async function createArtCollection(artFactory, owner, { name = "Rescoe Art", maxSupply = 100, collaborators = [], percents = [], user, id = 1, type = "Art" } = {}) {
  await artFactory.connect(owner).configureCollection(name, maxSupply, collaborators, percents);
  const tx = await artFactory.connect(owner).createDynamicCollection(name, type, user.address ?? user, id);
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return artFactory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CollectionCreated");
  const addr = ev.args.collection;
  return ethers.getContractAt("ArtNFT", addr);
}

/** Déploie directement un ArtNFT avec un RewardMock (isole la logique de vente). */
async function deployArtNFT({ owner, name = "Art", symbol = "AR", collectionId = 1, type = "Art", reward, association, share = 100, maxSupply = 1000, extras = [], percents = [] }) {
  return deploy("ArtNFT", owner, owner.address, name, symbol, collectionId, type, reward, association, share, maxSupply, extras, percents);
}

async function snapshotBalances(addrs) {
  const out = {};
  for (const a of addrs) out[a] = await ethers.provider.getBalance(a);
  return out;
}

/** PRNG déterministe (mulberry32) pour les tests de propriétés reproductibles. */
function prng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  DUST, MINT_PRICE, DAY, YEAR, ZERO,
  actors, deploy, deployAdhesion, deployStack, createArtCollection, deployArtNFT, snapshotBalances, prng, time, ethers,
};
