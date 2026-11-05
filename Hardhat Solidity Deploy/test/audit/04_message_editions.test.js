/**
 * AUDIT — MessageEditions + MessageFactory (source RÉCUPÉRÉE : build-info d6da8606…)
 * "[F-MSG-xx]" = test qui démontre un défaut (vert tant que le défaut existe).
 */
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers, time, ZERO, actors, deploy, deployStack } = require("./helpers/fixtures");

const E = ethers.parseEther;
const P = E("1");
const mid = (s) => ethers.id(s);
const dec = (uri) => JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));

async function setup({ requires = false, royaltyKey = "extra1", ownerKey = "artist" } = {}) {
  const a = await actors();
  const reward = await deploy("RewardMock", a.deployer);
  const royalty = royaltyKey === "ZERO" ? ZERO : a[royaltyKey].address;
  const ownerAddr = ownerKey.startsWith("0x") ? ownerKey : a[ownerKey].address;
  const c = await deploy("MessageEditions", a.deployer, ownerAddr, "Salon Haiku", "SH", 1, "Message", await reward.getAddress(), "Salon Haiku", requires, royalty);
  return { ...a, reward, c };
}

async function setupMembership() {
  return setup({ requires: true });
}

async function mintMsg(c, signer, o = {}) {
  const ts = o.ts ?? (await time.latest());
  const price = o.price ?? P;
  return c.connect(signer).mint(
    o.id ?? mid("m0"), o.haiku ?? "an old pond\na frog jumps in", price, o.salonRoyalty ?? ZERO, o.image ?? "",
    ts, o.dur ?? 0, o.max ?? 0, o.open ?? false, o.extras ?? [], o.pcts ?? [], { value: o.value ?? price }
  );
}

describe("MessageEditions — permissions & validations", () => {
  it("owner = initialOwner ; setDefaultRoyalties/defineRoyalties/updateDefaultRoyaltyAddress réservés à l'owner", async () => {
    const { c, artist, attacker, extra1 } = await loadFixture(setup);
    expect(await c.owner()).to.equal(artist.address);
    const denied = (p) => expect(p).to.be.revertedWithCustomError(c, "OwnableUnauthorizedAccount");
    await denied(c.connect(attacker).setDefaultRoyalties([attacker.address], [10000]));
    await denied(c.connect(attacker).defineRoyalties([attacker.address], [10000]));
    await denied(c.connect(attacker).updateDefaultRoyaltyAddress(attacker.address));
    await denied(c.connect(attacker).transferOwnership(attacker.address));
    await expect(c.connect(artist).updateDefaultRoyaltyAddress(ZERO)).to.be.revertedWith("Invalid address");
    await expect(c.connect(artist).setDefaultRoyalties([extra1.address], [5000, 5000])).to.be.revertedWith("Length mismatch");
    await expect(c.connect(artist).setDefaultRoyalties([extra1.address], [10001])).to.be.revertedWith("Total > 100%");
    await expect(c.connect(artist).setDefaultRoyalties([ZERO], [100])).to.be.revertedWith("Invalid recipient");
    await expect(c.connect(artist).defineRoyalties([extra1.address], [10001])).to.be.revertedWith("Total > 100%");
  });

  it("mint : haiku non vide, prix > 0, msg.value == prix exact (sous-paiement ET surpaiement refusés)", async () => {
    const { c, memberA } = await loadFixture(setup);
    await expect(mintMsg(c, memberA, { haiku: "" })).to.be.revertedWith("Haiku cannot be empty");
    await expect(mintMsg(c, memberA, { price: 0n, value: 0n })).to.be.revertedWith("Price must be > 0");
    await expect(mintMsg(c, memberA, { value: P - 1n })).to.be.revertedWith("Incorrect msg.value");
    await expect(mintMsg(c, memberA, { value: P + 1n })).to.be.revertedWith("Incorrect msg.value");
    await expect(mintMsg(c, memberA)).to.not.be.reverted;
  });

  it("requiresMembership : refusé sans adhésion valide, accepté avec", async () => {
    const { c, memberA, reward } = await loadFixture(setupMembership);
    await expect(mintMsg(c, memberA)).to.be.revertedWith("Adhesion required to mint in this salon");
    await reward.setValid(memberA.address, true);
    await expect(mintMsg(c, memberA)).to.not.be.reverted;
  });

  it("[F-MSG-09] avec le VRAI AdhesionRescoe, un salon à adhésion est inutilisable : getUserInfo revert même pour un membre valide", async () => {
    const { adhesion, memberA, messageFactory, deployer } = await deployStack();
    await messageFactory.connect(deployer).configureSalon("Salon Membres", true, deployer.address);
    const tx = await messageFactory.connect(memberA).createDynamicCollection("Salon Membres", "Message", memberA.address, 7);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return messageFactory.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CollectionCreated");
    const col = await ethers.getContractAt("MessageEditions", ev.args.collection);
    await adhesion.connect(memberA).safeMint("ipfs://m", 1, "A", "b", true, true, { value: E("0.0051") });
    await expect(mintMsg(col, memberA)).to.be.revertedWith("Token does not exist");
  });
});

