/**
 * AUDIT — AdhesionRescoe (source RÉCUPÉRÉE : audit-recovered-contracts/build-info/62c65c27…/Adhesion.sol)
 *
 * Convention de nommage :
 *   "[F-ADH-xx] ..."    test qui DÉMONTRE UN BUG : il passe tant que le défaut est présent et ÉCHOUERA une fois corrigé.
 *   autres              comportement attendu / non-régression (permissions, prix, remboursements...).
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, time, DUST, MINT_PRICE, DAY, YEAR, ZERO, deployAdhesion, deploy } = require("./helpers/fixtures");

const URI = "ipfs://member-1";

async function fixture() {
  return deployAdhesion();
}

/** Se place au milieu d'un « bucket annuel » époque (block.timestamp / 365d) pour éviter les effets de bord. */
async function moveToMidYear() {
  const now = await time.latest();
  const mid = (Math.floor(now / YEAR) + 1) * YEAR + Math.floor(YEAR / 2);
  await time.increaseTo(mid);
}

function mint(c, signer, { role = 1, name = "Alice", bio = "bio", annual = false, auto = true, value, uri = URI } = {}) {
  return (async () => {
    const v = value ?? (await c.mintPrice()) + DUST;
    return c.connect(signer).safeMint(uri, role, name, bio, annual, auto, { value: v });
  })();
}

