/**
 * RescoeNetworkLoader
 *
 * - Canvas animation stable (ne redémarre PAS sur chaque tick de progress)
 * - Progress reçu depuis useAuth().loadingProgress (vrai état de l'init)
 * - Phases calquées sur les étapes réelles de l'authContext
 * - Données insectes précachées via le prefetchInsects de l'authContext
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  Text,
  VStack,
  HStack,
  Flex,
  useColorModeValue,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { keyframes } from "@emotion/react";
import { colors } from "@/styles/theme";
import { useAuth } from "./authContext";

// ─── Animations CSS ──────────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -800px 0; }
  100% { background-position:  800px 0; }
`;

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
`;

// ─── Phases calquées sur les étapes réelles de l'init ────────────────────────

const PHASES = [
  { from: 0,  label: "Démarrage",                detail: "Initialisation du protocole Web3Auth" },
  { from: 20, label: "Connexion au réseau",       detail: "Liaison avec Ethereum mainnet" },
  { from: 40, label: "Vérification de session",   detail: "Recherche d'une session active" },
  { from: 65, label: "Chargement du profil",      detail: "Récupération du rôle et des données" },
  { from: 90, label: "Préparation de l'interface",detail: "Précaching des collections" },
] as const;

interface Phase { from: number; label: string; detail: string; }

function getPhase(progress: number): Phase {
  let current: Phase = PHASES[0];
  for (const phase of PHASES) {
    if (progress >= phase.from) current = phase;
  }
  return current;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function Loading() {
  const { loadingProgress } = useAuth();

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(loadingProgress); // ref pour canvas sans re-render

  // Sync ref sans recréer le canvas
  useEffect(() => {
    progressRef.current = loadingProgress;
  }, [loadingProgress]);

  const isDark      = useColorModeValue(false, true);
  const bgPanel     = useColorModeValue("rgba(253,251,212,0.93)", "rgba(1,12,25,0.88)");
  const shadow      = useColorModeValue(
    "0 8px 60px rgba(1,28,57,0.18), 0 0 0 1px rgba(1,28,57,0.06)",
    "0 8px 60px rgba(238,212,132,0.22), 0 0 0 1px rgba(238,212,132,0.1)"
  );
  const titleGrad   = useColorModeValue(
    `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue}, ${colors.brand.navy})`,
    `linear(to-r, ${colors.brand.gold}, #F5E8A0, ${colors.brand.gold})`
  );
  const labelColor  = useColorModeValue("brand.navy", "brand.gold");
  const detailColor = useColorModeValue("#475569", "#94A3B8");
  const barBg       = useColorModeValue("rgba(1,28,57,0.1)", "rgba(238,212,132,0.12)");
  const barFill     = useColorModeValue(
    `linear-gradient(90deg, ${colors.brand.navy}, ${colors.brand.blue})`,
    `linear-gradient(90deg, ${colors.brand.gold}, #F5E8A0)`
  );
  const barGlow     = useColorModeValue(
    "0 0 16px rgba(1,28,57,0.35)",
    "0 0 16px rgba(238,212,132,0.55)"
  );
  const milestoneActive = useColorModeValue(colors.brand.navy, colors.brand.gold);
  const milestoneInactive = useColorModeValue("rgba(1,28,57,0.18)", "rgba(238,212,132,0.18)");
  const dividerColor = useColorModeValue("rgba(1,28,57,0.08)", "rgba(238,212,132,0.08)");
  const statColor   = useColorModeValue("brand.navy", "brand.gold");
  const footerColor = useColorModeValue("#94A3B8", "#64748B");

  const phase = getPhase(loadingProgress);

  // ─── Canvas : animation réseau — UNE seule fois, stable ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Palette — fixe (lue depuis isDark une seule fois au montage)
    const gold    = "#EED484";
    const navyBg  = isDark ? "#000814" : "#E8E4D8";
    const navyFg  = isDark ? "#011C39" : "#FDFBD4";

    // 14 nœuds sur orbite
    const N = 14;
    const seeded = (s: number) => { const v = Math.sin(s * 9301 + 49297); return v - Math.floor(v); };
    const nodes = Array.from({ length: N }, (_, i) => ({
      angle:      (i / N) * Math.PI * 2,
      speed:      0.10 + seeded(i * 0.37) * 0.08,
      baseR:      10 + seeded(i * 0.71) * 4,
      pulseOff:   seeded(i * 1.3) * Math.PI * 2,
    }));

    let frameId: number;
    let time = 0;
    const DT = 1 / 60;

    const render = () => {
      time += DT;
      const t = progressRef.current / 100; // lit la ref — pas de re-render

      const W = window.innerWidth;
      const H = window.innerHeight;
      const cx = W / 2, cy = H / 2;
      const R  = Math.min(cx, cy) * 0.38;

      // Fond
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
      bg.addColorStop(0, navyFg);
      bg.addColorStop(1, navyBg);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Particules de fond (apparaissent progressivement)
      if (t > 0.08) {
        const count = Math.floor(20 * t);
        for (let i = 0; i < count; i++) {
          const px = cx + Math.cos(time * 0.4 + i * 0.9) * R * (1.6 + seeded(i) * 0.4);
          const py = cy + Math.sin(time * 0.25 + i * 1.1) * R * (1.4 + seeded(i + 1) * 0.4);
          ctx.fillStyle = `rgba(238,212,132,${0.025 * t})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Connexions entre nœuds proches
      if (t > 0.15) {
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const xi = cx + Math.cos(nodes[i].angle + time * nodes[i].speed) * R;
            const yi = cy + Math.sin(nodes[i].angle + time * nodes[i].speed) * R;
            const xj = cx + Math.cos(nodes[j].angle + time * nodes[j].speed) * R;
            const yj = cy + Math.sin(nodes[j].angle + time * nodes[j].speed) * R;
            const d  = Math.hypot(xi - xj, yi - yj);
            const maxD = R * 1.1;
            if (d < maxD) {
              const alpha = ((maxD - d) / maxD) * 0.22 * (t - 0.15) / 0.85;
              ctx.strokeStyle = isDark ? `rgba(238,212,132,${alpha})` : `rgba(1,28,57,${alpha})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(xi, yi); ctx.lineTo(xj, yj); ctx.stroke();

              // Flux de données (petits points animés)
              if (seeded(time + i * 13 + j) > 0.94) {
                const ft = ((time * 1.8) % 1);
                ctx.fillStyle = `rgba(238,212,132,${0.55 * (1 - ft)})`;
                ctx.beginPath();
                ctx.arc(xi + (xj - xi) * ft, yi + (yj - yi) * ft, 2, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      // Nœuds
      nodes.forEach((node, idx) => {
        const a  = node.angle + time * node.speed;
        const x  = cx + Math.cos(a) * R;
        const y  = cy + Math.sin(a) * R;
        const active = idx === Math.floor(time * 2.5) % N;
        const pr = node.baseR + (active ? 7 : 3) + 1.5 * Math.sin(time * 5 + node.pulseOff);

        // Halo
        const grad = ctx.createRadialGradient(x, y, 0, x, y, pr + 14);
        grad.addColorStop(0, `rgba(238,212,132,${active ? 0.45 : 0.25})`);
        grad.addColorStop(0.5, `rgba(238,212,132,${active ? 0.18 : 0.08})`);
        grad.addColorStop(1, "rgba(238,212,132,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, pr + 14, 0, Math.PI * 2); ctx.fill();

        // Nœud
        ctx.shadowColor = gold;
        ctx.shadowBlur  = active ? 22 : 12;
        ctx.fillStyle   = gold;
        ctx.beginPath(); ctx.arc(x, y, node.baseR, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur  = 0;

        // Anneau actif
        if (active) {
          ctx.strokeStyle = gold;
          ctx.lineWidth   = 1.5;
          ctx.beginPath(); ctx.arc(x, y, pr * 1.25, 0, Math.PI * 2); ctx.stroke();
        }
      });

      frameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← STABLE : une seule fois au montage

  return (
    <AnimatePresence>
      <motion.div
        key="rescoe-loader"
        style={{ position: "fixed", inset: 0, zIndex: 13000, display: "flex", alignItems: "center", justifyContent: "center" }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
      >
        {/* Canvas réseau en fond */}
        <canvas
          ref={canvasRef}
          style={{ position: "fixed", inset: 0, zIndex: 12999, display: "block", pointerEvents: "none" }}
        />

        {/* Panneau central */}
        <VStack
          position="relative"
          zIndex={13001}
          spacing={7}
          px={10}
          py={8}
          w="90%"
          maxW="500px"
          borderRadius="3xl"
          bg={bgPanel}
          boxShadow={shadow}
          backdropFilter="blur(24px)"
        >
          {/* ── Logo ─────────────────────────────────────────── */}
          <VStack spacing={1}>
            <Text
              fontWeight={900}
              fontSize={["3xl", "4xl"]}
              letterSpacing="tight"
              bgGradient={titleGrad}
              bgClip="text"
              css={{ backgroundSize: "200% auto" }}
              animation={`${shimmer} 3s linear infinite`}
            >
              RESCOE
            </Text>
            <Text
              fontSize="xs"
              fontWeight={600}
              letterSpacing="widest"
              textTransform="uppercase"
              color={detailColor}
            >
              Galerie Numérique Web3
            </Text>
          </VStack>

          {/* ── Phase actuelle ───────────────────────────────── */}
          <VStack spacing={1} w="100%">
            <HStack justify="space-between" w="100%">
              <Text fontSize="sm" fontWeight={700} color={labelColor}>
                {phase.label}
              </Text>
              <Text
                fontSize="sm"
                fontWeight={600}
                color={labelColor}
                opacity={0.7}
                animation={loadingProgress < 100 ? `${blink} 1.6s ease-in-out infinite` : undefined}
              >
                {Math.round(loadingProgress)}%
              </Text>
            </HStack>
            <Text fontSize="xs" color={detailColor} w="100%" opacity={0.75}>
              {phase.detail}
            </Text>
          </VStack>

          {/* ── Barre de progression ─────────────────────────── */}
          <Box w="100%" position="relative">
            {/* Track */}
            <Box w="100%" h="5px" bg={barBg} borderRadius="full" overflow="hidden">
              <motion.div
                style={{
                  height: "100%",
                  background: barFill,
                  borderRadius: "9999px",
                  boxShadow: barGlow,
                }}
                initial={{ width: "0%" }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </Box>

            {/* Jalons */}
            <Flex
              position="absolute"
              top="-3px"
              left={0}
              right={0}
              justify="space-between"
              px="1px"
              pointerEvents="none"
            >
              {PHASES.map((p, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: loadingProgress >= p.from ? 1 : 0.7,
                    opacity: loadingProgress >= p.from ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.25 }}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: loadingProgress >= p.from ? milestoneActive : milestoneInactive,
                    border: "2px solid transparent",
                    boxShadow: loadingProgress >= p.from ? `0 0 8px ${milestoneActive}` : "none",
                  }}
                />
              ))}
            </Flex>
          </Box>

          {/* ── Stats protocole ──────────────────────────────── */}
          <HStack
            w="100%"
            justify="space-around"
            pt={5}
            borderTop="1px solid"
            borderColor={dividerColor}
            spacing={0}
          >
            {[
              { value: "Solidity",      label: "Contrats" },
              { value: "ERC-721",       label: "Standard" },
              { value: "Décentralisé",  label: "Stockage" },
            ].map(({ value, label }) => (
              <VStack key={label} spacing={0}>
                <Text fontSize="sm" fontWeight={800} color={statColor} letterSpacing="tight">
                  {value}
                </Text>
                <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider" color={footerColor}>
                  {label}
                </Text>
              </VStack>
            ))}
          </HStack>

          {/* ── Footer ───────────────────────────────────────── */}
          <Text fontSize="2xs" color={footerColor} opacity={0.65} textAlign="center">
            Protocole d&apos;adhésion • Collections décentralisées
          </Text>
        </VStack>
      </motion.div>
    </AnimatePresence>
  );
}
