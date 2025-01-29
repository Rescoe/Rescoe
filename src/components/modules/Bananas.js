import * as THREE from 'three';
import { useRef, useState } from 'react';
import { useGLTF, Detailed, Environment } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';

function Banana({ index, z, speed }) {
  const ref = useRef();
  const { viewport, camera } = useThree();
  const { width, height } = viewport.getCurrentViewport(camera, [0, 0, -z]);
  const { nodes, materials } = useGLTF('/StagBeetle.glb');
  const [data] = useState({
    y: THREE.MathUtils.randFloatSpread(height * 2),
    x: THREE.MathUtils.randFloatSpread(2),
    spin: THREE.MathUtils.randFloat(8, 12),
    rX: Math.random() * Math.PI,
    rZ: Math.random() * Math.PI,
  });

  useFrame((state, dt) => {
    if (dt < 0.1) ref.current.position.set(index === 0 ? 0 : data.x * width, (data.y += dt * speed), -z);
    ref.current.rotation.set((data.rX += dt / data.spin), Math.sin(index * 1000 + state.clock.elapsedTime / 10) * Math.PI, (data.rZ += dt / data.spin));
    ref.current.scale.set(0.1, 0.1, 0.2); // Ajustez l'échelle ici pour réduire la taille

    if (data.y > height * (index === 0 ? 4 : 1)) data.y = -(height * (index === 0 ? 4 : 1));
  });

  return (
    <Detailed ref={ref} distances={[0, 80, 160]}>
      <mesh geometry={nodes.StagBeetle.geometry} material={materials.skin} receiveShadow={false} castShadow={false}>
        <meshStandardMaterial color="white" transparent={true} />
      </mesh>
    </Detailed>
  );
}

export default function Bananas({ count = 30, depth = 80, easing = (x) => Math.sqrt(1 - Math.pow(x - 1, 2)) }) {
  const speed = 5; // Définir la vitesse statique directement dans Bananas

  return (
    <>
      <ambientLight intensity={0.5} color="orange" />
      {Array.from({ length: Math.min(count, 30) }, (_, i) => (
        <Banana key={i} index={i} z={Math.round(easing(i / count) * depth + 20)} speed={speed} />
      ))}
      <Environment preset="sunset" />
    </>
  );
}
