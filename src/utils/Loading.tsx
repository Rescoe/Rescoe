import { useEffect, useRef, useState } from "react";

type RescoeNetworkLoaderProps = {
  progress?: number;
  seed?: number;
  onFinish?: () => void;
};

const RescoeNetworkLoader = ({
  progress: externalProgress,
  seed = 1337,
  onFinish,
}: RescoeNetworkLoaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

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
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Nœuds du réseau
    const nodes = Array.from({ length: 5 }, () => ({
      x: width * (0.2 + random() * 0.6),
      y: height * (0.2 + random() * 0.6),
    }));

    // Insectes / fragments
    const insects = Array.from({ length: 320 }, () => {
      const target = nodes[Math.floor(random() * nodes.length)];
      return {
        x: random() * width,
        y: random() * height,
        vx: (random() - 0.5) * 0.3,
        vy: (random() - 0.5) * 0.3,
        target,
        alpha: 0,
      };
    });

    const render = () => {
      ctx.fillStyle = "#0b0b10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const t = progress / 100;

      // Connexions réseau (émergent après 40%)
      if (t > 0.4) {
        ctx.strokeStyle = "rgba(140,150,255,0.08)";
        ctx.lineWidth = 1;
        nodes.forEach((a, i) => {
          nodes.slice(i + 1).forEach((b) => {
            if (random() < 0.02) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          });
        });
      }

      insects.forEach((p) => {
        // Phase 1 : apparition diffuse
        if (t < 0.3) {
          p.alpha = Math.min(p.alpha + 0.01, 0.4);
        } else {
          // Attraction douce vers le nœud
          p.vx += (p.target.x - p.x) * 0.0005;
          p.vy += (p.target.y - p.y) * 0.0005;
          p.alpha = Math.min(p.alpha + 0.02, 0.9);
        }

        // Micro errance (effet insecte)
        p.vx += (random() - 0.5) * 0.02;
        p.vy += (random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        ctx.fillStyle = `rgba(190,190,255,${p.alpha})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      });

      requestAnimationFrame(render);
    };

    render();

    return () => window.removeEventListener("resize", resize);
  }, [progress]);

  return (
    <div style={overlay}>
      <canvas ref={canvasRef} />
      <div style={ui}>
        <div style={title}>RESCOE NETWORK</div>
        <div style={status}>
          {progress < 30 && "indexing contributors"}
          {progress >= 30 && progress < 60 && "binding works"}
          {progress >= 60 && progress < 90 && "verifying authorship"}
          {progress >= 90 && "activating network"}
        </div>
        <div style={percent}>{progress}%</div>
      </div>
    </div>
  );
};

export default RescoeNetworkLoader;

// Styles

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#0b0b10",
  zIndex: 9999,
};

const ui: React.CSSProperties = {
  position: "absolute",
  bottom: "10%",
  width: "100%",
  textAlign: "center",
  fontFamily: "monospace",
  letterSpacing: "0.18em",
  color: "#e0e0ff",
};

const title: React.CSSProperties = {
  fontSize: "1.2rem",
  marginBottom: "0.6rem",
};

const status: React.CSSProperties = {
  opacity: 0.7,
  fontSize: "0.75rem",
  marginBottom: "0.4rem",
};

const percent: React.CSSProperties = {
  opacity: 0.35,
  fontSize: "0.65rem",
};
