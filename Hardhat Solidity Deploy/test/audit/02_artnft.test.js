/**
 * AUDIT — ArtFactory + ArtNFT (source RÉCUPÉRÉE : build-info e7e63d83…/{ArtFactory,mintArt}.sol)
 * "[F-ART-xx] / [F-FAC-xx]" = test qui démontre un défaut (vert tant que le défaut existe).
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, time, ZERO, actors, deploy, deployArtNFT, createArtCollection } = require("./helpers/fixtures");

const E = ethers.parseEther;

/** Répartition attendue d'une vente PRIMAIRE (seller == artiste), calquée sur buyNFT. */
function splitPrimary(price, percents) {
  const fee = (price * 10n) / 100n;
  const rem = price - fee;
  const extra = percents.map((p) => {
    let s = (rem * BigInt(p)) / 100n;
    if (s > rem / 2n) s = rem / 2n;
    return s;
  });
  const totalExtra = extra.reduce((a, b) => a + b, 0n);
  return { fee, extra, artist: rem - totalExtra, seller: 0n, dust: 0n };
}

/** Répartition attendue d'une REVENTE. */
function splitSecondary(price, percents) {
  const seller = (price * 90n) / 100n;
  const pool = price - seller;
  const fee = (pool * 30n) / 100n;
  const base = (pool * 70n) / 100n;
  const extra = percents.map((p) => (base * BigInt(p)) / 100n);
  const totalExtra = extra.reduce((a, b) => a + b, 0n);
  return { fee, extra, artist: base - totalExtra, seller, dust: price - seller - fee - base };
}

async function setup({ extras = [], percents = [], maxSupply = 1000, assocKey = "vault" } = {}) {
  const a = await actors();
  const reward = await deploy("RewardMock", a.deployer);
  const assoc = assocKey === "vault" ? a.vault.address : assocKey; // "vault" ou une adresse 0x…
  const extraAddrs = extras.map((k) => (k.startsWith("0x") ? k : a[k].address));
  const art = await deployArtNFT({
    owner: a.artist, reward: await reward.getAddress(), association: assoc, extras: extraAddrs, percents, maxSupply,
  });
  return { ...a, reward, art, extraAddrs };
}

