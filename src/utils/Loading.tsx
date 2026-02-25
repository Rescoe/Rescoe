import { useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  useTheme,
  useColorModeValue,
  Flex,
  chakra,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";

// Type Props
type RescoeNetworkLoaderProps = {
  progress?: number; // de 0 à 100
  seed?: number; // pour PRNG
  onFinish?: () => void;
};

// Badge d’adhésion stylisé (exemple simple)
const Badge = chakra("div", {
  baseStyle: {
    px: 3,
    py: 1,
    borderRadius: "full",
    fontWeight: "bold",
    fontSize: "xs",
    userSelect: "none",
  },
});

const RescoeNetworkLoader = ({
  progress: externalProgress,
  seed = 1337,
  onFinish,
}: RescoeNetworkLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(externalProgress ?? 0);

  const theme = useTheme();
  const isDark = useColorModeValue(false, true);

  // PRNG déterministe
  const random = (() => {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  })();

  // Gérer progress externe ou cycle interne
  useEffect(() => {
    if (externalProgress !== undefined) {
      setProgress(externalProgress);
    }
  }, [externalProgress]);

  useEffect(() => {
    if (externalProgress !== undefined) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => onFinish?.(), 300);
          return 100;
        }
        return p + 1;
      });
    }, 26);
    return () => clearInterval(interval);
  }, [externalProgress, onFinish]);

  // Animation canvas + dessin
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    // Resize & scale
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Nœuds réseau pulsants : 6 points
    const nodes = Array.from({ length: 6 }, () => ({
      x: width * (0.15 + random() * 0.7),
      y: height * (0.15 + random() * 0.7),
      baseRadius: 6 + random() * 4,
      pulsePhase: random() * Math.PI * 2,
    }));

    // Fragments numériques (insectes) : 400 particules
    const insects = Array.from({ length: 400 }, () => {
      const target = nodes[Math.floor(random() * nodes.length)];
      return {
        x: random() * width,
        y: random() * height,
        vx: (random() - 0.5) * 0.4,
        vy: (random() - 0.5) * 0.4,
        target,
        alpha: 0,
        size: 1 + random() * 1.4,
      };
    });

    const colorNode = isDark ? theme.colors.brand.gold : theme.colors.brand.blue;
    const colorInsect = isDark ? theme.colors.brand.mauve : theme.colors.brand.gold;
    const bgColor = isDark ? theme.colors.brand.navy : theme.colors.brand.cream;

    let frameId: number;
    let time = 0;

    const render = () => {
      time += 0.016;
      // Fond gradient sombre
      const gradientBg = ctx.createLinearGradient(0, 0, 0, height);
      gradientBg.addColorStop(0, bgColor);
      gradientBg.addColorStop(1, bgColor);
      ctx.fillStyle = gradientBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const t = progress / 100;

      // Dessiner connexions lumineuses (après 35%)
      if (t > 0.35) {
        ctx.strokeStyle = isDark
          ? "rgba(238, 212, 132, 0.12)"
          : "rgba(0, 65, 106, 0.15)";
        ctx.lineWidth = 1;
        nodes.forEach((a, i) => {
          nodes.slice(i + 1).forEach((b) => {
            if (random() < 0.04) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          });
        });
      }

      // Nœuds pulsants
      nodes.forEach((node) => {
        const pulse = (Math.sin(time * 3 + node.pulsePhase) + 1) / 2; // 0→1
        const radius = node.baseRadius + pulse * 3;
        ctx.beginPath();
        // Halo pulsant glow
        const glowAlpha = 0.25 + pulse * 0.4;
        ctx.fillStyle = `rgba(${hexToRgb(colorNode)},${glowAlpha.toFixed(2)})`;
        ctx.shadowColor = `rgba(${hexToRgb(colorNode)},${glowAlpha.toFixed(2)})`;
        ctx.shadowBlur = pulse * 10 + 15;
        ctx.ellipse(node.x, node.y, radius, radius, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Insectes animés / tech-particles
      insects.forEach((p) => {
        if (t < 0.35) {
          p.alpha = Math.min(p.alpha + 0.015, 0.3);
        } else {
          // attraction vers nœud
          p.vx += (p.target.x - p.x) * 0.0007;
          p.vy += (p.target.y - p.y) * 0.0007;
          p.alpha = Math.min(p.alpha + 0.025, 0.85);
        }
        // Errance micro aléatoire
        p.vx += (random() - 0.5) * 0.02;
        p.vy += (random() - 0.5) * 0.02;

        // Mouvements
        p.x += p.vx;
        p.y += p.vy;

        // Boucler insectes partant hors écran
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;

        // Dessin insecte carré pixel en tech mauve/or
        ctx.fillStyle = `rgba(${hexToRgb(colorInsect!)} ,${p.alpha.toFixed(2)})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      // Badges d’adhésion animés (en bas à droite, petites sphères lumineuses)
      const badgeCount = 7;
      for (let i = 0; i < badgeCount; i++) {
        const bx = width - 60 + Math.sin(time + i) * 12;
        const by = height - 50 + Math.cos(time * 1.1 + i * 1.5) * 8;
        const badgeRadius = 10 + Math.sin(time * 4 + i) * 3;

        ctx.beginPath();
        ctx.fillStyle = `rgba(${hexToRgb(theme.colors.brand.gold)},0.9)`;
        ctx.shadowColor = `rgba(${hexToRgb(theme.colors.brand.gold)},0.8)`;
        ctx.shadowBlur = 10;
        ctx.ellipse(bx, by, badgeRadius, badgeRadius, 0, 0, 2 * Math.PI);
        ctx.fill();

        // Lettrage “MEMBER” stylisé minimaliste dans badge
        ctx.font = `600 8px "Inter", monospace`;
        ctx.fillStyle = `rgba(${hexToRgb(theme.colors.brand.navy)},0.85)`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("M", bx, by + 1.5);
        ctx.shadowBlur = 0;
      }

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
    };
  }, [progress, isDark, theme]);

  // Texte statut dynamique selon progress
  const getStatusLabel = () => {
    if (progress < 30) return "Indexing contributors...";
    if (progress < 60) return "Binding works...";
    if (progress < 90) return "Verifying authorship...";
    return "Activating network...";
  };

  // Utilitaire conversion HEX to RGB (sans #)
  function hexToRgb(hex: string) {
    hex = hex.replace("#", "");
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r},${g},${b}`;
  }

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: isDark
            ? theme.colors.brand.navy
            : theme.colors.brand.cream,
          zIndex: 13000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.8 } }}
        key="rescoe-loader"
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12999,
            display: "block",
          }}
        />

        <Box
          position="relative"
          zIndex={13001}
          textAlign="center"
          fontFamily="'Inter', monospace"
          letterSpacing="wide"
          userSelect="none"
          px={6}
          py={4}
          maxW="320px"
          borderRadius="xl"
          bg={isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"}
          boxShadow={isDark ? theme.effects.glowDark : theme.effects.glowLight}
        >
          <Text
            fontWeight="extrabold"
            fontSize={["2xl", "3xl"]}
            color={isDark ? theme.colors.brand.gold : theme.colors.brand.blue}
            textTransform="uppercase"
            mb={1}
            bgGradient={
              isDark
                ? `linear(to-r, ${theme.colors.brand.gold}, ${theme.colors.brand.mauve})`
                : `linear(to-r, ${theme.colors.brand.blue}, ${theme.colors.brand.mauve})`
            }
            bgClip="text"
          >
            RESCOE NETWORK
          </Text>

          <Text mt={1} fontSize="sm" opacity={0.75} color={isDark ? "gold" : "blue"}>
            {getStatusLabel()}
          </Text>

          <Text
            mt={2}
            fontSize="sm"
            letterSpacing="widest"
            fontWeight="bold"
            opacity={0.45}
            color={isDark ? theme.colors.brand.cream : theme.colors.brand.navy}
          >
            {progress}%
          </Text>

          {/* Barre de progression stylée */}
          <Box
            mt={3}
            width="100%"
            height="6px"
            borderRadius="full"
            bg={isDark ? "rgba(238,212,132,0.2)" : "rgba(0,65,106,0.15)"}
            overflow="hidden"
          >
            <Box
              width={`${progress}%`}
              height="100%"
              bgGradient={
                isDark
                  ? `linear(to-r, ${theme.colors.brand.gold}, ${theme.colors.brand.mauve})`
                  : `linear(to-r, ${theme.colors.brand.blue}, ${theme.colors.brand.mauve})`
              }
              transition="width 0.3s ease"
            />
          </Box>

          {/* Badges textuels sous forme d’exemples (optionnel) */}
          <Flex justify="center" gap={3} mt={4} wrap="wrap">
            <Badge bg={theme.colors.brand.gold} color={theme.colors.brand.navy}>
              Membre
            </Badge>
            <Badge bg={theme.colors.brand.mauve} color={theme.colors.brand.navy}>
              Artiste
            </Badge>
            <Badge bg={theme.colors.brand.blue} color={theme.colors.brand.cream}>
              Poète
            </Badge>
            <Badge bg={theme.colors.brand.navy} color={theme.colors.brand.gold}>
              Résident
            </Badge>
          </Flex>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
};

export default RescoeNetworkLoader;
