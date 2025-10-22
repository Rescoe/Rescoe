import { extendTheme, ThemeConfig, StyleFunctionProps } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false,
};


// 💫 Animation pulsante avec couleur dynamique
export const pulse = (color: string) => keyframes`
  0% { box-shadow: 0 0 0 0 ${color}99; }
  70% { box-shadow: 0 0 0 15px ${color}00; }
  100% { box-shadow: 0 0 0 0 ${color}00; }
`;

//Fond cream
const colors = {
  brand: {
    gold: "#EED484",   // accent principal, lumineux et chaleureux
    mauve: "#B4A6D5",  // teinte artistique et douce
    blue: "#00416A",   // ton profond, tech
    navy: "#011C39",   // fond sombre principal
    cream: "#F7F5EC",  // fond clair
    textDark: "#1A1A1A", // texte foncé pour light mode
    textLight: "#F7F5EC", // texte clair pour dark mode

    // 🎨 aliases utilisés pour les titres et dégradés dynamiques
    startLight: "#B4A6D5", // or doux en haut du dégradé (light)
    endLight: "#B4A6D5",   // mauve clair en bas (light)
    startDark: "#B4A6D5",  // mauve dominant (dark)
    endDark: "#B4A6D5",    // bleu profond (dark)
  },
};

const styles = {
  global: (props: any) => ({
    body: {
      bgGradient:
        props.colorMode === "light"
          ? `linear(to-b, ${colors.brand.cream}, ${colors.brand.cream})`
          : `linear(to-b, ${colors.brand.navy}, ${colors.brand.navy})`,
      color:
        props.colorMode === "light"
          ? colors.brand.textDark
          : colors.brand.textLight,
      transition: "background 0.4s ease, color 0.4s ease",
      fontFamily: "'Inter', sans-serif",
      minHeight: "100vh",
    },
  }),
};

export const hoverStyles = {
  brandHover: {
    _hover: {
      bgGradient: "linear(to-r, #EED484, #EED484)", // mauve → or (palette RESCOE)
      transform: "scale(1.05)",
      transition: "all 0.3s ease-in-out",
      boxShadow: "0 0 12px rgba(180, 166, 213, 0.5)", // halo doux
    },
  },
};

export const brandHover = {
  transform: "translateY(-3px) scale(1.05)",
  transition: "all 0.3s ease",
  shadow: "xl",
};




const components = {
  Card: {
    baseStyle: (props: StyleFunctionProps) => ({
      bg:
        props.colorMode === "light"
          ? "rgba(255, 255, 255, 0.8)"
          : "rgba(17, 25, 40, 0.75)",
      borderRadius: "2xl",
      boxShadow:
        props.colorMode === "light"
          ? "0 4px 20px rgba(0,0,0,0.1)"
          : "0 4px 20px rgba(0,0,0,0.3)",
      backdropFilter: "blur(8px)",
      color:
        props.colorMode === "light"
          ? colors.brand.textDark
          : colors.brand.textLight,
      transition: "all 0.3s ease-in-out",
    }),
  },

  Button: {
    variants: {
      solid: (props: StyleFunctionProps) => ({
        bgGradient:
          props.colorMode === "light"
            ? `linear(to-r, ${colors.brand.blue}, ${colors.brand.blue})`
            : `linear(to-r, ${colors.brand.mauve}, ${colors.brand.mauve})`,
        color: "white",
        fontWeight: "bold",
        _hover: {
          transform: "scale(1.05)",
          boxShadow:
            props.colorMode === "light"
              ? "0 0 10px rgba(0,0,0,0.1)"
              : "0 0 10px rgba(255,255,255,0.2)",
        },
      }),
    },
  },

  // 🌟 Style global pour tous les Heading
  Heading: {
    baseStyle: (props: StyleFunctionProps) => ({
      bgGradient:
        props.colorMode === "light"
          ? `linear(to-r, ${colors.brand.mauve}, ${colors.brand.mauve})`
          : `linear(to-r, ${colors.brand.gold}, ${colors.brand.gold})`,
      bgClip: "text",
      fontWeight: "extrabold",
      letterSpacing: "wide",
      lineHeight: "shorter",
      textTransform: "uppercase",
      transition: "color 0.3s ease, background 0.3s ease",
    }),
    sizes: {
      xl: { fontSize: ["3xl", "4xl", "5xl"] },
      lg: { fontSize: ["2xl", "3xl"] },
      md: { fontSize: ["xl", "2xl"] },
      sm: { fontSize: "lg" },
    },
  },
};


const theme = extendTheme({ config, colors, styles, components, hoverStyles });
export default theme;