describe("AdhesionRescoe — permissions & câblage", () => {
  it("owner() = vault après transfert ; le constructeur refuse un owner nul", async () => {
    const { adhesion, vault, deployer } = await loadFixture(fixture);
    expect(await adhesion.owner()).to.equal(vault.address);
    await expect(deploy("AdhesionRescoe", deployer, ZERO)).to.be.revertedWithCustomError(adhesion, "OwnableInvalidOwner");
  });

  it("[F-ADH-17] le constructeur appelle transferOwnership(initialOwner) : déploiement impossible si initialOwner != msg.sender", async () => {
    const { adhesion, vault, deployer } = await loadFixture(fixture);
    // vault ≠ deployer : revert OwnableUnauthorizedAccount(deployer) dans le constructeur
    await expect(deploy("AdhesionRescoe", deployer, vault.address))
      .to.be.revertedWithCustomError(adhesion, "OwnableUnauthorizedAccount")
      .withArgs(deployer.address);
    // conséquence : la clé qui déploie (souvent la clé relayer « chaude ») est owner jusqu'au transfert manuel
    const direct = await deploy("AdhesionRescoe", deployer, deployer.address);
    expect(await direct.owner()).to.equal(deployer.address);
  });

  it("toutes les fonctions onlyOwner refusent l'attaquant", async () => {
    const { adhesion, attacker } = await loadFixture(fixture);
    const a = adhesion.connect(attacker);
    const denied = (p) => expect(p).to.be.revertedWithCustomError(adhesion, "OwnableUnauthorizedAccount").withArgs(attacker.address);
    await denied(a.setMintPrice(1));
    await denied(a.setPointPrice(1));
    await denied(a.setRelayer(attacker.address));
    await denied(a.setLevelDurations([1, 1, 1, 1]));
    await denied(a.mintMultiple([], [], [], [], []));
    await denied(a.withdraw());
    await denied(a.transferOwnership(attacker.address));
    await denied(a.renounceOwnership());
  });

  it("l'attaquant ne peut ni retirer ni dépenser les fonds du contrat", async () => {
    const { adhesion, attacker, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    const before = await ethers.provider.getBalance(await adhesion.getAddress());
    expect(before).to.equal(MINT_PRICE); // mintPrice reste dans le contrat, DUST va au relayer
    await expect(adhesion.connect(attacker).withdraw()).to.be.reverted;
    await expect(adhesion.connect(attacker).burnNFT(0)).to.be.revertedWith("You do not own this token");
    expect(await ethers.provider.getBalance(await adhesion.getAddress())).to.equal(before);
  });

  it("transfert d'ownership : le nouvel owner contrôle withdraw(), l'ancien perd ses droits", async () => {
    const { adhesion, vault, memberB, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await adhesion.connect(vault).transferOwnership(memberB.address);
    await expect(adhesion.connect(vault).withdraw()).to.be.revertedWithCustomError(adhesion, "OwnableUnauthorizedAccount");
    await expect(adhesion.connect(memberB).withdraw()).to.changeEtherBalances(
      [adhesion, memberB],
      [-MINT_PRICE, MINT_PRICE]
    );
  });

  it("[ABI] le contrat récupéré n'a NI mintRelayer, NI onlyRelayer, NI onlyEvolutionContract, NI hatchEgg/evolve/insectStorage", async () => {
    const { adhesion } = await loadFixture(fixture);
    for (const fn of ["mintRelayer", "setMintRelayer", "relayerMint", "evolve", "hatchEgg", "insectStorage", "setInsectStorage", "reproductionParents", "lockAndExtendOneYear", "spendPoints"]) {
      expect(adhesion.interface.hasFunction(fn), fn).to.equal(false);
    }
    // ... alors que l'ABI frontend les attend : voir 06_artifacts.test.js (comparaison ABI complète)
  });

  it("[F-ADH-06] setRelayer(address(0)) est accepté : chaque mint brûle alors DUST_ETH vers l'adresse zéro", async () => {
    const { adhesion, vault, memberA } = await loadFixture(fixture);
    await adhesion.connect(vault).setRelayer(ZERO); // aucun contrôle d'adresse nulle
    const before = await ethers.provider.getBalance(ZERO);
    await mint(adhesion, memberA);
    expect((await ethers.provider.getBalance(ZERO)) - before).to.equal(DUST); // ETH brûlé définitivement
  });

  it("[F-ADH-07] relayer = wallet intelligent (receive() écrit en storage) ⇒ safeMint revert (Address.transfer = 2300 gas)", async () => {
    const { adhesion, vault, memberA } = await loadFixture(fixture);
    const safeLike = await deploy("StorageWritingReceiver", vault);
    await adhesion.connect(vault).setRelayer(await safeLike.getAddress());
    await expect(mint(adhesion, memberA)).to.be.reverted; // mint bloqué pour tout le monde
  });
});

describe("AdhesionRescoe — adhésion : trial, annuel, prix, remboursement, limites", () => {
  it("trial : prix exact, 7 jours, +15 points, DUST au relayer, mintPrice conservé par le contrat", async () => {
    const { adhesion, memberA, relayer } = await loadFixture(fixture);
    const price = MINT_PRICE + DUST;
    const tx = adhesion.connect(memberA).safeMint(URI, 1, "Alice", "bio", false, false, { value: price });
    await expect(tx).to.changeEtherBalances([memberA, relayer, adhesion], [-price, DUST, MINT_PRICE]);
    await expect(tx).to.emit(adhesion, "NFTMinted").withArgs(memberA.address, 0);
    const info = await adhesion.membershipInfo(0);
    expect(info.level).to.equal(0);
    expect(info.autoEvolve).to.equal(false); // le choix de l'utilisateur est respecté en mode trial
    expect(info.expirationTimestamp - info.startTimestamp).to.equal(7n * BigInt(DAY));
    expect(info.totalYears).to.equal(0);
    expect(await adhesion.rewardPoints(memberA.address)).to.equal(15);
    expect((await adhesion.members(memberA.address)).exists).to.equal(true);
    expect(await adhesion.ownerOf(0)).to.equal(memberA.address);
  });

  it("annuel : 365 jours, totalYears=1, autoEvolve forcé à true même si l'utilisateur passe false", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true, auto: false });
    const info = await adhesion.membershipInfo(0);
    expect(info.expirationTimestamp - info.startTimestamp).to.equal(BigInt(YEAR));
    expect(info.totalYears).to.equal(1);
    expect(info.autoEvolve).to.equal(true);
  });

  it("sous-paiement d'1 wei refusé ; paiement exact accepté", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await expect(mint(adhesion, memberA, { value: MINT_PRICE + DUST - 1n })).to.be.revertedWith("Insufficient funds");
    await expect(mint(adhesion, memberA, { value: 0n })).to.be.revertedWith("Insufficient funds");
    await expect(mint(adhesion, memberA, { value: MINT_PRICE + DUST })).to.not.be.reverted;
  });

  it("trop-perçu remboursé intégralement à l'adhérent (mint)", async () => {
    const { adhesion, memberA, relayer } = await loadFixture(fixture);
    const sent = ethers.parseEther("1");
    await expect(adhesion.connect(memberA).safeMint(URI, 2, "n", "b", true, true, { value: sent })).to.changeEtherBalances(
      [memberA, relayer, adhesion],
      [-(MINT_PRICE + DUST), DUST, MINT_PRICE]
    );
  });

  it("rôle invalide (>3) refusé ; rôles 0..3 acceptés", async () => {
    const { adhesion, memberA, memberB } = await loadFixture(fixture);
    await expect(mint(adhesion, memberA, { role: 4 })).to.be.revertedWith("Role must be between 0 and 3");
    for (const r of [0, 3]) await expect(mint(adhesion, memberB, { role: r })).to.not.be.reverted;
  });

  it("limite : 3e mint dans la même année-époque refusé", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await moveToMidYear();
    await mint(adhesion, memberA);
    await mint(adhesion, memberA);
    await expect(mint(adhesion, memberA)).to.be.revertedWith("Max 2 mints per year per wallet");
  });

  it("[F-ADH-12] la limite « 2 mints/an » est un bucket calé sur l'époque Unix : 4 mints en < 1 minute à la frontière", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    const now = await time.latest();
    const boundary = (Math.floor(now / YEAR) + 1) * YEAR;
    await time.setNextBlockTimestamp(boundary - 20);
    await mint(adhesion, memberA);
    await mint(adhesion, memberA);
    await expect(mint(adhesion, memberA)).to.be.reverted; // limite atteinte dans le bucket courant (le bloc suit à boundary-18)
    await time.setNextBlockTimestamp(boundary + 5);
    await mint(adhesion, memberA);
    await mint(adhesion, memberA); // 4 adhésions en ~25 secondes
    expect((await adhesion.getTokensByOwner(memberA.address)).length).to.equal(4);
  });

  it("[F-ADH-14] chaque mint pousse l'adresse dans membersByRole sans dédoublonnage ni retrait au changement de rôle", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await moveToMidYear();
    await mint(adhesion, memberA, { role: 1 });
    await mint(adhesion, memberA, { role: 2 });
    expect(await adhesion.getMembersByRole(1)).to.deep.equal([memberA.address]);
    expect(await adhesion.getMembersByRole(2)).to.deep.equal([memberA.address]); // même adresse dans 2 rôles
    expect((await adhesion.members(memberA.address)).role).to.equal(2);
  });

  it("nom/bio : setNameAndBio réservé au propriétaire du token (événement émis) ; tokenURI = URI fournie", async () => {
    const { adhesion, memberA, attacker } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await expect(adhesion.connect(memberA).setNameAndBio(0, "Nouveau", "Nouvelle bio"))
      .to.emit(adhesion, "MembershipUpdated")
      .withArgs(0, memberA.address, "Nouveau", "Nouvelle bio");
    await expect(adhesion.connect(attacker).setNameAndBio(0, "x", "y")).to.be.revertedWith("Only owner can update name and bio");
    expect(await adhesion.tokenURI(0)).to.equal(URI);
  });

  it("[F-ADH-15] aucune validation d'URI : un membre peut enregistrer n'importe quelle chaîne comme metadata", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    const evil = 'data:application/json,{"name":"Rescoe Core Team","image":"https://evil.example/x.png"}';
    await mint(adhesion, memberA, { uri: evil });
    expect(await adhesion.tokenURI(0)).to.equal(evil);
  });

  it("[F-ADH-09] getTotalMinted() ne bouge jamais (compteur _totalMinted jamais incrémenté)", async () => {
    const { adhesion, memberA, memberB } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await mint(adhesion, memberB);
    expect(await adhesion.getTotalMinted()).to.equal(0);
    expect((await adhesion.getTokensByOwner(memberA.address)).length + (await adhesion.getTokensByOwner(memberB.address)).length).to.equal(2);
  });
});

