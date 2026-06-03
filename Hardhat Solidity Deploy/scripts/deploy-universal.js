const hre = require('hardhat');
const fs = require('fs');

async function main() {
  try {
    const argsJsonPath = './temp-deploy-args.json';
    if (!fs.existsSync(argsJsonPath)) {
      throw new Error('temp-deploy-args.json missing');
    }
    
    const deployArgs = JSON.parse(fs.readFileSync(argsJsonPath, 'utf8'));
    const { contractName, args = [] } = deployArgs;
    
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    // 1 LIGNE JSON UNIQUEMENT
    console.log(JSON.stringify({
      success: true,
      contractName,
      address: address.toString(),
      txHash: contract.deploymentTransaction()?.hash || 'pending'
    }));
    
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

main().catch(error => {
  console.log(JSON.stringify({
    success: false,
    error: error.message
  }));
  process.exit(1);
});
