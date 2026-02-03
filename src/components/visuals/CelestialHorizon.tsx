import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface HemisphereProps {
  isWarping?: boolean;
}

// Check if WebGL is available
const isWebGLAvailable = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  } catch {
    return false;
  }
};

const Hemisphere = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.1;
    meshRef.current.position.y = Math.sin(t * 0.5) * 0.1 - 2.5;
  });

  return (
    <group>
      <mesh ref={meshRef} position={[0, -2.5, 0]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[3, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial 
          color="#00f2ff" 
          wireframe 
          transparent 
          opacity={0.3} 
        />
      </mesh>

      <Sphere args={[1.5, 32, 32]} position={[0, -2, 0]}>
        <MeshDistortMaterial 
          color="#14b8a6" 
          transparent 
          opacity={0.15} 
          distort={0.4} 
          speed={2} 
        />
      </Sphere>
    </group>
  );
};

const DataStream = ({ isActive }: { isActive: boolean }) => {
  const points = useRef<THREE.Points>(null);
  const count = 800;
  
  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = -20;
    }
    return pos;
  }, []);

  useFrame(() => {
    if (!points.current) return;
    const material = points.current.material as THREE.PointsMaterial;
    
    if (!isActive) {
      material.opacity = Math.max(0, material.opacity - 0.02);
      return;
    }

    material.opacity = Math.min(0.8, material.opacity + 0.05);
    const posArray = points.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      posArray[i * 3 + 2] += 0.5;
      if (posArray[i * 3 + 2] > 5) {
        posArray[i * 3 + 2] = -20;
        posArray[i * 3] = (Math.random() - 0.5) * 10;
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 10;
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.05} 
        color="#00f2ff" 
        transparent 
        opacity={0} 
        sizeAttenuation 
      />
    </points>
  );
};

// CSS-only fallback for devices without WebGL
const CSSFallback = () => (
  <div className="fixed inset-0 z-0 pointer-events-none bg-[#0b0b0d] overflow-hidden">
    {/* Animated gradient orb */}
    <div 
      className="absolute left-1/2 bottom-1/4 -translate-x-1/2 w-[500px] h-[250px] rounded-full opacity-20"
      style={{
        background: 'radial-gradient(ellipse at center, #14b8a6 0%, #00f2ff 30%, transparent 70%)',
        animation: 'pulse 4s ease-in-out infinite',
        filter: 'blur(40px)',
      }}
    />
    
    {/* Static stars */}
    <div className="absolute inset-0">
      {[...Array(100)].map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
    
    <style>{`
      @keyframes pulse {
        0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.2; }
        50% { transform: translateX(-50%) scale(1.1); opacity: 0.3; }
      }
      @keyframes twinkle {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.7; }
      }
    `}</style>
  </div>
);

export const CelestialHorizon = ({ isWarping = false }: HemisphereProps) => {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  // Show nothing during check
  if (webglAvailable === null) {
    return <div className="fixed inset-0 z-0 pointer-events-none bg-[#0b0b0d]" />;
  }

  // Use CSS fallback if WebGL not available or if Canvas errored
  if (!webglAvailable || hasError) {
    return <CSSFallback />;
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 1, 6], fov: 60 }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color('#0b0b0d');
        }}
        gl={{ 
          antialias: false, 
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false, // Don't throw, just degrade gracefully
        }}
        dpr={[1, 1.5]}
        onError={() => setHasError(true)}
      >
        <group rotation={[-0.2, 0, 0]}>
          <ambientLight intensity={0.2} />
          <pointLight position={[0, 5, 5]} intensity={0.5} color="#14b8a6" />
          
          <Stars 
            radius={50} 
            depth={50} 
            count={1500}
            factor={4} 
            saturation={0} 
            fade 
            speed={0.5} 
          />
          
          <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
            <Hemisphere />
          </Float>
          
          <DataStream isActive={isWarping} />
          
          <fog attach="fog" args={['#0b0b0d', 5, 30]} />
        </group>
      </Canvas>
    </div>
  );
};

export default CelestialHorizon;
