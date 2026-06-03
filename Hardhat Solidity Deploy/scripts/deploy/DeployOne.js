import { ethers } from "hardhat";

async function main() {
  // Récupère le nom du contrat depuis argv[2]
  const [,, contractName, ...extraArgs] = process.argv;

  if (!contractName) {
    console.error(JSON.stringify({ error: "Nom contrat requis" }));
    process.exit(1);
  }

  try {
    console.log(`🚀 Deploy ${contractName}`);

    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...extraArgs); // Supporte args constructeur
    await contract.waitForDeployment();

    const address = await contract.getAddress();

    console.log(JSON.stringify({
      success: true,
      contractName,
      address,
      extraArgs
    }));
  } catch (err: any) {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(JSON.stringify({ success: false, error: err.message }));
  process.exit(1);
});
