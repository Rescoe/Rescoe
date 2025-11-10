import { ChakraProvider } from "@chakra-ui/react";
import { AuthProvider } from "../src/utils/authContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import { isMobile } from "react-device-detect";
import theme from "@styles/theme";

const queryClient = new QueryClient();

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider resetCSS theme={theme}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider session={pageProps.session} refetchInterval={0}>
            <AuthProvider>
                {isMobile ? (
                  <div className="mobile-layout">
                    <Component {...pageProps} />
                  </div>
                ) : (
                  <div className="desktop-layout">
                    <Component {...pageProps} />
                  </div>
                )}
            </AuthProvider>
          </SessionProvider>
        </QueryClientProvider>
    </ChakraProvider>
  );
}
