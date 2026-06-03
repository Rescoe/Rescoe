import { ethers } from "hardhat";
import fs from "fs";

async function main() {
  console.log("🚀 RESCOE Full Deploy + Setters");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1-5. MEME DEPLOIS (Adhesion → MasterFactory) - copie du précédent
  const Adhesion = await ethers.getContractFactory("Adhesion");
  const adhesion = await Adhesion.deploy(deployer.address, deployer.address);
  await adhesion.waitForDeployment();
  const adhesionAddr = await adhesion.getAddress();
  console.log("✅ Adhesion:", adhesionAddr);

  const AdhesionManagement = await ethers.getContractFactory("AdhesionManagement");
  const adhesionMgmt = await AdhesionManagement.deploy(adhesionAddr, deployer.address);
  await adhesionMgmt.waitForDeployment();
  const adhesionMgmtAddr = await adhesionMgmt.getAddress();
  console.log("✅ AdhesionManagement:", adhesionMgmtAddr);

  const ResCollectionManager = await ethers.getContractFactory("ResCollectionManager");
  const resCollectionManager = await ResCollectionManager.deploy(deployer.address, "0x0000000000000000000000000000000000000000");
  await resCollectionManager.waitForDeployment();
  const resCollectionManagerAddr = await resCollectionManager.getAddress();
  console.log("✅ ResCollectionManager:", resCollectionManagerAddr);

  const [ArtFactory, PoetryFactory, MessageFactory] = await Promise.all([
    ethers.getContractFactory("ArtFactory").then(f => f.deploy(adhesionAddr, resCollectionManagerAddr)),
    ethers.getContractFactory("PoetryFactory").then(f => f.deploy(adhesionAddr, resCollectionManagerAddr)),
    ethers.getContractFactory("MessageFactory").then(f => f.deploy(resCollectionManagerAddr)),
  ]);
  await Promise.all([ArtFactory.waitForDeployment(), PoetryFactory.waitForDeployment(), MessageFactory.waitForDeployment()]);
  const [artFactoryAddr, poetryFactoryAddr, messageFactoryAddr] = await Promise.all([
    ArtFactory.getAddress(), PoetryFactory.getAddress(), MessageFactory.getAddress()
  ]);
  console.log("✅ Art/Poetry/Message Factories:", artFactoryAddr, poetryFactoryAddr, messageFactoryAddr);

  const MasterFactory = await ethers.getContractFactory("MasterFactory");
  const masterFactory = await MasterFactory.deploy(artFactoryAddr, poetryFactoryAddr, messageFactoryAddr);
  await masterFactory.waitForDeployment();
  const masterFactoryAddr = await masterFactory.getAddress();
  console.log("✅ MasterFactory:", masterFactoryAddr);

  // ✅ SETTERS POST-DEPLOY
  console.log("🔧 Setters...");

  // Setter 1: ResCollectionManager.addAdhesionContract(adhesionAddr)
  const resCollAttached = await ethers.getContractAt("ResCollectionManager", resCollectionManagerAddr, deployer);
  const tx1 = await resCollAttached.addAdhesionContract(adhesionAddr);
  await tx1.wait();
  console.log("✅ ResCollectionManager.addAdhesionContract OK");

  // Setter 2: ResCollectionManager.updateFactoryAddress(masterFactoryAddr)
  const tx2 = await resCollAttached.updateFactoryAddress(masterFactoryAddr);
  await tx2.wait();
  console.log("✅ ResCollectionManager.updateFactoryAddress OK");

  // JSON export
  const addresses = {
    adhesion: adhesionAddr,
    adhesionManagement: adhesionMgmtAddr,
    resCollectionManager: resCollectionManagerAddr,
    artFactory: artFactoryAddr,
    poetryFactory: poetryFactoryAddr,
    messageFactory: messageFactoryAddr,
    masterFactory: masterFactoryAddr,
  };
  fs.writeFileSync("./addresses.json", JSON.stringify(addresses, null, 2));
  console.log("💾 addresses.json créé !");

  console.log("🎉 RESCOE 100% prêt !");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