describe("ArtNFT — constructeur, permissions, mint", () => {
  it("le constructeur valide : part association ≤ 100, tableaux alignés, somme des extras ≤ 100", async () => {
    const a = await actors();
    const rw = await deploy("RewardMock", a.deployer);
    const r = await rw.getAddress();
    const mk = (share, ex, pc) => deploy("ArtNFT", a.artist, a.artist.address, "n", "s", 1, "Art", r, a.vault.address, share, 10, ex, pc);
    await expect(mk(101, [], [])).to.be.revertedWith("association share must be <=100");
    await expect(mk(100, [a.extra1.address], [])).to.be.revertedWith("extra arrays mismatch");
    await expect(mk(100, [a.extra1.address, a.extra2.address], [60, 41])).to.be.revertedWith("extra percents too high");
    await expect(mk(100, [a.extra1.address, a.extra2.address], [60, 40])).to.not.be.reverted;
  });

  it("mint est onlyOwner ; editions > 0 ; plafond maxSupply ; rareté dans [1..255] ; supply et éditions suivis", async () => {
    const { art, artist, attacker } = await setup({ maxSupply: 10 });
    await expect(art.connect(attacker).mint("ipfs://x", 1)).to.be.revertedWithCustomError(art, "OwnableUnauthorizedAccount");
    await expect(art.connect(artist).mint("ipfs://x", 0)).to.be.revertedWith("Vous devez choisir un nombre d'editions superieur a zero");
    await expect(art.connect(artist).mint("ipfs://x", 11)).to.be.revertedWith("Maximum d'oeuvre dans la collection atteinte");
    await art.connect(artist).mint("ipfs://x", 4);
    await art.connect(artist).mint("ipfs://y", 1);
    expect(await art.totalSupply()).to.equal(5);
    expect(await art.ownerOf(1)).to.equal(artist.address);
    expect(await art.tokenCreator(1)).to.equal(artist.address);
    for (const id of [1, 4, 5]) {
      const r = await art.tokenRarity(id);
      expect(r).to.be.gte(1);
      expect(r).to.be.lte(255);
    }
    expect(await art.tokenRarity(5)).to.be.lt(await art.tokenRarity(1)); // 1 édition = plus rare que 4 éditions
    const [uniques, counts] = await art.getTokenUniquesPaginated(0, 10);
    expect(uniques.map(Number)).to.deep.equal([1, 2]);
    expect(counts.map(Number)).to.deep.equal([4, 1]);
    await expect(art.connect(artist).mint("ipfs://z", 6)).to.be.revertedWith("Maximum d'oeuvre dans la collection atteinte");
  });

  it("[F-ART-12] le plafond porte sur le supply VIVANT : brûler puis re-minter dépasse le nombre cumulé d'œuvres", async () => {
    const { art, artist } = await setup({ maxSupply: 2 });
    await art.connect(artist).mint("ipfs://x", 2);
    await art.connect(artist).burn(1);
    await art.connect(artist).mint("ipfs://y", 1);
    expect(await art.totalSupply()).to.equal(2);
    expect(await art.getLastMintedTokenId()).to.equal(3); // 3 tokens créés pour un maxSupply de 2
  });

  it("burn : réservé au propriétaire du token ; nettoie état de vente, supply et éditions", async () => {
    const { art, artist, attacker } = await setup();
    await art.connect(artist).mint("ipfs://x", 2);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await expect(art.connect(attacker).burn(1)).to.be.revertedWith("You do not own this NFT");
    await art.connect(artist).burn(1);
    expect(await art.totalSupply()).to.equal(1);
    expect(await art.doesTokenExist(1)).to.equal(false);
    expect(await art.isNFTForSale(1)).to.equal(false);
  });

  it("[F-ART-06] le owner ou le créateur peut réécrire la rareté de N'IMPORTE QUEL token, même après vente", async () => {
    const { art, artist, buyer, attacker } = await setup();
    await art.connect(artist).mint("ipfs://x", 100);
    await art.connect(artist).listNFTForSale(100, E("1"));
    await art.connect(buyer).buyNFT(100, { value: E("1") });
    const before = await art.tokenRarity(100);
    await art.connect(artist).setTokenMetadataOnChain(100, 255); // l'artiste dégrade/améliore à volonté
    expect(await art.tokenRarity(100)).to.equal(255).and.to.not.equal(before);
    await expect(art.connect(attacker).setTokenMetadataOnChain(100, 1)).to.be.revertedWith("Not allowed");
    await expect(art.connect(artist).setTokenMetadataOnChain(100, 0)).to.be.revertedWith("Rarity must be 1..255");
  });
});

