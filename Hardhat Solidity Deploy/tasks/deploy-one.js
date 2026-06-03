const { task } = require("hardhat/config");

task("deploy-one", "Deploy ONE contract")
  .setAction(async function(_taskArgs, hre) {
    // 🔥 POSITIONNELS BRUTS
    const positionals = process.argv.slice(3);
    const name = positionals[0];
    const args = positionals.slice(1);
    
    console.log(`🚀 Deploy ${name} (${args.length} args)`);

    try {
      const factory = await hre.ethers.getContractFactory(name);
      const contract = await factory.deploy(...args);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      
      console.log(JSON.stringify({
        success: true,
        contractName: name,
        address: address.toString(),
        args: args
      }));
    } catch (err) {
      console.log(JSON.stringify({
        success: false,
        error: err.message
      }));
    }
  });
const { task } = require("hardhat/config");

task("deploy-one", "Deploy ONE contract")
  .setAction(async function(taskArgs, hre) {
    const positionals = process.argv.slice(process.argv.indexOf("deploy-one") + 1);
    const name = positionals[0];
    const args = positionals.slice(1);
    
    console.log(`🚀 ${name} START (${args.length})`);

    try {
      const factory = await hre.ethers.getContractFactory(name);
      const contract = await factory.deploy(...args);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      
      console.log(JSON.stringify({
        success: true,
        contractName: name,
        address: address.toString()
      }));
    } catch (err) {
      console.log(JSON.stringify({ success: false, error: err.message }));
    }
  });
