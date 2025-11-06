import { useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import useEthToEur from "@/hooks/useEuro"; // ✅ bon nom du hook

const useEstimateGas = () => {
  const [estimatedCost, setEstimatedCost] = useState<string | null>(null);
  const [estimatedCostEuro, setEstimatedCostEuro] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  const { convertEthToEur, loading: loadingEthPrice, error: ethPriceError } = useEthToEur();

  const estimateGas = async (
    contractAddress: string,
    methodName: string,
    args: any[],
    address: string,
    abis: any
  ) => {
    if (isEstimating) return;
    setIsEstimating(true);
    setEstimatedCost(null);
    setEstimatedCostEuro(null);

    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_URL_SERVER_MORALIS);
      const contract = new ethers.Contract(contractAddress, abis, provider);

      const data = contract.interface.encodeFunctionData(methodName, args);
      const gasLimit = await provider.estimateGas({
        from: address,
        to: contractAddress,
        data: data,
      });

      const feeData = await provider.getFeeData();
      let gasPrice = feeData.gasPrice ?? ethers.parseUnits("5", "gwei");

      // (optionnel) Récupération du gas price moyen via Etherscan
      try {
        const res = await axios.get(
          `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY}`
        );
        const gasPriceGwei = Number(res.data?.result?.ProposeGasPrice);
        if (!isNaN(gasPriceGwei)) {
          gasPrice = ethers.parseUnits(gasPriceGwei.toString(), "gwei");
        }
      } catch {
        // silencieux si Etherscan échoue
      }

      const totalCost = gasLimit * gasPrice;
      const totalEth = ethers.formatEther(totalCost);
      setEstimatedCost(totalEth);

      // ✅ Conversion automatique en euros
      const eurValue = convertEthToEur(totalEth);
      if (eurValue !== null) {
        setEstimatedCostEuro(eurValue.toFixed(2));
      }
    } catch (error) {
      console.error("Erreur lors de l'estimation du gas :", error);
      setEstimatedCost(null);
      setEstimatedCostEuro(null);
    } finally {
      setIsEstimating(false);
    }
  };

  return {
    estimateGas,
    estimatedCost,
    estimatedCostEuro, // ✅ ajouté ici
    isEstimating,
    loadingEthPrice,
    ethPriceError,
  };
};

export default useEstimateGas;
