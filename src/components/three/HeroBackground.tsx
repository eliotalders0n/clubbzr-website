'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, DepthOfField, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface HeroBackgroundProps {
  /** Number of particles */
  particleCount?: number;
  /** Brand colors for particles */
  colors?: string[];
  /** Mouse interaction radius */
  mouseRadius?: number;
  /** Enable depth of field effect */
  enableDOF?: boolean;
  /** Enable bloom effect */
  enableBloom?: boolean;
  /** Enable vignette effect */
  enableVignette?: boolean;
  /** Particle movement speed */
  speed?: number;
  /** Callback when scene is entering view */
  onEnter?: () => void;
  /** Callback when scene is leaving view */
  onLeave?: () => void;
  /** Reduce effects for performance */
  reducedMotion?: boolean;
}

// =============================================================================
// Organic Shape Generator
// =============================================================================

const createOrganicGeometry = (type: number): THREE.BufferGeometry => {
  switch (type % 5) {
    case 0:
      // Soft blob (deformed sphere)
      const blobGeo = new THREE.IcosahedronGeometry(1, 2);
      const blobPositions = blobGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < blobPositions.length; i += 3) {
        const noise = Math.sin(blobPositions[i] * 3) * 0.2 +
                      Math.cos(blobPositions[i + 1] * 2) * 0.15;
        blobPositions[i] *= 1 + noise;
        blobPositions[i + 1] *= 1 + noise * 0.8;
        blobPositions[i + 2] *= 1 + noise * 0.6;
      }
      blobGeo.computeVertexNormals();
      return blobGeo;

    case 1:
      // Pill shape
      return new THREE.CapsuleGeometry(0.5, 1, 4, 8);

    case 2:
      // Torus (donut)
      return new THREE.TorusGeometry(0.7, 0.3, 8, 16);

    case 3:
      // Octahedron
      return new THREE.OctahedronGeometry(1, 0);

    case 4:
      // Stretched sphere
      const stretchGeo = new THREE.SphereGeometry(1, 16, 8);
      stretchGeo.scale(0.6, 1.2, 0.6);
      return stretchGeo;

    default:
      return new THREE.SphereGeometry(1, 8, 8);
  }
};

// =============================================================================
// Instanced Particles Component
// =============================================================================

interface InstancedParticlesProps {
  count: number;
  colors: THREE.Color[];
  mouseRadius: number;
  speed: number;
  reducedMotion: boolean;
}

const InstancedParticles: React.FC<InstancedParticlesProps> = ({
  count,
  colors,
  mouseRadius,
  speed,
  reducedMotion,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const targetMouseRef = useRef(new THREE.Vector2(0, 0));
  const { viewport, size } = useThree();

  // Store particle data
  const particleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 10
        ),
        basePosition: new THREE.Vector3(),
        rotation: new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ),
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        scale: 0.05 + Math.random() * 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
        offset: Math.random() * Math.PI * 2,
        floatSpeed: 0.3 + Math.random() * 0.5,
        shapeType: Math.floor(Math.random() * 5),
      });
      data[i].basePosition.copy(data[i].position);
    }
    return data;
  }, [count, colors]);

  // Create geometries for different shapes
  const geometries = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => createOrganicGeometry(i));
  }, []);

  // Use the most common shape for instanced mesh (blob)
  const geometry = useMemo(() => geometries[0], [geometries]);

  // Mouse tracking with smooth interpolation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / size.width) * 2 - 1;
      const y = -(e.clientY / size.height) * 2 + 1;
      targetMouseRef.current.set(
        x * viewport.width * 0.5,
        y * viewport.height * 0.5
      );
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [viewport, size]);

  // Animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime() * speed;

    // Smooth mouse following
    mouseRef.current.lerp(targetMouseRef.current, 0.05);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    particleData.forEach((particle, i) => {
      // Update rotation (reduced if needed)
      if (!reducedMotion) {
        particle.rotation.x += particle.rotationSpeed.x;
        particle.rotation.y += particle.rotationSpeed.y;
        particle.rotation.z += particle.rotationSpeed.z;
      }

      // Floating motion
      const floatOffset = Math.sin(time * particle.floatSpeed + particle.offset);
      position.copy(particle.basePosition);
      position.y += floatOffset * 0.3;
      position.x += Math.sin(time * 0.2 + particle.offset) * 0.1;

      // Mouse repulsion
      const dx = position.x - mouseRef.current.x;
      const dy = position.y - mouseRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mouseRadius) {
        const force = (1 - dist / mouseRadius) * 2;
        const angle = Math.atan2(dy, dx);
        position.x += Math.cos(angle) * force;
        position.y += Math.sin(angle) * force;
      }

      // Scale with subtle breathing
      const breathScale = 1 + Math.sin(time * 0.5 + particle.offset) * 0.05;
      scale.setScalar(particle.scale * breathScale);

      // Build matrix
      rotation.setFromEuler(particle.rotation);
      matrix.compose(position, rotation, scale);
      meshRef.current!.setMatrixAt(i, matrix);

      // Set color
      meshRef.current!.setColorAt(i, particle.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        transparent
        opacity={0.85}
        roughness={0.3}
        metalness={0.1}
        vertexColors
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};

// =============================================================================
// Background Gradient Plane
// =============================================================================

const BackgroundGradient: React.FC<{ colors: string[] }> = ({ colors }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(colors[0] || '#1a1a2e') },
      uColor2: { value: new THREE.Color(colors[1] || '#16213e') },
      uColor3: { value: new THREE.Color(colors[2] || '#0f3460') },
    }),
    [colors]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh position={[0, 0, -8]}>
      <planeGeometry args={[50, 30]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform vec3 uColor3;
          varying vec2 vUv;

          void main() {
            float t = vUv.y + sin(vUv.x * 2.0 + uTime * 0.3) * 0.1;
            vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.5, t));
            color = mix(color, uColor3, smoothstep(0.5, 1.0, t));
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
};