describe("ArtNFT — vente primaire : prix, remboursement, répartition, points", () => {
  it("prix exact : association 10 %, extras (plafonnés), artiste = reste ; contrat à 0 ; points conservés", async () => {
    const percents = [30, 20];
    const { art, artist, buyer, vault, extra1, extra2, reward } = await setup({ extras: ["extra1", "extra2"], percents });
    await art.connect(artist).mint("ipfs://x", 1);
    const price = E("1");
    await art.connect(artist).listNFTForSale(1, price);
    const s = splitPrimary(price, percents);
    const tx = art.connect(buyer).buyNFT(1, { value: price });
    await expect(tx).to.changeEtherBalances(
      [buyer, vault, extra1, extra2, artist, art],
      [-price, s.fee, s.extra[0], s.extra[1], s.artist, 0]
    );
    await expect(tx).to.emit(art, "NFTSold").withArgs(1, buyer.address, price);
    expect(await art.ownerOf(1)).to.equal(buyer.address);
    expect(s.fee + s.extra[0] + s.extra[1] + s.artist).to.equal(price); // aucune distribution > prix, aucune perte
    // points : 1000 pts / ETH répartis proportionnellement, somme = total
    const total = (price * 1000n) / E("1");
    const pts = [vault, extra1, extra2, artist].map((x) => reward.points(x.address));
    const sum = (await Promise.all(pts)).reduce((x, y) => x + y, 0n);
    expect(sum).to.equal(total);
  });

  it("sous-paiement refusé ; surpaiement remboursé (rien ne reste dans le contrat en vente primaire)", async () => {
    const { art, artist, buyer } = await setup();
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") - 1n })).to.be.revertedWith("Insufficient funds");
    await expect(art.connect(buyer).buyNFT(1, { value: E("3") })).to.changeEtherBalances([buyer, art], [-E("1"), 0]);
  });

  it("garde-fous : propre NFT, hors vente, inexistant ; annonce supprimée après achat", async () => {
    const { art, artist, buyer } = await setup();
    await art.connect(artist).mint("ipfs://x", 1);
    await expect(art.connect(buyer).buyNFT(1, { value: 1 })).to.be.revertedWith("NFT not for sale");
    await art.connect(artist).listNFTForSale(1, E("1"));
    await expect(art.connect(artist).buyNFT(1, { value: E("1") })).to.be.revertedWith("Cannot buy your own NFT");
    await expect(art.connect(buyer).buyNFT(99, { value: 1 })).to.be.revertedWith("Token does not exist");
    await art.connect(buyer).buyNFT(1, { value: E("1") });
    expect(await art.isNFTForSale(1)).to.equal(false);
    await expect(art.connect(artist).buyNFT(1, { value: E("1") })).to.be.revertedWith("NFT not for sale");
    await expect(art.connect(buyer).listNFTForSale(1, 0)).to.be.revertedWith("Price > 0");
    await expect(art.connect(artist).listNFTForSale(1, 5)).to.be.revertedWith("Not owner");
  });

  it("[F-ART-09] extraPercents : plafonné à 50 % du net en primaire (100 % déclaré ⇒ 50 % payé) mais PAS en revente (100 % payé)", async () => {
    const { art, artist, buyer, extra1, vault } = await setup({ extras: ["extra1"], percents: [100] });
    await art.connect(artist).mint("ipfs://x", 2);
    const P = E("1");
    await art.connect(artist).listNFTForSale(1, P);
    // primaire : extra reçoit 0.45 (50 % de 0.9) au lieu de 0.9
    await expect(art.connect(buyer).buyNFT(1, { value: P })).to.changeEtherBalances([extra1, artist, vault], [E("0.45"), E("0.45"), E("0.1")]);
    // revente : extra reçoit 100 % du pool créateur (7 % du prix)
    await art.connect(buyer).listNFTForSale(1, P);
    await expect(art.connect(extra1).buyNFT(1, { value: P })).to.changeEtherBalances([extra1, artist], [E("0.07") - P, 0]);
  });
});

