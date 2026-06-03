import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const contractName = process.argv[2];
  
  if (!contractName) throw new Error("Nom contrat requis: Adhesion|AdhesionManagement|...");

  try {
    console.log(`🚀 Deploy ${contractName}`);
    
    // Mapping contrats → args (basé sur ton full deploy)
    const deployments = {
      "Adhesion": [deployer.address, deployer.address],
      "AdhesionManagement": [], // Sera patché après
      "ResCollectionManager": [deployer.address, "0x0000000000000000000000000000000000000000"],
      "ArtFactory": [], // Sera patché après
      "PoetryFactory": [], // Sera patché après
      "MessageFactory": [],
      "MasterFactory": []
    };

    const args = deployments[contractName as keyof typeof deployments] || [];
    
    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    
    console.log(JSON.stringify({ 
      success: true,
      address,
      contractName
    }));
    
  } catch (error: any) {
    console.log(JSON.stringify({ 
      success: false,
      error: error.message 
    }));
  }
}

main();
