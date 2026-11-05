/**
 * Configuration Hardhat DÉDIÉE À L'AUDIT (hors-ligne, aucun réseau public, aucun .env).
 *
 *   npx hardhat --config hardhat.audit.config.js test
 *
 * - Sources : audit-src/ (sources RÉCUPÉRÉES depuis build-info + contrats d'attaque). Voir audit-src/PROVENANCE.json.
 * - Compilateur : solc 0.8.30+commit.73712a01 via le paquet npm `solc` (solcjs), car le téléchargement des binaires
 *   solc est bloqué dans l'environnement d'audit. Même version et mêmes réglages que les build-info d'origine :
 *   viaIR=true, optimizer runs=200, evmVersion=prague.
 * - Les imports `@openzeppelin/contracts/...` sont redirigés vers audit-vendor/ (OZ exactement comme compilé
 *   à l'origine : le package.json déclare ^4.9.6 mais les sources compilées utilisent un mélange 4.x/5.x).
 * - Aucun accès à un RPC : réseau `hardhat` uniquement. RELAYER_PK/.env ne sont PAS lus.
 */
require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD,
  TASK_COMPILE_GET_REMAPPINGS,
} = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.30") {
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: "0.8.30",
      longVersion: "0.8.30+commit.73712a01",
    };
  }
  return runSuper();
});

// Remapping natif Hardhat >= 2.2x : le nom de source reste "@openzeppelin/contracts/..." (métadonnées fidèles),
// le contenu est lu dans audit-vendor/.
subtask(TASK_COMPILE_GET_REMAPPINGS).setAction(async () => ({
  "@openzeppelin/contracts/": "audit-vendor/@openzeppelin/contracts/",
}));

module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "prague",
    },
  },
  paths: {
    sources: "./audit-src",
    tests: "./test/audit",
    cache: "./cache-audit",
    artifacts: "./artifacts-audit",
  },
  networks: {
    hardhat: {
      hardfork: "prague",
      allowUnlimitedContractSize: false, // on veut voir EIP-170 en vrai
      blockGasLimit: 100_000_000,
      gas: 90_000_000, // gros mints d'éditions (ArtNFT.mint boucle) : on veut mesurer, pas échouer sur le gas par défaut
    },
  },
  gasReporter: { enabled: false },
  mocha: { timeout: 600000 },
};