// =============================================================================
// Lighting Setup
// =============================================================================

const Lighting: React.FC = () => (
  <>
    <ambientLight intensity={0.4} />
    <directionalLight
      position={[10, 10, 5]}
      intensity={0.8}
      color="#ffffff"
    />
    <pointLight position={[-10, -10, -5]} intensity={0.3} color="#6c5ce7" />
    <pointLight position={[10, -5, 5]} intensity={0.2} color="#ff6b6b" />
  </>
);

// =============================================================================
// Post-Processing Effects
// =============================================================================

interface EffectsProps {
  enableDOF: boolean;
  enableBloom: boolean;
  enableVignette: boolean;
}

const Effects: React.FC<EffectsProps> = ({
  enableDOF,
  enableBloom,
  enableVignette,
}) => (
  <EffectComposer>
    {enableDOF && (
      <DepthOfField
        focusDistance={0}
        focalLength={0.02}
        bokehScale={2}
        height={480}
      />
    )}
    {enableBloom && (
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    )}
    {enableVignette && <Vignette darkness={0.4} offset={0.3} />}
  </EffectComposer>
);

// =============================================================================
// Main HeroBackground Component
// =============================================================================

export const HeroBackground: React.FC<HeroBackgroundProps> = ({
  particleCount = 150,
  colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a8e6cf'],
  mouseRadius = 3,
  enableDOF = true,
  enableBloom = true,
  enableVignette = true,
  speed = 1,
  onEnter,
  onLeave,
  reducedMotion = false,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const groupRef = useRef<THREE.Group>(null);

  // Parse colors
  const parsedColors = useMemo(
    () => colors.map((c) => new THREE.Color(c)),
    [colors]
  );

  // Visibility callbacks
  useEffect(() => {
    if (isVisible) {
      onEnter?.();
    } else {
      onLeave?.();
    }
  }, [isVisible, onEnter, onLeave]);

  // Handle visibility transitions
  useFrame(() => {
    if (groupRef.current) {
      const targetOpacity = isVisible ? 1 : 0;
      const children = groupRef.current.children;
      children.forEach((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.05);
        }
      });
    }
  });

  // Adjust count for performance
  const adjustedCount = reducedMotion ? Math.floor(particleCount * 0.5) : particleCount;

  return (
    <group ref={groupRef}>
      {/* Background gradient */}
      <BackgroundGradient colors={colors.slice(0, 3)} />

      {/* Lighting */}
      <Lighting />

      {/* Main particle system */}
      <InstancedParticles
        count={adjustedCount}
        colors={parsedColors}
        mouseRadius={mouseRadius}
        speed={reducedMotion ? speed * 0.5 : speed}
        reducedMotion={reducedMotion}
      />

      {/* Post-processing (only if not reduced motion) */}
      {!reducedMotion && (
        <Effects
          enableDOF={enableDOF}
          enableBloom={enableBloom}
          enableVignette={enableVignette}
        />
      )}
    </group>
  );
};

export default HeroBackground;