describe("AdhesionRescoe — défauts d'existence, de points et d'accès", () => {
  it("[F-ADH-01] mettreAJourPoints() est public sans contrôle d'accès : n'importe qui s'attribue des points illimités", async () => {
    const { adhesion, attacker, memberA } = await loadFixture(fixture);
    expect(await adhesion.rewardPoints(attacker.address)).to.equal(0);
    await expect(adhesion.connect(attacker).mettreAJourPoints(attacker.address, 1_000_000n))
      .to.emit(adhesion, "RewardsAdded")
      .withArgs(attacker.address, 1_000_000n);
    expect(await adhesion.rewardPoints(attacker.address)).to.equal(1_000_000n);
    await adhesion.connect(attacker).mettreAJourPoints(memberA.address, 5); // et peut en donner à n'importe qui
    expect(await adhesion.rewardPoints(memberA.address)).to.equal(5);
  });

  it("[F-ADH-01b] « points négatifs » : le require(rewardPoints + points >= 0) est une tautologie (uint256)", async () => {
    const { adhesion, attacker } = await loadFixture(fixture);
    await adhesion.connect(attacker).mettreAJourPoints(attacker.address, 0); // passe, sans effet ni garde-fou
    // aucune fonction de retrait de points exposée (spendPoints absent) : les points ne peuvent que croître
    expect(adhesion.interface.hasFunction("spendPoints")).to.equal(false);
  });

  it("[F-ADH-02] _exists() lit _owners (jamais écrit) ⇒ getRemainingMembershipTime/getTokenDetails/getUserInfo revert pour un token pourtant existant", async () => {
    const { adhesion, memberA, attacker } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    expect(await adhesion.ownerOf(0)).to.equal(memberA.address); // le token existe bien (ERC721 OZ)
    await expect(adhesion.getRemainingMembershipTime(0)).to.be.revertedWith("Token does not exist");
    await expect(adhesion.getTokenDetails(0)).to.be.revertedWith("Token does not exist");
    await expect(adhesion.getUserInfo(memberA.address)).to.be.revertedWith("Token does not exist"); // membre valide ⇒ revert
    await expect(adhesion.getUserInfo(attacker.address)).to.be.revertedWith("User is not a member"); // non-membre ⇒ revert aussi
  });

  it("[F-ADH-02b] conséquence : renewMembership, listTokenForSale, buyNFT et buyRewardPoints sont inutilisables", async () => {
    const { adhesion, memberA, memberB } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await expect(adhesion.connect(memberA).renewMembership(0, false, { value: MINT_PRICE + DUST })).to.be.revertedWith("Token does not exist");
    await expect(adhesion.connect(memberA).listTokenForSale(0, 1)).to.be.revertedWith("Token does not exist");
    await expect(adhesion.connect(memberB).buyNFT(0, { value: 1 })).to.be.revertedWith("Token does not exist");
    await expect(adhesion.connect(memberA).buyRewardPoints(memberA.address, 1, { value: ethers.parseEther("1") })).to.be.revertedWith("Token does not exist");
  });

  it("[F-ADH-03] totalSupply() s'appelle elle-même (récursion infinie) : l'appel échoue toujours", async () => {
    const { adhesion } = await loadFixture(fixture);
    let failed = false;
    try {
      await adhesion.totalSupply({ gasLimit: 2_000_000 });
    } catch (e) {
      failed = true;
    }
    expect(failed).to.equal(true);
  });
});