describe("MessageEditions — mint : répartition des fonds", () => {
  it("50 % owner ; 50 % restants : extras en bps, le salon prend le reste ; contrat à 0 ; somme = msg.value", async () => {
    const { c, memberA, artist, extra1: salon, extra2 } = await loadFixture(setup);
    const tx = mintMsg(c, memberA, { extras: [extra2.address], pcts: [2000] });
    await expect(tx).to.changeEtherBalances([memberA, artist, salon, extra2, c], [-P, E("0.5"), E("0.4"), E("0.1"), 0]);
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(0);
  });

  it("extras > 100 % ⇒ revert (underflow) ; tableaux désalignés ⇒ revert ; reliquat d'arrondi ⇒ owner", async () => {
    const { c, memberA, extra2, extra3, artist, extra1: salon } = await loadFixture(setup);
    await expect(mintMsg(c, memberA, { extras: [extra2.address, extra3.address], pcts: [6000, 5000] })).to.be.reverted; // 10000 - 11000
    await expect(mintMsg(c, memberA, { extras: [extra2.address, extra3.address], pcts: [10] })).to.be.reverted; // index hors borne
    // 1001 wei : owner 500 ; net 501 ; salon 501*6667/10000=334 ; extra 501*3333/10000=166 ; reliquat 1 -> owner (501)
    await expect(mintMsg(c, memberA, { id: mid("odd"), price: 1001n, extras: [extra2.address], pcts: [3333] })).to.changeEtherBalances(
      [artist, salon, extra2, c],
      [501, 334, 166, 0]
    );
  });

  it("[F-MSG-10] si owner() est un contrat qui refuse l'ETH, plus aucun mint n'est possible (la part owner est poussée à chaque mint)", async () => {
    const a = await actors();
    const rej = await deploy("RejectingReceiver", a.deployer);
    const { c, memberA } = await setup({ ownerKey: await rej.getAddress() });
    await expect(mintMsg(c, memberA)).to.be.revertedWith("Failed to send owner share"); // owner = contrat qui refuse ⇒ plus aucun mint
  });

  it("[F-MSG-05] pas de ReentrancyGuard (la doc dit « NonReentrant ») : un owner-contrat ré-entre dans mint() pendant la distribution ; l'ID identique fait échouer la ré-entrée (sûr par accident)", async () => {
    const a = await actors();
    const re = await deploy("ReentrantReceiver", a.deployer);
    const { c, memberA } = await setup({ ownerKey: await re.getAddress() });
    await re.execute(a.deployer.address, "0x", 0, { value: E("5") }); // finance le contrat
    const ts = await time.latest();
    const payload = c.interface.encodeFunctionData("mint", [mid("re2"), "x", P, ZERO, "", ts, 0, 0, false, [], []]);
    await re.arm(await c.getAddress(), payload, P, 1);
    await mintMsg(c, memberA);
    expect(await re.hits()).to.equal(1); // la ré-entrée a bien eu lieu (aucun garde)
    expect(await re.lastOk()).to.equal(false); // mais échoue : _mint(tokenId déjà pris) car _tokenIdCounter est incrémenté APRÈS la distribution
    expect(await c.ownerOf(0)).to.equal(memberA.address);
    expect(await c.getLastMintedTokenId()).to.equal(0);
  });
});