describe("ArtNFT — revente : 90/3/7, poussière, évasion de frais, états", () => {
  it("revente : vendeur 90 %, association 3 %, artiste/extras 7 % ; somme exacte", async () => {
    const percents = [40];
    const { art, artist, buyer, memberA, vault, extra1 } = await (async () => {
      const x = await setup({ extras: ["extra1"], percents });
      return { ...x };
    })();
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).transferFrom(artist.address, memberA.address, 1); // memberA devient vendeur « secondaire »
    const P = E("2");
    await art.connect(memberA).listNFTForSale(1, P);
    const s = splitSecondary(P, percents);
    await expect(art.connect(buyer).buyNFT(1, { value: P })).to.changeEtherBalances(
      [buyer, memberA, vault, extra1, artist, art],
      [-P, s.seller, s.fee, s.extra[0], s.artist, s.dust]
    );
    expect(s.seller + s.fee + s.extra[0] + s.artist + s.dust).to.equal(P);
    expect(s.seller).to.equal(E("1.8")); // 90 %
    expect(s.fee).to.equal(E("0.06")); // 3 %
  });

  it("[F-ART-04] poussière : prix impair en revente ⇒ 1 wei reste bloqué dans le contrat (aucune fonction de retrait)", async () => {
    const { art, artist, buyer, memberA } = await setup();
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).transferFrom(artist.address, memberA.address, 1);
    await art.connect(memberA).listNFTForSale(1, 1001n);
    await art.connect(buyer).buyNFT(1, { value: 1001n });
    expect(await ethers.provider.getBalance(await art.getAddress())).to.equal(1n);
    const fn = art.interface.fragments.filter((f) => f.type === "function").map((f) => f.name);
    const writers = art.interface.fragments.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f) => f.name);
    expect(writers.filter((n) => /withdraw|rescue|sweep|claim/i.test(n))).to.deep.equal([]); // aucun retrait possible
    expect(fn).to.include("pendingWithdrawals"); // mapping public jamais alimenté
    expect(art.interface.fragments.some((f) => f.type === "receive")).to.equal(false);
  });

  it("[F-ART-05] évasion de frais : primaire via 2e wallet (transfert puis « revente ») ⇒ association 3 % au lieu de 10 %", async () => {
    const P = E("10");
    const direct = await setup();
    await direct.art.connect(direct.artist).mint("ipfs://x", 1);
    await direct.art.connect(direct.artist).listNFTForSale(1, P);
    const t1 = direct.art.connect(direct.buyer).buyNFT(1, { value: P });
    await expect(t1).to.changeEtherBalance(direct.vault, E("1")); // 10 %

    const bypass = await setup();
    await bypass.art.connect(bypass.artist).mint("ipfs://x", 1);
    await bypass.art.connect(bypass.artist).transferFrom(bypass.artist.address, bypass.extra3.address, 1); // 2e wallet de l'artiste
    await bypass.art.connect(bypass.extra3).listNFTForSale(1, P);
    const t2 = bypass.art.connect(bypass.buyer).buyNFT(1, { value: P });
    await expect(t2).to.changeEtherBalance(bypass.vault, E("0.3")); // 3 % seulement
    // l'artiste (via ses 2 wallets) encaisse 9 + 0.7 = 9.7 ETH au lieu de 9
  });

  it("[F-ART-01] annonce PÉRIMÉE : le flag « en vente » survit à un transfert ⇒ n'importe qui rachète le NFT de la victime au vieux prix", async () => {
    const { art, artist, attacker, extra1: victim } = await setup();
    await art.connect(artist).mint("ipfs://chef-d-oeuvre", 1);
    await art.connect(artist).listNFTForSale(1, E("0.001")); // annonce à 0.001 ETH
    await art.connect(artist).transferFrom(artist.address, victim.address, 1); // vendu ailleurs (ex. place de marché) : l'annonce n'est PAS retirée
    expect(await art.isNFTForSale(1)).to.equal(true);
    expect(await art.getTokenPrice(1)).to.equal(E("0.001"));
    // l'attaquant « achète » le NFT de la victime sans son accord, au vieux prix
    await expect(art.connect(attacker).buyNFT(1, { value: E("0.001") })).to.changeEtherBalance(victim, E("0.0009"));
    expect(await art.ownerOf(1)).to.equal(attacker.address); // NFT volé (la victime reçoit 90 % de 0.001 ETH)
  });

  it("états : transfert approuvé n'efface ni prix ni flag ; burn et achat les effacent", async () => {
    const { art, artist, buyer } = await setup();
    await art.connect(artist).mint("ipfs://x", 2);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await art.connect(artist).listNFTForSale(2, E("1"));
    await art.connect(artist).burn(2);
    expect(await art.isNFTForSale(2)).to.equal(false);
    await art.connect(buyer).buyNFT(1, { value: E("1") });
    expect(await art.isNFTForSale(1)).to.equal(false);
    expect((await art.getPriceHistory(1)).length).to.equal(1);
    expect((await art.getTransactionHistory(1)).length).to.equal(1);
  });
});

