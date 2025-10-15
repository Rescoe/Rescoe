import { ChakraProvider } from '@chakra-ui/react';
import { AuthProvider } from '../src/utils/authContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { mainnet, arbitrum, goerli, polygon, sepolia } from 'wagmi/chains';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { extendTheme } from '@chakra-ui/react';
import { SessionProvider } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { isMobile } from 'react-device-detect';



// Créer un client de requête
const queryClient = new QueryClient();

// Configurer Wagmi avec getDefaultConfig
const wagmiConfig = getDefaultConfig({
  appName: 'Rescoe',
  projectId: 'c3c9b3085f93848af6fb534508261321', // ID WalletConnect
  chains: [mainnet, arbitrum, goerli, polygon, sepolia],
});

const theme = extendTheme({
  initialColorMode: 'dark',
  useSystemColorMode: false,
});

const MyApp = ({ Component, pageProps }: AppProps) => {
  return (
    <ChakraProvider resetCSS theme={theme}>
      <AuthProvider>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider session={pageProps.session} refetchInterval={0}>
              <RainbowKitProvider>
                {isMobile ? (
                  <div className="mobile-layout">
                    <Component {...pageProps} />
                  </div>
                ) : (
                  <div className="desktop-layout">
                    <Component {...pageProps} />
                  </div>
                )}
              </RainbowKitProvider>
            </SessionProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </AuthProvider>
    </ChakraProvider>
  );
};

export default MyApp;
