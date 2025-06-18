import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import components
const HeroSection = dynamic(() => import("./HeroSection"), { ssr: false });
const DynamicCarousel = dynamic(() => import("./DynamicCarousel"), { ssr: false });

const Loading = ({ onFinish }: { onFinish?: () => void }) => {
  const [visible, setVisible] = useState(true);
  const insectCount = 40;

  useEffect(() => {
    const timeout = setTimeout(async () => {
      await Promise.all([HeroSection, DynamicCarousel]);
      setVisible(false);
      if (onFinish) onFinish();
    }, 4000);

    for (let i = 0; i < insectCount; i++) {
      createFirefly();
    }

    return () => clearTimeout(timeout);
  }, []);

  const createFirefly = () => {
    const firefly = document.createElement("div");
    firefly.className = "firefly";
    document.body.appendChild(firefly);
    animateFirefly(firefly);
  };

  const animateFirefly = (firefly: HTMLDivElement) => {
    const move = () => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      const scale = 0.5 + Math.random() * 1.2;

      firefly.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      firefly.style.opacity = `${0.4 + Math.random() * 0.5}`;
    };

    move();
    const interval = setInterval(move, 1000 + Math.random() * 1500);

    setTimeout(() => {
      clearInterval(interval);
      firefly.remove();
    }, 4000);
  };

  if (!visible) return null;

  return (
    <div className="loader-overlay">
      <div className="loader-text">Les insectes s'activent...</div>
      <style jsx>{`
        .loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          width: 100%;
          height: 100%;
          background: linear-gradient(160deg, #0f0f23, #1a1a2f, #0d0d1b);
          animation: pulseBG 6s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .loader-text {
          position: absolute;
          bottom: 8%;
          font-size: 1.5rem;
          color: #f0e6ff;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          animation: waveText 3s ease-in-out infinite;
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }

        @keyframes pulseBG {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes waveText {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        .firefly {
          position: absolute;
          width: 8px;
          height: 8px;
          background: rgba(255, 255, 200, 0.85);
          border-radius: 50%;
          pointer-events: none;
          filter: blur(1px);
          box-shadow: 0 0 12px rgba(255, 255, 150, 0.9), 0 0 20px rgba(255, 255, 150, 0.7);
          transition: transform 1.8s ease-in-out, opacity 1.8s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Loading;
