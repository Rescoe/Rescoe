import { ChakraProvider } from "@chakra-ui/react";
import { AuthProvider } from "../src/utils/authContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { mainnet, arbitrum, goerli, polygon, sepolia } from "wagmi/chains";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { isMobile } from "react-device-detect";
import theme from "@styles/theme";

const queryClient = new QueryClient();

const wagmiConfig = getDefaultConfig({
  appName: "Rescoe",
  projectId: "c3c9b3085f93848af6fb534508261321", // ID WalletConnect
  chains: [mainnet, arbitrum, goerli, polygon, sepolia],
});

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider resetCSS theme={theme}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={pageProps.session} refetchInterval={0}>
            <AuthProvider>
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
            </AuthProvider>
          </SessionProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ChakraProvider>
  );
}
