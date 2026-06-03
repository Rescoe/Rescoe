require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RELAYER_PK = process.env.RELAYER_PK || "";
const BASESCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 50,
      },
    },
  },
networks: {
  hardhat: {},
  baseSepolia: {
    url: "https://sepolia.base.org",
    chainId: 84532,
    accounts: RELAYER_PK ? [RELAYER_PK] : [],
  },
  base: {  // Nouveau réseau pour mainnet
    url: "https://mainnet.base.org",  // RPC public Base mainnet [web:3]
    chainId: 8453,  // Chain ID Base mainnet [web:1][web:6]
    accounts: RELAYER_PK ? [RELAYER_PK] : [],
  },
},
etherscan: {
  apiKey: {
    baseSepolia: BASESCAN_API_KEY,
    base: BASESCAN_API_KEY,  // Même clé API Basescan pour mainnet [web:16]
  },
  customChains: [
    {
      network: "baseSepolia",
      chainId: 84532,
      urls: {
        apiURL: "https://api-sepolia.basescan.org/api",
        browserURL: "https://sepolia.basescan.org",
      },
    },
    {  // Ajout pour Base mainnet
      network: "base",
      chainId: 8453,
      urls: {
        apiURL: "https://api.basescan.org/api",  // Basescan mainnet API [web:7]
        browserURL: "https://basescan.org",
      },
    },
  ],
},

  mocha: {
    timeout: 120000,
  },
};



//  ##### POUR LES TEST EN LOCAL ######""
/*
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RELAYER_PK = process.env.RELAYER_PK || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {}, // ✅ Utilise ça par défaut (équivaut localhost)
    localhost: { // ✅ Ajout pour compatibilité complète
      url: "http://127.0.0.1:8545"
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: RELAYER_PK ? [RELAYER_PK] : [],
    },
  },
  etherscan: {
    apiKey: { baseSepolia: ETHERSCAN_API_KEY },
    customChains: [{
      network: "baseSepolia",
      chainId: 84532,
      urls: {
        apiURL: "https://api-sepolia.basescan.org/api",
        browserURL: "https://sepolia.basescan.org",
      },
    }],
  },
  mocha: {
    timeout: 100000
  }
};

// ✅ TASK deploy-one PERFECTE (déjà bonne, juste format JSON amélioré)
task("deploy-one", "Deploy any contract by name")
  .addParam("name", "Contract name to deploy")
  .setAction(async ({ name }, hre) => {
    try {
      console.log(`🚀 Deploying ${name}...`);
      const factory = await hre.ethers.getContractFactory(name);
      const contract = await factory.deploy();
      await contract.waitForDeployment();
      
      const address = await contract.getAddress();
      
      // JSON complet pour ton pipeline
      console.log(JSON.stringify({
        success: true,
        contractName: name,
        address: address
      }));
    } catch (error) {
      console.error(JSON.stringify({
        success: false,
        error: error.message
      }));
      process.exit(1);
    }
  });
*/