describe("AdhesionRescoe — burn, évolution, ETH", () => {
  it("burnNFT : +10 points, TokenBurned, token détruit ; le DUST du relayer est payé PAR LE CONTRAT (pas par l'appelant)", async () => {
    const { adhesion, memberA, relayer } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    const pts = await adhesion.rewardPoints(memberA.address);
    const tx = adhesion.connect(memberA).burnNFT(0);
    await expect(tx).to.emit(adhesion, "TokenBurned").withArgs(0, memberA.address);
    await expect(tx).to.changeEtherBalances([adhesion, relayer, memberA], [-DUST, DUST, 0]);
    expect(await adhesion.rewardPoints(memberA.address)).to.equal(pts + 10n);
    await expect(adhesion.ownerOf(0)).to.be.revertedWithCustomError(adhesion, "ERC721NonexistentToken");
  });

  it("[F-ADH-06b] burnNFT revert quand le contrat n'a plus 0.0001 ETH (après withdraw) : brûlage bloqué", async () => {
    const { adhesion, memberA, vault } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await adhesion.connect(vault).withdraw(); // le contrat est vidé par l'owner
    await expect(adhesion.connect(memberA).burnNFT(0)).to.be.reverted;
    expect(await adhesion.ownerOf(0)).to.equal(memberA.address); // l'adhérent ne peut plus brûler son token
  });

  it("[F-ADH-05] après burnNFT, getTokensByOwner liste toujours le token brûlé (liste obsolète)", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await adhesion.connect(memberA).burnNFT(0);
    expect(await adhesion.getTokensByOwner(memberA.address)).to.deep.equal([0n]); // token inexistant encore listé
    expect((await adhesion.members(memberA.address)).exists).to.equal(true); // et le membre reste « existant »
  });

  it("evolveManual : refusé avant le délai (« Level not ready »), accepté après, ID du token change", async () => {
    const { adhesion, memberA, relayer } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    await expect(adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: DUST })).to.be.revertedWith("Level not ready");
    await time.increase(7 * DAY);
    await expect(adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: DUST - 1n })).to.be.revertedWith("Dust required");
    const tx = adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: DUST });
    await expect(tx).to.emit(adhesion, "LevelEvolved").withArgs(1, 1);
    await expect(tx).to.changeEtherBalances([memberA, relayer], [-DUST, DUST]);
    expect((await adhesion.membershipInfo(1)).level).to.equal(1); // 1re évolution : niveau 1 (correct, par coïncidence — voir F-ADH-18)
    expect(await adhesion.tokenURI(1)).to.equal("ipfs://l1");
    await expect(adhesion.ownerOf(0)).to.be.revertedWithCustomError(adhesion, "ERC721NonexistentToken"); // ancien token brûlé
    // double évolution / replay du même token impossible
    await expect(adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: DUST })).to.be.reverted;
  });

  it("[F-ADH-18] evolveManual lit `info` (pointeur storage) APRÈS `delete membershipInfo[old]` : niveau bloqué à 1, totalYears et autoEvolve perdus", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true, auto: true }); // level 0, totalYears 1, autoEvolve true
    await time.increase(7 * DAY);
    await adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: DUST }); // -> token 1
    let info = await adhesion.membershipInfo(1);
    expect(info.level).to.equal(1);
    expect(info.totalYears).to.equal(0); // PERDU (était 1)  => le token ne pourra jamais servir à reproduce()
    expect(info.autoEvolve).to.equal(false); // PERDU (était true)

    await time.increase(56 * DAY); // délai du niveau 1 respecté
    await expect(adhesion.connect(memberA).evolveManual(1, "ipfs://l2", { value: DUST }))
      .to.emit(adhesion, "LevelEvolved")
      .withArgs(2, 1); // l'événement annonce « niveau 1 » alors qu'on évolue du niveau 1
    info = await adhesion.membershipInfo(2);
    expect(info.level).to.equal(1); // devrait être 2 : le niveau n'augmente plus jamais
    // cycle sans fin : on peut payer éternellement sans jamais atteindre le niveau 3
    await time.increase(56 * DAY);
    await adhesion.connect(memberA).evolveManual(2, "ipfs://l3", { value: DUST });
    expect((await adhesion.membershipInfo(3)).level).to.equal(1);
  });

  it("[F-ADH-18b] conséquence : par evolveManual, ni niveau 3 ni reproduction ne sont atteignables (seul burnAndUpgrade, sans délai, le permet)", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    let id = 0n;
    for (let i = 0; i < 4; i++) {
      await time.increase(120 * DAY);
      await adhesion.connect(memberA).evolveManual(id, "ipfs://x", { value: DUST });
      id += 1n;
    }
    expect((await adhesion.membershipInfo(id)).level).to.be.lt(3);
    expect(await adhesion.MAX_LEVEL()).to.equal(3);
  });

  it("evolveManual / burnAndUpgrade : un tiers ne peut pas faire évoluer le token d'autrui", async () => {
    const { adhesion, memberA, attacker } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    await time.increase(8 * DAY);
    await expect(adhesion.connect(attacker).evolveManual(0, "x", { value: DUST })).to.be.revertedWith("Not owner");
    await expect(adhesion.connect(attacker).burnAndUpgrade(0, "x", { value: DUST })).to.be.revertedWith("Not owner");
  });

  it("[F-ADH-11] evolveManual / burnAndUpgrade : le trop-perçu n'est PAS remboursé (reste dans le contrat)", async () => {
    const { adhesion, memberA, relayer } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    await time.increase(8 * DAY);
    const sent = DUST + ethers.parseEther("1");
    await expect(adhesion.connect(memberA).evolveManual(0, "ipfs://l1", { value: sent })).to.changeEtherBalances(
      [memberA, relayer, adhesion],
      [-sent, DUST, ethers.parseEther("1")] // 1 ETH capturé par le contrat
    );
  });

  it("[F-ADH-04] burnAndUpgrade n'a AUCUN contrôle de délai : niveau 3 immédiat pour 3×DUST (+10 points par burn)", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true }); // token 0, niveau 0, à l'instant T
    const p0 = await adhesion.rewardPoints(memberA.address);
    await adhesion.connect(memberA).burnAndUpgrade(0, "ipfs://l1", { value: DUST });
    await adhesion.connect(memberA).burnAndUpgrade(1, "ipfs://l2", { value: DUST });
    await adhesion.connect(memberA).burnAndUpgrade(2, "ipfs://l3", { value: DUST });
    expect((await adhesion.membershipInfo(3)).level).to.equal(3); // « insecte » sans aucune attente
    expect(await adhesion.rewardPoints(memberA.address)).to.equal(p0 + 30n);
    // alors que le chemin légitime (evolveManual) impose 7j + 56j + 112j
    await expect(adhesion.connect(memberA).burnAndUpgrade(3, "x", { value: DUST })).to.be.revertedWith("Already max level");
  });

  it("[F-ADH-04b] burnAndUpgrade ne nettoie pas membershipInfo de l'ancien token (état fantôme)", async () => {
    const { adhesion, memberA } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    await adhesion.connect(memberA).burnAndUpgrade(0, "ipfs://l1", { value: DUST });
    expect((await adhesion.membershipInfo(0)).expirationTimestamp).to.be.gt(0); // vs evolveManual qui fait delete
  });
});