describe("ArtNFT — disponibilité : paiements « push », dépendances, bornes de gas", () => {
  it("[F-ART-02] un extraRecipient qui refuse l'ETH bloque TOUTES les ventes primaires et reventes de la collection", async () => {
    const a = await actors();
    const rej = await deploy("RejectingReceiver", a.deployer);
    const { art, artist, buyer } = await setup({ extras: [await rej.getAddress()], percents: [10] });
    await art.connect(artist).mint("ipfs://x", 2);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") })).to.be.revertedWith("Extra payment failed");
    // la liste d'extras est immuable (aucun setter) : blocage définitif de la collection
    expect(art.interface.fragments.filter((f) => f.type === "function" && /extra|recipient|royalt/i.test(f.name) && !f.constant && f.stateMutability !== "view").length).to.equal(0);
  });

  it("[F-ART-02b] une association qui refuse l'ETH (ex. contrat sans receive) bloque toutes les ventes", async () => {
    const a = await actors();
    const rej = await deploy("RejectingReceiver", a.deployer);
    const { art, artist, buyer } = await setup({ assocKey: await rej.getAddress() });
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") })).to.be.revertedWith("Association payment failed");
  });

  it("[F-ART-10] association / extra = address(0) : la part est ENVOYÉE à l'adresse nulle (ETH brûlé), sans erreur", async () => {
    const { art, artist, buyer } = await setup({ assocKey: ZERO, extras: [ZERO], percents: [50] });
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).listNFTForSale(1, E("1"));
    const before = await ethers.provider.getBalance(ZERO);
    await art.connect(buyer).buyNFT(1, { value: E("1") });
    expect((await ethers.provider.getBalance(ZERO)) - before).to.equal(E("0.1") + E("0.45")); // 10 % + 50 % du net
  });

  it("[F-ART-07] dépendance dure à la contrat de points : si mettreAJourPoints revert, plus aucune vente (ETH rendu, NFT bloqué)", async () => {
    const { art, artist, buyer, reward } = await setup();
    await art.connect(artist).mint("ipfs://x", 1);
    await art.connect(artist).listNFTForSale(1, E("1"));
    await reward.setRevertOnUpdate(true); // ex. correctif de F-ADH-01 ajoutant un contrôle d'accès non prévu pour les collections
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") })).to.be.revertedWith("RewardMock: reverted");
    expect(await art.ownerOf(1)).to.equal(artist.address);
  });

  it("[F-ART-07b] adresse de points nulle (mauvais câblage) : toutes les ventes revert (appel à une adresse sans code)", async () => {
    const a = await actors();
    const art = await deployArtNFT({ owner: a.artist, reward: ZERO, association: a.vault.address });
    await art.connect(a.artist).mint("ipfs://x", 1);
    await art.connect(a.artist).listNFTForSale(1, E("1"));
    await expect(art.connect(a.buyer).buyNFT(1, { value: E("1") })).to.be.reverted;
  });

  it("[F-ART-03] burn() est O(n) sur la collection ET sur les éditions : le coût croît avec l'index du token", async () => {
    const { art, artist } = await setup({ maxSupply: 400 });
    await art.connect(artist).mint("ipfs://big", 150);
    // swap-and-pop : on mesure d'abord le token situé en FIN de tableau (scan complet), puis le token en tête (index 0)
    const gasLast = (await (await art.connect(artist).burn(150)).wait()).gasUsed; // 150 itérations ×2 (collection + éditions)
    const gasFirst = (await (await art.connect(artist).burn(1)).wait()).gasUsed; // trouvé à l'index 0
    console.log(`        burn(token 1)=${gasFirst} gas ; burn(token 150)=${gasLast} gas ; delta/élément ≈ ${(gasLast - gasFirst) / 149n} gas (2 boucles)`);
    expect(gasLast).to.be.gt(gasFirst);
    // extrapolation : au rythme mesuré, un burn en fin d'une collection de ~10 000 éditions dépasserait ~30 M gas
  });
});

