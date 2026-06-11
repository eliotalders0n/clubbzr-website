'use client';

import React, {
  useRef,
  useMemo,
  useState,
  useCallback,
  Suspense,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useTexture,
  OrbitControls,
  PerspectiveCamera,
  Environment,
  ContactShadows,
  Html,
} from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  SSAO,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface Artwork {
  id: string;
  src: string;
  title: string;
  artist: string;
  description?: string;
  width?: number;
  height?: number;
}

export interface GalleryLayout {
  type: 'linear' | 'circular' | 'grid' | 'custom';
  spacing?: number;
  radius?: number;
  columns?: number;
  positions?: Array<[number, number, number]>;
  rotations?: Array<[number, number, number]>;
}

export interface GallerySceneProps {
  artworks: Artwork[];
  layout?: GalleryLayout;
  cameraMode?: 'orbit' | 'walkthrough';
  enableAO?: boolean;
  enableBloom?: boolean;
  floorColor?: string;
  wallColor?: string;
  ambientIntensity?: number;
  spotlightIntensity?: number;
  onArtworkClick?: (artwork: Artwork) => void;
  onArtworkHover?: (artwork: Artwork | null) => void;
  frameColor?: string;
  frameDepth?: number;
  showInfo?: boolean;
}

// =============================================================================
// Artwork Frame Component
// =============================================================================

interface ArtworkFrameProps {
  artwork: Artwork;
  position: [number, number, number];
  rotation?: [number, number, number];
  frameColor: string;
  frameDepth: number;
  spotlightIntensity: number;
  onClick?: () => void;
  onHover?: (isHovered: boolean) => void;
  showInfo: boolean;
}

const ArtworkFrame: React.FC<ArtworkFrameProps> = ({
  artwork,
  position,
  rotation = [0, 0, 0],
  frameColor,
  frameDepth,
  spotlightIntensity,
  onClick,
  onHover,
  showInfo,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Default dimensions
  const artWidth = artwork.width || 1.5;
  const artHeight = artwork.height || 1;
  const frameThickness = 0.05;

  // Load texture
  const texture = useTexture(artwork.src, (tex) => {
    setImageLoaded(true);
    // Adjust dimensions based on actual image aspect ratio
    if (tex.image) {
      const aspectRatio = (tex.image as HTMLImageElement).width / (tex.image as HTMLImageElement).height;
      // We could update dimensions here if needed
    }
  });

  // Handle hover
  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    onHover?.(true);
    document.body.style.cursor = 'pointer';
  }, [onHover]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    onHover?.(false);
    document.body.style.cursor = 'auto';
  }, [onHover]);

  // Hover animation
  useFrame(() => {
    if (groupRef.current) {
      const targetZ = isHovered ? 0.1 : 0;
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        0.1
      );
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Spotlight for artwork */}
      <spotLight
        position={[0, 2, 2]}
        angle={0.4}
        penumbra={0.5}
        intensity={spotlightIntensity}
        target-position={[0, 0, 0]}
        castShadow
        shadow-mapSize={[512, 512]}
      />

      <group
        ref={groupRef}
        onClick={onClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {/* Frame */}
        <mesh castShadow receiveShadow>
          <boxGeometry
            args={[
              artWidth + frameThickness * 2,
              artHeight + frameThickness * 2,
              frameDepth,
            ]}
          />
          <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Canvas backing */}
        <mesh position={[0, 0, frameDepth / 2 - 0.01]}>
          <planeGeometry args={[artWidth, artHeight]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>

        {/* Artwork image */}
        <mesh position={[0, 0, frameDepth / 2 + 0.001]}>
          <planeGeometry args={[artWidth, artHeight]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.1}
            metalness={0}
          />
        </mesh>

        {/* Info label on hover */}
        {showInfo && isHovered && (
          <Html
            position={[0, -(artHeight / 2 + 0.3), 0]}
            center
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              padding: '12px 16px',
              borderRadius: '4px',
              color: 'white',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {artwork.title}
            </div>
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>
              {artwork.artist}
            </div>
          </Html>
        )}
      </group>
    </group>
  );
};

// =============================================================================
// Gallery Room Component
// =============================================================================

interface GalleryRoomProps {
  floorColor: string;
  wallColor: string;
  size?: [number, number, number];
}

