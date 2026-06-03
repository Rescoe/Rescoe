const { task } = require("hardhat/config");

task("deploy-pure", "Deploy pure positional")
  .setAction(async function(taskArgs, hre) {
    const positionals = process.argv.slice(process.argv.indexOf("deploy-pure") + 1);
    const name = positionals[0];
    const args = positionals.slice(1);
    
    console.log(`🚀 PURE ${name} (${args.length})`);

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
