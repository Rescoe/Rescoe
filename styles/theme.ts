import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: "#FBF4E8", // très clair
    100: "#F5E1B0",
    200: "#EEC47A",
    300: "#E2B051",
    400: "#D68D2A",
    500: "#A13D2D", // ton accent rouge-brun
    600: "#7E2F25",
    700: "#592422",
    800: "#35201F",
    900: "#202F4B", // bleu nuit foncé cohérent
    startLight: "#A13D2D",
    endLight: "#202F4B",
    startDark: "#FBF4E8",
    endDark: "#E2B051",
  },
  primary: {
    500: "#A13D2D", // couleur d'accent
  },
  secondary: {
    500: "#E2B051", // autre couleur d'accent
  },
};

const gradients = {
  bgLight: "linear(to-b, brand.startLight, brand.endLight)",
  bgDark: "linear(to-b, brand.startDark, brand.endDark)",
  brandText: "linear(to-r, brand.500, brand.300)",
};

const styles = {
  global: (props: any) => ({
    body: {
      bg: props.colorMode === "light"
        ? gradients.bgLight
        : gradients.bgDark,
      color: props.colorMode === "light" ? "#2A1E13" : "#F5F5F5",
      transition: "background 0.4s ease",
    },
  }),
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: "bold",
      borderRadius: "full",
      _focus: { boxShadow: "none" },
    },
    variants: {
      solid: (props: any) => ({
        bgGradient:
          props.colorMode === "light"
            ? "linear(to-r, brand.500, brand.300)"
            : "linear(to-r, brand.300, brand.500)",
        color: "white",
        _hover: {
          transform: "scale(1.05)",
          bgGradient:
            props.colorMode === "light"
              ? "linear(to-r, brand.300, brand.500)"
              : "linear(to-r, brand.500, brand.300)",
        },
      }),
    },
  },
  Card: {
    baseStyle: (props: any) => ({
      bg: props.colorMode === "light"
        ? "rgba(255, 255, 255, 0.8)"
        : "rgba(0, 0, 0, 0.5)",
      borderRadius: "2xl",
      boxShadow:
        props.colorMode === "light"
          ? "0 4px 30px rgba(0,0,0,0.1)"
          : "0 4px 30px rgba(0,0,0,0.3)",
      backdropFilter: "blur(6px)",
      color: props.colorMode === "light" ? "#2A1E13" : "gray.100",
      transition: "all 0.3s ease-in-out",
    }),
  },
};

const theme = extendTheme({
  config,
  colors,
  styles,
  components,
});

export default theme;
