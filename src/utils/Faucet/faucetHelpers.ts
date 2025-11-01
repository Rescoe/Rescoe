import { ethers } from "ethers";

export async function createClaimSignature(
  signer: ethers.Signer,       // typage du signer
  faucetAddress: string        // typage de l'adresse du contrat
) {
  const user = await signer.getAddress();

  // ABI minimal pour récupérer le nonce
  const abi = ["function getNonce(address) view returns (uint256)"];
  const provider = signer.provider;
  if (!provider) throw new Error("Signer has no provider");

  const contract = new ethers.Contract(faucetAddress, abi, provider);
  const nonce = (await contract.getNonce(user)).toString();

  // expiration du claim dans 5 minutes
  const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

  const chainId = (await provider.getNetwork()).chainId;

  // Encodage du message
  const encoded = ethers.solidityPacked(
    ["address", "uint256", "uint256", "address", "uint256"],
    [user, nonce, deadline, faucetAddress, chainId]
  );

  const hash = ethers.keccak256(encoded);

  // signer le message hashé
  const signature = await signer.signMessage(ethers.getBytes(hash));

  return { user, nonce, deadline, signature };
}
