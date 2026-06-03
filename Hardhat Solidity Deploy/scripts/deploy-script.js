const hre = require('hardhat');

async function main() {
  try {
    // Args codés en dur (FIX 100% HH308)
    const args = ["0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879","0xFa6d6E36Da4acA3e6aa3bf2b4939165C39d83879"];
    console.log('🚀 Deploying AdhesionRescoe avec args:', args);
    
    const factory = await hre.ethers.getContractFactory('AdhesionRescoe');
    const contract = await factory.deploy(...args);
    
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log(JSON.stringify({
      success: true,
      name: 'AdhesionRescoe',
      address: address,
      transactionHash: contract.deploymentTransaction().hash
    }));
    
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main();