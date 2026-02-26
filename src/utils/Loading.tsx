import { useEffect, useRef, useState } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  useColorModeValue,
  Flex,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { keyframes } from "@emotion/react"; // ✅ correct

type RescoeNetworkLoaderProps = {
  progress?: number;
  seed?: number;
  onFinish?: () => void;
};

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const RescoeNetworkLoader = ({
  progress: externalProgress,
  seed = 1337,
  onFinish,
}: RescoeNetworkLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(externalProgress ?? 0);
  const [currentPhase, setCurrentPhase] = useState(0);

  const isDark = useColorModeValue(false, true);

  // Phases de chargement détaillées
  const phases = [
    { threshold: 0, label: "Initialisation du protocole", detail: "Connexion au réseau Ethereum" },
    { threshold: 15, label: "Vérification des contrats", detail: "AdhesionContract & Factories" },
    { threshold: 30, label: "Chargement des collections", detail: "Récupération depuis IPFS" },
    { threshold: 50, label: "Indexation des membres", detail: "SBT & badges d'adhésion" },
    { threshold: 70, label: "Synchronisation des métadonnées", detail: "Œuvres & poésies numériques" },
    { threshold: 85, label: "Validation de la signature", detail: "Authentification Web3" },
    { threshold: 95, label: "Finalisation", detail: "Préparation de l'interface" },
  ];

  // PRNG déterministe
  const random = (() => {
    let s = seed;
    return () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  })();

  useEffect(() => {
    if (externalProgress !== undefined) {
      setProgress(externalProgress);
    }
  }, [externalProgress]);

  useEffect(() => {
    const newPhase = phases.findIndex((p, i) =>
      progress >= p.threshold && (i === phases.length - 1 || progress < phases[i + 1].threshold)
    );
    setCurrentPhase(Math.max(0, newPhase));
  }, [progress]);

  useEffect(() => {
    if (externalProgress !== undefined) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => onFinish?.(), 600);
          return 100;
        }
        // Ralentissement progressif pour effet plus réaliste
        const increment = p < 30 ? 2 : p < 70 ? 1.5 : 1;
        return Math.min(100, p + increment);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [externalProgress, onFinish]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const radiusCircle = Math.min(centerX, centerY) * 0.35;

    // 12 nœuds pour un réseau plus dense et professionnel
    const nodes = Array.from({ length: 12 }).map((_, i) => ({
      baseRadius: 12,
      pulsePhase: random() * Math.PI * 2,
      angle: (i / 12) * 2 * Math.PI,
      orbitSpeed: 0.15 + random() * 0.1,
    }));

    let frameId: number;
    let time = 0;

    const colorBg = isDark ? "#011C39" : "#F7F5EC";
    const colorNode = "#EFD484";
    const colorConnBase = isDark ? "#EFD484" : "#011C39";

    const render = () => {
      time += 0.012;
      const t = progress / 100;

      // Fond avec gradient subtil
      const bgGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(window.innerWidth, window.innerHeight)
      );
      if (isDark) {
        bgGradient.addColorStop(0, "#011C39");
        bgGradient.addColorStop(1, "#000814");
      } else {
        bgGradient.addColorStop(0, "#F7F5EC");
        bgGradient.addColorStop(1, "#E8E4D8");
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Particules de fond (effet blockchain)
      if (t > 0.1) {
        for (let i = 0; i < 30; i++) {
          const px = centerX + Math.cos(time * 0.5 + i) * (radiusCircle * 1.5);
          const py = centerY + Math.sin(time * 0.3 + i) * (radiusCircle * 1.5);
          ctx.fillStyle = `rgba(239, 212, 132, ${0.03 * t})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Connexions avec effet de progression
      if (t > 0.2) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const ni = nodes[i];
            const nj = nodes[j];

            const xi = centerX + Math.cos(ni.angle + time * ni.orbitSpeed) * radiusCircle;
            const yi = centerY + Math.sin(ni.angle + time * ni.orbitSpeed) * radiusCircle;
            const xj = centerX + Math.cos(nj.angle + time * nj.orbitSpeed) * radiusCircle;
            const yj = centerY + Math.sin(nj.angle + time * nj.orbitSpeed) * radiusCircle;

            const dist = Math.hypot(xi - xj, yi - yj);
            const maxDist = radiusCircle * 1.2;

            if (dist < maxDist) {
              const opacity = ((maxDist - dist) / maxDist) * 0.25 * ((t - 0.2) / 0.8);
              ctx.strokeStyle = isDark
                ? `rgba(239, 212, 132, ${opacity})`
                : `rgba(1, 28, 57, ${opacity})`;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(xi, yi);
              ctx.lineTo(xj, yj);
              ctx.stroke();

              // Flux de données animés
              if (random() > 0.95) {
                const flowT = (time * 2) % 1;
                const flowX = xi + (xj - xi) * flowT;
                const flowY = yi + (yj - yi) * flowT;
                ctx.fillStyle = `rgba(239, 212, 132, ${0.6 * (1 - flowT)})`;
                ctx.beginPath();
                ctx.arc(flowX, flowY, 2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      // Nœuds avec effets professionnels
      nodes.forEach((node, idx) => {
        const anglePuls = node.angle + time * node.orbitSpeed;
        const x = centerX + Math.cos(anglePuls) * radiusCircle;
        const y = centerY + Math.sin(anglePuls) * radiusCircle;

        const isActive = idx === Math.floor((time * 3) % nodes.length);
        const pulseRadius = node.baseRadius + (isActive ? 8 : 4) * (0.5 + 0.5 * Math.sin(time * 6 + node.pulsePhase));

        // Glow externe
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, pulseRadius * 1.5);
        gradient.addColorStop(0, `rgba(239, 212, 132, ${isActive ? 0.5 : 0.3})`);
        gradient.addColorStop(0.5, `rgba(239, 212, 132, ${isActive ? 0.25 : 0.1})`);
        gradient.addColorStop(1, "rgba(239, 212, 132, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Cercle central
        ctx.beginPath();
        ctx.shadowColor = colorNode;
        ctx.shadowBlur = isActive ? 20 : 12;
        ctx.fillStyle = colorNode;
        ctx.arc(x, y, node.baseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Anneau extérieur si actif
        if (isActive) {
          ctx.strokeStyle = colorNode;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, pulseRadius * 1.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
    };
  }, [progress, isDark, random]);

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: isDark ? "#011C39" : "#F7F5EC",
          zIndex: 13000,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          userSelect: "none",
        }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
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

        <VStack
          position="relative"
          zIndex={13001}
          spacing={6}
          px={10}
          py={8}
          maxW="540px"
          w="90%"
          borderRadius="3xl"
          bg={isDark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.92)"}
          boxShadow={
            isDark
              ? "0 8px 60px rgba(239, 212, 132, 0.25), 0 0 0 1px rgba(239, 212, 132, 0.1)"
              : "0 8px 60px rgba(1, 28, 57, 0.15), 0 0 0 1px rgba(1, 28, 57, 0.05)"
          }
          backdropFilter="blur(20px)"
        >
          {/* Logo / Titre */}
          <VStack spacing={1}>
            <Text
              fontWeight="900"
              fontSize={["3xl", "4xl"]}
              letterSpacing="tight"
              bgGradient={
                isDark
                  ? "linear(to-r, #EFD484, #F0D98E, #EFD484)"
                  : "linear(to-r, #011C39, #1A3A52, #011C39)"
              }
              bgClip="text"
              animation={`${shimmer} 3s linear infinite`}
              backgroundSize="200% auto"
            >
              RESCOE
            </Text>
            <Text
              fontSize="sm"
              fontWeight="600"
              letterSpacing="widest"
              textTransform="uppercase"
              color={isDark ? "#F0D98E" : "#334D65"}
              opacity={0.8}
            >
              Galerie Numérique Web3
            </Text>
          </VStack>

          {/* Phase actuelle */}
          <VStack spacing={2} w="100%">
            <HStack justify="space-between" w="100%">
              <Text
                fontSize="md"
                fontWeight="700"
                color={isDark ? "#EFD484" : "#011C39"}
              >
                {phases[currentPhase]?.label}
              </Text>
              <Text
                fontSize="sm"
                fontWeight="600"
                color={isDark ? "#F0D98E" : "#334D65"}
                animation={`${pulse} 2s ease-in-out infinite`}
              >
                {progress}%
              </Text>
            </HStack>
            <Text
              fontSize="xs"
              color={isDark ? "#94A3B8" : "#64748B"}
              w="100%"
              opacity={0.7}
            >
              {phases[currentPhase]?.detail}
            </Text>
          </VStack>

          {/* Barre de progression professionnelle */}
          <Box w="100%" position="relative">
            <Box
              width="100%"
              height="6px"
              bg={isDark ? "rgba(239, 212, 132, 0.15)" : "rgba(1, 28, 57, 0.1)"}
              borderRadius="full"
              overflow="hidden"
              position="relative"
            >
              <motion.div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: isDark
                    ? "linear-gradient(90deg, #EFD484, #F0D98E)"
                    : "linear-gradient(90deg, #011C39, #334D65)",
                  borderRadius: "9999px",
                  position: "relative",
                  boxShadow: isDark
                    ? "0 0 20px rgba(239, 212, 132, 0.5)"
                    : "0 0 20px rgba(1, 28, 57, 0.3)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </Box>

            {/* Points de jalon */}
            <Flex position="absolute" top="-2px" left="0" right="0" justify="space-between">
              {phases.map((phase, idx) => (
                <Box
                  key={idx}
                  width="10px"
                  height="10px"
                  borderRadius="full"
                  bg={
                    progress >= phase.threshold
                      ? isDark ? "#EFD484" : "#011C39"
                      : isDark ? "rgba(239, 212, 132, 0.2)" : "rgba(1, 28, 57, 0.2)"
                  }
                  border="2px solid"
                  borderColor={isDark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.92)"}
                  transition="all 0.3s"
                  boxShadow={
                    progress >= phase.threshold
                      ? `0 0 10px ${isDark ? "#EFD484" : "#011C39"}`
                      : "none"
                  }
                />
              ))}
            </Flex>
          </Box>

          {/* Statistiques du protocole */}
          <HStack
            spacing={4}
            w="100%"
            justify="space-around"
            pt={4}
            borderTop="1px solid"
            borderColor={isDark ? "rgba(239, 212, 132, 0.1)" : "rgba(1, 28, 57, 0.1)"}
          >
            <VStack spacing={0}>
              <Text
                fontSize="xl"
                fontWeight="900"
                color={isDark ? "#EFD484" : "#011C39"}
              >
                7
              </Text>
              <Text
                fontSize="2xs"
                textTransform="uppercase"
                letterSpacing="wider"
                color={isDark ? "#94A3B8" : "#64748B"}
                opacity={0.7}
              >
                Contrats
              </Text>
            </VStack>
            <VStack spacing={0}>
              <Text
                fontSize="xl"
                fontWeight="900"
                color={isDark ? "#EFD484" : "#011C39"}
              >
                On-chain
              </Text>
              <Text
                fontSize="2xs"
                textTransform="uppercase"
                letterSpacing="wider"
                color={isDark ? "#94A3B8" : "#64748B"}
                opacity={0.7}
              >
                Stockage
              </Text>
            </VStack>
            <VStack spacing={0}>
              <Text
                fontSize="xl"
                fontWeight="900"
                color={isDark ? "#EFD484" : "#011C39"}
              >
                ERC-721
              </Text>
              <Text
                fontSize="2xs"
                textTransform="uppercase"
                letterSpacing="wider"
                color={isDark ? "#94A3B8" : "#64748B"}
                opacity={0.7}
              >
                Standard
              </Text>
            </VStack>
          </HStack>

          {/* Footer avec mentions */}
          <Text
            fontSize="2xs"
            textAlign="center"
            color={isDark ? "#64748B" : "#94A3B8"}
            opacity={0.6}
            pt={2}
          >
            Protocole d'adhésion & collections décentralisé
          </Text>
        </VStack>
      </motion.div>
    </AnimatePresence>
  );
};

export default RescoeNetworkLoader;