describe("ArtNFT — réentrance", () => {
  async function secondarySetup() {
    const s = await setup();
    const re = await deploy("ReentrantReceiver", s.deployer);
    await s.art.connect(s.artist).mint("ipfs://x", 1);
    await s.art.connect(s.artist).transferFrom(s.artist.address, await re.getAddress(), 1); // le contrat réentrant est vendeur « secondaire »
    const list = s.art.interface.encodeFunctionData("listNFTForSale", [1, E("1")]);
    await re.execute(await s.art.getAddress(), list, 0);
    return { ...s, re };
  }

  it("un vendeur-contrat qui ré-appelle buyNFT pendant son paiement est bloqué par nonReentrant (achat OK, ré-entrée KO)", async () => {
    const { art, re, buyer } = await secondarySetup();
    await re.arm(await art.getAddress(), art.interface.encodeFunctionData("buyNFT", [1]), 0, 1);
    await art.connect(buyer).buyNFT(1, { value: E("1") });
    expect(await re.hits()).to.equal(1);
    expect(await re.lastOk()).to.equal(false);
    expect(await art.ownerOf(1)).to.equal(buyer.address);
  });

  it("un vendeur-contrat qui BRÛLE le token pendant son paiement (avant _transfer) fait échouer toute la vente : acheteur indemne", async () => {
    const { art, re, buyer } = await secondarySetup();
    await re.arm(await art.getAddress(), art.interface.encodeFunctionData("burn", [1]), 0, 1);
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") })).to.be.reverted;
    expect(await art.ownerOf(1)).to.equal(await re.getAddress());
    expect(await ethers.provider.getBalance(await art.getAddress())).to.equal(0);
  });

  it("un vendeur-contrat qui TRANSFÈRE le token pendant son paiement fait aussi échouer la vente (ERC721IncorrectOwner)", async () => {
    const { art, re, buyer, attacker } = await secondarySetup();
    const steal = art.interface.encodeFunctionData("transferFrom", [await re.getAddress(), attacker.address, 1]);
    await re.arm(await art.getAddress(), steal, 0, 1);
    await expect(art.connect(buyer).buyNFT(1, { value: E("1") })).to.be.reverted;
    expect(await art.ownerOf(1)).to.equal(await re.getAddress());
  });
});