describe("MessageEditions — identité des haikus (messageId, éditions, prix)", () => {
  it("[F-MSG-02] le premier haiku reçoit l'id 0 = valeur sentinelle de messageIdToHaikuId : la 2e édition du même message crée un NOUVEAU haiku", async () => {
    const { c, memberA, memberB } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("first") });
    expect(await c.getLastUniqueHaikusMinted()).to.equal(1);
    await mintMsg(c, memberB, { id: mid("first") }); // devrait être l'édition #2 du même haiku
    expect(await c.getLastUniqueHaikusMinted()).to.equal(2); // un 2e haiku a été créé (le message premier-né n'a jamais d'édition)
    expect(await c.messageIdToHaikuId(mid("first"))).to.equal(1);
    // les messages suivants se comportent normalement
    await mintMsg(c, memberA, { id: mid("second") });
    await mintMsg(c, memberB, { id: mid("second") });
    expect(await c.getLastUniqueHaikusMinted()).to.equal(3);
    expect(await c.haikuEditionsMinted(2)).to.equal(2);
  });

  it("[F-MSG-03] prix, texte et image d'une édition sont fournis par le MINTEUR : une édition d'un haiku existant se mint pour 1 wei", async () => {
    const { c, memberA, attacker } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("dummy") }); // consomme l'id 0 (cf. F-MSG-02)
    await mintMsg(c, memberA, { id: mid("poem"), price: P, haiku: "texte original" });
    await mintMsg(c, attacker, { id: mid("poem"), price: 1n, value: 1n, haiku: "TEXTE FALSIFIÉ", image: "https://evil.example/x.png" });
    expect((await c.haikus(1)).pricePerEdition).to.equal(P); // le prix du créateur n'est pas appliqué...
    expect(await c.haikuEditionsMinted(1)).to.equal(2); // ... l'attaquant a minté l'édition #2 pour 1 wei
    const md = dec(await c.tokenURI(2));
    expect(md.description).to.equal("TEXTE FALSIFIÉ"); // et signe l'édition avec son propre texte/image sous l'identité du haiku
    expect(md.image).to.equal("https://evil.example/x.png");
  });

  it("[F-MSG-03b] squat du messageId : le 1er minteur devient « creator » et fixe prix/plafond/durée (front-running d'un message Discord public)", async () => {
    const { c, memberA, attacker } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("dummy") });
    await mintMsg(c, attacker, { id: mid("victim-poem"), price: 1n, value: 1n, max: 1, dur: 3600 }); // plafond 1 édition
    expect((await c.haikus(1)).creator).to.equal(attacker.address);
    await expect(mintMsg(c, memberA, { id: mid("victim-poem"), price: 1n, value: 1n })).to.be.revertedWith("Max editions reached");
  });

  it("[F-MSG-01] _haikuIdFromToken : un token d'édition ouverte (totalEditions=0) ne peut être ni listé, ni brûlé, ni vendu", async () => {
    const { c, memberA } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("open"), dur: 86400, max: 0, open: true });
    await expect(c.connect(memberA).listEditionForSale(0, P)).to.be.revertedWith("Haiku ID not found for token");
    await expect(c.connect(memberA).burnMultiple([0])).to.be.revertedWith("Haiku ID not found for token");
    await expect(c.getTokenFullDetails(0)).to.be.revertedWith("Haiku ID not found for token");
  });

  it("[F-MSG-01b] _haikuIdFromToken : mauvaise attribution entre haikus — un token du haiku #1 est résolu vers le haiku #0", async () => {
    const { c, memberA } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("alpha"), haiku: "ALPHA" }); // haiku 0 / token 0 (100 éditions par défaut)
    await mintMsg(c, memberA, { id: mid("beta"), haiku: "BETA", max: 5, dur: 86400 }); // haiku 1 / token 1
    const d = await c.getTokenFullDetails(1);
    expect(d.haiku_).to.equal("ALPHA"); // token 1 appartient au haiku BETA : mauvais haiku renvoyé
    await c.connect(memberA).listEditionForSale(1, P);
  });

  it("[F-MSG-01c] haikuIdToTokenId pointe vers le DERNIER token minté, pas le premier : les premières éditions deviennent introuvables", async () => {
    const { c, memberA, memberB } = await loadFixture(setup);
    await mintMsg(c, memberA, { id: mid("pad") });
    for (let i = 0; i < 3; i++) await mintMsg(c, i % 2 ? memberB : memberA, { id: mid("ed"), max: 3, dur: 86400 });
    // haiku 1 : tokens 1,2,3 ; haikuIdToTokenId[1] = 3 ; plage résolue = [3, 6) ; le token 1 « tombe » dans la plage du haiku 0 (100 éditions)
    expect(await c.haikuIdToTokenId(1)).to.equal(3);
    expect((await c.getTokenFullDetails(1)).haiku_).to.equal("an old pond\na frog jumps in"); // texte du haiku 0
  });

  it("[F-MSG-11] expirationDate dépend du messageTimestamp fourni par le minteur : un timestamp passé rend le haiku non mintable dès sa création", async () => {
    const { c, memberA } = await loadFixture(setup);
    const now = await time.latest();
    await expect(mintMsg(c, memberA, { ts: now - 30 * 86400 })).to.be.revertedWith("Mint period expired"); // défaut 7 jours depuis le message
  });
});

