'use client';

import React, {
  useRef,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Html,
  Line,
  Text,
} from '@react-three/drei';
import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface Venue {
  id: string;
  name: string;
  type: 'gallery' | 'museum' | 'studio' | 'event' | 'other';
  coordinates: {
    lat: number;
    lng: number;
  };
  address?: string;
  description?: string;
  currentExhibit?: string;
  image?: string;
}

export interface VenueConnection {
  from: string;
  to: string;
  type?: 'collaboration' | 'tour' | 'exchange';
}

export interface ArtMapGlobeProps {
  venues: Venue[];
  connections?: VenueConnection[];
  onVenueClick?: (venue: Venue) => void;
  onVenueHover?: (venue: Venue | null) => void;
  mapStyle?: 'minimal' | 'detailed' | 'neon';
  markerSize?: number;
  showLabels?: boolean;
  enableZoom?: boolean;
  initialZoom?: number;
  centerCoordinates?: { lat: number; lng: number };
  animateConnections?: boolean;
  mapColors?: {
    background?: string;
    grid?: string;
    marker?: Record<Venue['type'], string>;
    connection?: string;
    hover?: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_COLORS = {
  background: '#1a1a2e',
  grid: '#2a2a4e',
  marker: {
    gallery: '#ff6b6b',
    museum: '#4ecdc4',
    studio: '#f9ca24',
    event: '#6c5ce7',
    other: '#a8e6cf',
  },
  connection: '#ffffff',
  hover: '#ffffff',
};

// Map dimensions (stylized flat map representation)
const MAP_WIDTH = 20;
const MAP_HEIGHT = 12;

// =============================================================================
// Coordinate Conversion
// =============================================================================

const latLngToMapPosition = (
  lat: number,
  lng: number,
  width: number = MAP_WIDTH,
  height: number = MAP_HEIGHT
): [number, number, number] => {
  // Convert lat/lng to x/y on a flat plane
  // Longitude: -180 to 180 -> -width/2 to width/2
  // Latitude: -90 to 90 -> -height/2 to height/2
  const x = (lng / 180) * (width / 2);
  const y = (lat / 90) * (height / 2);
  return [x, y, 0];
};

// =============================================================================
// Map Grid Component
// =============================================================================

interface MapGridProps {
  width: number;
  height: number;
  gridColor: string;
  style: 'minimal' | 'detailed' | 'neon';
}

const MapGrid: React.FC<MapGridProps> = ({
  width,
  height,
  gridColor,
  style,
}) => {
  const gridLines = useMemo(() => {
    const lines: Array<{ points: THREE.Vector3[]; opacity: number }> = [];
    const divisions = style === 'detailed' ? 20 : style === 'neon' ? 15 : 10;

    // Horizontal lines
    for (let i = 0; i <= divisions; i++) {
      const y = (i / divisions - 0.5) * height;
      const opacity = i === divisions / 2 ? 0.5 : 0.2;
      lines.push({
        points: [
          new THREE.Vector3(-width / 2, y, -0.01),
          new THREE.Vector3(width / 2, y, -0.01),
        ],
        opacity,
      });
    }

    // Vertical lines
    for (let i = 0; i <= divisions; i++) {
      const x = (i / divisions - 0.5) * width;
      const opacity = i === divisions / 2 ? 0.5 : 0.2;
      lines.push({
        points: [
          new THREE.Vector3(x, -height / 2, -0.01),
          new THREE.Vector3(x, height / 2, -0.01),
        ],
        opacity,
      });
    }

    return lines;
  }, [width, height, style]);

  return (
    <group>
      {/* Background plane */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 1, height + 1]} />
        <meshBasicMaterial color="#0a0a1e" transparent opacity={0.9} />
      </mesh>

      {/* Grid lines */}
      {gridLines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color={gridColor}
          lineWidth={style === 'neon' ? 1.5 : 1}
          transparent
          opacity={line.opacity}
        />
      ))}