describe("AdhesionRescoe — reproduction", () => {
  /** Prépare un membre avec 2 parents niveau 3 (annuels) par le chemin le plus court (burnAndUpgrade), + points donnés par F-ADH-01. */
  async function parents(adhesion, m, attacker) {
    await moveToMidYear();
    await mint(adhesion, m, { annual: true });
    await mint(adhesion, m, { annual: true });
    // IDs : mints 0 et 1 ; upgrades : 0->2, 1->3, 2->4, 3->5, 4->6 (parent A, niveau 3), 5->7 (parent B, niveau 3)
    await adhesion.connect(m).burnAndUpgrade(0, "u", { value: DUST }); // -> 2
    await adhesion.connect(m).burnAndUpgrade(1, "u", { value: DUST }); // -> 3
    await adhesion.connect(m).burnAndUpgrade(2, "u", { value: DUST }); // -> 4
    await adhesion.connect(m).burnAndUpgrade(3, "u", { value: DUST }); // -> 5
    await adhesion.connect(m).burnAndUpgrade(4, "u", { value: DUST }); // -> 6 (A niveau 3)
    await adhesion.connect(m).burnAndUpgrade(5, "u", { value: DUST }); // -> 7 (B niveau 3)
    return { a: 6n, b: 7n };
  }

  it("chaîne complète : parents niveau 3 + 100 points ⇒ œuf niveau 0 ; points consommés exactement ; paiements corrects ; événement Reproduced ABSENT", async () => {
    const { adhesion, memberA, attacker, relayer, vault } = await loadFixture(fixture);
    const { a, b } = await parents(adhesion, memberA, attacker);
    expect((await adhesion.membershipInfo(a)).level).to.equal(3);
    expect((await adhesion.membershipInfo(b)).level).to.equal(3);

    // points : 2 mints (30) + 6 upgrades (60) = 90 < 100 → refus légitime
    await expect(adhesion.connect(memberA).reproduce(a, b, { value: MINT_PRICE / 2n + DUST })).to.be.revertedWith("Not enough points");
    await adhesion.connect(attacker).mettreAJourPoints(memberA.address, 10); // l'attaquant « offre » 10 points (F-ADH-01)
    const p0 = await adhesion.rewardPoints(memberA.address);
    expect(p0).to.equal(100);

    const price = MINT_PRICE / 2n + DUST;
    const tx = adhesion.connect(memberA).reproduce(a, b, { value: price + 12345n });
    await expect(tx).to.changeEtherBalances([memberA, relayer, vault, adhesion], [-price, DUST, MINT_PRICE / 2n, 0]);
    await expect(tx).to.emit(adhesion, "RewardsDeducted").withArgs(memberA.address, 100);
    await expect(tx).to.not.emit(adhesion, "Reproduced"); // [F-ADH-10] l'événement de généalogie n'est jamais émis
    expect(await adhesion.rewardPoints(memberA.address)).to.equal(0);

    const egg = 8n;
    const info = await adhesion.membershipInfo(egg);
    expect(info.level).to.equal(0);
    expect(info.totalYears).to.equal(0);
    expect(info.autoEvolve).to.equal(true);
    expect(await adhesion.tokenURI(egg)).to.equal("ipfs://oeuf_uri"); // URI figée en dur
    expect(adhesion.interface.hasFunction("reproductionParents")).to.equal(false); // [F-ADH-10] aucune généalogie on-chain
  });

  it("garde-fous : parents identiques, propriétaires différents, non-propriétaire, niveau < 3, prix insuffisant", async () => {
    const { adhesion, memberA, memberB, attacker } = await loadFixture(fixture);
    const { a, b } = await parents(adhesion, memberA, attacker);
    await adhesion.connect(attacker).mettreAJourPoints(memberA.address, 1000);
    const price = MINT_PRICE / 2n + DUST;
    await expect(adhesion.connect(memberA).reproduce(a, a, { value: price })).to.be.revertedWith("Parents must be different");
    await expect(adhesion.connect(memberA).reproduce(a, b, { value: price - 1n })).to.be.revertedWith("Half price + dust");
    await expect(adhesion.connect(memberB).reproduce(a, b, { value: price })).to.be.revertedWith("Not owner");
    await adhesion.connect(memberA).transferFrom(memberA.address, memberB.address, b);
    await expect(adhesion.connect(memberA).reproduce(a, b, { value: price })).to.be.revertedWith("Same owner required");
  });

  it("[F-ADH-10] aucune limite de reproduction : mêmes parents, œufs à volonté tant que les points suffisent (et ils sont gratuits)", async () => {
    const { adhesion, memberA, attacker } = await loadFixture(fixture);
    const { a, b } = await parents(adhesion, memberA, attacker);
    await adhesion.connect(attacker).mettreAJourPoints(memberA.address, 10_000); // F-ADH-01
    const price = MINT_PRICE / 2n + DUST;
    for (let i = 0; i < 5; i++) await adhesion.connect(memberA).reproduce(a, b, { value: price });
    expect((await adhesion.getTokensByOwner(memberA.address)).length).to.be.gte(5 + 8);
    expect((await adhesion.membershipInfo(a)).level).to.equal(3); // parents intacts, non verrouillés, non brûlés
  });
});