describe("ArtFactory — permissions et câblage", () => {
  async function stack() {
    const a = await actors();
    const reward = await deploy("RewardMock", a.deployer);
    const factory = await deploy("ArtFactory", a.deployer, await reward.getAddress(), a.vault.address);
    return { ...a, reward, factory };
  }

  it("configureCollection : onlyOwner, maxSupply>0, tableaux alignés, somme ≤ 90", async () => {
    const { factory, attacker, deployer, extra1, extra2 } = await stack();
    await expect(factory.connect(attacker).configureCollection("A", 10, [], [])).to.be.revertedWith("Not owner");
    await expect(factory.connect(deployer).configureCollection("A", 0, [], [])).to.be.revertedWith("Invalid maxSupply");
    await expect(factory.connect(deployer).configureCollection("A", 10, [extra1.address], [])).to.be.revertedWith("Length mismatch");
    await expect(factory.connect(deployer).configureCollection("A", 10, [extra1.address, extra2.address], [50, 41])).to.be.revertedWith("Allocation too high");
    await expect(factory.connect(deployer).configureCollection("A", 10, [extra1.address, extra2.address], [50, 40])).to.not.be.reverted;
  });

  it("owner de la factory : transfert vers 0 refusé, updateAdhesionContract onlyOwner et non nul", async () => {
    const { factory, attacker, deployer, extra1 } = await stack();
    await expect(factory.connect(attacker).transferOwnership(attacker.address)).to.be.revertedWith("Not owner");
    await expect(factory.connect(deployer).transferOwnership(ZERO)).to.be.revertedWith("Zero address");
    await expect(factory.connect(attacker).updateAdhesionContract(attacker.address)).to.be.revertedWith("Not owner");
    await expect(factory.connect(deployer).updateAdhesionContract(ZERO)).to.be.revertedWith("Zero address");
    await factory.connect(deployer).transferOwnership(extra1.address); // transfert en UNE étape, sans acceptation
    await expect(factory.connect(deployer).configureCollection("A", 1, [], [])).to.be.revertedWith("Not owner");
  });

  it("[F-FAC-01] createDynamicCollection n'a AUCUN contrôle d'accès : un attaquant déploie des collections au nom de n'importe qui", async () => {
    const { factory, attacker, deployer, memberA: victim } = await stack();
    await factory.connect(deployer).configureCollection("Rescoe Art", 10, [], []);
    const tx = await factory.connect(attacker).createDynamicCollection("Rescoe Art", "Art", victim.address, 424242);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CollectionCreated");
    expect(ev.args.collectionId).to.equal(424242); // ID de collection usurpé, jamais vu par le ResCoellectionManager
    expect(ev.args.creator).to.equal(victim.address);
    const col = await ethers.getContractAt("ArtNFT", ev.args.collection);
    expect(await col.owner()).to.equal(victim.address); // la victime « possède » une collection qu'elle n'a pas créée
    expect((await factory.getCollections()).length).to.equal(1); // et le registre de la factory est pollué
  });

  it("createDynamicCollection exige une config préalable et un user non nul", async () => {
    const { factory, attacker, deployer } = await stack();
    await expect(factory.connect(attacker).createDynamicCollection("Inconnu", "Art", attacker.address, 1)).to.be.revertedWith("Collection not configured");
    await factory.connect(deployer).configureCollection("Rescoe Art", 10, [], []);
    await expect(factory.connect(attacker).createDynamicCollection("Rescoe Art", "Art", ZERO, 1)).to.be.revertedWith("User address cannot be zero");
  });

  it("[F-FAC-02] câblage de full-deploy.ts : association = ResCoellectionManager (sans receive) ⇒ toute vente ArtNFT revert", async () => {
    const a = await actors();
    const reward = await deploy("RewardMock", a.deployer);
    const manager = await deploy("ResCoellectionManager", a.deployer, a.vault.address, ZERO);
    // scripts/full-deploy.ts : ArtFactory.deploy(adhesionAddr, resCollectionManagerAddr)
    const factory = await deploy("ArtFactory", a.deployer, await reward.getAddress(), await manager.getAddress());
    const art = await createArtCollection(factory, a.deployer, { user: a.artist, id: 1 });
    await art.connect(a.artist).mint("ipfs://x", 1);
    await art.connect(a.artist).listNFTForSale(1, E("1"));
    await expect(art.connect(a.buyer).buyNFT(1, { value: E("1") })).to.be.revertedWith("Association payment failed");
  });

  it("[F-FAC-04] _associationShare codé en dur à 100 et jamais utilisé : la répartition réelle est figée à 10/3/7 %", async () => {
    const { factory, deployer, artist, reward } = Object.assign(await stack(), {});
    const art = await createArtCollection(factory, deployer, { user: artist, id: 1 });
    expect(await art.associationFeeSharePercent()).to.equal(100);
    expect(await art.OWNER_FEE_PERCENTAGE()).to.equal(10);
    expect(await art.minCreatorFee()).to.equal(5); // constantes de frais « pour usage futur », sans effet
  });

  it("[F-ART-11] updateAdhesionContract n'affecte que les NOUVELLES collections : les anciennes gardent l'ancien contrat de points (immuable)", async () => {
    const { factory, deployer, artist, reward, buyer } = await stack();
    const oldArt = await createArtCollection(factory, deployer, { user: artist, id: 1, name: "Old" });
    const newReward = await deploy("RewardMock", deployer);
    await factory.connect(deployer).updateAdhesionContract(await newReward.getAddress());
    await oldArt.connect(artist).mint("ipfs://x", 1);
    await oldArt.connect(artist).listNFTForSale(1, E("1"));
    await oldArt.connect(buyer).buyNFT(1, { value: E("1") });
    expect(await newReward.calls()).to.equal(0); // aucun point vers le nouveau contrat
    expect(await reward.calls()).to.be.gt(0); // tout continue vers l'ancien
    expect(oldArt.interface.fragments.some((f) => f.type === "function" && /reward|adhesion/i.test(f.name) && f.stateMutability !== "view")).to.equal(false);
  });

  it("[F-FAC-03] _generateSymbol coupe sur 2 OCTETS : un nom en caractères multi-octets produit un symbole UTF-8 invalide", async () => {
    const { factory, deployer, artist } = await stack();
    const art = await createArtCollection(factory, deployer, { user: artist, id: 1, name: "日本" });
    let threw = false;
    try { await art.symbol(); } catch { threw = true; }
    expect(threw).to.equal(true);
  });
});