      {/* Outer border */}
      <Line
        points={[
          new THREE.Vector3(-width / 2, -height / 2, 0),
          new THREE.Vector3(width / 2, -height / 2, 0),
          new THREE.Vector3(width / 2, height / 2, 0),
          new THREE.Vector3(-width / 2, height / 2, 0),
          new THREE.Vector3(-width / 2, -height / 2, 0),
        ]}
        color={gridColor}
        lineWidth={2}
        transparent
        opacity={0.6}
      />
    </group>
  );
};

// =============================================================================
// Venue Marker Component
// =============================================================================

interface VenueMarkerProps {
  venue: Venue;
  position: [number, number, number];
  color: string;
  hoverColor: string;
  size: number;
  showLabel: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (isHovered: boolean) => void;
  style: 'minimal' | 'detailed' | 'neon';
}

const VenueMarker: React.FC<VenueMarkerProps> = ({
  venue,
  position,
  color,
  hoverColor,
  size,
  showLabel,
  isHovered,
  onClick,
  onHover,
  style,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);

  // Pulse animation for hovered marker
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const targetScale = isHovered ? 1.5 : 1;
      const currentScale = THREE.MathUtils.lerp(scale, targetScale, 0.1);
      setScale(currentScale);
      meshRef.current.scale.setScalar(currentScale);
    }

    if (ringRef.current && isHovered) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.2;
      ringRef.current.scale.setScalar(pulse * 2);
    }
  });

  const markerColor = isHovered ? hoverColor : color;

  return (
    <group position={position}>
      {/* Glow ring for neon style or hover */}
      {(style === 'neon' || isHovered) && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.5, size * 2, 32]} />
          <meshBasicMaterial
            color={markerColor}
            transparent
            opacity={isHovered ? 0.4 : 0.2}
          />
        </mesh>
      )}

      {/* Main marker */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerEnter={() => {
          onHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerLeave={() => {
          onHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={markerColor}
          emissive={markerColor}
          emissiveIntensity={style === 'neon' ? 0.5 : 0.2}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Vertical line from marker */}
      <Line
        points={[
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, size * 2),
        ]}
        color={markerColor}
        lineWidth={1}
        transparent
        opacity={0.5}
      />

      {/* Label */}
      {(showLabel || isHovered) && (
        <Text
          position={[0, size * 3.5, 0]}
          fontSize={size * 2}
          color={isHovered ? hoverColor : '#ffffff'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {venue.name}
        </Text>
      )}

      {/* Hover info card */}
      {isHovered && (
        <Html
          position={[size * 4, size * 2, 0]}
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${markerColor}`,
            color: 'white',
            minWidth: '200px',
            pointerEvents: 'none',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: markerColor }}>
            {venue.name}
          </div>
          <div
            style={{
              fontSize: '0.75em',
              textTransform: 'uppercase',
              opacity: 0.7,
              marginBottom: 8,
            }}
          >
            {venue.type}
          </div>
          {venue.address && (
            <div style={{ fontSize: '0.85em', marginBottom: 4 }}>
              {venue.address}
            </div>
          )}
          {venue.currentExhibit && (
            <div style={{ fontSize: '0.85em', fontStyle: 'italic', opacity: 0.8 }}>
              Now showing: {venue.currentExhibit}
            </div>
          )}
        </Html>
      )}
    </group>
  );
};

// =============================================================================
// Connection Line Component
// =============================================================================

interface ConnectionLineProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  animated: boolean;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  from,
  to,
  color,
  animated,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const [dashOffset, setDashOffset] = useState(0);

  // Create curved path between points
  const curvePoints = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .setZ(Math.max(1, start.distanceTo(end) * 0.2));

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(50);
  }, [from, to]);

  // Animation
  useFrame(() => {
    if (animated) {
      setDashOffset((prev) => prev + 0.01);
    }
  });

  return (
    <Line
      points={curvePoints}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.4}
      dashed={animated}
      dashScale={10}
      dashSize={0.5}
      dashOffset={dashOffset}
    />
  );
};

// =============================================================================
// Main ArtMapGlobe Component
// =============================================================================

export const ArtMapGlobe: React.FC<ArtMapGlobeProps> = ({
  venues,
  connections = [],
  onVenueClick,
  onVenueHover,
  mapStyle = 'minimal',
  markerSize = 0.15,
  showLabels = false,
  enableZoom = true,
  initialZoom = 10,
  centerCoordinates,
  animateConnections = true,
  mapColors = {},
}) => {
  const [hoveredVenue, setHoveredVenue] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Merge colors with defaults
  const colors = useMemo(
    () => ({
      background: mapColors.background || DEFAULT_COLORS.background,
      grid: mapColors.grid || DEFAULT_COLORS.grid,
      marker: { ...DEFAULT_COLORS.marker, ...mapColors.marker },
      connection: mapColors.connection || DEFAULT_COLORS.connection,
      hover: mapColors.hover || DEFAULT_COLORS.hover,
    }),
    [mapColors]
  );

  // Calculate venue positions
  const venuePositions = useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    venues.forEach((venue) => {
      positions[venue.id] = latLngToMapPosition(
        venue.coordinates.lat,
        venue.coordinates.lng
      );
    });
    return positions;
  }, [venues]);

  // Center camera on coordinates if provided
  useEffect(() => {
    if (centerCoordinates && controlsRef.current) {
      const [x, y] = latLngToMapPosition(
        centerCoordinates.lat,
        centerCoordinates.lng
      );
      controlsRef.current.target.set(x, y, 0);
      camera.position.set(x, y, initialZoom);
    }
  }, [centerCoordinates, initialZoom, camera]);

  // Handle venue hover
  const handleVenueHover = useCallback(
    (venue: Venue, isHovered: boolean) => {
      setHoveredVenue(isHovered ? venue.id : null);
      onVenueHover?.(isHovered ? venue : null);
    },
    [onVenueHover]
  );

  // Handle venue click with camera zoom
  const handleVenueClick = useCallback(
    (venue: Venue) => {
      onVenueClick?.(venue);

      // Animate camera to venue
      if (controlsRef.current) {
        const [x, y] = venuePositions[venue.id];
        // Smooth zoom would need gsap or custom animation
        controlsRef.current.target.set(x, y, 0);
      }
    },
    [onVenueClick, venuePositions]
  );

  return (
    <group>
      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        enableRotate={false}
        enablePan
        enableZoom={enableZoom}
        minDistance={3}
        maxDistance={25}
        panSpeed={0.5}
        zoomSpeed={0.5}
        dampingFactor={0.1}
        enableDamping
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={0.5} />

      {/* Map grid */}
      <MapGrid
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        gridColor={colors.grid}
        style={mapStyle}
      />

      {/* Connection lines */}
      {connections.map((connection, index) => {
        const fromPos = venuePositions[connection.from];
        const toPos = venuePositions[connection.to];

        if (!fromPos || !toPos) return null;

        return (
          <ConnectionLine
            key={`connection-${index}`}
            from={fromPos}
            to={toPos}
            color={colors.connection}
            animated={animateConnections}
          />
        );
      })}

      {/* Venue markers */}
      {venues.map((venue) => {
        const position = venuePositions[venue.id];
        if (!position) return null;

        return (
          <VenueMarker
            key={venue.id}
            venue={venue}
            position={position}
            color={colors.marker[venue.type]}
            hoverColor={colors.hover}
            size={markerSize}
            showLabel={showLabels}
            isHovered={hoveredVenue === venue.id}
            onClick={() => handleVenueClick(venue)}
            onHover={(isHovered) => handleVenueHover(venue, isHovered)}
            style={mapStyle}
          />
        );
      })}

      {/* Legend */}
      <Html
        position={[-MAP_WIDTH / 2 + 1, -MAP_HEIGHT / 2 + 1, 0]}
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '10px',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ marginBottom: 4, fontWeight: 600 }}>Venues</div>
        {Object.entries(colors.marker).map(([type, color]) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </Html>
    </group>
  );
};

export default ArtMapGlobe;