describe("AdhesionRescoe — transferts (règles de non-transférabilité)", () => {
  it("[F-ADH-08] une adhésion ACTIVE est librement transférable via transferFrom (la règle n'existe que dans listTokenForSale, inutilisable)", async () => {
    const { adhesion, memberA, memberB } = await loadFixture(fixture);
    await mint(adhesion, memberA, { annual: true });
    expect(await adhesion.membershipInfo(0).then((i) => i.expirationTimestamp)).to.be.gt(await time.latest());
    await adhesion.connect(memberA).transferFrom(memberA.address, memberB.address, 0);
    expect(await adhesion.ownerOf(0)).to.equal(memberB.address);
  });

  it("[F-ADH-08b] un œuf (niveau 0) est transférable ; l'état membre/liste n'est pas mis à jour (incohérences ownership/membre)", async () => {
    const { adhesion, memberA, memberB } = await loadFixture(fixture);
    await mint(adhesion, memberA);
    await adhesion.connect(memberA).transferFrom(memberA.address, memberB.address, 0);
    expect((await adhesion.members(memberB.address)).exists).to.equal(false); // le receveur n'est pas « membre »
    expect(await adhesion.getTokensByOwner(memberA.address)).to.deep.equal([0n]); // l'émetteur « possède » encore l'ID
    expect(await adhesion.getTokensByOwner(memberB.address)).to.deep.equal([]); // le receveur n'a rien
    expect(await adhesion.ownerOf(0)).to.equal(memberB.address);
  });
});

