import { useEffect, useRef, useState } from "react";

type GenesisLoaderProps = {
  progress?: number; // optionnel : si tu veux piloter depuis l’extérieur
  seed?: number;
  onFinish?: () => void;
};

const GenesisLoader = ({
  progress: externalProgress,
  seed = 1337,
  onFinish,
}: GenesisLoaderProps) => {
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
    }, 28);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const center = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    const points = Array.from({ length: 420 }, () => ({
      x: random() * window.innerWidth,
      y: random() * window.innerHeight,
      ox: 0,
      oy: 0,
      alpha: 0,
    }));

    points.forEach((p) => {
      p.ox = center.x + (random() - 0.5) * 180;
      p.oy = center.y + (random() - 0.5) * 180;
    });

    const render = () => {
      ctx.fillStyle = "#0b0b10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      points.forEach((p, i) => {
        const t = progress / 100;

        if (t < 0.4) {
          p.alpha = Math.min(p.alpha + 0.01, 0.6);
        } else {
          p.x += (p.ox - p.x) * 0.02;
          p.y += (p.oy - p.y) * 0.02;
          p.alpha = Math.min(p.alpha + 0.02, 1);
        }

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
        <div style={title}>GENESIS</div>
        <div style={status}>
          {progress < 40 && "initializing structure"}
          {progress >= 40 && progress < 80 && "resolving fragments"}
          {progress >= 80 && "sealing form"}
        </div>
        <div style={percent}>{progress}%</div>
      </div>
    </div>
  );
};

export default GenesisLoader;

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
  letterSpacing: "0.2em",
  color: "#e0e0ff",
};

const title: React.CSSProperties = {
  fontSize: "1.4rem",
  marginBottom: "0.6rem",
};

const status: React.CSSProperties = {
  opacity: 0.7,
  fontSize: "0.8rem",
  marginBottom: "0.4rem",
};

const percent: React.CSSProperties = {
  opacity: 0.4,
  fontSize: "0.7rem",
};
