'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  MeshTransmissionMaterial,
  Float,
  Environment,
} from '@react-three/drei';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export type ShapeType =
  | 'torus'
  | 'icosahedron'
  | 'octahedron'
  | 'dodecahedron'
  | 'torusKnot'
  | 'sphere'
  | 'capsule'
  | 'custom';

export interface FloatingShapeConfig {
  type: ShapeType;
  position: [number, number, number];
  scale?: number;
  color?: string;
  rotationSpeed?: [number, number, number];
  floatIntensity?: number;
  floatSpeed?: number;
}

export interface FloatingShapesProps {
  /** Predefined shape configurations */
  shapes?: FloatingShapeConfig[];
  /** Number of random shapes (if shapes not provided) */
  count?: number;
  /** Spread area for random shapes */
  spread?: [number, number, number];
  /** Glass material settings */
  glassSettings?: {
    thickness?: number;
    roughness?: number;
    transmission?: number;
    ior?: number;
    chromaticAberration?: number;
  };
  /** Enable shadows */
  shadows?: boolean;
  /** Background color for environment */
  environmentColor?: string;
  /** Environment preset */
  environmentPreset?: 'city' | 'dawn' | 'forest' | 'night' | 'studio' | 'sunset';
  /** Color palette for random shapes */
  colors?: string[];
  /** Reduced motion mode */
  reducedMotion?: boolean;
}

// =============================================================================
// Single Floating Shape Component
// =============================================================================

interface SingleShapeProps {
  config: FloatingShapeConfig;
  glassSettings: NonNullable<FloatingShapesProps['glassSettings']>;
  shadows: boolean;
  reducedMotion: boolean;
}

const SingleShape: React.FC<SingleShapeProps> = ({
  config,
  glassSettings,
  shadows,
  reducedMotion,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const {
    type,
    position,
    scale = 1,
    color = '#ffffff',
    rotationSpeed = [0.01, 0.01, 0.01],
    floatIntensity = 1,
    floatSpeed = 1,
  } = config;

  // Create geometry based on type
  const geometry = useMemo(() => {
    switch (type) {
      case 'torus':
        return new THREE.TorusGeometry(1, 0.4, 32, 64);
      case 'icosahedron':
        return new THREE.IcosahedronGeometry(1, 1);
      case 'octahedron':
        return new THREE.OctahedronGeometry(1, 0);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(1, 0);
      case 'torusKnot':
        return new THREE.TorusKnotGeometry(0.8, 0.25, 128, 16);
      case 'sphere':
        return new THREE.SphereGeometry(1, 32, 32);
      case 'capsule':
        return new THREE.CapsuleGeometry(0.5, 1, 8, 16);
      case 'custom':
        // Custom blob-like shape
        const geo = new THREE.IcosahedronGeometry(1, 3);
        const positions = geo.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          const noise =
            Math.sin(positions[i] * 2) * 0.15 +
            Math.cos(positions[i + 1] * 3) * 0.1;
          const factor = 1 + noise;
          positions[i] *= factor;
          positions[i + 1] *= factor;
          positions[i + 2] *= factor;
        }
        geo.computeVertexNormals();
        return geo;
      default:
        return new THREE.SphereGeometry(1, 32, 32);
    }
  }, [type]);

  // Animation
  useFrame(() => {
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.x += rotationSpeed[0];
      meshRef.current.rotation.y += rotationSpeed[1];
      meshRef.current.rotation.z += rotationSpeed[2];
    }
  });

  const adjustedFloatIntensity = reducedMotion ? floatIntensity * 0.3 : floatIntensity;
  const adjustedFloatSpeed = reducedMotion ? floatSpeed * 0.5 : floatSpeed;

  return (
    <Float
      speed={adjustedFloatSpeed}
      rotationIntensity={reducedMotion ? 0 : 0.5}
      floatIntensity={adjustedFloatIntensity}
    >
      <mesh
        ref={meshRef}
        position={position}
        scale={scale}
        castShadow={shadows}
        receiveShadow={shadows}
        geometry={geometry}
      >
        <MeshTransmissionMaterial
          color={color}
          thickness={glassSettings.thickness}
          roughness={glassSettings.roughness}
          transmission={glassSettings.transmission}
          ior={glassSettings.ior}
          chromaticAberration={glassSettings.chromaticAberration}
          backside
          backsideThickness={0.3}
          samples={reducedMotion ? 4 : 8}
          resolution={reducedMotion ? 128 : 256}
        />
      </mesh>
    </Float>
  );
};