describe("AdhesionRescoe — réentrance & robustesse", () => {
  it("réentrance via onERC721Received : la limite de 2 mints/an tient (compteur incrémenté avant _safeMint)", async () => {
    const { adhesion, deployer, vault } = await loadFixture(fixture);
    await moveToMidYear();
    const re = await deploy("ReentrantReceiver", deployer);
    await deployer.sendTransaction({ to: await re.getAddress(), value: ethers.parseEther("1") });
    const payload = adhesion.interface.encodeFunctionData("safeMint", ["ipfs://re", 1, "re", "re", false, false]);
    await re.arm(await adhesion.getAddress(), payload, MINT_PRICE + DUST, 5);
    const outer = adhesion.interface.encodeFunctionData("safeMint", ["ipfs://re", 1, "re", "re", false, false]);
    const [ok] = await re.execute.staticCall(await adhesion.getAddress(), outer, MINT_PRICE + DUST);
    expect(ok).to.equal(true);
    await re.execute(await adhesion.getAddress(), outer, MINT_PRICE + DUST);
    const tokens = await adhesion.getTokensByOwner(await re.getAddress());
    expect(tokens.length).to.be.lte(2); // jamais plus de 2 sur l'année
  });

  it("accès : un contrat refusant l'ETH ne bloque pas safeMint (aucun paiement push vers le minteur)", async () => {
    const { adhesion, deployer } = await loadFixture(fixture);
    const rej = await deploy("RejectingReceiver", deployer);
    await rej.execute(deployer.address, "0x", 0, { value: ethers.parseEther("1") }); // receive() revert : on finance via execute() payable
    const data = adhesion.interface.encodeFunctionData("safeMint", ["u", 1, "n", "b", false, false]);
    // trop-perçu = 0 ⇒ aucun remboursement ; le mint passe. Avec trop-perçu, le remboursement .transfer() vers un contrat qui refuse fait revert :
    await expect(rej.execute(await adhesion.getAddress(), data, MINT_PRICE + DUST)).to.not.be.reverted;
    const over = await rej.execute.staticCall(await adhesion.getAddress(), data, MINT_PRICE + DUST + 1n);
    expect(over[0]).to.equal(false); // remboursement vers un contrat qui refuse l'ETH ⇒ mint refusé
  });
});
