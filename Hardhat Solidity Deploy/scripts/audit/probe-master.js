/* Sonde boîte noire du MasterFactory (SANS SOURCE) déployé localement depuis le bytecode d'artifact Remix.
 * Usage : npx hardhat --config hardhat.audit.config.js run scripts/audit/probe-master.js */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
(async () => {
  const { ethers } = hre;
  const [d, user, attacker] = await ethers.getSigners();
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "../../contracts/artifacts/MasterFactory.json"), "utf8"));
  const reward = await (await ethers.getContractFactory("RewardMock")).deploy();
  const A = await (await ethers.getContractFactory("ArtFactory")).deploy(await reward.getAddress(), d.address);
  const P = await (await ethers.getContractFactory("ArtFactory")).deploy(await reward.getAddress(), d.address);
  const M = await (await ethers.getContractFactory("MessageFactory")).deploy(await reward.getAddress());
  const F = new ethers.ContractFactory(art.abi, art.data.bytecode.object, d);
  const mf = await F.deploy(await A.getAddress(), await P.getAddress(), await M.getAddress());
  await mf.waitForDeployment();
  console.log("owner:", await mf.owner(), "deployer:", d.address);
  for (const k of ["Art", "Poesie", "Poetry", "Message", "Social", "art", "poesie", "message", "Haiku", "Generative", "Discord"]) {
    console.log(" collectionFactories(", k, ") =", await mf.collectionFactories(k));
  }
  console.log("artFactory", await mf.artFactory(), "poetry", await mf.poetryFactory(), "message", await mf.messageFactory());
  await A.configureCollection("X", 5, [], []);
  await P.configureCollection("X", 5, [], []);
  try { const tx = await mf.connect(attacker).createDynamicCollection("X", "Art", user.address, 1); const rc = await tx.wait(); console.log("attacker createDynamicCollection(Art): OK gas", rc.gasUsed); } catch (e) { console.log("attacker createDynamicCollection(Art): REVERT", e.shortMessage || e.message); }
  try { await mf.connect(attacker).updateFactory("Art", attacker.address); console.log("attacker updateFactory: OK (!)"); } catch (e) { console.log("attacker updateFactory: REVERT", (e.shortMessage || e.message).slice(0, 120)); }
  try { await mf.connect(d).updateFactory("Art", attacker.address); console.log("owner updateFactory(Art -> EOA): OK, aucune validation de contrat"); } catch (e) { console.log("owner updateFactory: REVERT", e.message.slice(0, 120)); }
  try { await mf.connect(attacker).createDynamicCollection("X", "Art", user.address, 2); console.log("after: OK"); } catch (e) { console.log("after rewire to EOA: REVERT", (e.shortMessage || e.message).slice(0, 120)); }
  try { await mf.connect(attacker).createDynamicCollection("X", "Inconnu", user.address, 3); } catch (e) { console.log("unknown type:", (e.shortMessage || e.message).slice(0, 140)); }
})();
