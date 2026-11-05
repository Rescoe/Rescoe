/**
 * AUDIT — ResCoellectionManager (source RÉCUPÉRÉE : build-info a6daef4a…/RescollectionFactory.sol)
 * Le mock RewardMock sert d'« adhésion » à comportement connu (mettreAJourPoints ouvert, comme le contrat réel : F-ADH-01).
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, ZERO, actors, deploy, deployStack } = require("./helpers/fixtures");

async function setup() {
  const a = await actors();
  const shim = await deploy("RewardMock", a.deployer);
  const artFactory = await deploy("ArtFactory", a.deployer, await shim.getAddress(), a.vault.address);
  const manager = await deploy("ResCoellectionManager", a.deployer, a.vault.address, ZERO);
  await manager.connect(a.vault).addAdhesionContract(await shim.getAddress());
  await manager.connect(a.deployer).updateFactoryAddress(await artFactory.getAddress());
  await artFactory.connect(a.deployer).configureCollection("Rescoe Art", 10, [], []);
  return { ...a, shim, artFactory, manager };
}

describe("ResCoellectionManager — état initial et permissions", () => {
  it("état initial : owner=initialOwner, admin=msg.sender du constructeur, types Art/Poesie autorisés", async () => {
    const { manager, vault, deployer } = await loadFixture(setup);
    expect(await manager.owner()).to.equal(vault.address);
    expect(await manager.admin()).to.equal(deployer.address);
    expect(await manager.allowedCollectionTypes("Art")).to.equal(true);
    expect(await manager.allowedCollectionTypes("Poesie")).to.equal(true);
    expect(await manager.allowedCollectionTypes("Message")).to.equal(false); // à ajouter pour les salons
  });

  it("l'attaquant ne peut modifier aucune adresse critique ni configuration", async () => {
    const { manager, attacker } = await loadFixture(setup);
    const m = manager.connect(attacker);
    const denied = (p) => expect(p).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    await denied(m.addAdhesionContract(attacker.address));
    await denied(m.addCollectionType("Evil"));
    await denied(m.removeCollectionType("Art"));
    await denied(m.createAdminCollection(attacker.address, "n", "u", "Art"));
    await denied(m.featureCollection(0, true));
    await denied(m.transferOwnership(attacker.address));
    await expect(m.updateFactoryAddress(attacker.address)).to.be.revertedWith("Seul l'admin peut changer l'adresse de la factory");
    await expect(m.setCollectionActiveStatus(0, false)).to.be.revertedWith("Not authorized");
  });

  it("[F-MGR-03] updateFactoryAddress est réservé à `admin` (clé de déploiement), PAS à owner(): l'owner ne peut pas câbler la factory", async () => {
    const { manager, vault, deployer, extra1 } = await loadFixture(setup);
    await expect(manager.connect(vault).updateFactoryAddress(extra1.address)).to.be.revertedWith("Seul l'admin peut changer l'adresse de la factory");
    await manager.connect(deployer).updateFactoryAddress(extra1.address); // la clé de déploiement (souvent chaude) garde ce pouvoir
    expect(await manager.factoryContractAddress()).to.equal(extra1.address);
  });

  it("[F-MGR-03b] `admin` n'a ni setter ni renonciation : même après transfert d'ownership, la clé de déploiement garde updateFactory/updateCollection/setActive à vie", async () => {
    const { manager, vault, deployer, extra1 } = await loadFixture(setup);
    await manager.connect(vault).transferOwnership(extra1.address);
    expect(await manager.admin()).to.equal(deployer.address);
    expect(manager.interface.hasFunction("setAdmin")).to.equal(false);
    expect(manager.interface.hasFunction("transferAdmin")).to.equal(false);
    // la clé de déploiement peut ré-router la factory (donc créer des collections arbitraires) alors qu'elle n'est plus owner
    await manager.connect(deployer).updateFactoryAddress(deployer.address);
    expect(await manager.factoryContractAddress()).to.equal(deployer.address);
  });
});

describe("ResCoellectionManager — création de collections (quota, adhésion)", () => {
  it("adhésion requise : non-membre refusé ; membre sans points refusé ; type invalide refusé", async () => {
    const { manager, shim, memberA } = await loadFixture(setup);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art")).to.be.revertedWith("User is no more adherent");
    await shim.setValid(memberA.address, true);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art")).to.be.revertedWith("User must have more adhesion tokens than collections");
    await shim.mettreAJourPoints(memberA.address, 5);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Musique")).to.be.revertedWith("Invalid collection type");
  });

  it("quota = points/5 : 5 points ⇒ 1 collection ; la 2e exige 5 points de plus ; ArtNFT créé avec le bon owner", async () => {
    const { manager, shim, memberA } = await loadFixture(setup);
    await shim.setValid(memberA.address, true);
    await shim.mettreAJourPoints(memberA.address, 5);
    expect(await manager.getRemainingCollections(memberA.address)).to.equal(1);
    const tx = await manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art");
    await expect(tx).to.emit(manager, "CollectionCreated");
    const col = await manager.getCollection(0);
    expect(col.creator).to.equal(memberA.address);
    expect(col.isActive).to.equal(true);
    const art = await ethers.getContractAt("ArtNFT", col.collectionAddress);
    expect(await art.owner()).to.equal(memberA.address);
    expect(await manager.getNumberOfCollectionsByUser(memberA.address)).to.equal(1);
    expect(await manager.getRemainingCollections(memberA.address)).to.equal(0);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c2", "Art")).to.be.revertedWith("User must have more adhesion tokens than collections");
    await shim.mettreAJourPoints(memberA.address, 5);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c2", "Art")).to.not.be.reverted;
  });

  it("[F-MGR-02] le quota de collections dérive des points, gratuits via F-ADH-01 : un membre valide s'octroie des collections illimitées", async () => {
    const { manager, shim, attacker } = await loadFixture(setup);
    await shim.setValid(attacker.address, true); // membre valide (7 jours, 0.0051 ETH)
    await shim.connect(attacker).mettreAJourPoints(attacker.address, 1000); // même sémantique que AdhesionRescoe.mettreAJourPoints (ouvert)
    expect(await manager.getRemainingCollections(attacker.address)).to.equal(200);
    for (let i = 0; i < 5; i++) await manager.connect(attacker).createCollection("Rescoe Art", "ipfs://spam" + i, "Art");
    expect(await manager.getTotalCollectionsMinted()).to.equal(5);
  });

  it("createAdminCollection (owner) : crée pour un tiers sans quota ni adhésion, et consomme le quota de ce tiers", async () => {
    const { manager, vault, memberA } = await loadFixture(setup);
    // la factory exige un nom préalablement configuré
    await expect(manager.connect(vault).createAdminCollection(memberA.address, "N", "ipfs://u", "Art")).to.be.revertedWith("Collection not configured");
    await manager.connect(vault).createAdminCollection(memberA.address, "Rescoe Art", "ipfs://u", "Art");
    expect(await manager.getNumberOfCollectionsByUser(memberA.address)).to.equal(1);
  });

  it("[F-MGR-01] avec le VRAI AdhesionRescoe récupéré, createCollection est impossible : getUserInfo revert (membre ET non-membre)", async () => {
    const { manager, adhesion, memberA, attacker, vault, deployer, artFactory } = await deployStack();
    await artFactory.connect(deployer).configureCollection("Rescoe Art", 10, [], []);
    await manager.connect(deployer).updateFactoryAddress(await artFactory.getAddress());
    await adhesion.connect(memberA).safeMint("ipfs://m", 1, "A", "b", true, true, { value: ethers.parseEther("0.0051") });
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art")).to.be.revertedWith("Token does not exist");
    await expect(manager.connect(attacker).createCollection("Rescoe Art", "ipfs://c", "Art")).to.be.revertedWith("User is not a member");
    expect(await manager.getTotalCollectionsMinted()).to.equal(0);
  });

  it("[F-MGR-04] addAdhesionContract est irréversible (aucun remove) : une adresse invalide ajoutée bloque createCollection pour TOUS", async () => {
    const { manager, vault, shim, memberA, extra3 } = await loadFixture(setup);
    await shim.setValid(memberA.address, true);
    await shim.mettreAJourPoints(memberA.address, 50);
    await manager.connect(vault).addAdhesionContract(extra3.address); // EOA / mauvaise adresse : aucune validation
    expect(manager.interface.hasFunction("removeAdhesionContract")).to.equal(false);
    await expect(manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art")).to.be.reverted; // checkUserAdhesionNumber boucle sur toutes
    await expect(manager.getRemainingCollections(memberA.address)).to.be.reverted;
    expect(await manager.adhesionContractCount()).to.equal(2);
  });

  it("[F-MGR-05] updateCollection : créateur OU admin seulement (l'owner() ne peut pas) ; setCollectionActiveStatus : owner OU admin", async () => {
    const { manager, shim, memberA, vault, deployer, attacker } = await loadFixture(setup);
    await shim.setValid(memberA.address, true);
    await shim.mettreAJourPoints(memberA.address, 5);
    await manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c", "Art");
    await expect(manager.connect(attacker).updateCollection(0, "x", "y")).to.be.revertedWith("Only the creator or admin can update the collection");
    await expect(manager.connect(vault).updateCollection(0, "x", "y")).to.be.revertedWith("Only the creator or admin can update the collection");
    await manager.connect(memberA).updateCollection(0, "Nouveau", "ipfs://n");
    await manager.connect(deployer).updateCollection(0, "Admin edit", "ipfs://a");
    expect(await manager.getCollectionURI(0)).to.equal("ipfs://a");
    await manager.connect(vault).setCollectionActiveStatus(0, false);
    expect((await manager.getCollection(0)).isActive).to.equal(false);
    await expect(manager.connect(vault).setCollectionActiveStatus(99, false)).to.be.revertedWith("Collection does not exist");
  });

  it("lectures paginées / par type / par utilisateur : bornes et cohérence", async () => {
    const { manager, shim, memberA } = await loadFixture(setup);
    await shim.setValid(memberA.address, true);
    await shim.mettreAJourPoints(memberA.address, 15);
    for (let i = 0; i < 3; i++) await manager.connect(memberA).createCollection("Rescoe Art", "ipfs://c" + i, "Art");
    expect((await manager.getCollectionsPaginated(0, 2)).length).to.equal(2);
    expect((await manager.getCollectionsPaginated(2, 10)).length).to.equal(1);
    await expect(manager.getCollectionsPaginated(3, 1)).to.be.revertedWith("Start ID out of range");
    expect((await manager.getCollectionsByUser(memberA.address)).length).to.equal(3);
    expect((await manager.getCollectionsByType("Art", 0, 2)).length).to.equal(3);
    await expect(manager.getCollectionsByType("Art", 0, 3)).to.be.revertedWith("ID range is invalid");
    await expect(manager.getCollectionsByType("Art", 1, 1)).to.be.revertedWith("ID range is invalid");
  });
});