const GalleryRoom: React.FC<GalleryRoomProps> = ({
  floorColor,
  wallColor,
  size = [30, 8, 30],
}) => {
  const [width, height, depth] = size;

  return (
    <group>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, height / 2, -depth / 2]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>

      {/* Front wall (with gap for entry) */}
      <mesh position={[-width / 4 - 1.5, height / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width / 2 - 3, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh position={[width / 4 + 1.5, height / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width / 2 - 3, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>

      {/* Side walls */}
      <mesh
        position={[-width / 2, height / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
      <mesh
        position={[width / 2, height / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>
    </group>
  );
};

// =============================================================================
// Layout Calculators
// =============================================================================

const calculateLinearLayout = (
  count: number,
  spacing: number
): Array<{ position: [number, number, number]; rotation: [number, number, number] }> => {
  const positions = [];
  const startX = -((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    positions.push({
      position: [startX + i * spacing, 1.5, -5] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    });
  }

  return positions;
};

const calculateCircularLayout = (
  count: number,
  radius: number
): Array<{ position: [number, number, number]; rotation: [number, number, number] }> => {
  const positions = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    const rotationY = -angle + Math.PI;

    positions.push({
      position: [x, 1.5, z] as [number, number, number],
      rotation: [0, rotationY, 0] as [number, number, number],
    });
  }

  return positions;
};

const calculateGridLayout = (
  count: number,
  columns: number,
  spacing: number
): Array<{ position: [number, number, number]; rotation: [number, number, number] }> => {
  const positions = [];
  const rows = Math.ceil(count / columns);
  const startX = -((columns - 1) * spacing) / 2;
  const startZ = -((rows - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);

    // Alternate between front and back walls
    const isBackWall = row % 2 === 0;

    positions.push({
      position: [
        startX + col * spacing,
        1.5,
        isBackWall ? -8 : 8,
      ] as [number, number, number],
      rotation: [0, isBackWall ? 0 : Math.PI, 0] as [number, number, number],
    });
  }

  return positions;
};

// =============================================================================
// Camera Controls
// =============================================================================

interface CameraControlsProps {
  mode: 'orbit' | 'walkthrough';
}

const CameraControls: React.FC<CameraControlsProps> = ({ mode }) => {
  if (mode === 'orbit') {
    return (
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={20}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
        target={[0, 1.5, 0]}
      />
    );
  }

  // Walkthrough mode uses first-person controls
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      minDistance={0.1}
      maxDistance={0.1}
      enableZoom={false}
      target={[0, 1.5, 0]}
    />
  );
};

// =============================================================================
// Lighting Setup
// =============================================================================

interface LightingProps {
  ambientIntensity: number;
}

const Lighting: React.FC<LightingProps> = ({ ambientIntensity }) => (
  <>
    <ambientLight intensity={ambientIntensity} />
    <directionalLight
      position={[5, 10, 5]}
      intensity={0.5}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-far={50}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
    />
    {/* Gallery track lighting */}
    <pointLight position={[0, 7, 0]} intensity={0.3} decay={2} />
    <pointLight position={[-8, 7, -5]} intensity={0.2} decay={2} />
    <pointLight position={[8, 7, -5]} intensity={0.2} decay={2} />
  </>
);

// =============================================================================
// Post-Processing Effects
// =============================================================================

interface EffectsProps {
  enableAO: boolean;
  enableBloom: boolean;
}

const Effects: React.FC<EffectsProps> = ({ enableAO, enableBloom }) => (
  <EffectComposer>
    {enableAO && (
      <SSAO
        samples={21}
        radius={0.1}
        intensity={20}
        luminanceInfluence={0.6}
        color={"black" as any}
      />
    )}
    {enableBloom && (
      <Bloom
        intensity={0.2}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.9}
      />
    )}
    <Vignette darkness={0.3} offset={0.3} />
  </EffectComposer>
);

// =============================================================================
// Main GalleryScene Component
// =============================================================================

export const GalleryScene: React.FC<GallerySceneProps> = ({
  artworks,
  layout = { type: 'linear', spacing: 3 },
  cameraMode = 'orbit',
  enableAO = true,
  enableBloom = false,
  floorColor = '#2a2a2a',
  wallColor = '#f5f5f5',
  ambientIntensity = 0.3,
  spotlightIntensity = 2,
  onArtworkClick,
  onArtworkHover,
  frameColor = '#1a1a1a',
  frameDepth = 0.08,
  showInfo = true,
}) => {
  const [hoveredArtwork, setHoveredArtwork] = useState<Artwork | null>(null);

  // Calculate artwork positions based on layout
  const artworkPositions = useMemo(() => {
    const count = artworks.length;

    switch (layout.type) {
      case 'linear':
        return calculateLinearLayout(count, layout.spacing || 3);
      case 'circular':
        return calculateCircularLayout(count, layout.radius || 8);
      case 'grid':
        return calculateGridLayout(count, layout.columns || 4, layout.spacing || 3);
      case 'custom':
        if (layout.positions) {
          return layout.positions.map((pos, i) => ({
            position: pos,
            rotation: layout.rotations?.[i] || ([0, 0, 0] as [number, number, number]),
          }));
        }
        return calculateLinearLayout(count, 3);
      default:
        return calculateLinearLayout(count, 3);
    }
  }, [artworks.length, layout]);

  // Handle artwork hover
  const handleArtworkHover = useCallback(
    (artwork: Artwork | null) => {
      setHoveredArtwork(artwork);
      onArtworkHover?.(artwork);
    },
    [onArtworkHover]
  );

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera
        makeDefault
        position={[0, 1.7, 8]}
        fov={60}
        near={0.1}
        far={100}
      />

      {/* Controls */}
      <CameraControls mode={cameraMode} />

      {/* Environment */}
      <Environment preset="city" background={false} />

      {/* Lighting */}
      <Lighting ambientIntensity={ambientIntensity} />

      {/* Gallery room */}
      <GalleryRoom floorColor={floorColor} wallColor={wallColor} />

      {/* Contact shadows on floor */}
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={40}
        blur={2}
        far={10}
      />

      {/* Artworks */}
      <Suspense fallback={null}>
        {artworks.map((artwork, index) => {
          const { position, rotation } = artworkPositions[index] || {
            position: [0, 1.5, 0] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number],
          };

          return (
            <ArtworkFrame
              key={artwork.id}
              artwork={artwork}
              position={position}
              rotation={rotation}
              frameColor={frameColor}
              frameDepth={frameDepth}
              spotlightIntensity={spotlightIntensity}
              onClick={() => onArtworkClick?.(artwork)}
              onHover={(isHovered) =>
                handleArtworkHover(isHovered ? artwork : null)
              }
              showInfo={showInfo}
            />
          );
        })}
      </Suspense>

      {/* Post-processing */}
      <Effects enableAO={enableAO} enableBloom={enableBloom} />
    </>
  );
};

export default GalleryScene;
