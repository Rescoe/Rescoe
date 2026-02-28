import { useEffect, useRef, useState } from 'react'
import { Box, Text, VStack, HStack, useColorModeValue, Flex } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { keyframes } from '@emotion/react'
import { colors, effects } from '@/styles/theme'  // Ajuste le chemin

interface RescoeNetworkLoaderProps {
  progress?: number
  seed?: number
  onFinish?: () => void
}

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`

const RescoeNetworkLoader: React.FC<RescoeNetworkLoaderProps> = ({
  progress: externalProgress,
  seed = 1337,
  onFinish,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [progress, setProgress] = useState(externalProgress ?? 0)
  const [currentPhase, setCurrentPhase] = useState(0)
  const isDark = useColorModeValue(false, true)

  // 🎨 Couleurs du thème - statiques pour perf canvas
  const gold = colors.brand.cream        // #EED484
  const navy = colors.brand.navy        // #011C39
  const cream = useColorModeValue(colors.brand.cream, navy)  // #FDFBD4 → navy
  const navyDark = useColorModeValue('#E8E4D8', '#000814')
  const textSecondary = useColorModeValue('#64748B', '#94A3B8')

  const phases = [
    { threshold: 0, label: 'Initialisation du protocole', detail: 'Connexion au réseau Ethereum' },
    { threshold: 15, label: 'Vérification des contrats', detail: 'AdhesionContract + Factories' },
    { threshold: 30, label: 'Chargement des collections', detail: 'Récupération depuis IPFS' },
    { threshold: 50, label: 'Indexation des membres', detail: 'SBT badges d\'adhésion' },
    { threshold: 70, label: 'Synchronisation des métadonnées', detail: 'Œuvres posées numériques' },
    { threshold: 85, label: 'Validation de la signature', detail: 'Authentification Web3' },
    { threshold: 95, label: 'Finalisation', detail: 'Préparation de l\'interface' },
  ]

  // PRNG déterministe
  const random = (s: number) => {
    s = Math.sin(s * 10000)
    return s - Math.floor(s)
  }

  useEffect(() => {
    if (externalProgress !== undefined) setProgress(externalProgress)
  }, [externalProgress])

  useEffect(() => {
    const newPhase = phases.findIndex((p, i) =>
      progress >= p.threshold && (i === phases.length - 1 || progress < phases[i + 1].threshold)
    )
    setCurrentPhase(Math.max(0, newPhase))
  }, [progress])

  useEffect(() => {
    if (externalProgress !== undefined) return

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setTimeout(onFinish ?? (() => {}), 600);
          return 100
        }
        // Ralentissement progressif
        const increment = p > 70 ? 1.5 : p > 30 ? 2 : 1
        return Math.min(100, p + increment)
      })
    }, 50)

    return () => clearInterval(interval)
  }, [externalProgress, onFinish])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    const radiusCircle = Math.min(centerX, centerY) * 0.35

    const nodes = Array.from({ length: 12 }, (_, i) => ({
      baseRadius: 12,
      pulsePhase: random(Math.PI * 2),
      angle: (i / 12) * 2 * Math.PI,
      orbitSpeed: 0.15 + random(0.1),
    }))

    let frameId: number
    let time = 0

    const render = (deltaTime: number = 0.012) => {
      time += deltaTime
      const t = progress / 100

      // Fond gradient thème
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(window.innerWidth, window.innerHeight))
      bgGradient.addColorStop(0, isDark ? navy : cream)
      bgGradient.addColorStop(1, isDark ? navyDark : navyDark)
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Particules blockchain (gold theme)
      if (t > 0.1) {
        for (let i = 0; i < 30; i++) {
          const px = centerX + Math.cos(time * 0.5 + i) * radiusCircle * 1.5
          const py = centerY + Math.sin(time * 0.3 + i) * radiusCircle * 1.5
          ctx.fillStyle = `rgba(238, 212, 132, ${0.03 * t})`  // gold rgba
          ctx.beginPath()
          ctx.arc(px, py, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Connexions
      if (t > 0.2) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const ni = nodes[i], nj = nodes[j]
            const xi = centerX + Math.cos(ni.angle + time * ni.orbitSpeed) * radiusCircle
            const yi = centerY + Math.sin(ni.angle + time * ni.orbitSpeed) * radiusCircle
            const xj = centerX + Math.cos(nj.angle + time * nj.orbitSpeed) * radiusCircle
            const yj = centerY + Math.sin(nj.angle + time * nj.orbitSpeed) * radiusCircle

            const dist = Math.hypot(xi - xj, yi - yj)
            const maxDist = radiusCircle * 1.2
            if (dist < maxDist) {
              const opacity = ((maxDist - dist) / maxDist) * 0.25 * (t - 0.2) * 0.8
              ctx.strokeStyle = isDark
                ? `rgba(238, 212, 132, ${opacity})`  // gold
                : `rgba(1, 28, 57, ${opacity})`     // navy
              ctx.lineWidth = 1.5
              ctx.beginPath()
              ctx.moveTo(xi, yi)
              ctx.lineTo(xj, yj)
              ctx.stroke()

              // Flux données
              if (random(time) > 0.95) {
                const flowT = (time * 2) % 1
                const flowX = xi + (xj - xi) * flowT
                const flowY = yi + (yj - yi) * flowT
                ctx.fillStyle = `rgba(238, 212, 132, ${0.6 * (1 - flowT)})`
                ctx.beginPath()
                ctx.arc(flowX, flowY, 2, 0, Math.PI * 2)
                ctx.fill()
              }
            }
          }
        }
      }

      // Nœuds pro
      nodes.forEach((node, idx) => {
        const anglePuls = node.angle + time * node.orbitSpeed
        const x = centerX + Math.cos(anglePuls) * radiusCircle
        const y = centerY + Math.sin(anglePuls) * radiusCircle
        const isActive = idx === Math.floor(time * 3) % nodes.length
        const pulseRadius = node.baseRadius + (isActive ? 8 : 4) + 0.5 + 0.5 * Math.sin(time * 6 + node.pulsePhase)

        // Glow externe
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, pulseRadius + 1.5)
        gradient.addColorStop(0, `rgba(238, 212, 132, ${isActive ? 0.5 : 0.3})`)  // gold
        gradient.addColorStop(0.5, `rgba(238, 212, 132, ${isActive ? 0.25 : 0.1})`)
        gradient.addColorStop(1, `rgba(238, 212, 132, 0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, pulseRadius + 1.5, 0, Math.PI * 2)
        ctx.fill()

        // Cercle central
        ctx.beginPath()
        ctx.shadowColor = gold
        ctx.shadowBlur = isActive ? 20 : 12
        ctx.fillStyle = gold
        ctx.arc(x, y, node.baseRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // Anneau extérieur actif
        if (isActive) {
          ctx.strokeStyle = gold
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, pulseRadius * 1.2, 0, Math.PI * 2)
          ctx.stroke()
        }
      })

      frameId = requestAnimationFrame(render)
    }

    render()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frameId)
    }
  }, [progress, isDark, gold, navy, cream, navyDark])

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: useColorModeValue('brand.cream', 'brand.navy'),
          zIndex: 13000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          userSelect: 'none',
        }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        key="rescoe-loader"
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12999,
            display: 'block',
          }}
        />
        <VStack
          position="relative"
          zIndex={13001}
          spacing={6}
          px="10"
          py="8"
          maxW="540px"
          w="90%"
          borderRadius="3xl"
          bg={useColorModeValue('rgba(255,255,255,0.92)', 'rgba(0,0,0,0.75)')}
          boxShadow={useColorModeValue(
            `0 8px 60px rgba(1,28,57,0.15), 0 0 0 1px rgba(1,28,57,0.05)`,
            `0 8px 60px rgba(238,212,132,0.25), 0 0 0 1px rgba(238,212,132,0.1)`
          )}
          backdropFilter="blur(20px)"
        >
          {/* Logo */}
          <VStack spacing={1}>
            <Text
              fontWeight={900}
              fontSize={['3xl', '4xl']}
              letterSpacing="tight"
              bgGradient={useColorModeValue(
                `linear(to-r, ${colors.brand.navy}, ${colors.brand.blue}, ${colors.brand.navy})`,
                `linear(to-r, ${colors.brand.gold}, #F0D98E, ${colors.brand.gold})`
              )}
              bgClip="text"
              animation={`${shimmer} 3s linear infinite`}
              backgroundSize="200% auto"
            >
              RESCOE
            </Text>
            <Text
              fontSize="sm"
              fontWeight={600}
              letterSpacing="widest"
              textTransform="uppercase"
              color={useColorModeValue('#334D65', '#F0D98E')}
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
                fontWeight={700}
                color={useColorModeValue('brand.navy', 'brand.gold')}
              >
                {phases[currentPhase]?.label}
              </Text>
              <Text
                fontSize="sm"
                fontWeight={600}
                color={useColorModeValue('#334D65', '#F0D98E')}
                animation={`${pulse} 2s ease-in-out infinite`}
              >
                {Math.round(progress)}%
              </Text>
            </HStack>
            <HStack>
              <Text fontSize="xs" color={textSecondary} w="100%" opacity={0.7}>
                {phases[currentPhase]?.detail}
              </Text>
            </HStack>
          </VStack>

          {/* Barre de progression */}
          <VStack spacing={0} w="100%">
            <Box position="relative" w="100%" h="6px" bg={useColorModeValue(
              'rgba(1,28,57,0.1)', 'rgba(238,212,132,0.15)'
            )} borderRadius="full" overflow="hidden">
              <motion.div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: useColorModeValue(
                    `linear-gradient(90deg, ${colors.brand.gold}, #F0D98E)`,
                    `linear-gradient(90deg, ${colors.brand.navy}, ${colors.brand.blue})`
                  ),
                  borderRadius: '9999px',
                  position: 'relative',
                  boxShadow: useColorModeValue(
                    '0 0 20px rgba(1,28,57,0.3)',
                    `0 0 20px rgba(238,212,132,0.5)`
                  ),
                }}
                initial={{ width: 0 }}
                animate={{ width: progress }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </Box>
            {/* Points jalons */}
            <Flex position="absolute" top="-2px" left={0} right={0} justify="space-between">
              {phases.map((phase, idx) => (
                <Box
                  key={idx}
                  w="10px" h="10px" borderRadius="full"
                  bg={progress >= phase.threshold
                    ? useColorModeValue('brand.navy', 'brand.gold')
                    : useColorModeValue('rgba(1,28,57,0.2)', 'rgba(238,212,132,0.2)')
                  }
                  border="2px solid"
                  borderColor={useColorModeValue('rgba(255,255,255,0.92)', 'rgba(0,0,0,0.75)')}
                  transition="all 0.3s"
                  boxShadow={progress >= phase.threshold
                    ? `0 0 10px ${useColorModeValue('brand.navy', 'brand.gold')}`
                    : 'none'
                  }
                />
              ))}
            </Flex>
          </VStack>

          {/* Stats protocole */}
          <HStack spacing={4} w="100%" justify="space-around" pt={4}
            borderTop="1px solid"
            borderColor={useColorModeValue('rgba(1,28,57,0.1)', 'rgba(238,212,132,0.1)')}
          >
            <VStack spacing={0}>
              <Text fontSize="l" fontWeight={900} color={useColorModeValue('brand.navy', 'brand.gold')}>
                Solidity
              </Text>
              <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider"
                color={textSecondary} opacity={0.7}>
                Contrats
              </Text>
            </VStack>
            <VStack spacing={0}>
              <Text fontSize="l" fontWeight={900} color={useColorModeValue('brand.navy', 'brand.gold')}>
                On-chain
              </Text>
              <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider"
                color={textSecondary} opacity={0.7}>
                Stockage
              </Text>
            </VStack>
            <VStack spacing={0}>
              <Text fontSize="l" fontWeight={900} color={useColorModeValue('brand.navy', 'brand.gold')}>
                ERC-721
              </Text>
              <Text fontSize="2xs" textTransform="uppercase" letterSpacing="wider"
                color={textSecondary} opacity={0.7}>
                Standard
              </Text>
            </VStack>
          </HStack>

          {/* Footer */}
          <HStack>
            <Text fontSize="2xs" textAlign="center" color={textSecondary} opacity={0.6} pt={2}
              whiteSpace="nowrap"
            >
              Protocole d&apos;adhésion • collections décentralisées
            </Text>
          </HStack>
        </VStack>
      </motion.div>
    </AnimatePresence>
  )
}

export default RescoeNetworkLoader
