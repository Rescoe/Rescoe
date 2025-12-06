import * as THREE from 'three';
import { useRef, useState } from 'react';
import { useGLTF, Environment } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';

function Banana({ index, z, speed }) {
  const ref = useRef();
  const { viewport } = useThree();           // <<< FIX
  const { width, height } = viewport;        // <<< FIX

  const { scene } = useGLTF('/StagBeetle.glb');

  const [data] = useState({
    y: THREE.MathUtils.randFloatSpread(height * 2),
    x: THREE.MathUtils.randFloatSpread(2),
    spin: THREE.MathUtils.randFloat(8, 12),
    rX: Math.random() * Math.PI,
    rZ: Math.random() * Math.PI,
  });

  useFrame((state, dt) => {
    if (!ref.current) return;

    ref.current.position.set(
      index === 0 ? 0 : data.x * width,
      (data.y += dt * speed),
      -z
    );

    ref.current.rotation.set(
      (data.rX += dt / data.spin),
      Math.sin(index * 1000 + state.clock.elapsedTime / 10) * Math.PI,
      (data.rZ += dt / data.spin)
    );

    ref.current.scale.set(0.1, 0.1, 0.2);

    if (data.y > height * (index === 0 ? 4 : 1)) {
      data.y = -height * (index === 0 ? 4 : 1);
    }
  });

  return <primitive ref={ref} object={scene} />;
}

export default function Bananas({
  count = 30,
  depth = 80,
  easing = (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
}) {
  const speed = 5;

  return (
    <>
      {/* <<< FIX: garder comme ça */}
      <ambientLight intensity={0.5} color="orange" />

      {Array.from({ length: Math.min(count, 30) }, (_, i) => (
        <Banana
          key={i}
          index={i}
          z={Math.round(easing(i / count) * depth + 20)}
          speed={speed}
        />
      ))}

      {/* <<< FIX: preset sunset OK, background désactivé pour éviter erreur */}
      <Environment preset="sunset" background={false} />
    </>
  );
}