describe("MessageEditions — revente, fonds bloqués, comptage", () => {
  async function listed() {
    const s = await setup();
    await mintMsg(s.c, s.memberA, { id: mid("p"), max: 3, dur: 86400 }); // haiku 0 / token 0 : résolvable
    await s.c.connect(s.memberA).listEditionForSale(0, P);
    return s;
  }

  it("revente : vendeur 90 %, owner 5 %, royalties 5 % (bps) ; annonce retirée ; NFT transféré", async () => {
    const { c, memberA, buyer, artist, extra1: salon } = await listed();
    await expect(c.connect(buyer).buyEdition(0, { value: P })).to.changeEtherBalances([buyer, memberA, artist, salon, c], [-P, E("0.9"), E("0.05"), E("0.05"), 0]);
    expect(await c.ownerOf(0)).to.equal(buyer.address);
    expect(await c.isNFTForSale(0)).to.equal(false);
    await expect(c.connect(memberA).buyEdition(0, { value: P })).to.be.revertedWith("Token is not for sale");
  });

  it("garde-fous : sous-paiement, propre token, double mise en vente, retrait d'annonce", async () => {
    const { c, memberA, buyer } = await listed();
    await expect(c.connect(buyer).buyEdition(0, { value: P - 1n })).to.be.revertedWith("Insufficient payment");
    await expect(c.connect(memberA).buyEdition(0, { value: P })).to.be.revertedWith("You already own this token");
    await expect(c.connect(memberA).listEditionForSale(0, P)).to.be.revertedWith("Already listed");
    await expect(c.connect(buyer).removeEditionFromSale(0)).to.be.revertedWith("Not your token");
    await c.connect(memberA).removeEditionFromSale(0);
    await expect(c.connect(buyer).buyEdition(0, { value: P })).to.be.revertedWith("Token is not for sale");
  });

  it("[F-MSG-04] surpaiement NON remboursé ni distribué : l'excédent reste bloqué dans le contrat (aucune fonction de retrait)", async () => {
    const { c, memberA, buyer } = await listed();
    await c.connect(buyer).buyEdition(0, { value: P * 3n });
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(P * 2n);
    const writers = c.interface.fragments.filter((f) => f.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f) => f.name);
    expect(writers.filter((n) => /withdraw|rescue|sweep|refund/i.test(n))).to.deep.equal([]);
  });

  it("[F-MSG-04b] defaultRoyaltyAddress = 0 : les 5 % de royalties de chaque revente restent bloqués dans le contrat", async () => {
    const s = await setup({ royaltyKey: "ZERO" });
    const { c, memberA, buyer, extra1 } = s;
    await mintMsg(c, memberA, { id: mid("z"), salonRoyalty: extra1.address, max: 3, dur: 86400 });
    await c.connect(memberA).listEditionForSale(0, P);
    await c.connect(buyer).buyEdition(0, { value: P });
    expect(await ethers.provider.getBalance(await c.getAddress())).to.equal(E("0.05")); // 5 % jamais versés
  });

  it("[F-MSG-07] editionsSold est incrémenté à la revente : getRemainingEditions finit par revert (underflow), l'historique n'est jamais écrit", async () => {
    const { c, memberA, buyer, memberB } = await listed(); // max 3, sold=1 après mint
    await c.connect(buyer).buyEdition(0, { value: P }); // sold=2
    await c.connect(buyer).listEditionForSale(0, P);
    await c.connect(memberB).buyEdition(0, { value: P }); // sold=3
    expect(await c.getRemainingEditions(0)).to.equal(0);
    await c.connect(memberB).listEditionForSale(0, P);
    await c.connect(memberA).buyEdition(0, { value: P }); // sold=4 > total=3
    await expect(c.getRemainingEditions(0)).to.be.reverted; // Panic 0x11
    expect((await c.getTransactionHistory(0)).length).to.equal(0); // aucune transaction enregistrée malgré 3 ventes
  });

  it("burnMultiple : propriétaire seulement ; refuse un token en vente ; édition limitée seulement (haikuMaxEditions décrémenté)", async () => {
    const { c, memberA, attacker } = await listed();
    await expect(c.connect(attacker).burnMultiple([0])).to.be.revertedWith("You do not own this NFT");
    await expect(c.connect(memberA).burnMultiple([0])).to.be.revertedWith("Token is for sale and cannot be burned");
    await c.connect(memberA).removeEditionFromSale(0);
    await c.connect(memberA).burnMultiple([0]);
    expect(await c.haikuMaxEditions(0)).to.equal(2); // le plafond d'éditions baisse quand on brûle
  });
});

