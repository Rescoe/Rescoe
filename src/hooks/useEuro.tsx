import { useEffect, useState } from 'react';
import axios from 'axios';

const useEthToEur = () => {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        setLoading(true);
        const response = await axios.get<{ ethereum: { eur: number } }>(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur'
        );
        setEthPrice(response.data.ethereum.eur);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEthPrice();
  }, []);

  // convertEthToEur dans le hook
  const convertEthToEur = (amountInEth?: string | number): number | null => {
    if (ethPrice !== null && amountInEth !== undefined && amountInEth !== null) {
      const value = Number(amountInEth);
      if (!isNaN(value)) {
        return value * ethPrice;
      }
    }
    return null;
  };



  return { ethPrice, convertEthToEur, loading, error };
};

export default useEthToEur;