// =============================================================================
// Generate Random Shapes
// =============================================================================

const generateRandomShapes = (
  count: number,
  spread: [number, number, number],
  colors: string[]
): FloatingShapeConfig[] => {
  const shapeTypes: ShapeType[] = [
    'torus',
    'icosahedron',
    'octahedron',
    'dodecahedron',
    'torusKnot',
    'sphere',
    'capsule',
    'custom',
  ];

  return Array.from({ length: count }, () => ({
    type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
    position: [
      (Math.random() - 0.5) * spread[0],
      (Math.random() - 0.5) * spread[1],
      (Math.random() - 0.5) * spread[2],
    ] as [number, number, number],
    scale: 0.3 + Math.random() * 0.7,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotationSpeed: [
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.02,
    ] as [number, number, number],
    floatIntensity: 0.5 + Math.random() * 1.5,
    floatSpeed: 0.5 + Math.random() * 1.5,
  }));
};

// =============================================================================
// Lighting Component
// =============================================================================

interface LightingProps {
  shadows: boolean;
}

const Lighting: React.FC<LightingProps> = ({ shadows }) => (
  <>
    <ambientLight intensity={0.3} />
    <directionalLight
      position={[10, 10, 5]}
      intensity={1}
      castShadow={shadows}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-far={50}
      shadow-camera-left={-10}
      shadow-camera-right={10}
      shadow-camera-top={10}
      shadow-camera-bottom={-10}
    />
    <pointLight position={[-5, 5, -5]} intensity={0.5} color="#4ecdc4" />
    <pointLight position={[5, -5, 5]} intensity={0.3} color="#ff6b6b" />
  </>
);

// =============================================================================
// Main FloatingShapes Component
// =============================================================================

export const FloatingShapes: React.FC<FloatingShapesProps> = ({
  shapes,
  count = 8,
  spread = [15, 10, 8],
  glassSettings = {
    thickness: 0.5,
    roughness: 0.1,
    transmission: 0.95,
    ior: 1.5,
    chromaticAberration: 0.03,
  },
  shadows = true,
  environmentPreset = 'city',
  colors = [
    '#ff6b6b',
    '#4ecdc4',
    '#45b7d1',
    '#f9ca24',
    '#6c5ce7',
    '#ffffff',
    '#a8e6cf',
  ],
  reducedMotion = false,
}) => {
  // Use provided shapes or generate random ones
  const shapeConfigs = useMemo(() => {
    if (shapes && shapes.length > 0) {
      return shapes;
    }
    return generateRandomShapes(count, spread, colors);
  }, [shapes, count, spread, colors]);

  // Merge glass settings with defaults
  const mergedGlassSettings = useMemo(
    () => ({
      thickness: glassSettings.thickness ?? 0.5,
      roughness: glassSettings.roughness ?? 0.1,
      transmission: glassSettings.transmission ?? 0.95,
      ior: glassSettings.ior ?? 1.5,
      chromaticAberration: glassSettings.chromaticAberration ?? 0.03,
    }),
    [glassSettings]
  );

  return (
    <group>
      {/* Environment for reflections */}
      <Environment preset={environmentPreset} />

      {/* Lighting */}
      <Lighting shadows={shadows} />

      {/* Render shapes */}
      {shapeConfigs.map((config, index) => (
        <SingleShape
          key={index}
          config={config}
          glassSettings={mergedGlassSettings}
          shadows={shadows}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Optional ground plane for shadows */}
      {shadows && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -5, 0]}
          receiveShadow
        >
          <planeGeometry args={[50, 50]} />
          <shadowMaterial opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

// =============================================================================
// Preset Configurations
// =============================================================================

export const FloatingShapesPresets = {
  minimal: {
    count: 5,
    glassSettings: {
      transmission: 0.98,
      roughness: 0.05,
    },
    colors: ['#ffffff', '#f0f0f0', '#e0e0e0'],
  },
  colorful: {
    count: 12,
    glassSettings: {
      transmission: 0.9,
      chromaticAberration: 0.05,
    },
    colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a8e6cf'],
  },
  ethereal: {
    count: 8,
    glassSettings: {
      transmission: 0.95,
      roughness: 0.2,
      ior: 1.8,
    },
    colors: ['#e8daef', '#d5d8dc', '#aed6f1', '#fadbd8'],
  },
};

export default FloatingShapes;