describe("MessageEditions — boucles non bornées, métadonnées on-chain", () => {
  it("[F-MSG-06] mint d'une édition ouverte : boucle sur tous les détenteurs existants ⇒ coût de gas croissant avec le nombre de minteurs uniques", async () => {
    const { c, memberA, deployer } = await setup();
    await mintMsg(c, memberA, { id: mid("pad") });
    const open = { id: mid("open"), dur: 365 * 86400, max: 0, open: true, price: 1n, value: 1n };
    const gas = [];
    const N = 60;
    for (let i = 0; i < N; i++) {
      const w = ethers.Wallet.createRandom().connect(ethers.provider);
      await ethers.provider.send("hardhat_setBalance", [w.address, "0x56BC75E2D63100000"]);
      const rc = await (await mintMsg(c, w, open)).wait();
      gas.push(rc.gasUsed);
    }
    console.log(`        gas mint #2=${gas[1]} ; mint #${N}=${gas[N - 1]} ; ≈ ${(gas[N - 1] - gas[1]) / BigInt(N - 2)} gas par détenteur existant`);
    expect(gas[N - 1]).to.be.gt(gas[1] + 50_000n);
  });

  it("[F-MSG-08] imageUrl est inséré SANS échappement dans le JSON du tokenURI : injection de champs (ex. name) par le minteur", async () => {
    const { c, memberA } = await loadFixture(setup);
    await mintMsg(c, memberA, { image: 'x","name":"Hacked' });
    const md = dec(await c.tokenURI(0));
    expect(md.name).to.equal("Hacked"); // le dernier « name » l'emporte
  });

  it("[F-MSG-08b] escapeJSONString n'échappe ni \\ ni les caractères de contrôle : un haiku se terminant par \\ rend le tokenURI illisible (JSON invalide)", async () => {
    const { c, memberA } = await loadFixture(setup);
    await mintMsg(c, memberA, { haiku: "vers\\" });
    const uri = await c.tokenURI(0);
    expect(() => dec(uri)).to.throw();
  });

  it("[F-MSG-08c] le SVG on-chain insère le texte brut : balises <script> du haiku présentes dans l'image data: (XSS si rendu inline par un front)", async () => {
    const { c, memberA } = await loadFixture(setup);
    await mintMsg(c, memberA, { haiku: "</text><script>alert(1)</script>" });
    const md = dec(await c.tokenURI(0));
    const svg = Buffer.from(md.image.split(",")[1], "base64").toString("utf8");
    expect(svg).to.contain("<script>alert(1)</script>");
  });
});

describe("MessageFactory — permissions & création", () => {
  async function fx() {
    const a = await actors();
    const reward = await deploy("RewardMock", a.deployer);
    const f = await deploy("MessageFactory", a.deployer, await reward.getAddress());
    await f.connect(a.deployer).configureSalon("Salon Haiku", false, a.extra1.address);
    return { ...a, reward, f };
  }

  it("configureSalon / updateAdhesionContract / transferOwnership : réservés à l'owner de la factory", async () => {
    const { f, attacker, deployer, extra1 } = await loadFixture(fx);
    await expect(f.connect(attacker).configureSalon("X", false, attacker.address)).to.be.revertedWith("Not admin");
    await expect(f.connect(attacker).updateAdhesionContract(attacker.address)).to.be.revertedWith("Not admin");
    await expect(f.connect(attacker).transferOwnership(attacker.address)).to.be.revertedWith("Not admin");
    await expect(f.connect(deployer).updateAdhesionContract(ZERO)).to.be.revertedWith("Invalid address");
    await expect(f.connect(deployer).transferOwnership(ZERO)).to.be.revertedWith("Invalid owner");
    await f.connect(deployer).configureSalon("Salon Haiku", true, extra1.address); // ré-écrase la config et duplique le nom
    expect((await f.getAllSalons()).filter((n) => n === "Salon Haiku").length).to.equal(2);
  });

  it("[F-FAC-01b] createDynamicCollection sans contrôle d'accès : un attaquant crée un salon dont la victime est owner()", async () => {
    const { f, attacker, memberA: victim } = await loadFixture(fx);
    const tx = await f.connect(attacker).createDynamicCollection("Salon Haiku", "Message", victim.address, 999);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return f.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "CollectionCreated");
    const col = await ethers.getContractAt("MessageEditions", ev.args.collection);
    expect(await col.owner()).to.equal(victim.address);
    expect(await col.defaultRoyaltyAddress()).to.not.equal(ZERO);
    await expect(f.connect(attacker).createDynamicCollection("Inconnu", "Message", victim.address, 1)).to.be.revertedWith("Salon not configured");
  });
});
